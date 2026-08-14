import { useState, useEffect, useMemo, useRef } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { useNavigate, useParams } from 'react-router-dom';
import { bffClient } from '../services/bffClient';
import { AppHeader, LearningBreadcrumb } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../theme/tokens';
import { formatMinutesHM } from '../utils/studyStats';
import {
  LEARNING_HIERARCHY,
  LEARNING_TYPE_LABEL,
  LearningType,
  lessonLabel,
} from '../constants/learningTaxonomy';

interface Module {
  id: number;
  name: string;
  modname: string;
  description?: string;
  learningtype?: LearningType;
  /** 所要時間の目安（分）。モックのシードが持つ。実BFFでは付かないので任意 */
  durationminutes?: number;
  completion?: number;
  completiondata?: { state: number };
}

interface Section {
  id: number;
  name: string;
  visible?: boolean;
  summary: string;
  modules: Module[];
}

interface Course {
  id: number;
  fullname: string;
  shortname: string;
  categoryid: number;
  categoryname?: string;
  summary?: string;
}

const stripTags = (html?: string) => (html ?? '').replace(/<[^>]*>/g, '').trim();

/** 所要時間の合計。実BFFには時間が無いので、1件も持っていなければ 0 を返して表示ごと消す */
const totalMinutes = (modules: Module[]) =>
  modules.reduce((sum, m) => sum + (m.durationminutes ?? 0), 0);

/**
 * STEPの丸アイコンの色。参照デザインはSTEPごとに別々の原色を当てていたが、
 * それだと画面全体のトンマナから浮くので「状態」の3色だけにする。
 */
function stepTone(done: boolean, current: boolean) {
  if (done) return { bg: t.color.success, fg: '#fff', border: 'transparent' };
  if (current) return { bg: t.color.primary, fg: '#fff', border: 'transparent' };
  return { bg: t.color.bg.card, fg: t.color.text.subtle, border: t.color.border.muted };
}

