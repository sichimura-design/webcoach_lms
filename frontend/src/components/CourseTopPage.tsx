import { useState, useEffect } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { useNavigate, useParams } from 'react-router-dom';
import { bffClient } from '../services/bffClient';
import { AppHeader, LearningBreadcrumb } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { t } from '../theme/tokens';
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

export default function CourseTopPage() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const courseIdNum = parseInt(courseId || '0', 10);

  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  // 単元カードの開閉。未設定の単元は「いま進めている単元だけ開く」を既定にする
  const [openOverrides, setOpenOverrides] = useState<Record<number, boolean>>({});

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

  const isOpen = (section: Section) => openOverrides[section.id] ?? (section.id === currentSection?.id);
  const toggle = (section: Section) =>
    setOpenOverrides(prev => ({ ...prev, [section.id]: !isOpen(section) }));

  const openLesson = (moduleId: number) => navigate(`/course/${courseIdNum}?module=${moduleId}`);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: t.color.bg.page }}>
      <AppHeader userName={user?.username || 'User'} />

      <main
        className="mx-auto flex flex-col w-full"
        style={{ maxWidth: 1000, paddingTop: 30, paddingBottom: 56, paddingLeft: 24, paddingRight: 24, gap: 20, fontFamily: t.font.family, color: t.color.text.primary }}
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

        {/* コースの見出し。アイコン・装飾は置かず、名前と進み具合だけにする */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: t.font.weight.black, color: t.color.primary }}>
              {course?.categoryname || LEARNING_HIERARCHY.area}
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: t.font.weight.black }}>
              {course?.fullname ?? LEARNING_HIERARCHY.course}
            </h1>
            {stripTags(course?.summary) && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: t.color.text.muted, lineHeight: 1.7 }}>
                {stripTags(course?.summary)}
              </p>
            )}
            <div style={{ fontSize: 12, color: t.color.text.subtle, marginTop: 8 }}>
              全{sections.length}{LEARNING_HIERARCHY.unit}・{modules.length}{LEARNING_HIERARCHY.lesson}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: t.color.text.muted }}>コース進捗</div>
            <div style={{ fontSize: 26, fontWeight: t.font.weight.black, color: t.color.primary }}>{progressPercent}%</div>
            <div style={{ width: 140, height: 6, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden', marginTop: 6 }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', borderRadius: t.radius.pill, background: t.color.primary }} />
            </div>
          </div>
        </div>

        {nextModule && (
          <button
            onClick={() => openLesson(nextModule.id)}
            className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ alignSelf: 'flex-start', background: t.color.primary, color: '#fff', borderRadius: t.radius.button, padding: '15px 30px', fontSize: 14, fontWeight: t.font.weight.black, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            {completedIds.size > 0 ? '続きから' : 'はじめる'}：{nextModule.name}　→
          </button>
        )}

        {/* 単元カード。1単元＝1カードで、概要とレッスン一覧をその場で開いて読める。
            以前は冒険マップと一覧の2カラムで、マップは飾りなのに面積の半分を使っていた。 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
          {sections.map((section, sectionIndex) => {
            const done = section.modules.filter(m => completedIds.has(m.id)).length;
            const allDone = done === section.modules.length;
            const isCurrent = section.id === currentSection?.id;
            const open = isOpen(section);
            const types = Array.from(
              new Set(section.modules.map(m => m.learningtype).filter((x): x is LearningType => !!x))
            );
            const firstIncomplete = section.modules.find(m => !completedIds.has(m.id));
            const stepCta = allDone ? '復習する' : done > 0 ? '続きから' : 'はじめる';

            return (
              <div
                key={section.id}
                style={{
                  background: t.color.bg.card,
                  border: `1px solid ${isCurrent ? t.color.primaryBorder : t.color.border.card}`,
                  borderRadius: t.radius.card,
                  boxShadow: t.shadow.card,
                  padding: '22px 26px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 4, height: 22, borderRadius: 2, background: isCurrent ? t.color.primary : t.color.border.muted }} />
                  <span style={{ fontSize: 12.5, fontWeight: t.font.weight.black, color: t.color.text.subtle, letterSpacing: t.font.letterSpacingWide }}>
                    STEP {sectionIndex + 1}
                  </span>
                  <span style={{ fontSize: 17, fontWeight: t.font.weight.black, flex: 1, minWidth: 0 }}>{section.name}</span>
                  <span style={{ fontSize: 11.5, color: allDone ? t.color.success : t.color.text.subtle, whiteSpace: 'nowrap' }}>
                    {allDone ? '✓ 完了' : `${done} / ${section.modules.length} 完了`}
                  </span>
                </div>

                <div style={{ height: 1, background: t.color.border.card }} />

                {stripTags(section.summary) && (
                  <p style={{ margin: 0, fontSize: 13, color: t.color.text.body, lineHeight: 1.8 }}>
                    {stripTags(section.summary)}
                  </p>
                )}

                {/* レッスン一覧。開くとそのまま各レッスンへ飛べる */}
                <div style={{ border: `1px solid ${t.color.border.line}`, borderRadius: t.radius.inner, overflow: 'hidden' }}>
                  <div
                    onClick={() => toggle(section)}
                    className="cursor-pointer"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: open ? t.color.bg.hover : t.color.bg.card }}
                  >
                    <span style={{ fontSize: 13, fontWeight: t.font.weight.bold }}>{LEARNING_HIERARCHY.lesson}一覧</span>
                    <span style={{ fontSize: 11.5, color: t.color.text.subtle }}>{section.modules.length}個の{LEARNING_HIERARCHY.lesson}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 12, color: t.color.text.subtle, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>⌄</span>
                  </div>

                  {open && (
                    <div style={{ borderTop: `1px solid ${t.color.border.line}` }}>
                      {section.modules.map((m) => {
                        const i = modules.findIndex(x => x.id === m.id);
                        const isDone = completedIds.has(m.id);
                        const isNext = m.id === nextModule?.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => openLesson(m.id)}
                            className="cursor-pointer"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px',
                              borderTop: `1px solid ${t.color.border.line}`,
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
                              {isDone ? '✓' : i + 1}
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
                            <span style={{ fontSize: 12, color: t.color.text.subtle }}>›</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {types.length > 0 && (
                    <>
                      <span style={{ fontSize: 11.5, color: t.color.text.subtle }}>このステップの内容</span>
                      {types.map((type) => (
                        <span key={type} style={{ fontSize: 11, fontWeight: t.font.weight.bold, color: t.color.text.body, background: t.color.bg.hover, border: `1px solid ${t.color.border.line}`, borderRadius: 6, padding: '5px 10px' }}>
                          {LEARNING_TYPE_LABEL[type]}
                        </span>
                      ))}
                    </>
                  )}
                  <span style={{ flex: 1 }} />
                  <button
                    onClick={() => openLesson((firstIncomplete ?? section.modules[0]).id)}
                    className="appearance-none outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      borderRadius: t.radius.button, padding: '11px 30px', fontSize: 13, fontWeight: t.font.weight.bold, fontFamily: 'inherit', cursor: 'pointer',
                      ...(isCurrent
                        ? { background: t.color.primary, color: '#fff', border: 'none' }
                        : { background: t.color.bg.card, color: t.color.primary, border: `1px solid ${t.color.primaryBorder}` }),
                    }}
                  >
                    {stepCta}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span className="font-bold text-white" style={{ fontSize: '11.4px', letterSpacing: '0.6px' }}>2026 © WEBCOACH</span>
      </footer>
    </div>
  );
}
