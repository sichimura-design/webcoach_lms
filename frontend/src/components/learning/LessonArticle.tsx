import { RefObject, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, Sparkles } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { LessonDoc } from '../../types/lesson';
import { LEARNING_TYPE_LABEL, MATERIAL_FORMAT_LABEL } from '../../constants/learningTaxonomy';
import LessonBlockView from './LessonBlockView';
import MoodleFallbackBlock from './MoodleFallbackBlock';
import { ClipAnchor, applyClipMarks } from './clipHighlight';
import { groupByHeading } from './lessonSections';
import { resolveExternalUrl } from './moodleContent';

/**
 * 中央：レッスン本文（教材の並び）。画面の主役。
 *
 * 本文カラムには最大幅を設ける（横に長い文章は読みにくいため）。
 * 図解・課題の教材は LessonBlockView 側で本文より広く出せるようにしてある。
 */
interface LessonArticleProps {
  doc: LessonDoc;
  articleRef: RefObject<HTMLDivElement>;
  clips: ClipAnchor[];
  flashBlockId: string | null;
  videoUrl: string | null;
  isCompleted: boolean;
  completing: boolean;
  onComplete: () => void;
  onUndoComplete: () => void;
  onNavigate: (lessonId: number) => void;
  onBackToCourse: () => void;
}

/**
 * 本文カラムの最大幅。
 * 以前は 1080px で、左右の目次・サポートが閉じていると1行が長くなりすぎた。
 * 目次とサポートが列でなくなった今は、読み幅そのものをここで決める。
 */
const CONTENT_MAX_WIDTH = 900;