export default function CourseTopPage() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const courseIdNum = parseInt(courseId || '0', 10);

  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  // 単元カードの開閉。未設定の単元は「いま進めている単元だけ開く」を既定にする
  const [openOverrides, setOpenOverrides] = useState<Record<number, boolean>>({});
  // STEPステッパーから該当カードへ飛ぶための参照
  const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { data, loading, error } = useAsyncData(
    () => Promise.all([
      bffClient.getCourseContent(courseIdNum),
      bffClient.getCourses(),
    ]).then(([content, courses]) => ({
      sections: (Array.isArray(content) ? content : []).filter((s: Section) => s.modules?.length > 0),
      course: (courses as Course[]).find(c => c.id === courseIdNum) ?? null,
    })),
    [courseIdNum],
  );
  const sections: Section[] = data?.sections ?? [];
  const course: Course | null = data?.course ?? null;
  const modules: Module[] = sections.flatMap(s => s.modules);

  useEffect(() => {
    if (sections.length === 0) return;
    const trackableModules = sections.flatMap(s => s.modules).filter(m => (m.completion ?? 0) >= 1);
    Promise.all(
      trackableModules.map(m =>
        bffClient.getActivityCompletion(m.id, courseIdNum)
          .then((d: { state: number }) => ({ id: m.id, state: d.state }))
          .catch(() => ({ id: m.id, state: 0 }))
      )
    ).then(results => {
      setCompletedIds(new Set(results.filter(r => r.state >= 1).map(r => r.id)));
    });
  }, [sections, courseIdNum]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.color.bg.page }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto" />
          <p className="mt-4 text-sm text-brand-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.color.bg.page }}>
        <div className="text-center">
          <p style={{ color: t.color.primary }}>{error}</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2 rounded-full text-white font-medium text-sm" style={{ background: t.color.primary }}>戻る</button>
        </div>
      </div>
    );
  }

  const progressPercent = modules.length > 0 ? Math.round((completedIds.size / modules.length) * 100) : 0;
  // 次にやるレッスン。ロックはかけず、どのレッスンからでも開ける
  const nextModule = modules.find(m => !completedIds.has(m.id));
  const currentSection = sections.find(s => s.modules.some(m => m.id === nextModule?.id));
  const courseMinutes = totalMinutes(modules);

  const isOpen = (section: Section) => openOverrides[section.id] ?? (section.id === currentSection?.id);
  const toggle = (section: Section) =>
    setOpenOverrides(prev => ({ ...prev, [section.id]: !isOpen(section) }));

  const openLesson = (moduleId: number) => navigate(`/course/${courseIdNum}?module=${moduleId}`);

  /** ステッパーから該当STEPへ。畳んでいたら開いてから送る（飛んだ先が閉じていると何も起きなく見える） */
  const jumpToStep = (section: Section) => {
    setOpenOverrides(prev => ({ ...prev, [section.id]: true }));
    stepRefs.current[section.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: t.color.bg.page }}>
      <AppHeader userName={user?.username || 'User'} />

      <main
        className="wc-page flex flex-col"
        style={{ '--wc-page-max': '1000px', '--wc-page-top': '30px', '--wc-page-bottom': '56px', gap: 20, fontFamily: t.font.family, color: t.color.text.primary } as React.CSSProperties}
      >
        {/* パンくずは常に表示。学習領域からコースまでを辿れるようにする */}
        <LearningBreadcrumb
          items={[
            { label: '学習コンテンツ', to: '/courses' },
            course?.categoryname
              ? { label: course.categoryname, to: `/courses/category/${course.categoryid}` }
              : { label: '' },
            { label: course?.fullname ?? LEARNING_HIERARCHY.course },
          ]}
        />

        {/* ヒーロー帯。左にコースの正体、右に「いまどこまで来ていて、次に何を押すか」。
            以前は見出しと進捗率が同じ行に並ぶだけで、コースの規模（STEP数・所要時間）が
            どこにも書かれておらず「全体像が見えない」という指摘を受けた。 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
          <div style={{ minWidth: 0, paddingTop: 4 }}>
            <div style={{ fontSize: 11.5, fontWeight: t.font.weight.black, color: t.color.primary }}>
              {course?.categoryname || LEARNING_HIERARCHY.area}
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: t.font.weight.black }}>
              {course?.fullname ?? LEARNING_HIERARCHY.course}
            </h1>
            {stripTags(course?.summary) && (
              <p style={{ margin: '10px 0 0', fontSize: 13.5, color: t.color.text.muted, lineHeight: 1.8 }}>
                {stripTags(course?.summary)}
              </p>
            )}
            <div style={{ display: 'flex', gap: 22, marginTop: 14, fontSize: 12.5, color: t.color.text.subtle, flexWrap: 'wrap' }}>
              <span>
                全{sections.length}STEP・{modules.length}
                {LEARNING_HIERARCHY.lesson}
              </span>
              {courseMinutes > 0 && <span>学習時間の目安：約{formatMinutesHM(courseMinutes)}</span>}
            </div>
          </div>

          {/* 進捗カード。数字と「次に押すもの」を1枚にまとめ、迷わせない */}
          <div
            style={{
              background: t.color.bg.card,
              border: `1px solid ${t.color.border.card}`,
              borderRadius: t.radius.card,
              boxShadow: t.shadow.card,
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 12, color: t.color.text.muted }}>コースの進捗</span>
              <span style={{ fontSize: 30, fontWeight: t.font.weight.black, color: t.color.primary, lineHeight: 1 }}>
                {progressPercent}%
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: t.color.text.subtle, textAlign: 'right', marginTop: -6 }}>
              {completedIds.size} / {modules.length} 完了
            </div>
            <div style={{ height: 7, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', borderRadius: t.radius.pill, background: t.color.primary }} />
            </div>

            {nextModule ? (
              <button
                onClick={() => openLesson(nextModule.id)}
                className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ background: t.color.primary, color: '#fff', borderRadius: t.radius.button, padding: '14px 20px', fontSize: 14, fontWeight: t.font.weight.black, fontFamily: 'inherit', cursor: 'pointer', marginTop: 4 }}
              >
                {completedIds.size > 0 ? '続きから学ぶ' : 'はじめる'}　→
              </button>
            ) : (
              <button
                onClick={() => openLesson(modules[0]?.id)}
                disabled={modules.length === 0}
                className="appearance-none outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ background: t.color.bg.card, color: t.color.primary, border: `1px solid ${t.color.primaryBorder}`, borderRadius: t.radius.button, padding: '14px 20px', fontSize: 14, fontWeight: t.font.weight.black, fontFamily: 'inherit', cursor: 'pointer', marginTop: 4 }}
              >
                最初から復習する　→
              </button>
            )}

            {nextModule && (
              <div style={{ fontSize: 11.5, color: t.color.text.subtle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                次：{nextModule.name}
              </div>
            )}
          </div>
        </div>

        {/* STEPステッパー。コースの道筋を1行で見せる。押すとその単元まで送る。
            「単元ステップが上部にある」＝下までスクロールしなくても全体の段取りが分かる状態。 */}
        {sections.length > 1 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))`,
              gap: 10,
              background: t.color.bg.card,
              border: `1px solid ${t.color.border.card}`,
              borderRadius: t.radius.card,
              boxShadow: t.shadow.card,
              padding: 14,
            }}
          >
            {sections.map((section, i) => {
              const done = section.modules.every(m => completedIds.has(m.id));
              const current = section.id === currentSection?.id;
              const tone = stepTone(done, current);
              return (
                <button
                  key={section.id}
                  onClick={() => jumpToStep(section)}
                  className="appearance-none outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', minWidth: 0,
                    background: current ? t.color.primarySoft : 'transparent',
                    border: `1px solid ${current ? t.color.primaryBorder : 'transparent'}`,
                    borderRadius: t.radius.inner, padding: '11px 13px',
                    fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 28, height: 28, borderRadius: '50%', boxSizing: 'border-box',
                      fontSize: 12, fontWeight: t.font.weight.bold,
                      background: tone.bg, color: tone.fg, border: `1.5px solid ${tone.border}`,
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: t.font.weight.bold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {section.name}
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: t.color.text.subtle, marginTop: 2 }}>
                      {section.modules.length}
                      {LEARNING_HIERARCHY.lesson}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* カリキュラム。以前は1単元＝1枚の大きなカードで、カードだけで画面が埋まり
            「コースの全体像が見えない／カードがでかすぎる」という指摘を受けた。
            1枚のカードの中にSTEPを畳んで並べ、開いた単元だけ中身を見せる。 */}
        <div
          style={{
            background: t.color.bg.card,
            border: `1px solid ${t.color.border.card}`,
            borderRadius: t.radius.card,
            boxShadow: t.shadow.card,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 14.5, fontWeight: t.font.weight.black, padding: '4px 8px 8px' }}>
            カリキュラム
          </div>

          {sections.map((section, sectionIndex) => {
            const doneCount = section.modules.filter(m => completedIds.has(m.id)).length;
            const allDone = doneCount === section.modules.length;
            const isCurrent = section.id === currentSection?.id;
            const open = isOpen(section);
            const tone = stepTone(allDone, isCurrent);
            const stepMinutes = totalMinutes(section.modules);
            const types = Array.from(
              new Set(section.modules.map(m => m.learningtype).filter((x): x is LearningType => !!x))
            );

            return (
              <div
                key={section.id}
                ref={(el) => { stepRefs.current[section.id] = el; }}
                style={{
                  border: `1px solid ${open && isCurrent ? t.color.primaryBorder : t.color.border.line}`,
                  borderRadius: t.radius.inner,
                  background: open && isCurrent ? t.color.primarySoft : t.color.bg.card,
                  overflow: 'hidden',
                  scrollMarginTop: 20,
                }}
              >
                {/* 見出し行。畳んでいる状態でも「何を・何レッスン・何分」が読めるようにする */}
                <div
                  onClick={() => toggle(section)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(section); } }}
                  aria-expanded={open}
                  className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px' }}
                >
                  <span
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 30, height: 30, borderRadius: '50%', boxSizing: 'border-box',
                      fontSize: 12.5, fontWeight: t.font.weight.bold,
                      background: tone.bg, color: tone.fg, border: `1.5px solid ${tone.border}`,
                    }}
                  >
                    {allDone ? '✓' : sectionIndex + 1}
                  </span>

                  <span style={{ fontSize: 12, fontWeight: t.font.weight.black, color: isCurrent ? t.color.primary : t.color.text.subtle, letterSpacing: t.font.letterSpacingWide, flexShrink: 0 }}>
                    STEP {sectionIndex + 1}
                  </span>

                  <span style={{ fontSize: 15, fontWeight: t.font.weight.black, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {section.name}
                  </span>

                  <span style={{ fontSize: 11, fontWeight: t.font.weight.bold, color: allDone ? t.color.success : isCurrent ? t.color.primary : t.color.text.subtle, background: t.color.bg.card, border: `1px solid ${allDone ? t.color.success : isCurrent ? t.color.primaryBorder : t.color.border.line}`, borderRadius: t.radius.pill, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                    {allDone ? '完了' : `${doneCount} / ${section.modules.length} 完了`}
                  </span>

                  <span style={{ fontSize: 11.5, color: t.color.text.subtle, whiteSpace: 'nowrap' }}>
                    {section.modules.length}{LEARNING_HIERARCHY.lesson}
                  </span>
                  {stepMinutes > 0 && (
                    <span style={{ fontSize: 11.5, color: t.color.text.subtle, whiteSpace: 'nowrap' }}>
                      目安 {formatMinutesHM(stepMinutes)}
                    </span>
                  )}

                  <span style={{ fontSize: 12, color: t.color.text.subtle, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>⌄</span>
                </div>

                {open && (
                  <div style={{ borderTop: `1px solid ${t.color.border.line}`, padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 14, background: t.color.bg.card }}>
                    {stripTags(section.summary) && (
                      <p style={{ margin: 0, fontSize: 13, color: t.color.text.body, lineHeight: 1.8 }}>
                        {stripTags(section.summary)}
                      </p>
                    )}

                    {types.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {types.map((type) => (
                          <span key={type} style={{ fontSize: 11, fontWeight: t.font.weight.bold, color: t.color.text.body, background: t.color.bg.hover, border: `1px solid ${t.color.border.line}`, borderRadius: 6, padding: '5px 10px' }}>
                            ✓ {LEARNING_TYPE_LABEL[type]}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* レッスン行。行そのものが本文への入口で、右のラベルは状態を兼ねる */}
                    <div style={{ border: `1px solid ${t.color.border.line}`, borderRadius: t.radius.inner, overflow: 'hidden' }}>
                      {section.modules.map((m, lessonIndex) => {
                        const i = modules.findIndex(x => x.id === m.id);
                        const isDone = completedIds.has(m.id);
                        const isNext = m.id === nextModule?.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => openLesson(m.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLesson(m.id); } }}
                            className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px',
                              borderTop: lessonIndex === 0 ? undefined : `1px solid ${t.color.border.line}`,
                              background: isNext ? t.color.primarySoft : undefined,
                            }}
                          >
                            <span
                              className="flex items-center justify-center flex-shrink-0"
                              style={{
                                width: 26, height: 26, borderRadius: '50%', fontSize: 11, fontWeight: t.font.weight.bold, boxSizing: 'border-box',
                                ...(isDone
                                  ? { background: t.color.success, color: '#fff' }
                                  : isNext
                                    ? { background: t.color.primary, color: '#fff' }
                                    : { background: t.color.bg.card, border: `1.5px solid ${t.color.border.muted}`, color: t.color.text.subtle }),
                              }}
                            >
                              {isDone ? '✓' : '▶'}
                            </span>

                            <span style={{ fontSize: 11.5, color: t.color.text.subtle, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                              {String(i + 1).padStart(2, '0')}
                            </span>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 10.5, color: t.color.text.subtle }}>{lessonLabel(i + 1)}</div>
                              <div style={{ fontSize: 14, fontWeight: t.font.weight.bold, color: isDone ? t.color.text.done : t.color.text.primary }}>
                                {m.name}
                              </div>
                            </div>

                            {m.learningtype && (
                              <span style={{ fontSize: 10.5, color: t.color.text.subtle, background: t.color.bg.hover, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                                {LEARNING_TYPE_LABEL[m.learningtype]}
                              </span>
                            )}
                            {m.durationminutes ? (
                              <span style={{ fontSize: 11.5, color: t.color.text.subtle, whiteSpace: 'nowrap' }}>
                                {m.durationminutes}分
                              </span>
                            ) : null}

                            {/* 文言は状態と一致させる（CONSISTENCY-004）。はじめる / 続きから / 復習する */}
                            <span
                              style={{
                                fontSize: 11.5, fontWeight: t.font.weight.bold, borderRadius: t.radius.pill,
                                padding: '5px 14px', whiteSpace: 'nowrap', flexShrink: 0,
                                ...(isNext
                                  ? { color: t.color.primary, border: `1px solid ${t.color.primaryBorder}`, background: t.color.bg.card }
                                  : { color: t.color.text.subtle, border: `1px solid ${t.color.border.line}`, background: t.color.bg.card }),
                              }}
                            >
                              {isDone ? '復習する' : isNext ? (completedIds.size > 0 ? '続きから' : 'はじめる') : 'ひらく'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 最下部のひとこと。全STEPを見たあとに「で、どこから？」で止まらないようにする */}
        {sections.length > 0 && (
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: t.color.bg.hover, border: `1px solid ${t.color.border.line}`,
              borderRadius: t.radius.inner, padding: '14px 18px',
              fontSize: 12.5, color: t.color.text.body,
            }}
          >
            <span aria-hidden>💡</span>
            {completedIds.size === 0
              ? `まずは STEP 1「${sections[0].name}」から始めましょう。`
              : currentSection
                ? `いまは STEP ${sections.indexOf(currentSection) + 1}「${currentSection.name}」の途中です。`
                : 'すべてのSTEPが完了しています。気になるレッスンから復習できます。'}
          </div>
        )}
      </main>

      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span className="font-bold text-white" style={{ fontSize: '11.4px', letterSpacing: '0.6px' }}>2026 © WEBCOACH</span>
      </footer>
    </div>
  );
}
