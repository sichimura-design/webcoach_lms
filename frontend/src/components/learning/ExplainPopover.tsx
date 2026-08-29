import { Lightbulb, X } from 'lucide-react';
import { font } from '../../theme/webcoachTheme';

/**
 * 💡かんたん解説。
 *
 * 選択した文章について「その場で短く」説明するだけの場所。ここで会話はさせない。
 * 深掘りは右のAIコーチへ移す（要件§6）ため、アクションは1つだけに絞っている。
 */
interface ExplainPopoverProps {
  anchor: { top: number; left: number };
  text: string | null;   // null = 生成中
  loading: boolean;
  onClose: () => void;
  onAskMore: () => void;
}

const WIDTH = 370;

export function ExplainPopover({ anchor, text, loading, onClose, onAskMore }: ExplainPopoverProps) {
  const left = Math.max(10, Math.min(window.innerWidth - WIDTH - 10, anchor.left));
  const top = Math.min(window.innerHeight - 230, anchor.top);

  return (
    <div
      data-selection-ui
      role="dialog"
      aria-label="かんたん解説"
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 79,
        width: `min(${WIDTH}px, calc(100vw - 24px))`,
        padding: 14,
        border: '1px solid #ECD998',
        borderRadius: 13,
        background: '#FFFDF5',
        boxShadow: '0 16px 48px rgba(33,42,57,.18)',
      }}
    >
      <div className="flex items-center" style={{ gap: 7, marginBottom: 8 }}>
        <Lightbulb size={14} style={{ color: '#B98A16' }} />
        <span style={{ ...font.rowTitle, color: '#5A4A16' }}>かんたん解説</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          aria-label="解説を閉じる"
          style={{
            width: 26, height: 26, display: 'grid', placeItems: 'center',
            border: '1px solid #EAD795', borderRadius: 8,
            background: '#fff', color: '#8A7326', cursor: 'pointer',
          }}
        >
          <X size={13} />
        </button>
      </div>

      <p style={{ margin: 0, color: '#55543F', fontSize: 11.5, lineHeight: 1.8, minHeight: 34 }}>
        {loading ? '教材の該当箇所と照合しています…' : text}
      </p>

      <div className="flex justify-end" style={{ marginTop: 10 }}>
        <button
          type="button"
          onClick={onAskMore}
          style={{
            height: 30, padding: '0 12px',
            border: '1px solid #EAD795', borderRadius: 8,
            background: '#fff', color: '#76621A',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          さらに詳しく質問
        </button>
      </div>
    </div>
  );
}

export default ExplainPopover;
