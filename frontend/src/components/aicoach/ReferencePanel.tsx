import { BookOpen, ExternalLink, Image as ImageIcon, Target } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { AiCoachContext } from '../../types/aiCoach';
import { AiSkillId, AI_SKILL_MODE_LABEL } from '../../types/aiSkill';
import { LessonBlock, LESSON_BLOCK_KIND_LABEL } from '../../types/lesson';

/**
 * 右カラム：参照情報（要件§5）。
 *
 * 「AIがいま何を見ているか」を隠さないための列。専門モードに入ると
 * 参照するものが増える（教材＋課題基準＋添付画像）ので、それを明示する。
 * ここが空のままだと、添削結果がどこから来たのか確かめられない。
 */
interface ReferencePanelProps {
  context: AiCoachContext;
  skillId: AiSkillId;
  /** 会話で添付されている画像（最新のもの） */
  image: string | null;
  /** 教材ブロック。読み込めていなければ空配列 */
  blocks: LessonBlock[];
  /** 引用中の教材本文 */
  quoteText: string | null;
  /** 教材の該当箇所を開く。教材ページへ戻る導線になる */
  onOpenLesson: (blockId?: string) => void;
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center" style={{ gap: 5, marginBottom: 6 }}>
      {icon}
      <strong style={{ fontSize: 10, fontWeight: 800, color: color.text }}>{children}</strong>
    </div>
  );
}

export function ReferencePanel({
  context,
  skillId,
  image,
  blocks,
  quoteText,
  onOpenLesson,
}: ReferencePanelProps) {
  const taskBlocks = blocks.filter((b) => b.kind === 'task' || b.kind === 'callout');
  const hasAnything =
    !!context.lessonTitle || !!image || !!quoteText || blocks.length > 0;

  return (
    <aside
      aria-label="参照情報"
      className="flex flex-col"
      style={{
        height: '100%',
        minWidth: 0,
        overflow: 'hidden',
        background: color.surface,
        borderLeft: `1px solid ${color.border}`,
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: 8, minHeight: 52, padding: '0 14px', borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}
      >
        <strong style={{ ...font.rowTitle, color: color.text }}>参照情報</strong>
        {skillId !== 'auto' && (
          <span
            style={{
              marginLeft: 'auto',
              padding: '3px 8px',
              borderRadius: 999,
              background: color.primarySoft,
              color: color.primary,
              fontSize: 9.5,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {AI_SKILL_MODE_LABEL[skillId]}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, minHeight: 0 }}>
        {!hasAnything && (
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.8, color: color.textFaint }}>
            まだ参照しているものはありません。教材のAIコーチから拡大すると、そのとき読んでいた教材と添付画像が引き継がれます。
          </p>
        )}

        {context.lessonTitle && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle icon={<BookOpen size={12} style={{ color: color.primary }} />}>
              教材
            </SectionTitle>
            <div
              style={{
                padding: '9px 10px',
                border: `1px solid ${color.border}`,
                borderRadius: 9,
                background: color.pageBg,
              }}
            >
              {context.courseName && (
                <div style={{ fontSize: 9.5, color: color.textFaint, marginBottom: 2 }}>
                  {context.courseName}
                </div>
              )}
              <div style={{ fontSize: 11.5, fontWeight: 700, color: color.text }}>
                {context.lessonTitle}
              </div>
              {context.heading && (
                <div style={{ fontSize: 10.5, color: color.textSecondary, marginTop: 3 }}>
                  ＞ {context.heading}
                </div>
              )}
              <button
                type="button"
                onClick={() => onOpenLesson()}
                className="inline-flex items-center"
                style={{
                  marginTop: 7,
                  gap: 4,
                  height: 26,
                  padding: '0 9px',
                  border: `1px solid ${color.primaryBorder}`,
                  borderRadius: 8,
                  background: color.surface,
                  color: color.primary,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <ExternalLink size={11} /> 教材を開く
              </button>
            </div>
          </div>
        )}

        {skillId === 'design-review' && taskBlocks.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle icon={<Target size={12} style={{ color: color.primary }} />}>
              課題の評価基準
            </SectionTitle>
            {taskBlocks.map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={() => onOpenLesson(block.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  marginBottom: 6,
                  padding: '9px 10px',
                  border: `1px solid ${color.border}`,
                  borderRadius: 9,
                  background: color.surface,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, color: color.textFaint, marginBottom: 2 }}>
                  {LESSON_BLOCK_KIND_LABEL[block.kind]}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: color.text }}>{block.heading}</div>
                <p
                  style={{
                    margin: '3px 0 0',
                    fontSize: 10.5,
                    lineHeight: 1.7,
                    color: color.textSecondary,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {block.plain}
                </p>
              </button>
            ))}
          </div>
        )}

        {quoteText && (
          <div style={{ marginBottom: 16 }}>
            <SectionTitle icon={<BookOpen size={12} style={{ color: color.primary }} />}>
              引用中の教材本文
            </SectionTitle>
            <p
              style={{
                margin: 0,
                padding: '9px 10px',
                borderLeft: `3px solid ${color.primary}`,
                borderRadius: 8,
                background: color.primarySoft,
                fontSize: 10.5,
                lineHeight: 1.75,
                color: color.textSecondary,
              }}
            >
              {quoteText}
            </p>
          </div>
        )}

        {image && (
          <div>
            <SectionTitle icon={<ImageIcon size={12} style={{ color: color.primary }} />}>
              添付画像
            </SectionTitle>
            <img
              src={image}
              alt="添付画像"
              style={{
                width: '100%',
                borderRadius: 9,
                border: `1px solid ${color.border}`,
                objectFit: 'contain',
                background: color.pageBg,
              }}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

export default ReferencePanel;
