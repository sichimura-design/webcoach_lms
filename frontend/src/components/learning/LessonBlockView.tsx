import { useState } from 'react';
import DOMPurify from 'dompurify';
import { color, font, radius } from '../../theme/webcoachTheme';
import { LessonBlock } from '../../types/lesson';

/**
 * 教材ブロック1つ分の描画。
 *
 * data-block-id / data-heading は必須。useTextSelection がこの属性から
 * 「選択された文章がどのブロックのものか」を解決し、クリップ位置とAIの参照箇所が
 * すべてこのIDに紐づく。
 */
interface LessonBlockViewProps {
  block: LessonBlock;
  /** AI回答の参照チップから飛んできた直後などに一時的に光らせる */
  flashing: boolean;
}

/** 本文HTMLの共通タイポグラフィ。moodle-content と衝突しないよう専用クラスにする。 */
const proseClass = 'wc-lesson-prose';

function Quiz({ block }: { block: LessonBlock }) {
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  if (!block.quiz) return null;
  const picked = pickedIndex === null ? null : block.quiz.choices[pickedIndex];

  return (
    <div
      style={{
        marginTop: 8,
        padding: 20,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        background: color.pageBg,
      }}
    >
      <strong style={{ ...font.rowTitle, color: color.text, display: 'block', marginBottom: 10 }}>
        ここまでの確認
      </strong>
      <p style={{ ...font.label, color: color.textMuted, margin: '0 0 12px' }}>{block.quiz.question}</p>
      {block.quiz.choices.map((choice, i) => {
        const isPicked = pickedIndex === i;
        const showCorrect = isPicked && choice.correct;
        const showWrong = isPicked && !choice.correct;
        return (
          <button
            key={choice.text}
            type="button"
            onClick={() => setPickedIndex(i)}
            className="w-full text-left focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'block',
              margin: '7px 0',
              padding: '11px 13px',
              border: `1px solid ${showCorrect ? '#9FD8C3' : showWrong ? color.primaryBorder : color.border}`,
              borderRadius: radius.nav,
              background: showCorrect ? '#EAF7F2' : showWrong ? color.primarySoft : color.surface,
              color: showCorrect ? '#1F7655' : color.text,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {choice.text}
          </button>
        );
      })}
      {picked && (
        <p
          style={{
            ...font.caption,
            margin: '10px 0 0',
            color: picked.correct ? '#1F7655' : color.textMuted,
            lineHeight: 1.7,
          }}
        >
          {picked.explain}
        </p>
      )}
    </div>
  );
}

export function LessonBlockView({ block, flashing }: LessonBlockViewProps) {
  const isCallout = block.kind === 'callout';
  const isExample = block.kind === 'example';
  const isTask = block.kind === 'task';
  const isSummary = block.kind === 'summary';
  const isQuiz = block.kind === 'quiz';

  // 図解・課題は本文より広く見せてよい（要件§4）
  const wide = block.kind === 'figure' || isTask;

  const decorated: React.CSSProperties | null = isCallout
    ? {
        padding: '17px 19px',
        border: `1px solid ${color.primaryBorderSoft}`,
        borderLeft: `4px solid ${color.primary}`,
        borderRadius: radius.nav,
        background: color.hoverBgTint,
      }
    : isExample
    ? {
        padding: 18,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        background: color.pageBg,
      }
    : isTask
    ? {
        padding: '18px 20px',
        border: `1px solid ${color.primaryBorderSoft}`,
        borderRadius: radius.md,
        background: color.primarySoft,
      }
    : isSummary
    ? {
        padding: '18px 20px',
        border: `1px solid ${color.borderStrong}`,
        borderRadius: radius.md,
        background: color.surface,
      }
    : null;

  return (
    <section
      id={`block-${block.id}`}
      data-block-id={block.id}
      data-heading={block.heading}
      style={{
        position: 'relative',
        scrollMarginTop: 20,
        marginBottom: 28,
        width: wide ? '100%' : undefined,
        borderRadius: 8,
        transition: 'background .35s ease, box-shadow .35s ease',
        ...(flashing ? { background: '#FFF8D9', boxShadow: '0 0 0 10px #FFF8D9' } : null),
      }}
    >
      <div style={decorated ?? undefined}>
        {block.media && (
          <figure style={{ margin: '0 0 12px' }}>
            <img
              src={block.media.src}
              alt={block.media.alt ?? ''}
              style={{ width: '100%', maxWidth: '100%', borderRadius: radius.md, display: 'block' }}
            />
            {block.media.caption && (
              <figcaption style={{ ...font.caption, color: color.textSubtle, marginTop: 6 }}>
                {block.media.caption}
              </figcaption>
            )}
          </figure>
        )}
        {block.html && (
          <div
            className={proseClass}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html) }}
          />
        )}
        {isQuiz && <Quiz block={block} />}
      </div>
    </section>
  );
}

export default LessonBlockView;
