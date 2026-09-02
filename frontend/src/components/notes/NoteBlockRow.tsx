import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Heading, Image as ImageIcon, List, ListChecks, Plus, Trash2, Type } from 'lucide-react';
import { useDismissable } from '../../hooks/useDismissable';
import { NOTE_BLOCK_DRAG_TYPE, hasBlockDrag } from './folderRows';
import { INSERT_LABEL, InsertKind } from './NoteEditorToolbar';

/**
 * ノート面の1行（デザイン『マイノート 改善案』⑦）。
 * 行にホバーすると左に ⠿（掴み手）と ＋ が出る。何ができるかを触れば分かる。
 *
 *   ⠿ … ドラッグで並べ替え。クリックすると「上に移動／下に移動／削除」のメニュー
 *        （ドラッグが使えないキーボード・タッチ向け。削除もここに集めた）
 *   ＋ … この行の前に 画像／見出し／箇条書き／チェックリスト／文章 を差し込む
 *
 * 末尾の「続きを書く…」の行（tail）は ＋ だけ。動かすものも消すものも無い。
 */
export type DropPosition = 'before' | 'after';

interface NoteBlockRowProps {
  index: number;
  total: number;
  children: React.ReactNode;
  onInsert: (kind: InsertKind, index: number) => void;
  /** 末尾行。⠿ を出さず、ドロップ先にもならない */
  tail?: boolean;
  onMove?: (from: number, to: number) => void;
  onRemove?: () => void;
  /** ドラッグ中の行かどうか（薄く出す） */
  dragging?: boolean;
  /** この行に出すドロップ線 */
  dropIndicator?: DropPosition | null;
  onDragStartRow?: (index: number) => void;
  onDragOverRow?: (index: number, position: DropPosition) => void;
  onDropRow?: (index: number, position: DropPosition) => void;
  onDragEndRow?: () => void;
}

const INSERT_ITEMS: Array<{ kind: InsertKind; icon: React.ReactNode }> = [
  { kind: 'text', icon: <Type size={15} /> },
  { kind: 'heading', icon: <Heading size={15} /> },
  { kind: 'list', icon: <List size={15} /> },
  { kind: 'task', icon: <ListChecks size={15} /> },
  { kind: 'image', icon: <ImageIcon size={15} /> },
];

export function NoteBlockRow({
  index,
  total,
  children,
  onInsert,
  tail,
  onMove,
  onRemove,
  dragging,
  dropIndicator,
  onDragStartRow,
  onDragOverRow,
  onDropRow,
  onDragEndRow,
}: NoteBlockRowProps) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [gripOpen, setGripOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  useDismissable(plusRef, plusOpen, () => setPlusOpen(false));
  useDismissable(gripRef, gripOpen, () => setGripOpen(false));

  const positionOf = (e: React.DragEvent): DropPosition => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return 'after';
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  };

  const className = [
    'notes-block',
    dragging ? 'is-dragging' : '',
    dropIndicator === 'before' ? 'is-drop-before' : '',
    dropIndicator === 'after' ? 'is-drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rowRef}
      className={className}
      onDragOver={
        tail
          ? undefined
          : (e) => {
              if (!hasBlockDrag(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              onDragOverRow?.(index, positionOf(e));
            }
      }
      onDrop={
        tail
          ? undefined
          : (e) => {
              if (!hasBlockDrag(e)) return;
              e.preventDefault();
              onDropRow?.(index, positionOf(e));
            }
      }
    >
      <span className={`notes-block-grip ${plusOpen || gripOpen ? 'is-open' : ''}`}>
        {!tail && (
          <div ref={gripRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="notes-grip-btn notes-grip-btn--drag focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              aria-label="このブロックを動かす"
              aria-haspopup="menu"
              aria-expanded={gripOpen}
              title="ドラッグで並べ替え。クリックでメニュー"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(NOTE_BLOCK_DRAG_TYPE, String(index));
                e.dataTransfer.effectAllowed = 'move';
                setGripOpen(false);
                onDragStartRow?.(index);
              }}
              onDragEnd={() => onDragEndRow?.()}
              onClick={() => setGripOpen((v) => !v)}
            >
              <GripVertical size={14} />
            </button>
            {gripOpen && (
              <div role="menu" className="notes-menu" style={{ top: 24, left: 0, minWidth: 170 }}>
                <button
                  type="button"
                  role="menuitem"
                  className="notes-menu-item"
                  disabled={index === 0}
                  style={index === 0 ? { opacity: 0.4, cursor: 'default' } : undefined}
                  onClick={() => {
                    setGripOpen(false);
                    onMove?.(index, index - 1);
                  }}
                >
                  <ArrowUp size={14} /> 上に移動
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="notes-menu-item"
                  disabled={index >= total - 1}
                  style={index >= total - 1 ? { opacity: 0.4, cursor: 'default' } : undefined}
                  onClick={() => {
                    setGripOpen(false);
                    onMove?.(index, index + 1);
                  }}
                >
                  <ArrowDown size={14} /> 下に移動
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="notes-menu-item is-danger"
                  onClick={() => {
                    setGripOpen(false);
                    onRemove?.();
                  }}
                >
                  <Trash2 size={14} /> 削除
                </button>
              </div>
            )}
          </div>
        )}

        <div ref={plusRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="notes-grip-btn focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ color: '#9E9E9E' }}
            aria-label={tail ? '末尾に追加' : 'この上に追加'}
            aria-haspopup="menu"
            aria-expanded={plusOpen}
            onClick={() => setPlusOpen((v) => !v)}
          >
            <Plus size={14} />
          </button>
          {plusOpen && (
            <div role="menu" className="notes-menu" style={{ top: 24, left: 0, minWidth: 190 }}>
              {INSERT_ITEMS.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  role="menuitem"
                  className="notes-menu-item"
                  onClick={() => {
                    setPlusOpen(false);
                    onInsert(item.kind, index);
                  }}
                >
                  <span style={{ color: 'var(--dc-primary)', display: 'flex' }}>{item.icon}</span>
                  {INSERT_LABEL[item.kind]}
                </button>
              ))}
            </div>
          )}
        </div>
      </span>

      {children}
    </div>
  );
}

export default NoteBlockRow;
