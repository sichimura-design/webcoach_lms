import React, { useState, useEffect } from 'react';
import { useAsyncData } from '../hooks/useAsyncData';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Clock, Play } from 'lucide-react';
import { bffClient } from '../services/bffClient';
import { AppHeader, LearningBreadcrumb } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { formatMinutesHM } from '../utils/studyStats';
import {
  LEARNING_HIERARCHY,
  LEARNING_TYPE_LABEL,
  LearningType,
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

/** 数字は2桁ゼロ埋め（CHAPTER 01 / 01 の丸） */
const pad2 = (n: number) => String(n).padStart(2, '0');

type LessonState = 'done' | 'current' | 'idle';

/**
 * レッスン・チャプターの状態を表す丸。
 * デザイン（コーストップ 3案.dc.html 案2a）では
 *   完了 = 緑塗り＋✓ ／ 学習中 = 赤塗り＋▶ ／ 未着手 = 破線の空丸
 * の3つだけ。状態以外の意味で色を増やさないこと。
 */
function StatusCircle({ state, size }: { state: LessonState; size: number }) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    flex: 'none',
    borderRadius: 9999,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  if (state === 'done') {
    return (
      <span style={{ ...base, background: 'var(--dc-success)', color: '#fff' }}>
        <Check size={Math.round(size * 0.6)} strokeWidth={3} />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span style={{ ...base, background: 'var(--dc-primary)', color: '#fff' }}>
        <Play size={Math.round(size * 0.45)} strokeWidth={2} fill="currentColor" />
      </span>
    );
  }
  return <span style={{ ...base, border: '1.5px dashed var(--dc-idle-dash)' }} />;
}

/** 「◷ 14分」。実BFFには時間が無いので、値が無ければ何も出さない */
function DurationLabel({ minutes, dim }: { minutes?: number; dim?: boolean }) {
  if (!minutes) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        flex: 'none',
        fontSize: 12.5,
        color: dim ? 'var(--dc-text-subtle)' : 'var(--dc-text-muted)',
      }}
    >
      <Clock size={13} strokeWidth={1.75} />
      {minutes}分
    </span>
  );
}

/** カリキュラム一覧の凡例（完了 / 学習中 / 未着手）。丸の意味を先に示す */
function Legend() {
  const item = (state: LessonState, label: string) => (
    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <StatusCircle state={state} size={14} />
      {label}
    </span>
  );
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        fontSize: 12,
        color: 'var(--dc-text-muted)',
      }}
    >
      {item('done', '完了')}
      {item('current', '学習中')}
      {item('idle', '未着手')}
    </div>
  );
}

const CARD: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 24,
};

const PILL: React.CSSProperties = {
  flex: 'none',
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 9999,
  padding: '5px 12px',
  whiteSpace: 'nowrap',
};

const BTN: React.CSSProperties = {
  flex: 'none',
  borderRadius: 9999,
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]';

