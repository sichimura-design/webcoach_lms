import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader, LearningBreadcrumb } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useMypageData } from '../hooks/useMypageData';
import { bffClient } from '../services/bffClient';
import { useScaleToFit } from '../hooks/useScaleToFit';
import { t } from '../theme/tokens';
import { LEARNING_HIERARCHY } from '../constants/learningTaxonomy';

const DESIGN_WIDTH = 1440;

interface CatalogCourse {
  id: number;
  title: string;
  description: string;
  categoryName: string;
  progress: number;
  totalLessons?: number;
  isCurrent: boolean;
}

interface LessonRow {
  id: number;
  name: string;
  done: boolean;
  current: boolean;
  minutes?: number;
}

const STATUS_LABELS = ['受講中', '未受講', '修了'] as const;
type StatusLabel = typeof STATUS_LABELS[number];

function statusOf(progress: number): StatusLabel {
  if (progress >= 100) return '修了';
  if (progress > 0) return '受講中';
  return '未受講';
}

function categoryColor(name?: string): string {
  switch (name) {
    case 'Webデザイン': return t.color.category.design;
    case 'コーディング': return t.color.category.coding;
    case 'マーケティング': return t.color.category.marketing;
    case 'キャリア': return t.color.category.career;
    default: return t.color.text.subtle;
  }
}

