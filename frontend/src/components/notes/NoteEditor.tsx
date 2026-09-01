import { useEffect, useRef, useState } from 'react';
import { Check, Heading, Image as ImageIcon, List, Pencil, Plus, Star, Trash2, Type } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { Note, NoteBlockInput, NoteBlockInsert, NoteBlockPatch, NoteSourceRef } from '../../types/notes';
import { NOTE_IMAGE_ACCEPT, NOTE_IMAGE_MAX_BYTES, putNoteImage } from '../../utils/noteImageStore';
import NoteBlockView from './NoteBlockView';
import { formatNoteStamp } from './noteDate';

/**
 * ノート面。クリーム地＋左端の綴じ代で「紙」に見せる。
 *
 * 要件の「メインカラーを中心に適度な色やハイライトを使い、自分のノートを作っていく
 * 楽しさも感じられるデザイン」への回答。他画面の白いカードと同じ見た目にすると、
 * 「与えられた画面」に文字を入れている感じから抜けない。
 *
 * 🔴 開いたら書ける画面にする（何をする画面か分からない、という指摘への対応）。
 *    - 本文より上に操作ボタンを並べない。上から「タイトル → 本文 → 続きを書く欄」だけ。
 *    - 新規ノート（ブロック0件）は末尾の入力欄にカーソルを置いて開く＝まっさらに書ける。
 *    - 追加は Notion 風の ＋。ブロックの隙間と末尾に出て、画像・見出し・箇条書きを差し込む。
 * 🔴 「クリップを追加」「AI回答を追加」ボタンは置かない。この画面には素材が無く、
 *    以前はトーストを出して教材ページへ強制遷移していた（案内を読む前に画面が変わる）。
 *    いまは ＋ メニューの中の説明文にして、勝手に画面を移動しない。
 */
interface NoteEditorProps {
  note: Note;
  onRename: (title: string) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  /** ブロックを追加する。index を渡すとその位置に差し込む */
  onAddBlock: (input: NoteBlockInput & NoteBlockInsert) => Promise<{ id: string } | null>;
  onPatchBlock: (blockId: string, patch: NoteBlockPatch) => void;
  onRemoveBlock: (blockId: string) => void;
  onOpenSource: (source: NoteSourceRef, blockId: string | null) => void;
  /** 画像の取り込みに失敗したときの通知 */
  onError: (message: string) => void;
}

type InsertKind = 'image' | 'heading' | 'list' | 'text';

/** ＋ メニューの中身。本文系は記法（noteText.tsx）の接頭辞を入れた空ブロックで始める */
const INSERT_ITEMS: Array<{ kind: InsertKind; label: string; icon: React.ReactNode }> = [
  { kind: 'image', label: '画像', icon: <ImageIcon size={15} /> },
  { kind: 'heading', label: '見出し', icon: <Heading size={15} /> },
  { kind: 'list', label: '箇条書き', icon: <List size={15} /> },
  { kind: 'text', label: '文章', icon: <Type size={15} /> },
];

const TEXT_PREFIX: Record<Exclude<InsertKind, 'image'>, string> = {
  heading: '## ',
  list: '- ',
  text: '',
};

/**
 * ブロックの間に差し込む ＋。
 * 末尾のものは always で常に出す（紙の一番下でホバー先を探させない）。
 */
function InsertPoint({
  index,
  always,
  onPick,
}: {
  index: number;
  always?: boolean;
  onPick: (kind: InsertKind, index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="group/insert relative flex items-center"
      style={{ gap: 8, height: always ? 34 : 18 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="ここに画像や見出しを追加"
        className={`grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD] ${
          always || open ? '' : 'opacity-0 group-hover/insert:opacity-100 focus-visible:opacity-100'
        }`}
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          border: `1px solid ${color.borderSoft}`,
          borderRadius: 7,
          background: color.surface,
          color: color.primary,
          cursor: 'pointer',
          transition: 'opacity .15s ease',
        }}
      >
        <Plus size={14} />
      </button>

      {always && (
        <span style={{ ...font.caption, color: color.textFaint }}>画像・見出し・箇条書きを追加</span>
      )}

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: always ? 32 : 22,
            left: 0,
            zIndex: 30,
            minWidth: 220,
            padding: 6,
            background: color.surface,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            boxShadow: '0 12px 28px -12px rgba(60,48,32,.35)',
          }}
        >
          {INSERT_ITEMS.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(item.kind, index);
              }}
              className="flex items-center w-full focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                gap: 9,
                padding: '8px 10px',
                border: 0,
                borderRadius: 8,
                background: 'transparent',
                color: color.textStrong,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: color.primary, display: 'flex' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          {/* 🔴 押せるボタンにしない。この画面には素材が無いので、
                 押させると「教材へ飛ばすだけ」になる（以前それをやっていた）。 */}
          <p
            style={{
              margin: '6px 4px 2px',
              paddingTop: 8,
              borderTop: `1px solid ${color.borderSoft}`,
              ...font.caption,
              color: color.textFaint,
              lineHeight: 1.7,
            }}
          >
            クリップは教材の文章を選ぶと、AI回答はAIコーチの「保存」から、このノートに入ります。
          </p>
        </div>
      )}
    </div>
  );
}

