import { AlertTriangle, X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { CHAT_FOCUS_RING } from './chatTheme';

/**
 * 添付に失敗したときの知らせ。
 *
 * 以前は赤い小さな文字が入力欄の上に出たまま、消す手段が無かった（別の画像を
 * 選び直すまで残る）。role="alert" で読み上げ、×で閉じられるようにする。
 * ユーザーの操作の直後に出るものなので assertive（alert）でよい。
 */
interface ChatErrorNoticeProps {
  message: string | null;
  onDismiss: () => void;
}

export function ChatErrorNotice({ message, onDismiss }: ChatErrorNoticeProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start"
      style={{
        gap: 7,
        marginBottom: 8,
        padding: '7px 8px',
        borderRadius: 8,
        background: color.primarySoft,
        border: `1px solid ${color.primaryBorder}`,
      }}
    >
      <AlertTriangle size={13} style={{ color: color.primary, flexShrink: 0, marginTop: 2 }} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 11.5,
          lineHeight: 1.7,
          color: color.primary,
          fontFamily: font.family,
        }}
      >
        {message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="このお知らせを閉じる"
        className={CHAT_FOCUS_RING}
        style={{
          border: 'none',
          background: 'transparent',
          color: color.primary,
          cursor: 'pointer',
          padding: 2,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          fontFamily: 'inherit',
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default ChatErrorNotice;