export default function CourseTopPage() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const courseIdNum = parseInt(courseId || '0', 10);

  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dc-bg)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto" />
          <p className="mt-4 text-sm text-brand-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--dc-bg)' }}>
        <div className="text-center">
          <p style={{ color: 'var(--dc-primary)' }}>{error}</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-6 py-2 rounded-full text-white font-medium text-sm" style={{ background: 'var(--dc-primary)' }}>戻る</button>
        </div>
      </div>
    );
  }

  const progressPercent = modules.length > 0 ? Math.round((completedIds.size / modules.length) * 100) : 0;
  // 次にやるレッスン。ロックはかけず、どのレッスンからでも開ける
  const nextModule = modules.find(m => !completedIds.has(m.id));
  const currentSectionIndex = sections.findIndex(s => s.modules.some(m => m.id === nextModule?.id));
  const currentSection = currentSectionIndex >= 0 ? sections[currentSectionIndex] : null;
  const courseMinutes = totalMinutes(modules);
  const allDone = modules.length > 0 && !nextModule;
  const started = completedIds.size > 0;

  const openLesson = (moduleId?: number) => {
    if (!moduleId) return;
    navigate(`/course/${courseIdNum}?module=${moduleId}`);
  };

  /** 「次のレッスン」帯で押す先。全完了なら復習として先頭に戻す */
  const heroModule = nextModule ?? modules[0];
  const heroSectionIndex = nextModule ? currentSectionIndex : 0;

  return (
    <div className="wc-warm min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username || 'User'} />

      <main
        className="wc-page flex flex-col"
        style={{
          '--wc-page-max': '1140px',
          '--wc-page-top': '28px',
          '--wc-page-bottom': '56px',
          gap: 24,
          fontFamily: "'Noto Sans JP', sans-serif",
          color: 'var(--dc-text)',
        } as React.CSSProperties}
      >
        {/* パンくずは常に表示。
            以前はここに学習領域（「Webデザイン」など）を挟んでいたが、受講生がたどるのは
            「コース ＞ 単元 ＞ レッスン」であって領域は経路ではない。領域だけのページに
            寄り道させる階層を1段消し、学習する → コース の2段にした。 */}
        <LearningBreadcrumb
          items={[
            { label: '学習する', to: '/courses' },
            { label: course?.fullname ?? LEARNING_HIERARCHY.course },
          ]}
        />

        {/* ヘッダー。左にコースの正体、右に「いまどこまで来ているか」だけを1行で置く。
            CTAはこの下の「次のレッスン」カードが専任なので、ここには置かない。 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 420px' }}>
            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3 }}>
              {course?.fullname ?? LEARNING_HIERARCHY.course}
            </h1>
            {stripTags(course?.summary) && (
              <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--dc-text-muted)', lineHeight: 1.7 }}>
                {stripTags(course?.summary)}
              </p>
            )}
            {/* コースの規模。デザインには無い行だが、現状ページが出している情報なので残す */}
            {sections.length > 0 && (
              <div style={{ display: 'flex', gap: 18, marginTop: 12, fontSize: 12.5, color: 'var(--dc-text-subtle)', flexWrap: 'wrap' }}>
                <span>
                  全{sections.length}チャプター・{modules.length}
                  {LEARNING_HIERARCHY.lesson}
                </span>
                {courseMinutes > 0 && <span>目安 約{formatMinutesHM(courseMinutes)}</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--dc-text-muted)' }}>
              全 {modules.length} {LEARNING_HIERARCHY.lesson}中{' '}
              <b className="dc-num" style={{ color: 'var(--dc-text)' }}>{completedIds.size}</b>{' '}
              {LEARNING_HIERARCHY.lesson}完了
            </span>
            <div
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="コースの進捗"
              style={{ width: 160, height: 8, borderRadius: 9999, background: 'var(--dc-soft-200)', overflow: 'hidden', flex: 'none' }}
            >
              <div style={{ width: `${progressPercent}%`, height: '100%', borderRadius: 9999, background: 'var(--dc-primary)' }} />
            </div>
            <span className="dc-num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--dc-primary)' }}>
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* 「次のレッスン」。この画面で押すべきものを1つだけ、はっきり大きく置く。
            全レッスン完了後は復習の入口に切り替える（押すものが無い画面にしない）。 */}
        {heroModule && (
          <div style={CARD}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dc-text-muted)', letterSpacing: '.08em' }}>
              {allDone ? 'このコースは完了しています' : '次のレッスン'}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                flexWrap: 'wrap',
                background: 'var(--dc-gradient-next)',
                borderRadius: 16,
                padding: '20px 24px',
                marginTop: 14,
              }}
            >
              <span
                style={{
                  width: 52, height: 52, flex: 'none', borderRadius: 9999,
                  background: 'var(--dc-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--dc-primary)',
                  boxShadow: 'var(--dc-shadow-primary-soft)',
                }}
              >
                {allDone ? <Check size={22} strokeWidth={2.5} /> : <Play size={19} strokeWidth={2} fill="currentColor" />}
              </span>

              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                {sections[heroSectionIndex] && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dc-primary)' }}>
                    チャプター{heroSectionIndex + 1}｜{sections[heroSectionIndex].name}
                  </div>
                )}
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{heroModule.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <DurationLabel minutes={heroModule.durationminutes} />
                  {heroModule.durationminutes ? <span style={{ color: 'var(--dc-text-subtle)' }}>・</span> : null}
                  <span style={{ fontSize: 13, color: 'var(--dc-text-muted)' }}>
                    {allDone
                      ? `最初の${LEARNING_HIERARCHY.lesson}`
                      : started
                        ? `学習中の${LEARNING_HIERARCHY.lesson}`
                        : `これから始める${LEARNING_HIERARCHY.lesson}`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openLesson(heroModule.id)}
                className={`ct-btn-primary appearance-none border-0 ${FOCUS_RING}`}
                style={{
                  ...BTN,
                  background: 'var(--dc-primary)',
                  color: '#fff',
                  padding: '14px 28px',
                  fontSize: 15,
                }}
              >
                {allDone ? '最初から復習する ›' : started ? '学習を再開する ›' : '学習をはじめる ›'}
              </button>
            </div>
          </div>
        )}

        {/* カリキュラム一覧。チャプターは畳まず全部開いたまま並べる（デザイン案2a）。
            進行中のチャプターだけ赤枠＋「いまここ」で、視線の落ちる先を1つに絞る。 */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>カリキュラム</div>
            {sections.length > 0 && <Legend />}
          </div>

          {sections.length === 0 ? (
            <p style={{ margin: '18px 0 0', fontSize: 13.5, color: 'var(--dc-text-muted)' }}>
              このコースにはまだ{LEARNING_HIERARCHY.lesson}がありません。
            </p>
          ) : (
            sections.map((section, sectionIndex) => {
              const doneCount = section.modules.filter(m => completedIds.has(m.id)).length;
              const chapterDone = doneCount === section.modules.length;
              const isCurrent = section.id === currentSection?.id;

              return (
                <div
                  key={section.id}
                  style={{
                    position: 'relative',
                    borderRadius: 16,
                    // 「いまここ」バッジが上にはみ出すので、進行中の箱だけ上余白を多く取る
                    marginTop: isCurrent ? 30 : 18,
                    ...(isCurrent
                      ? { border: '2px solid var(--dc-primary)', boxShadow: 'var(--dc-shadow-primary-soft)' }
                      : { border: '1px solid var(--dc-border)', overflow: 'hidden' }),
                  }}
                >
                  {isCurrent && (
                    <span
                      style={{
                        position: 'absolute', top: -12, left: 20,
                        background: 'var(--dc-primary)', color: '#fff',
                        borderRadius: 9999, padding: '4px 14px',
                        fontSize: 11, fontWeight: 700,
                      }}
                    >
                      いまここ
                    </span>
                  )}

                  {/* チャプターの見出し。進行中だけピンク、それ以外はベージュ（案2a の差分） */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--dc-border)',
                      ...(isCurrent
                        ? { background: 'var(--dc-soft-100)', borderRadius: '14px 14px 0 0' }
                        : { background: 'var(--dc-bg)' }),
                    }}
                  >
                    <span
                      className="dc-num"
                      style={{
                        width: 38, height: 38, flex: 'none', borderRadius: 9999,
                        background: 'var(--dc-surface)',
                        border: `1px solid ${isCurrent ? 'var(--dc-soft-200)' : 'var(--dc-border-strong)'}`,
                        boxSizing: 'border-box',
                        color: 'var(--dc-primary)',
                        fontSize: 14, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {pad2(sectionIndex + 1)}
                    </span>

                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div
                        className="dc-num"
                        style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
                          color: isCurrent ? 'var(--dc-primary)' : 'var(--dc-label-warm)',
                        }}
                      >
                        CHAPTER {pad2(sectionIndex + 1)}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 1 }}>{section.name}</div>
                    </div>

                    {/* 状態。完了は緑、進行中は素の数字（枠を足すと赤枠と競合する）、
                        未着手・途中は無彩色のピル */}
                    {chapterDone ? (
                      <span style={{ ...PILL, color: 'var(--dc-success)', background: 'var(--dc-success-surface)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Check size={12} strokeWidth={3} />
                        {doneCount}/{section.modules.length} 完了
                      </span>
                    ) : isCurrent ? (
                      <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}>
                        {doneCount}/{section.modules.length} 完了
                      </span>
                    ) : doneCount > 0 ? (
                      <span style={{ ...PILL, color: 'var(--dc-text-muted)', background: 'var(--dc-neutral-surface)' }}>
                        {doneCount}/{section.modules.length} 完了
                      </span>
                    ) : (
                      <span style={{ ...PILL, color: 'var(--dc-text-subtle)', background: 'var(--dc-neutral-surface)' }}>
                        未着手
                      </span>
                    )}
                  </div>

                  {/* レッスン行。行そのものが本文への入口で、右端のボタンが同じ行き先を明示する */}
                  {section.modules.map((m, lessonIndex) => {
                    const isDone = completedIds.has(m.id);
                    const isNext = m.id === nextModule?.id;
                    const state: LessonState = isDone ? 'done' : isNext ? 'current' : 'idle';
                    const isLast = lessonIndex === section.modules.length - 1;

                    return (
                      <div
                        key={m.id}
                        onClick={() => openLesson(m.id)}
                        className="ct-row cursor-pointer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                          ...(isCurrent
                            ? {
                                // 進行中の箱では行を内側に浮かせる（赤枠と行が触らないように）
                                minHeight: 56,
                                padding: '9px 16px',
                                margin: `${lessonIndex === 0 ? 12 : 0}px 14px ${isLast ? 12 : 4}px`,
                                borderRadius: 10,
                                background: isNext ? 'var(--dc-soft-100)' : undefined,
                              }
                            : {
                                minHeight: 60,
                                padding: '9px 20px',
                                borderBottom: isLast ? undefined : '1px solid var(--dc-border)',
                              }),
                        }}
                      >
                        <StatusCircle state={state} size={22} />

                        <span className="dc-num" style={{ flex: 'none', fontSize: 14, color: 'var(--dc-text-muted)' }}>
                          {lessonIndex + 1}.
                        </span>

                        <span
                          style={{
                            flex: '1 1 180px', minWidth: 0,
                            fontSize: 15,
                            fontWeight: isNext ? 700 : 400,
                            color: state === 'idle' ? 'var(--dc-text-muted)' : 'var(--dc-text)',
                          }}
                        >
                          {m.name}
                        </span>

                        {/* 学習タイプ（階層ではなく分類）。デザインには無いが、
                            現状ページが出している情報なので薄いチップで残す */}
                        {m.learningtype && (
                          <span
                            style={{
                              flex: 'none', fontSize: 10.5,
                              color: 'var(--dc-text-subtle)',
                              background: 'var(--dc-bg)',
                              borderRadius: 6, padding: '3px 8px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {LEARNING_TYPE_LABEL[m.learningtype]}
                          </span>
                        )}

                        {isDone ? (
                          <span style={{ ...PILL, fontSize: 11, padding: '3px 9px', color: 'var(--dc-success)', background: 'var(--dc-success-surface)' }}>
                            完了
                          </span>
                        ) : isNext ? (
                          <span style={{ flex: 'none', fontSize: 11, fontWeight: 700, color: 'var(--dc-primary)', whiteSpace: 'nowrap' }}>
                            学習中
                          </span>
                        ) : (
                          <span style={{ ...PILL, fontSize: 11, padding: '3px 9px', color: 'var(--dc-text-subtle)', background: 'var(--dc-neutral-surface)' }}>
                            未着手
                          </span>
                        )}

                        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <DurationLabel minutes={m.durationminutes} dim={state === 'idle'} />

                          {/* 文言は状態と一致させる（CONSISTENCY-004） */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openLesson(m.id); }}
                            className={`${isDone ? 'ct-btn-ghost' : isNext ? 'ct-btn-primary' : 'ct-btn-outline'} appearance-none ${FOCUS_RING}`}
                            style={{
                              ...BTN,
                              marginLeft: 6,
                              ...(isDone
                                ? { background: 'var(--dc-surface)', color: 'var(--dc-text-muted)', border: '1px solid var(--dc-border-strong)', padding: '8px 16px' }
                                : isNext
                                  ? { background: 'var(--dc-primary)', color: '#fff', border: 'none', padding: '9px 18px' }
                                  : { background: 'var(--dc-surface)', color: 'var(--dc-primary)', border: '1.5px solid var(--dc-primary)', padding: '8px 16px' }),
                            }}
                          >
                            {isDone ? 'もう一度見る' : isNext ? (started ? '再開する ›' : 'はじめる ›') : 'はじめる'}
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </main>

      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span className="font-bold text-white" style={{ fontSize: '11.4px', letterSpacing: '0.6px' }}>2026 © WEBCOACH</span>
      </footer>
    </div>
  );
}