export function LessonArticle({
  doc,
  articleRef,
  clips,
  flashBlockId,
  videoUrl,
  isCompleted,
  completing,
  onComplete,
  onUndoComplete,
  onNavigate,
  onBackToCourse,
}: LessonArticleProps) {
  const isFallback = doc.source === 'moodle-fallback';

  // 保存済みクリップを本文へ当て直す。ブロックが差し替わるたびに再適用する。
  useEffect(() => {
    const container = articleRef.current;
    if (!container || isFallback) return;
    applyClipMarks(container, clips);
  }, [articleRef, clips, doc.lessonId, isFallback]);

  // 章立ては structured 教材のときだけ。moodle-fallback は iframe の中身なので触らない
  const sections = isFallback ? [] : groupByHeading(doc.blocks);

  return (
    <article
      style={{
        width: `min(100%, ${CONTENT_MAX_WIDTH}px)`,
        margin: '0 auto',
        padding: '44px clamp(20px, 4vw, 40px) 96px',
      }}
    >
      {/* 白いカードの枠を外して全面化した。
          目次とサポートが列でなくなり、本文だけが画面に残ったので、
          その本文をさらに枠で囲うと「紙の中の紙」になる。 */}
      <div>
        {/* ── ヘッダー：カテゴリ・タイトル・リード ── */}
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          {doc.learningType && (
            <div style={{ ...font.eyebrow, color: color.primary }}>
              {LEARNING_TYPE_LABEL[doc.learningType]}
            </div>
          )}

          <h1
            style={{
              margin: '14px 0 0',
              fontSize: 'clamp(24px, 3.4vw, 38px)',
              fontWeight: 900,
              lineHeight: 1.35,
              letterSpacing: '-.02em',
              color: color.text,
            }}
          >
            {doc.title}
          </h1>

          {/* タイトル下の短い赤線。ここから本文が始まる合図 */}
          <span
            aria-hidden
            style={{ display: 'block', width: 48, height: 3, borderRadius: 2, background: color.primary, margin: '18px auto 0' }}
          />

          {doc.lead && (
            <p
              style={{
                margin: '20px auto 0',
                maxWidth: 640,
                color: color.textMuted,
                fontSize: 14,
                lineHeight: 2,
              }}
            >
              {doc.lead}
            </p>
          )}

          <div
            className="flex items-center justify-center flex-wrap"
            style={{ gap: 14, marginTop: 18, ...font.caption, color: color.textFaint }}
          >
            {doc.materialFormat && <span>{MATERIAL_FORMAT_LABEL[doc.materialFormat]}教材</span>}
            {doc.estimatedMinutes > 0 && (
              <span className="inline-flex items-center" style={{ gap: 4 }}>
                <Clock size={12} /> 読了目安 {doc.estimatedMinutes}分
              </span>
            )}
          </div>
        </header>

        {/* できるようになること。参照デザインの「チェックしてみよう」と同じ組み方で、
            読み始める前に到達点を見せる */}
        {doc.goals.length > 0 && (
          <div
            style={{
              padding: '20px 24px',
              border: `1px solid ${color.primaryBorderSoft}`,
              borderRadius: radius.md,
              background: color.hoverBgTint,
              marginBottom: 36,
            }}
          >
            <div className="flex items-center" style={{ gap: 8, ...font.chip, color: color.primary, marginBottom: 14 }}>
              <Check size={14} /> このレッスンでできるようになること
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 22px' }}>
              {doc.goals.map((goal) => (
                <div key={goal} className="flex items-start" style={{ gap: 9, fontSize: 12.5, lineHeight: 1.8, color: color.textBody }}>
                  <Check size={14} style={{ color: color.primary, flexShrink: 0, marginTop: 3 }} />
                  <span>{goal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 本文 ── */}
        <div ref={articleRef} data-lesson-article>
          {!isFallback && (
            <div
              className="flex items-center"
              style={{
                gap: 8,
                marginBottom: 26,
                padding: '9px 14px',
                borderRadius: radius.nav,
                background: color.surface,
                border: `1px solid ${color.border}`,
                ...font.caption,
                color: color.textMuted,
              }}
            >
              <Sparkles size={13} style={{ color: color.primary, flexShrink: 0 }} />
              分からない文章はドラッグで選択すると、解説・AIへの質問・クリップができます。右下からAI・メモも開けます
            </div>
          )}

          {isFallback ? (
            <MoodleFallbackBlock
              html={doc.fallbackHtml ?? ''}
              contentType={doc.fallbackModname}
              title={doc.title}
              videoUrl={videoUrl}
              externalUrl={resolveExternalUrl({
                id: doc.lessonId,
                name: doc.title,
                modname: 'url',
                content: doc.fallbackHtml,
              })}
            />
          ) : (
            sections.map((section) => (
              /* 🔴 このラッパーには data-block-id を付けない。
                 選択・クリップ復元・ジャンプ・読書位置の監視がその属性で
                 ブロックを引いているので、章の箱が混ざると誤検出する。 */
              <section key={`sec-${section.index}`} style={{ marginBottom: 8 }}>
                {section.heading && (
                  <div className="flex items-center" style={{ gap: 14, margin: '38px 0 16px' }}>
                    <span
                      aria-hidden
                      className="grid place-items-center flex-shrink-0"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        background: color.primary,
                        color: color.textOnPrimary,
                        fontSize: 12.5,
                        fontWeight: 900,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {String(section.index).padStart(2, '0')}
                    </span>
                    <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, lineHeight: 1.5, color: color.text }}>
                      {section.heading}
                    </h2>
                  </div>
                )}
                {section.blocks.map((block) => (
                  <LessonBlockView key={block.id} block={block} flashing={flashBlockId === block.id} />
                ))}
              </section>
            ))
          )}

          {/* ── 次にやること ── */}
          {doc.nextAction && (
            <section
              style={{
                marginTop: 30,
                padding: '18px 20px',
                border: `1px solid ${color.primaryBorderSoft}`,
                borderRadius: radius.md,
                background: color.primarySoft,
              }}
            >
              <strong style={{ ...font.rowTitle, color: color.text, display: 'block', marginBottom: 6 }}>
                次にやること
              </strong>
              <p style={{ margin: 0, ...font.label, color: color.textBody, lineHeight: 1.85 }}>{doc.nextAction}</p>
            </section>
          )}

          {/* ── 前後導線 ── */}
          <footer
            className="flex items-center justify-between"
            style={{ gap: 12, marginTop: 38, paddingTop: 24, borderTop: `1px solid ${color.border}`, flexWrap: 'wrap' }}
          >
            <button
              type="button"
              onClick={() => (doc.prev ? onNavigate(doc.prev.lessonId) : onBackToCourse())}
              className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                gap: 7, minHeight: 42, padding: '0 16px',
                border: `1px solid ${color.borderSoft}`, borderRadius: radius.nav,
                background: color.surface, color: color.textStrong, ...font.buttonSm, cursor: 'pointer',
              }}
            >
              <ArrowLeft size={15} />
              {doc.prev ? '前のレッスン' : 'コースの目次へ'}
            </button>

            <div className="flex flex-col items-end" style={{ gap: 6 }}>
              <button
                type="button"
                onClick={onComplete}
                disabled={completing}
                className="inline-flex items-center disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  gap: 8, minHeight: 44, padding: '0 22px', border: 'none', borderRadius: radius.nav,
                  background: isCompleted ? color.hoverBg : color.primary,
                  color: isCompleted ? color.textMuted : color.textOnPrimary,
                  fontSize: 14, fontWeight: 700,
                  boxShadow: isCompleted ? 'none' : shadow.primaryButton,
                  cursor: completing ? 'default' : 'pointer',
                }}
              >
                {isCompleted ? <Check size={16} /> : null}
                {completing
                  ? '送信中…'
                  : isCompleted
                  ? doc.next ? '完了済み・次のレッスンへ' : '完了済み・コースの目次へ'
                  : '完了して次へ進む'}
                <ArrowRight size={15} />
              </button>
              {isCompleted && (
                <div className="flex items-center" style={{ gap: 10 }}>
                  <span style={{ ...font.caption, color: color.textFaint }}>
                    {doc.next ? `次は「${doc.next.title}」` : 'このコースの最後のレッスンです'}
                  </span>
                  <button
                    type="button"
                    onClick={onUndoComplete}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      ...font.caption, color: color.textSubtle,
                      textDecoration: 'underline', cursor: 'pointer',
                    }}
                  >
                    完了を取り消す
                  </button>
                </div>
              )}
            </div>
          </footer>
        </div>
      </div>
    </article>
  );
}

export default LessonArticle;
