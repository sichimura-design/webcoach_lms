import { NotebookPen, Plus } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { useNoteList } from '../../hooks/useNoteList';

/**
 * 「どのノートに入れるか」を1度だけ聞くピッカー。
 *
 * 教材からクリップするたびに毎回聞くのではなく、
 * 追加先が決まっていないときにだけ出す（決めたら noteTargetStore が覚える）。
 * 最初の選択肢を「〈レッスン名〉のノートを作る」にしてあるのは、
 * ほとんどの人がそのレッスンのノートを1つ持つだけで足りるため。
 */
interface NoteTargetPickerProps {
  suggestedTitle: string;
  onPickNote: (noteId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

/** 一覧に出す件数。多いと「選ぶ」作業になってしまう */
const RECENT_COUNT = 5;

export function NoteTargetPicker({
  suggestedTitle,
  onPickNote,
  onCreateNew,
  onCancel,
}: NoteTargetPickerProps) {
  const { items, loading } = useNoteList();
  const recent = items.slice(0, RECENT_COUNT);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="どのノートに追加しますか"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(31,29,30,.38)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: color.surface,
          borderRadius: radius.hero,
          boxShadow: shadow.hero,
          padding: '26px 26px 22px',
          fontFamily: font.family,
        }}
      >
        <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>どのノートに追加しますか？</h2>
        <p style={{ ...font.caption, color: color.textMuted, margin: '8px 0 18px', lineHeight: 1.8 }}>
          一度選ぶと、このレッスンからの取り込みは次回から同じノートに入ります。
        </p>

        <button
          type="button"
          onClick={onCreateNew}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            width: '100%',
            padding: '14px 16px',
            border: `1px solid ${color.primaryBorder}`,
            borderRadius: radius.md,
            background: color.primarySoft,
            color: color.primary,
            fontFamily: 'inherit',
            fontSize: 13.5,
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <Plus size={17} style={{ flexShrink: 0 }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            「{suggestedTitle}」のノートを作る
          </span>
        </button>

        {recent.length > 0 && (
          <>
            <div style={{ ...font.caption, color: color.textSubtle, margin: '18px 0 8px' }}>
              最近のノートに追加する
            </div>
            <div className="flex flex-col" style={{ gap: 6 }}>
              {recent.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onPickNote(note.id)}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    width: '100%',
                    padding: '12px 14px',
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.md,
                    background: color.surface,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <NotebookPen size={15} style={{ color: color.textFaint, flexShrink: 0 }} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      ...font.rowTitle,
                      color: color.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {note.title}
                  </span>
                  <span style={{ ...font.caption, color: color.textFaint, flexShrink: 0 }}>
                    {note.blockCount}件
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {loading && recent.length === 0 && (
          <p style={{ ...font.caption, color: color.textSubtle, margin: '16px 0 0' }}>読み込んでいます…</p>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            width: '100%',
            marginTop: 16,
            padding: '12px 16px',
            border: `1px solid ${color.borderSoft}`,
            borderRadius: radius.md,
            background: color.surface,
            color: color.textMuted,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          やめる
        </button>
      </div>
    </div>
  );
}

export default NoteTargetPicker;
