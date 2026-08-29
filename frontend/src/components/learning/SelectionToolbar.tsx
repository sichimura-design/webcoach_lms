import { Lightbulb, MessageSquare, Bookmark } from 'lucide-react';
import { LessonSelection } from '../../hooks/useTextSelection';

/**
 * 教材本文を選択したときに、選択箇所の近くへ出す小さなツールバー。
 *   [💡解説] [AIに質問] [クリップ]
 *
 * data-selection-ui を付けておくと useTextSelection が
 * このUI上の mouseup を無視する（押した瞬間に選択が消えるのを防ぐ）。
 */
interface SelectionToolbarProps {
  selection: LessonSelection;
  onExplain: () => void;
  onAsk: () => void;
  onClip: () => void;
}

const TOOLBAR_WIDTH = 250;
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

export function SelectionToolbar({ selection, onExplain, onAsk, onClip }: SelectionToolbarProps) {
  const { rect } = selection;
  const left = Math.max(
    10,
    Math.min(window.innerWidth - TOOLBAR_WIDTH - 10, rect.left + rect.width / 2 - TOOLBAR_WIDTH / 2)
  );
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
      className="flex items-center"
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 80,
        gap: 2,
        padding: 5,
        width: TOOLBAR_WIDTH,
        borderRadius: 10,
        background: '#222A37',
        boxShadow: '0 16px 48px rgba(33,42,57,.24)',
      }}
    >
      <button type="button" onClick={onExplain} style={buttonStyle}>
        <Lightbulb size={13} /> 解説
      </button>
      <span aria-hidden style={{ width: 1, height: 18, background: 'rgba(255,255,255,.18)' }} />
      <button type="button" onClick={onAsk} style={buttonStyle}>
        <MessageSquare size={13} /> AIに質問
      </button>
      <span aria-hidden style={{ width: 1, height: 18, background: 'rgba(255,255,255,.18)' }} />
      <button type="button" onClick={onClip} style={buttonStyle}>
        <Bookmark size={13} /> クリップ
      </button>
    </div>
  );
}

export default SelectionToolbar;
