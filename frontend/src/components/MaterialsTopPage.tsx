import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppHeader, LearningBreadcrumb } from './shared';
import { CourseCard, GalleryCourse, categoryColor } from './materials/CourseCard';
import { useAuth } from '../contexts/AuthContext';
import { useMypageData } from '../hooks/useMypageData';
import { bffClient } from '../services/bffClient';
import { useScaleToFit } from '../hooks/useScaleToFit';
import { t } from '../theme/tokens';
import { LEARNING_HIERARCHY } from '../constants/learningTaxonomy';

const DESIGN_WIDTH = 1440;

interface CatalogCourse extends GalleryCourse {
  difficulty?: string;
}

interface LessonRow {
  id: number;
  name: string;
  done: boolean;
  current: boolean;
  minutes?: number;
}

/**
 * 学習領域の並び順と、見出しに添えるひとこと。
 * カタログにこれ以外の領域が来たら末尾にそのまま並べる。
 */
const AREA_ORDER = ['Webデザイン', 'コーディング', 'マーケティング', 'キャリア'];
const AREA_LEAD: Record<string, string> = {
  'Webデザイン': '見た目を整える力を、基礎から作品づくりまで。',
  'コーディング': 'HTML/CSSからWordPressまで、思ったとおりに形にする。',
  'マーケティング': '作ったものを届けて、成果につなげる考え方。',
  'キャリア': '副業のはじめ方から、案件を取るまでの進め方。',
};

/**
 * 領域の中の段階。チップで絞り込ませるのではなく、見出しとして常に見せる。
 * 難易度情報が無いコース（実BFF）は段階なしの1グループにまとめる。
 */
const TIERS = [
  { key: 'basic', label: '基礎からはじめる', lead: 'はじめての人はここから。用語と考え方をやさしく。', match: (d?: string) => d === '基礎' },
  { key: 'practice', label: '実践で力をつける', lead: '手を動かして、作品や成果物に落とし込む。', match: (d?: string) => d === '応用' || d === '発展' },
] as const;

interface TierGroup {
  key: string;
  label: string;
  lead: string;
  courses: CatalogCourse[];
}

function MaterialsTopPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resumableCourse, activeCourses } = useMypageData(user?.userid);
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);

  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [remainingLessons, setRemainingLessons] = useState<LessonRow[]>([]);
  const [currentModuleId, setCurrentModuleId] = useState<number | undefined>();
  const [query, setQuery] = useState('');

  const areaRefs = useRef<Record<string, HTMLElement | null>>({});

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
          totalLessons: c.lessoncount ?? enrolled?.totalLessons,
          duration: c.duration,
          purposes: Array.isArray(c.purposes) ? c.purposes : undefined,
          difficulty: c.difficulty,
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((c) => (c.title + c.description + c.categoryName + (c.purposes ?? []).join('')).toLowerCase().includes(q));
  }, [catalog, query]);

  /**
   * 学習領域 → 段階 の2段見出しに畳む。ページネーションはせず、
   * ここで作った全グループをそのまま縦に並べる（下までスクロールすれば全コースが見える）。
   */
  const areas = useMemo(() => {
    const names = Array.from(new Set(filtered.map((c) => c.categoryName)));
    names.sort((a, b) => {
      const ia = AREA_ORDER.indexOf(a), ib = AREA_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return names.map((name) => {
      const courses = filtered.filter((c) => c.categoryName === name);
      const hasDifficulty = courses.some((c) => c.difficulty);
      const tiered: TierGroup[] = TIERS.map((tier) => ({
        key: tier.key as string, label: tier.label as string, lead: tier.lead as string,
        courses: courses.filter((c) => tier.match(c.difficulty)),
      }));
      tiered.push({
        key: 'other', label: 'そのほか', lead: '気分転換や小ワザなど。',
        courses: courses.filter((c) => !TIERS.some((tier) => tier.match(c.difficulty))),
      });
      const groups: TierGroup[] = hasDifficulty
        ? tiered.filter((g) => g.courses.length > 0)
        : [{ key: 'all', label: '', lead: '', courses }];
      return { name, courses, groups };
    });
  }, [filtered]);

  const completedCount = remainingLessons.filter((l) => l.done).length;

  const goToContinue = () => resumableCourse && navigate(currentModuleId ? `/course/${resumableCourse.id}?module=${currentModuleId}` : `/course/${resumableCourse.id}/curriculum`);
  const goToCurriculum = () => resumableCourse && navigate(`/course/${resumableCourse.id}/curriculum`);
  const jumpToArea = (name: string) => areaRefs.current[name]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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

        {/* ② コースをさがす。
            以前はカテゴリ／受講状況のチップで絞り込ませ、9件ずつ「さらに表示」していた。
            探しに来ていない人には絞り込みが使われず、下に何があるかも分からなかったため、
            見出しで区切ったギャラリーを全件そのまま縦に並べる方式に変えた。 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: t.font.weight.black }}>コースをさがす</div>
            <div style={{ fontSize: 12.5, color: t.color.text.muted, marginTop: 6 }}>
              全 {catalog.length} コース ・ 目標以外のコースも自由に受講できます
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: t.color.bg.card, border: `1px solid ${t.color.border.card}`, borderRadius: t.radius.button, padding: '12px 18px', width: 380, boxShadow: t.shadow.card, boxSizing: 'border-box' }}>
            <span style={{ color: t.color.text.subtle, fontSize: 14 }}>⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="コース名・キーワードで検索（例：バナー、SEO）"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: t.color.text.primary, fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* 学習領域へのジャンプ。絞り込みではなく目次なので、押しても表示件数は減らない */}
        {areas.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, fontWeight: t.font.weight.bold, color: t.color.text.subtle }}>{LEARNING_HIERARCHY.area}</span>
            {areas.map((a) => (
              <span
                key={a.name}
                onClick={() => jumpToArea(a.name)}
                className="cursor-pointer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: t.color.bg.card, border: `1px solid ${t.color.border.card}`, borderRadius: t.radius.pill, padding: '8px 16px', fontSize: 12.5, fontWeight: t.font.weight.bold, color: t.color.text.body }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: categoryColor(a.name) }} />
                {a.name}
                <span style={{ color: t.color.text.subtle, fontWeight: t.font.weight.regular }}>{a.courses.length}</span>
              </span>
            ))}
          </div>
        )}

        {areas.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ padding: '60px 0', gap: 8 }}>
            <span style={{ fontSize: 28 }}>🔍</span>
            <p style={{ fontSize: 13, color: t.color.text.muted, margin: 0 }}>条件に合うコースが見つかりませんでした。検索語を変えてみてください。</p>
          </div>
        ) : (
          areas.map((area) => (
            <section
              key={area.name}
              ref={(el) => { areaRefs.current[area.name] = el; }}
              style={{ display: 'flex', flexDirection: 'column', gap: 18, scrollMarginTop: 24 }}
            >
              {/* 学習領域の見出し。色帯 + ひとことで「ここから下は何の話か」を明示する */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 10 }}>
                <span style={{ width: 5, height: 34, borderRadius: 3, background: categoryColor(area.name) }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 21, fontWeight: t.font.weight.black }}>{area.name}</h2>
                    <span style={{ fontSize: 12, color: t.color.text.subtle }}>{area.courses.length} コース</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: t.color.text.muted, marginTop: 5 }}>
                    {AREA_LEAD[area.name] ?? `${area.name}のコース一覧です。`}
                  </div>
                </div>
              </div>

              {area.groups.map((group) => (
                <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {group.label && (
                    <div>
                      <div style={{ fontSize: 15, fontWeight: t.font.weight.black, color: t.color.text.primary }}>{group.label}</div>
                      <div style={{ fontSize: 12, color: t.color.text.muted, marginTop: 4 }}>{group.lead}</div>
                    </div>
                  )}
                  <div className="grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', gap: 22 }}>
                    {group.courses.map((c) => (
                      <CourseCard key={c.id} course={c} onClick={() => navigate(`/course/${c.id}/curriculum`)} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))
        )}
      </main>
      </div>
    </div>
  );
}

export default MaterialsTopPage;
