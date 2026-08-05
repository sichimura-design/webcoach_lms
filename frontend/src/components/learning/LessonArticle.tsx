import { RefObject, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, Sparkles } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { LessonDoc } from '../../types/lesson';
import { LEARNING_TYPE_LABEL, MATERIAL_FORMAT_LABEL } from '../../constants/learningTaxonomy';
import LessonBlockView from './LessonBlockView';
import MoodleFallbackBlock from './MoodleFallbackBlock';
import { ClipAnchor, applyClipMarks } from './clipHighlight';
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

const CONTENT_MAX_WIDTH = 1080;

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

  return (
    <article
      style={{
        width: `min(100%, ${CONTENT_MAX_WIDTH}px)`,
        margin: '0 auto',
        padding: '26px clamp(16px, 3vw, 40px) 80px',
      }}
    >
      <div
        style={{
          overflow: 'hidden',
          border: `1px solid ${color.border}`,
          borderRadius: radius.hero,
          background: color.surface,
          boxShadow: shadow.card,
        }}
      >
        {/* ── ヘッダー：学習タイプ／教材形式・タイトル・リード・できるようになること ── */}
        <header
          style={{
            padding: '32px clamp(22px, 4vw, 46px) 26px',
            borderBottom: `1px solid ${color.border}`,
            background: `radial-gradient(circle at 100% 0%, ${color.primarySoft}, transparent 34%), ${color.surface}`,
          }}
        >
          <div className="flex items-center flex-wrap" style={{ gap: 10, ...font.caption, color: color.textSubtle }}>
            {/* 学習タイプ＝どう学ぶか（レッスンの分類）、教材形式＝コンテンツの形。
                どちらも階層名ではないので、階層のパンくずとは別にここへ出す。 */}
            {doc.learningType && (
              <span style={{ ...font.chip, color: color.primary, background: color.primarySoft, borderRadius: 999, padding: '4px 10px' }}>
                {LEARNING_TYPE_LABEL[doc.learningType]}
              </span>
            )}
            {doc.materialFormat && <span>{MATERIAL_FORMAT_LABEL[doc.materialFormat]}教材</span>}
            {doc.estimatedMinutes > 0 && (
              <span className="inline-flex items-center" style={{ gap: 4 }}>
                <Clock size={12} /> 読了目安 {doc.estimatedMinutes}分
              </span>
            )}
          </div>

          <h1
            style={{
              margin: '12px 0 9px',
              fontSize: 'clamp(23px, 2.6vw, 32px)',
              fontWeight: 900,
              lineHeight: 1.38,
              letterSpacing: '-.02em',
              color: color.text,
            }}
          >
            {doc.title}
          </h1>

          {doc.lead && (
            <p style={{ margin: 0, color: color.textMuted, fontSize: 14, lineHeight: 1.9 }}>{doc.lead}</p>
          )}

          {doc.goals.length > 0 && (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginTop: 20 }}>
              {doc.goals.map((goal) => (
                <div
                  key={goal}
                  className="flex items-start"
                  style={{
                    gap: 8,
                    padding: '12px 14px',
                    border: `1px solid ${color.primaryBorderSoft}`,
                    borderRadius: radius.nav,
                    background: color.hoverBgTint,
                    fontSize: 12,
                    lineHeight: 1.65,
                    color: color.textBody,
                  }}
                >
                  <Check size={14} style={{ color: color.primary, flexShrink: 0, marginTop: 2 }} />
                  <span>{goal}</span>
                </div>
              ))}
            </div>
          )}
        </header>

        {/* ── 本文 ── */}
        <div
          ref={articleRef}
          data-lesson-article
          style={{ padding: '30px clamp(22px, 4vw, 46px) 40px' }}
        >
          {!isFallback && (
            <div
              className="flex items-center"
              style={{
                gap: 8,
                marginBottom: 20,
                padding: '9px 14px',
                borderRadius: radius.nav,
                background: color.hoverBgTint,
                ...font.caption,
                color: color.textMuted,
              }}
            >
              <Sparkles size={13} style={{ color: color.primary, flexShrink: 0 }} />
              分からない文章はドラッグで選択すると、解説・AIへの質問・クリップができます
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
            doc.blocks.map((block) => (
              <LessonBlockView key={block.id} block={block} flashing={flashBlockId === block.id} />
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
