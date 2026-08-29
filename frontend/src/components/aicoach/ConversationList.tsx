import { MessageSquarePlus, Trash2, X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { AiCoachSession } from '../../types/aiCoach';
import { AI_SKILL_SHORT_LABEL } from '../../types/aiSkill';

/**
 * 会話履歴（要件§「会話履歴の考え方」）。
 *
 * メインチャットと専門モードの会話を完全に分けると文脈が切れ、全部を同じ会話に
 * 混ぜると履歴が読めなくなる。そこで2階層で見せる:
 *
 *   今日
 *   ・バナー課題について相談
 *   　└ 制作物添削
 *
 * 親子関係の実体は store（AiCoachSession.parentId）にあり、ここでは組み替えるだけ。
 * タイトルも store が最初のユーザー発言から導出したものを使う。
 * ここで再計算すると一覧とヘッダーで別の名前になる。
 */
interface ConversationListProps {
  sessions: AiCoachSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  /** 右からのドロワーで開いているときの「閉じる」。常設カラムのときは渡さない */
  onClose?: () => void;
}

function relativeTime(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'たったいま';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  return `${Math.floor(diffHour / 24)}日前`;
}

/** 日付の束。「今日」「昨日」より前はまとめる（相談は当日中に見返すものが大半） */
function dayGroup(iso: string): string {
  const started = new Date(iso);
  const today = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(started, today)) return '今日';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(started, yesterday)) return '昨日';
  return 'それ以前';
}

const GROUP_ORDER = ['今日', '昨日', 'それ以前'];

export function ConversationList({
  sessions,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onClose,
}: ConversationListProps) {
  // 親（メインチャット）と子（専門セッション）に分ける。
  // 親が消えている子は宙に浮かせず、親と同じ扱いで根に並べる。
  const byId = new Set(sessions.map((s) => s.id));
  const roots = sessions.filter((s) => !s.parentId || !byId.has(s.parentId));
  const childrenOf = (id: string) => sessions.filter((s) => s.parentId === id);

  const groups = GROUP_ORDER.map((label) => ({
    label,
    items: roots.filter((s) => dayGroup(s.updatedAt) === label),
  })).filter((g) => g.items.length > 0);

  return (
    <aside
      aria-label="会話履歴"
      className="flex flex-col"
      style={{
        height: '100%',
        minWidth: 0,
        overflow: 'hidden',
        background: color.surface,
        // 右からのドロワーで使うときは、境界と影は器（.wc-drawer-right）が持つ。
        // 左の常設カラムとして使うときだけ自分で右境界を引く。
        borderRight: onClose ? undefined : `1px solid ${color.border}`,
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
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="閉じる"
            aria-label="会話履歴を閉じる"
            className="grid place-items-center"
            style={{
              width: 28,
              height: 28,
              border: 0,
              borderRadius: 8,
              background: 'transparent',
              color: color.iconMuted,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10, minHeight: 0 }}>
        {sessions.length === 0 && (
          <p style={{ margin: 0, padding: '10px 4px', fontSize: 11, lineHeight: 1.8, color: color.textFaint }}>
            まだ相談がありません。「新規」から始めるか、教材のAIコーチから拡大してください。
          </p>
        )}

        {groups.map((group) => (
          <div key={group.label} style={{ marginBottom: 10 }}>
            <p
              style={{
                margin: '2px 4px 6px',
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '.06em',
                color: color.textFaint,
              }}
            >
              {group.label}
            </p>

            {group.items.map((session) => (
              <div key={session.id}>
                <Row
                  session={session}
                  active={session.id === activeId}
                  onSelect={onSelect}
                  onDelete={onDelete}
                />
                {childrenOf(session.id).map((child) => (
                  <div key={child.id} className="flex items-stretch" style={{ gap: 4, paddingLeft: 8 }}>
                    <span
                      aria-hidden
                      style={{ flexShrink: 0, width: 10, color: color.textFaint, fontSize: 10, paddingTop: 9 }}
                    >
                      └
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Row
                        session={child}
                        active={child.id === activeId}
                        onSelect={onSelect}
                        onDelete={onDelete}
                        nested
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Row({
  session,
  active,
  onSelect,
  onDelete,
  nested = false,
}: {
  session: AiCoachSession;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  nested?: boolean;
}) {
  // 子（専門セッション）は機能名を主に出す。何の相談かはタイトルより
  // 「どの機能で続けているか」の方が探すときの手がかりになる。
  const primary = nested && session.skillId !== 'auto' ? AI_SKILL_SHORT_LABEL[session.skillId] : session.title;
  const secondary = nested && session.skillId !== 'auto' ? session.title : null;

  return (
    <div
      className="flex items-start"
      style={{
        gap: 6,
        marginBottom: 6,
        padding: nested ? '7px 9px' : '9px 10px',
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
            fontSize: nested ? 11 : 11.5,
            fontWeight: 700,
            color: active ? color.primary : color.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {primary}
        </div>
        <div
          className="flex items-center"
          style={{ gap: 5, marginTop: 3, fontSize: 9.5, color: color.textFaint }}
        >
          {!nested && session.skillId !== 'auto' && (
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
          {(secondary || session.context.lessonTitle) && (
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {secondary ?? session.context.lessonTitle}
            </span>
          )}
          <span style={{ flexShrink: 0 }}>{relativeTime(session.updatedAt)}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onDelete(session.id)}
        aria-label={`${primary}を削除`}
        title={nested ? 'この専門セッションを削除' : 'この相談を削除（専門セッションも消えます）'}
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
}

export default ConversationList;