export function NoteEditor({
  note,
  onRename,
  onToggleFavorite,
  onDelete,
  onAddBlock,
  onPatchBlock,
  onRemoveBlock,
  onOpenSource,
  onError,
}: NoteEditorProps) {
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const [tail, setTail] = useState('');
  const tailRef = useRef<HTMLTextAreaElement>(null);
  /**
   * 未保存の下書きを ref にも持つ。
   * 「保存する」を押すと textarea の blur と click が続けて走るので、
   * state だけで判定すると同じ文章を2回足してしまう。
   * ref を保存時に空にしておけば、2回目の呼び出しは何もしない。
   */
  const pendingRef = useRef('');

  /** ＋ から作った直後のブロック。開いた瞬間に書き始められるよう編集状態で出す */
  const [autoEditId, setAutoEditId] = useState<string | null>(null);

  /** 画像の input は1つだけ持ち、どの位置に差し込むかは ref で覚える */
  const fileRef = useRef<HTMLInputElement>(null);
  const insertAtRef = useRef<number | undefined>(undefined);

  const isEmptyNote = note.blocks.length === 0;

  useEffect(() => {
    setTitleDraft(note.title);
    setEditingTitle(false);
    setTail('');
    pendingRef.current = '';
    setAutoEditId(null);
  }, [note.id, note.title]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.select();
  }, [editingTitle]);

  // 新規ノートは開いた瞬間から書ける（＝まっさらに書き始められる）
  useEffect(() => {
    if (isEmptyNote) tailRef.current?.focus();
  }, [note.id, isEmptyNote]);

  const commitTail = () => {
    const text = pendingRef.current.trim();
    if (!text) return;
    pendingRef.current = '';
    setTail('');
    void onAddBlock({ kind: 'text', text });
  };

  const changeTail = (value: string) => {
    pendingRef.current = value;
    setTail(value);
  };

  const insertText = async (kind: Exclude<InsertKind, 'image'>, index: number) => {
    const block = await onAddBlock({ kind: 'text', text: TEXT_PREFIX[kind], index });
    if (block) setAutoEditId(block.id);
  };

  const pickInsert = (kind: InsertKind, index: number) => {
    if (kind === 'image') {
      insertAtRef.current = index;
      fileRef.current?.click();
      return;
    }
    void insertText(kind, index);
  };

  const handleFile = async (file: File | undefined) => {
    const index = insertAtRef.current;
    insertAtRef.current = undefined;
    if (!file) return;
    if (file.size > NOTE_IMAGE_MAX_BYTES) {
      onError('画像が大きすぎます（12MBまで）');
      return;
    }
    try {
      const imageId = await putNoteImage(file);
      await onAddBlock({ kind: 'image', imageId, alt: file.name, index });
    } catch {
      onError('画像を取り込めませんでした');
    }
  };

  return (
    <section
      style={{
        background: color.notePaper,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        padding: '26px 30px 24px 44px',
        position: 'relative',
        minHeight: 460,
        // 親（MyNotesPage のノート面）が伸びるので、紙もそれに合わせて伸びる
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
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

      <input
        ref={fileRef}
        type="file"
        accept={NOTE_IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          // 同じファイルを続けて選べるように値を空にする
          e.target.value = '';
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
            更新日：{formatNoteStamp(note.updatedAt)}
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

      {/* ── 本文（4種が混ざって並ぶ）。ブロックの間に ＋ が出る ── */}
      <div style={{ marginTop: 18 }}>
        {note.blocks.map((block, i) => (
          <div key={block.id}>
            <InsertPoint index={i} onPick={pickInsert} />
            <NoteBlockView
              block={block}
              autoEdit={block.id === autoEditId}
              onPatch={onPatchBlock}
              onRemove={onRemoveBlock}
              onOpenSource={onOpenSource}
            />
          </div>
        ))}
      </div>

      {/*
        ── 末尾の書き足し欄。常にここが「次に書く場所」になる ──
        🔴 紙の下端まで伸ばして、余白をクリックしても入力に入れる。
           以前は2行分の textarea だけで、下に広い空白が残って
           「ここから下は何なのか」が分からなかった。
      */}
      <div
        onClick={() => tailRef.current?.focus()}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 96, cursor: 'text' }}
      >
        <textarea
          ref={tailRef}
          value={tail}
          onChange={(e) => changeTail(e.target.value)}
          onBlur={commitTail}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              commitTail();
            }
          }}
          placeholder={
            isEmptyNote
              ? 'ここに入力して、自由にメモを書いていきましょう…'
              : '続きを書く…'
          }
          rows={Math.max(2, tail.split('\n').length)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            flex: 1,
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
      </div>

      {/*
        書いたものが確定したかどうかは、押せるボタンで示す。
        🔴 未確定の入力があるときだけ出す。常設すると、空のノートの下端に
           押せないボタンと注記が居座って余白が締まらない。
      */}
      {tail.trim() ? (
        <div className="flex items-center" style={{ gap: 12, marginTop: 6 }}>
          <button
            type="button"
            // クリックで textarea が blur するので、フォーカスは移さないでおく
            onMouseDown={(e) => e.preventDefault()}
            onClick={commitTail}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              height: 38,
              padding: '0 20px',
              border: 0,
              borderRadius: radius.md,
              background: color.primary,
              color: color.textOnPrimary,
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Check size={15} /> 保存する
          </button>
          <span style={{ ...font.caption, color: color.textFaint }}>
            Ctrl+Enter でも保存できます
          </span>
        </div>
      ) : (
        <InsertPoint index={note.blocks.length} always onPick={pickInsert} />
      )}
    </section>
  );
}

export default NoteEditor;
