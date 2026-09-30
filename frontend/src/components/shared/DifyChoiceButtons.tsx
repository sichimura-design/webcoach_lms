/**
 * Dify の「ボタン付き」応答の選択肢を、押せるボタンとして並べる（3つのチャットで共通）。
 *
 * 🔴 送るのは data-message の値そのまま（difyButtons.ts）。言い換えない。
 * 🔴 押せるのは最新の回答のボタンだけ（stale=false）。過去のステップの選択肢を押すと
 *    Dify のフローが巻き戻って手順がずれるので、過去の分は薄く表示して押せなくする（A-3）。
 */
import { color } from '../../theme/webcoachTheme';
import type { DifyMessageButton } from '../../utils/difyButtons';

interface DifyChoiceButtonsProps {
  buttons: DifyMessageButton[];
  /** 生成中など、いま一時的に押せない */
  disabled?: boolean;
  /** 最新の回答ではない（この選択は終わっている） */
  stale?: boolean;
  onPick: (value: string) => void;
}

export default function DifyChoiceButtons({ buttons, disabled = false, stale = false, onPick }: DifyChoiceButtonsProps) {
  if (buttons.length === 0) return null;
  const locked = disabled || stale;
  return (
    <div className="flex flex-wrap" style={{ gap: 6, marginTop: 6 }}>
      {buttons.map((btn, i) => (
        <button
          key={`${btn.value}-${i}`}
          type="button"
          disabled={locked}
          title={stale ? 'この選択は終わっています' : undefined}
          onClick={() => onPick(btn.value)}
          className="wc-ai-chip focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            border: `1px solid ${stale ? color.border : color.primaryBorder}`,
            borderRadius: 8,
            background: stale ? color.pageBg : color.hoverBgTint,
            color: stale ? color.textMuted : color.primary,
            padding: '8px 12px',
            fontFamily: 'inherit',
            fontSize: 11.5,
            fontWeight: 700,
            textAlign: 'left',
            cursor: locked ? 'default' : 'pointer',
            opacity: stale ? 0.55 : disabled ? 0.6 : 1,
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}
