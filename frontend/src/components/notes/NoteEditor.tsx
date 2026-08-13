import { useEffect, useRef, useState } from 'react';
import { Link2, MessageSquareText, Pencil, PenLine, Star, Trash2 } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { Note, NoteSourceRef } from '../../types/notes';
import NoteBlockView from './NoteBlockView';

/**
 * ノート面。クリーム地＋左端の綴じ代で「紙」に見せる。
 *
 * 要件の「メインカラーを中心に適度な色やハイライトを使い、自分のノートを作っていく
 * 楽しさも感じられるデザイン」への回答。他画面の白いカードと同じ見た目にすると、
 * 「与えられた画面」に文字を入れている感じから抜けない。
 */
interface NoteEditorProps {
  note: Note;
  onRename: (title: string) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onAddText: (text: string) => void;
  onAddClipPrompt: () => void;
  onAddAnswerPrompt: () => void;
  onPatchBlock: (blockId: string, patch: { text?: string; answer?: string }) => void;
  onRemoveBlock: (blockId: string) => void;
  onOpenSource: (source: NoteSourceRef, blockId: string | null) => void;
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const ACTION_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 38,
  padding: '0 16px',
  border: `1px solid ${color.borderSoft}`,
  borderRadius: radius.md,
  background: color.surface,
  color: color.textStrong,
  fontFamily: 'inherit',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
};

export function NoteEditor({
  note,
  onRename,
  onToggleFavorite,
  onDelete,
  onAddText,
  onAddClipPrompt,
  onAddAnswerPrompt,
  onPatchBlock,
  onRemoveBlock,
  onOpenSource,
}: NoteEditorProps) {
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const [tail, setTail] = useState('');
  const tailRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitleDraft(note.title);
    setEditingTitle(false);
    setTail('');
  }, [note.id, note.title]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.select();
  }, [editingTitle]);

  const commitTail = () => {
    const text = tail.trim();
    if (!text) return;
    onAddText(text);
    setTail('');
  };

  return (
    <section
      style={{
        background: color.notePaper,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        padding: '26px 30px 30px 44px',
        position: 'relative',
        minHeight: 460,
      }}
    >
      {/* 綴じ代。紙であることを1本の線だけで示す */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 24,
          top: 20,
          bottom: 20,
          width: 0,
          borderLeft: `1px dashed ${color.noteRule}`,
        }}
      />

      {/* ── ヘッダー ── */}
      <div className="flex items-start" style={{ gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                onRename(titleDraft.trim() || note.title);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  setTitleDraft(note.title);
                  setEditingTitle(false);
                }
              }}
              style={{
                width: '100%',
                border: 0,
                borderBottom: `2px solid ${color.primaryBorder}`,
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 24,
                fontWeight: 900,
                color: color.text,
                outline: 'none',
                padding: '0 0 4px',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                gap: 10,
                maxWidth: '100%',
                border: 0,
                background: 'transparent',
                padding: 0,
                fontFamily: 'inherit',
                fontSize: 24,
                fontWeight: 900,
                color: color.text,
                cursor: 'text',
                textAlign: 'left',
              }}
            >
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {note.title}
              </span>
              <Pencil size={15} style={{ color: color.textFaint, flexShrink: 0 }} />
            </button>
          )}

          <div style={{ ...font.caption, color: color.textMuted, marginTop: 8 }}>
            {note.source && (
              <>
                {note.source.courseName} / {note.source.lessonTitle}
                <span style={{ margin: '0 8px' }}>・</span>
              </>
            )}
            更新日：{formatUpdatedAt(note.updatedAt)}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={note.favorite ? 'お気に入りを外す' : 'お気に入りに追加'}
          aria-pressed={note.favorite}
          className="grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            width: 32, height: 32, border: 0, borderRadius: 8, background: 'transparent',
            color: note.favorite ? color.primary : color.textFaint, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Star size={18} fill={note.favorite ? color.primary : 'none'} />
        </button>

        <button
          type="button"
          onClick={onDelete}
          aria-label="このノートを削除"
          title="ノートを削除"
          className="grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            width: 32, height: 32, border: 0, borderRadius: 8, background: 'transparent',
            color: color.textFaint, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <Trash2 size={17} />
        </button>
      </div>

      {/* ── 追加ボタン3種。ノートに入れられるものを最初に見せる ── */}
      <div className="flex flex-wrap" style={{ gap: 10, margin: '20px 0 22px' }}>
        <button
          type="button"
          onClick={() => tailRef.current?.focus()}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={ACTION_STYLE}
        >
          <PenLine size={15} style={{ color: color.primary }} /> 本文を書く
        </button>
        <button
          type="button"
          onClick={onAddClipPrompt}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={ACTION_STYLE}
        >
          <Link2 size={15} style={{ color: color.primary }} /> クリップを追加
        </button>
        <button
          type="button"
          onClick={onAddAnswerPrompt}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={ACTION_STYLE}
        >
          <MessageSquareText size={15} style={{ color: color.primary }} /> AI回答を追加
        </button>
      </div>

      {/* ── 本文（3種が混ざって並ぶ） ── */}
      <div>
        {note.blocks.map((block) => (
          <NoteBlockView
            key={block.id}
            block={block}
            onPatch={onPatchBlock}
            onRemove={onRemoveBlock}
            onOpenSource={onOpenSource}
          />
        ))}
      </div>

      {/* ── 末尾の書き足し欄。常にここが「次に書く場所」になる ── */}
      <textarea
        ref={tailRef}
        value={tail}
        onChange={(e) => setTail(e.target.value)}
        onBlur={commitTail}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            commitTail();
          }
        }}
        placeholder="ここに入力して、自由にメモを書いていきましょう…"
        rows={Math.max(2, tail.split('\n').length)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 10,
          border: 0,
          background: 'transparent',
          fontFamily: 'inherit',
          fontSize: 13.5,
          lineHeight: 2,
          color: color.textStrong,
          resize: 'none',
          outline: 'none',
        }}
      />
    </section>
  );
}

export default NoteEditor;
