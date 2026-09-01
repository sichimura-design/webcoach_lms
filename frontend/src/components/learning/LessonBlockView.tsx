import { useState } from 'react';
import DOMPurify from 'dompurify';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
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

const CHOICE_LETTERS = 'ABCDEFGH';

/**
 * 選択肢テキストの頭に入っている「A.」「1)」「①」などの通し記号を落とす。
 * 移行教材（mocks/materials/*.json）は本文に記号を含み、構造化教材は含まない。
 * 表示側で必ずバッジを出すので、二重に見えないようここで正規化する。
 */
function stripChoiceMarker(text: string): string {
  // 区切り記号（. ) 、 : など）は必須。これが無いと「A/Bテスト…」の A まで削ってしまう。
  return text.replace(/^\s*(?:[A-Ha-h1-8]\s*[.)．）、,:：]|[①-⑧]\s*)\s*/, '').trim() || text;
}

/**
 * 確認問題。
 *
 * 🔴 回答したら「選んだ選択肢」だけでなく **正解の選択肢を必ず緑で開示する**。
 *    以前は選んだものにしか色が付かず、間違えた人はどれが正解か分からなかった。
 * 🔴 開示後は選択肢をロックする（正解が見えている状態で選び直せると答え合わせが
 *    成立しない）。やり直しは「もう一度解く」から。
 */
function Quiz({ block }: { block: LessonBlock }) {
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  if (!block.quiz) return null;

  const choices = block.quiz.choices;
  const answered = pickedIndex !== null;
  const picked = pickedIndex === null ? null : choices[pickedIndex];
  const correctIndex = choices.findIndex((c) => c.correct);
  const isRight = !!picked?.correct;

  return (
    <div
      role="group"
      aria-label="確認問題"
      style={{
        marginTop: 8,
        padding: '22px 24px 20px',
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        background: color.surface,
        boxShadow: shadow.soft,
      }}
    >
      <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
        <span
          style={{
            ...font.chip,
            color: color.primary,
            background: color.primarySoft,
            borderRadius: radius.pill,
            padding: '4px 10px',
          }}
        >
          ✓ 確認問題
        </span>
        <span style={{ ...font.caption, color: color.textSubtle }}>1つ選んでください</span>
      </div>

      <p
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: color.text,
          lineHeight: 1.75,
          margin: '0 0 14px',
        }}
      >
        {block.quiz.question}
      </p>

      <div style={{ display: 'grid', gap: 8 }}>
        {choices.map((choice, i) => {
          const isPicked = pickedIndex === i;
          // 回答後は「正解」を常に開示する。選んだのが不正解でも正解が一目で分かる。
          const revealCorrect = answered && choice.correct;
          const revealWrong = answered && isPicked && !choice.correct;
          const faded = answered && !revealCorrect && !revealWrong;
          const hovered = !answered && hoverIndex === i;

          const borderColor = revealCorrect
            ? color.success
            : revealWrong
            ? color.primary
            : hovered
            ? color.primaryBorder
            : color.borderNeutral;

          return (
            <button
              key={choice.text}
              type="button"
              onClick={() => !answered && setPickedIndex(i)}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((prev) => (prev === i ? null : prev))}
              disabled={answered}
              aria-pressed={isPicked}
              className="w-full text-left flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                gap: 12,
                padding: '13px 15px',
                border: `1.5px solid ${borderColor}`,
                borderRadius: radius.md,
                background: revealCorrect
                  ? color.successSurface
                  : revealWrong
                  ? color.primarySoft
                  : hovered
                  ? color.hoverBgTint
                  : color.surface,
                color: revealCorrect ? color.success : color.textBody,
                fontSize: 13.5,
                fontWeight: revealCorrect || revealWrong ? 700 : 500,
                lineHeight: 1.6,
                textAlign: 'left',
                opacity: faded ? 0.5 : 1,
                cursor: answered ? 'default' : 'pointer',
                transition: 'background .15s ease, border-color .15s ease, opacity .2s ease',
              }}
            >
              <span
                aria-hidden
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radius.pill,
                  fontSize: 12,
                  fontWeight: 900,
                  background: revealCorrect
                    ? color.success
                    : revealWrong
                    ? color.primary
                    : color.pageBg,
                  color: revealCorrect || revealWrong ? color.textOnPrimary : color.textSubtle,
                  border:
                    revealCorrect || revealWrong ? 'none' : `1px solid ${color.borderNeutral}`,
                }}
              >
                {revealCorrect ? '✓' : revealWrong ? '✕' : CHOICE_LETTERS[i] ?? i + 1}
              </span>
              <span style={{ flex: 1 }}>{stripChoiceMarker(choice.text)}</span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div
          aria-live="polite"
          style={{
            marginTop: 14,
            padding: '14px 16px',
            borderRadius: radius.md,
            background: isRight ? color.successSurface : color.pageBg,
            border: `1px solid ${isRight ? color.success : color.border}`,
          }}
        >
          <div
            className="flex items-center"
            style={{
              gap: 8,
              ...font.rowTitle,
              color: isRight ? color.success : color.primary,
              marginBottom: 6,
            }}
          >
            <span aria-hidden>{isRight ? '🎉' : '💡'}</span>
            {isRight ? '正解です' : `不正解 — 正解は ${CHOICE_LETTERS[correctIndex] ?? ''}`}
          </div>
          <p style={{ ...font.label, color: color.textBody, margin: 0, lineHeight: 1.8 }}>
            {picked.explain}
          </p>
          <button
            type="button"
            onClick={() => setPickedIndex(null)}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              ...font.link,
              marginTop: 10,
              padding: 0,
              border: 'none',
              background: 'none',
              color: color.textMuted,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            もう一度解く
          </button>
        </div>
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

  /**
   * callout は「ポイント」の囲み。
   * 参照デザインに合わせて左の太線をやめ、淡いピンクの面＋💡ラベルにした。
   * 本文の流れの中で「ここだけ持ち帰ればいい」と読める形を優先している。
   */
  const decorated: React.CSSProperties | null = isCallout
    ? {
        padding: '18px 22px',
        border: `1px solid ${color.primaryBorderSoft}`,
        borderRadius: radius.md,
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
        // トップバーが固定になったので、その下に潜らない位置で止める。
        // /notes からの ?block= 深リンクの着地点でもある。
        scrollMarginTop: 72,
        marginBottom: 28,
        width: wide ? '100%' : undefined,
        borderRadius: 8,
        transition: 'background .35s ease, box-shadow .35s ease',
        ...(flashing ? { background: '#FFF8D9', boxShadow: '0 0 0 10px #FFF8D9' } : null),
      }}
    >
      <div style={decorated ?? undefined}>
        {/* 囲みが何のためのものかを、本文を読む前に1語で示す */}
        {(isCallout || isTask || isSummary) && (
          <div
            className="flex items-center"
            style={{ gap: 7, ...font.chip, color: color.primary, marginBottom: 10 }}
          >
            <span aria-hidden>{isCallout ? '💡' : isTask ? '✓' : '📝'}</span>
            {isCallout ? 'ポイント' : isTask ? 'チェックしてみよう' : 'まとめ'}
          </div>
        )}
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
        {/* quiz は下のカードが自前の見出しを持つ。html 側の「ここまでの確認」と二重になるので出さない */}
        {block.html && !isQuiz && (
          <div
            className={isTask ? `${proseClass} wc-lesson-checklist` : proseClass}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html) }}
          />
        )}
        {isQuiz && <Quiz block={block} />}
      </div>
    </section>
  );
}

export default LessonBlockView;
