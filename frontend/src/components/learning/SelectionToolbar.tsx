import { Lightbulb, MessageSquare, Bookmark } from 'lucide-react';
import { LessonSelection } from '../../hooks/useTextSelection';

/**
 * 教材本文を選択したときに、選択箇所の近くへ出す小さなツールバー。
 *   [💡解説] [AIに質問] [クリップ]
 *
 * data-selection-ui を付けておくと useTextSelection が
 * このUI上の mouseup を無視する（押した瞬間に選択が消えるのを防ぐ）。
 *
 * 解説とAIへの質問は任意。マイノートの引用モーダル（notes/QuoteFromLessonModal）は
 * クリップだけを出すので、渡されたものだけを描き、幅もその数から決める。
 */
interface SelectionToolbarProps {
  selection: LessonSelection;
  onExplain?: () => void;
  onAsk?: () => void;
  onClip: () => void;
  /** 重ね順。既定は教材ページ用。モーダルの中で使うときは、その上に出す */
  zIndex?: number;
}

/** ボタン1つぶんの取り分。区切り線と外周のパディングは別で足す（3つで従来の250px相当） */
const BUTTON_WIDTH = 84;
const TOOLBAR_HEIGHT = 40;

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 30,
  padding: '0 10px',
  border: 0,
  borderRadius: 7,
  background: 'transparent',
  color: '#fff',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function SelectionToolbar({
  selection,
  onExplain,
  onAsk,
  onClip,
  zIndex = 80,
}: SelectionToolbarProps) {
  const { rect } = selection;

  const actions = [
    onExplain && { key: 'explain', icon: <Lightbulb size={13} />, label: '解説', onClick: onExplain },
    onAsk && { key: 'ask', icon: <MessageSquare size={13} />, label: 'AIに質問', onClick: onAsk },
    { key: 'clip', icon: <Bookmark size={13} />, label: 'クリップ', onClick: onClip },
  ].filter(Boolean) as { key: string; icon: React.ReactNode; label: string; onClick: () => void }[];

  const width = 10 + actions.length * BUTTON_WIDTH + (actions.length - 1);
  const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.left + rect.width / 2 - width / 2));
  // 選択の上に出す。上端に近ければ下へ回り込ませる。
  const above = rect.top - TOOLBAR_HEIGHT - 8;
  const top = above > 10 ? above : rect.bottom + 8;

  return (
    <div
      data-selection-ui
      role="toolbar"
      aria-label="選択した文章への操作"
      // ツールバー上で mousedown すると選択が解除されてしまうため抑止する
      onMouseDown={(e) => e.preventDefault()}
      className="flex items-center justify-center"
      style={{
        position: 'fixed',
        left,
        top,
        zIndex,
        gap: 2,
        padding: 5,
        width,
        borderRadius: 10,
        background: '#222A37',
        boxShadow: '0 16px 48px rgba(33,42,57,.24)',
      }}
    >
      {actions.map((action, i) => (
        <span key={action.key} className="flex items-center" style={{ gap: 2 }}>
          {i > 0 && (
            <span aria-hidden style={{ width: 1, height: 18, background: 'rgba(255,255,255,.18)' }} />
          )}
          <button type="button" onClick={action.onClick} style={buttonStyle}>
            {action.icon} {action.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export default SelectionToolbar;
