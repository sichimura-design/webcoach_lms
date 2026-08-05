import { MessageSquarePlus, Trash2 } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { AiCoachSession } from '../../types/aiCoach';
import { AI_SKILL_SHORT_LABEL } from '../../types/aiSkill';

/**
 * 左カラム：会話履歴（要件§5）。
 *
 * タイトルは最初のユーザー発言から導出したものを store が持っている。
 * ここで再計算しないのは、一覧とヘッダーで別の名前になるのを避けるため。
 */
interface ConversationListProps {
  sessions: AiCoachSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

function relativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'たったいま';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  return `${Math.floor(diffHour / 24)}日前`;
}

export function ConversationList({
  sessions,
  activeId,
  onSelect,
  onCreate,
  onDelete,
}: ConversationListProps) {
  return (
    <aside
      aria-label="会話履歴"
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
        style={{ gap: 8, minHeight: 52, padding: '0 14px', borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}
      >
        <strong style={{ ...font.rowTitle, color: color.text }}>会話履歴</strong>
        <button
          type="button"
          onClick={onCreate}
          title="新しい相談を始める"
          aria-label="新しい相談を始める"
          className="inline-flex items-center"
          style={{
            marginLeft: 'auto',
            gap: 4,
            height: 28,
            padding: '0 9px',
            border: `1px solid ${color.primaryBorder}`,
            borderRadius: 8,
            background: color.primarySoft,
            color: color.primary,
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <MessageSquarePlus size={12} /> 新規
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10, minHeight: 0 }}>
        {sessions.length === 0 && (
          <p style={{ margin: 0, padding: '10px 4px', fontSize: 11, lineHeight: 1.8, color: color.textFaint }}>
            まだ相談がありません。「新規」から始めるか、教材のAIコーチから拡大してください。
          </p>
        )}

        {sessions.map((session) => {
          const active = session.id === activeId;
          return (
            <div
              key={session.id}
              className="flex items-start"
              style={{
                gap: 6,
                marginBottom: 6,
                padding: '9px 10px',
                border: `1px solid ${active ? color.primaryBorder : color.border}`,
                borderRadius: 10,
                background: active ? color.primaryTint : color.surface,
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(session.id)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: active ? color.primary : color.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {session.title}
                </div>
                <div
                  className="flex items-center"
                  style={{ gap: 5, marginTop: 3, fontSize: 9.5, color: color.textFaint }}
                >
                  {session.skillId !== 'auto' && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: color.primarySoft,
                        color: color.primary,
                        fontWeight: 700,
                      }}
                    >
                      {AI_SKILL_SHORT_LABEL[session.skillId]}
                    </span>
                  )}
                  {session.context.lessonTitle && (
                    <span
                      style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {session.context.lessonTitle}
                    </span>
                  )}
                  <span style={{ flexShrink: 0 }}>{relativeTime(session.updatedAt)}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onDelete(session.id)}
                aria-label={`${session.title}を削除`}
                title="この相談を削除"
                style={{
                  width: 24,
                  height: 24,
                  display: 'grid',
                  placeItems: 'center',
                  border: 0,
                  borderRadius: 6,
                  background: 'transparent',
                  color: color.textFaint,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default ConversationList;
