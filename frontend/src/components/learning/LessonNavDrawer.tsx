import { useMemo, useState } from 'react';
import { Check, Play, X } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { LessonOutline, LessonState } from '../../types/lesson';
import { LEARNING_HIERARCHY, LEARNING_TYPE_LABEL, unitLabel } from '../../constants/learningTaxonomy';

/**
 * 左：コースの目次（単元 ＞ レッスン）。
 *
 * PCでは本文に重ねず、グリッドの1列として並ぶ（閉じると幅0になり本文が左へ広がる）。
 * SPでは画面幅の都合でオーバーレイドロワーになるため、mobile を true にして呼ぶ。
 */
interface LessonNavDrawerProps {
  outline: LessonOutline | null;
  currentLessonId: number | null;
  completedIds: Set<number>;
  onSelect: (lessonId: number) => void;
  onClose: () => void;
  mobile?: boolean;
}

function stateOf(lessonId: number, currentLessonId: number | null, completedIds: Set<number>, fallback: LessonState): LessonState {
  if (lessonId === currentLessonId) return 'active';
  if (completedIds.has(lessonId)) return 'done';
  return fallback === 'active' ? 'todo' : fallback;
}

export function LessonNavDrawer({
  outline,
  currentLessonId,
  completedIds,
  onSelect,
  onClose,
  mobile = false,
}: LessonNavDrawerProps) {
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!outline) return [];
    if (!q) return outline.sections;
    return outline.sections
      .map((s) => ({ ...s, lessons: s.lessons.filter((l) => l.title.toLowerCase().includes(q)) }))
      .filter((s) => s.lessons.length > 0);
  }, [outline, query]);

  const flat = outline?.sections.flatMap((s) => s.lessons) ?? [];
  const doneCount = flat.filter((l) => completedIds.has(l.lessonId) || l.state === 'done').length;

  return (
    <nav
      aria-label="コースの目次"
      className="flex flex-col"
      style={{
        height: '100%',
        minWidth: 0,
        overflow: 'hidden',
        background: color.surface,
        borderRight: `1px solid ${color.border}`,
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: 10, padding: '14px 16px', borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}
      >
        <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>コースの目次</h2>
        <div style={{ flex: 1 }} />
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="目次を閉じる"
            style={{
              width: 32, height: 32, display: 'grid', placeItems: 'center',
              border: `1px solid ${color.borderStrong}`, borderRadius: 9,
              background: color.surface, color: color.iconMuted, cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {outline && (
        <div
          style={{
            margin: 14,
            padding: 14,
            border: `1px solid ${color.primaryBorderSoft}`,
            borderRadius: radius.md,
            background: color.hoverBgTint,
            flexShrink: 0,
          }}
        >
          <div style={{ ...font.caption, color: color.textSubtle }}>{LEARNING_HIERARCHY.course}</div>
          <div style={{ ...font.rowTitle, color: color.text, margin: '5px 0 9px', lineHeight: 1.5 }}>
            {outline.courseName}
          </div>
          <div style={{ ...font.caption, color: color.textMuted }}>
            {doneCount} / {flat.length} レッスン完了
          </div>
          <div style={{ height: 6, borderRadius: 999, background: color.trackBg, overflow: 'hidden', marginTop: 8 }}>
            <div
              style={{
                width: `${flat.length ? Math.round((doneCount / flat.length) * 100) : 0}%`,
                height: '100%',
                borderRadius: 999,
                background: color.primary,
              }}
            />
          </div>
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="レッスンを検索"
        aria-label="レッスンを検索"
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          margin: '0 14px 12px',
          height: 38,
          border: `1px solid ${color.borderStrong}`,
          borderRadius: radius.nav,
          padding: '0 12px',
          background: color.pageBg,
          color: color.text,
          ...font.label,
          flexShrink: 0,
          outline: 'none',
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px', minHeight: 0 }}>
        {sections.length === 0 && (
          <p style={{ ...font.caption, color: color.textFaint, textAlign: 'center', padding: '20px 8px' }}>
            該当するレッスンがありません。
          </p>
        )}
        {sections.map((section) => {
          // 検索で絞り込んでも単元番号がずれないよう、番号は元の目次の並びから引く。
          const unitIndex = (outline?.sections.findIndex((s) => s.id === section.id) ?? -1) + 1;
          return (
          <div key={section.id}>
            <div
              style={{
                margin: '15px 8px 7px',
                color: color.textFaint,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: '.08em',
              }}
            >
              {unitIndex > 0 ? `${unitLabel(unitIndex)}｜${section.name}` : section.name}
            </div>
            {section.lessons.map((lesson) => {
              // 番号はコース全体での通し番号にする（コーストップの「レッスンN」と一致させる）。
              // 単元ごとに1から振り直すと、同じレッスンが画面によって別の番号になる。
              const lessonNumber = flat.findIndex((l) => l.lessonId === lesson.lessonId) + 1;
              const state = stateOf(lesson.lessonId, currentLessonId, completedIds, lesson.state);
              const isActive = state === 'active';
              const isDone = state === 'done';
              return (
                <button
                  key={lesson.lessonId}
                  type="button"
                  onClick={() => onSelect(lesson.lessonId)}
                  aria-current={isActive ? 'true' : undefined}
                  className="w-full grid items-center text-left focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    gridTemplateColumns: '22px minmax(0,1fr) auto',
                    gap: 9,
                    padding: 10,
                    border: 0,
                    borderRadius: radius.nav,
                    background: isActive ? color.primaryTint : 'transparent',
                    color: isActive ? color.primary : color.textBody,
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 20, height: 20, display: 'grid', placeItems: 'center', borderRadius: '50%',
                      fontSize: 10,
                      border: `1px solid ${isDone ? '#CDE9DD' : isActive ? color.primary : color.borderNeutral}`,
                      background: isDone ? '#EAF7F2' : isActive ? color.primary : 'transparent',
                      color: isDone ? '#2C956D' : isActive ? '#fff' : color.textFaint,
                    }}
                  >
                    {isDone ? <Check size={11} /> : isActive ? <Play size={9} /> : lessonNumber}
                  </span>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lesson.title}
                  </span>
                  {/* 学習タイプ（基礎知識・演習・実践課題…）は階層ではなくレッスンの分類。
                      目安時間と並べて右端に小さく出す。 */}
                  <span
                    className="grid justify-items-end"
                    style={{ gap: 2, color: color.textFaint, fontSize: 10, lineHeight: 1.3, whiteSpace: 'nowrap' }}
                  >
                    {lesson.learningType && <span>{LEARNING_TYPE_LABEL[lesson.learningType]}</span>}
                    {lesson.minutes ? <span>{lesson.minutes}分</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          );
        })}
      </div>
    </nav>
  );
}

export default LessonNavDrawer;