function chipStyle(active: boolean) {
  return active
    ? { background: t.color.primary, color: '#fff', border: `1px solid ${t.color.primary}`, borderRadius: t.radius.pill, padding: '9px 20px', fontSize: 12.5, fontWeight: t.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' as const }
    : { background: t.color.bg.card, border: `1px solid ${t.color.border.card}`, color: t.color.text.body, borderRadius: t.radius.pill, padding: '9px 20px', fontSize: 12.5, fontWeight: t.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' as const };
}

function MaterialsTopPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resumableCourse, activeCourses } = useMypageData(user?.userid);
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);

  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [remainingLessons, setRemainingLessons] = useState<LessonRow[]>([]);
  const [currentModuleId, setCurrentModuleId] = useState<number | undefined>();

  const [category, setCategory] = useState('すべて');
  const [status, setStatus] = useState<StatusLabel | null>(null);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(9);

  // コースカタログ（全コース）を取得し、自分の受講進捗をマージする
  useEffect(() => {
    let alive = true;
    bffClient.getCourses().then((raw: any[]) => {
      if (!alive) return;
      const list = Array.isArray(raw) ? raw : [];
      setCatalog(list.map((c) => {
        const enrolled = activeCourses.find((ac) => ac.id === c.id) || (resumableCourse?.id === c.id ? resumableCourse : undefined);
        return {
          id: c.id,
          title: c.fullname || c.displayname || '',
          description: c.summary || '',
          categoryName: c.categoryname || LEARNING_HIERARCHY.area,
          totalLessons: enrolled?.totalLessons,
          progress: enrolled?.progress ?? 0,
          isCurrent: resumableCourse?.id === c.id,
        };
      }));
    }).catch(() => setCatalog([]));
    return () => { alive = false; };
  }, [activeCourses, resumableCourse]);

  // 続きから学習中のコースの、残りレッスン一覧（実モジュール＋実完了状態）
  useEffect(() => {
    if (!resumableCourse) {
      setRemainingLessons([]);
      setCurrentModuleId(undefined);
      return;
    }
    let alive = true;
    bffClient.getCourseContent(resumableCourse.id).then(async (sections: any) => {
      const modules = (Array.isArray(sections) ? sections : []).flatMap((s: any) => s.modules ?? []);
      const results = await Promise.all(
        modules.map((m: any) =>
          bffClient.getActivityCompletion(m.id, resumableCourse.id)
            .then((d: any) => ({ id: m.id, done: d.state >= 1 }))
            .catch(() => ({ id: m.id, done: false }))
        )
      );
      if (!alive) return;
      const doneMap = new Map(results.map((r) => [r.id, r.done]));
      const firstIncompleteIdx = modules.findIndex((m: any) => !doneMap.get(m.id));
      setCurrentModuleId(modules[firstIncompleteIdx]?.id);
      setRemainingLessons(
        modules.map((m: any, i: number) => ({
          id: m.id,
          name: m.name,
          done: doneMap.get(m.id) ?? false,
          current: i === firstIncompleteIdx,
        }))
      );
    }).catch(() => setRemainingLessons([]));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumableCourse?.id]);

  const categoryOptions = useMemo(() => {
    const names = Array.from(new Set(catalog.map((c) => c.categoryName).filter(Boolean)));
    return ['すべて', ...names];
  }, [catalog]);

  const filtered = catalog.filter((c) => {
    if (category !== 'すべて' && c.categoryName !== category) return false;
    if (status && statusOf(c.progress) !== status) return false;
    if (query && !(c.title + c.description + c.categoryName).toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });
  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > shown.length;
  const moreCount = Math.min(9, filtered.length - shown.length);
  const completedCount = remainingLessons.filter((l) => l.done).length;

  const resetPaging = () => setVisible(9);
  const goToContinue = () => resumableCourse && navigate(currentModuleId ? `/course/${resumableCourse.id}?module=${currentModuleId}` : `/course/${resumableCourse.id}/curriculum`);
  const goToCurriculum = () => resumableCourse && navigate(`/course/${resumableCourse.id}/curriculum`);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: t.color.bg.page }}>
      <AppHeader userName={user?.username || 'User'} />

      <div
        ref={outerRef}
        style={{ width: '100%', maxWidth: DESIGN_WIDTH, margin: '0 auto', position: 'relative', height: innerHeight ? innerHeight * scale : undefined }}
      >
      <main
        ref={innerRef}
        className="flex flex-col"
        style={{ position: 'absolute', top: 0, left: 0, width: DESIGN_WIDTH, paddingTop: t.space.pageTop, paddingLeft: t.space.pageX, paddingRight: t.space.pageX, paddingBottom: t.space.pageBottom, gap: t.space.stack, fontFamily: t.font.family, color: t.color.text.primary, boxSizing: 'border-box', transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {/* パンくずは常に出す。階層は「学習コンテンツ ＞ 学習領域 ＞ コース ＞ 単元 ＞ レッスン」で、
            以前先頭に付いていたサイドバーのグループ名「学習」は階層ではないので出さない。 */}
        <LearningBreadcrumb items={[{ label: '学習コンテンツ' }]} />

        <div>
          <h1 style={{ margin: 0, fontSize: t.font.size.pageTitle, fontWeight: t.font.weight.black }}>学習コンテンツ</h1>
          <p style={{ margin: '9px 0 0', fontSize: 13, color: t.color.text.muted }}>続きから進めて、必要なコースはいつでも探せます。</p>
        </div>

        {/* ① いま取り組むレッスン / このコースの残りレッスン */}
        {resumableCourse && (
          <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr', gap: t.space.grid, alignItems: 'stretch' }}>
            <div style={{ background: t.color.bg.card, border: `1px solid ${t.color.border.card}`, borderRadius: t.radius.card, overflow: 'hidden', boxShadow: t.shadow.card, display: 'flex' }}>
              <img src={`${process.env.PUBLIC_URL}/images/materials/hero-art.png`} alt="" style={{ width: 200, objectFit: 'cover', display: 'block' }} />
              <div style={{ flex: 1, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: t.font.weight.black, color: t.color.primary, letterSpacing: t.font.letterSpacingWide }}>いま取り組むレッスン</div>
                <div style={{ fontSize: 23, fontWeight: t.font.weight.black }}>{resumableCourse.title}</div>
                <div style={{ fontSize: 12.5, color: t.color.text.muted }}>
                  {[resumableCourse.currentLesson, resumableCourse.currentChapter && `${resumableCourse.currentChapter}から再開`, resumableCourse.remainingMinutes && `残り約${resumableCourse.remainingMinutes}分`]
                    .filter(Boolean)
                    .join('・')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 7, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden' }}>
                    <div style={{ width: `${resumableCourse.progress ?? 0}%`, height: '100%', background: t.color.primary, borderRadius: t.radius.pill }} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: t.font.weight.bold, color: t.color.primary }}>{resumableCourse.progress ?? 0}%</span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                  <button
                    onClick={goToContinue}
                    className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{ background: t.color.primary, color: '#fff', borderRadius: t.radius.button, padding: '16px 34px', fontSize: 14.5, fontWeight: t.font.weight.black, fontFamily: 'inherit', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  >
                    続きからはじめる　→
                  </button>
                  <button
                    onClick={goToCurriculum}
                    className="appearance-none outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{ background: t.color.bg.card, border: `1px solid ${t.color.border.line}`, color: t.color.text.body, borderRadius: t.radius.button, padding: '16px 26px', fontSize: 13.5, fontWeight: t.font.weight.bold, fontFamily: 'inherit', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  >
                    コースの目次
                  </button>
                </div>
              </div>
            </div>

            <div style={{ background: t.color.bg.card, border: `1px solid ${t.color.border.card}`, borderRadius: t.radius.card, padding: '24px 26px', boxShadow: t.shadow.card, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14.5, fontWeight: t.font.weight.black }}>このコースの残りレッスン</span>
                <span style={{ fontSize: 11.5, color: t.color.text.muted }}>{completedCount} / {remainingLessons.length} 完了</span>
              </div>
              {remainingLessons.map((l, i) => (
                <div
                  key={l.id}
                  onClick={() => navigate(`/course/${resumableCourse.id}?module=${l.id}`)}
                  className="cursor-pointer"
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  {l.done ? (
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: t.color.primary, color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</span>
                  ) : l.current ? (
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: t.color.bg.card, border: `2.5px solid ${t.color.text.strong}`, flexShrink: 0 }} />
                  ) : (
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: t.color.bg.card, border: `2px solid ${t.color.border.muted}`, color: t.color.text.subtle, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', flexShrink: 0 }}>{i + 1}</span>
                  )}
                  <span style={{ flex: 1, fontSize: 13, fontWeight: l.current ? t.font.weight.bold : undefined, color: l.done ? t.color.text.done : l.current ? t.color.text.primary : t.color.text.subtle }}>
                    {l.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ height: 1, background: t.color.divider, marginTop: 8 }} />

        {/* ② コースをさがす */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: t.font.weight.black }}>コースをさがす</div>
            <div style={{ fontSize: 12.5, color: t.color.text.muted, marginTop: 6 }}>全 {catalog.length} コース ・ 目標以外のコースも自由に受講できます</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.color.bg.card, border: `1px solid ${t.color.border.card}`, borderRadius: t.radius.button, padding: '12px 18px', width: 380, boxShadow: t.shadow.card, boxSizing: 'border-box' }}>
            <span style={{ color: t.color.text.subtle, fontSize: 14 }}>⌕</span>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); resetPaging(); }}
              placeholder="コース名・キーワードで検索（例：バナー、SEO）"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: t.color.text.primary, fontFamily: 'inherit' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* コースの大分類は「学習領域」。旧「カテゴリ」表記をここで統一する。 */}
          <span style={{ fontSize: 11.5, fontWeight: t.font.weight.bold, color: t.color.text.subtle }}>
            {LEARNING_HIERARCHY.area}
          </span>
          {categoryOptions.map((label) => {
            const active = category === label;
            const count = label === 'すべて' ? catalog.length : catalog.filter((c) => c.categoryName === label).length;
            return (
              <span key={label} onClick={() => { setCategory(label); resetPaging(); }} style={chipStyle(active)}>
                {label}
                <span style={{ marginLeft: 6, ...(active ? { opacity: 0.7 } : { color: t.color.text.subtle }) }}>{count}</span>
              </span>
            );
          })}
          <span style={{ width: 1, height: 22, background: t.color.divider, margin: '0 4px' }} />
          <span style={{ fontSize: 11.5, fontWeight: t.font.weight.bold, color: t.color.text.subtle }}>受講状況</span>
          {STATUS_LABELS.map((label) => (
            <span
              key={label}
              onClick={() => { setStatus((cur) => (cur === label ? null : label)); resetPaging(); }}
              style={chipStyle(status === label)}
            >
              {label}
            </span>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12.5, color: t.color.text.muted }}>{shown.length} / {filtered.length} 件を表示中</span>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ padding: '60px 0', gap: 8 }}>
            <span style={{ fontSize: 28 }}>🔍</span>
            <p style={{ fontSize: 13, color: t.color.text.muted, margin: 0 }}>条件に合うコースが見つかりませんでした。検索語や絞り込みを変えてみてください。</p>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: t.space.grid }}>
            {shown.map((c) => {
              const st = statusOf(c.progress);
              const tagStyle = c.isCurrent
                ? { background: t.color.primarySoft, color: t.color.primary, fontSize: 10.5, fontWeight: t.font.weight.black, borderRadius: t.radius.pill, padding: '3px 10px' }
                : st === '修了'
                  ? { background: t.color.successSoft, color: t.color.success, fontSize: 11, fontWeight: t.font.weight.bold, borderRadius: t.radius.pill, padding: '2px 10px' }
                  : { fontSize: 11.5, color: st === '受講中' ? t.color.text.muted : t.color.text.subtle };
              const tagLabel = c.isCurrent ? 'いま取り組み中' : st === '未受講' ? '未受講' : `レッスン ${Math.max(1, Math.round((c.progress / 100) * (c.totalLessons ?? 6)))} / ${c.totalLessons ?? 6}`;
              const ctaLabel = c.progress >= 100 ? 'もう一度見る' : c.progress > 0 ? '続きから' : 'はじめる';
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/course/${c.id}/curriculum`)}
                  className="cursor-pointer"
                  style={{
                    background: t.color.bg.card,
                    border: c.isCurrent ? `1.5px solid ${t.color.primaryBorder}` : `1px solid ${t.color.border.card}`,
                    borderRadius: t.radius.card, padding: '22px 24px', boxShadow: t.shadow.card,
                    display: 'flex', flexDirection: 'column', gap: 12, minHeight: 186,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11.5, fontWeight: t.font.weight.bold, color: categoryColor(c.categoryName) }}>{c.categoryName}</span>
                    <span style={tagStyle}>{tagLabel}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: t.font.weight.black }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: t.color.text.muted, lineHeight: 1.7 }}>{c.description}</div>
                  <div style={{ flex: 1 }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden' }}>
                      <div style={{ width: `${c.progress}%`, height: '100%', borderRadius: t.radius.pill, background: c.progress >= 100 ? t.color.success : t.color.primary }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: t.font.weight.bold, color: c.progress >= 100 ? t.color.success : c.progress > 0 ? t.color.primary : t.color.text.subtle }}>{c.progress}%</span>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: t.font.weight.bold, color: t.color.primary }}>
                    {ctaLabel}　→
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={() => setVisible((v) => v + 9)}
              className="appearance-none outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{ background: t.color.bg.card, border: `1px solid ${t.color.border.line}`, color: t.color.text.body, borderRadius: t.radius.button, padding: '14px 34px', fontSize: 13.5, fontWeight: t.font.weight.bold, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              さらに{moreCount}コースを表示　⌄
            </button>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}

export default MaterialsTopPage;
