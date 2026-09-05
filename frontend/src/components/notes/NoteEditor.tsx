import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Note, NoteBlockInput, NoteBlockInsert, NoteBlockPatch, NoteSourceRef } from '../../types/notes';
import { NOTE_IMAGE_ACCEPT, NOTE_IMAGE_MAX_BYTES, putNoteImage } from '../../utils/noteImageStore';
import NoteBlockView from './NoteBlockView';
import { DropPosition, NoteBlockRow } from './NoteBlockRow';
import { InsertKind, NoteEditorToolbar, TEXT_PREFIX } from './NoteEditorToolbar';

/**
 * ノート面（デザイン『マイノート 改善案』⑤⑥⑦）。
 *
 * 上から「タイトル欄 → 常設ツールバー → 本文のブロック → 続きを書く欄」。
 * 🔴 何を足せるのかが最初から見えている状態にする。以前は本文の下端に
 *    「＋ 画像・見出し・箇条書きを追加」が1つあるだけで、ノートを作る中身の操作が
 *    画面から読み取れなかった（レビュー指摘）。ツールバーは本文より上に置くが、
 *    ボタンは「足す」だけに絞り、タイトルと本文の間で完結させる。
 * 🔴「クリップを追加」「AI回答を追加」のボタンは置かない。この画面には素材が無く、
 *    以前はトーストを出して教材ページへ強制遷移していた。ツールバーの「教材から引用」は
 *    やり方の説明を出すだけで、勝手に画面を移動しない（NoteEditorToolbar）。
 *
 * 重要・削除・保存先・保存状態は上部バー（NoteEditorBar）にある。紙の中は書く場所だけ。
 */
interface NoteEditorProps {
  note: Note;
  onRename: (title: string) => void;
  /** ブロックを追加する。index を渡すとその位置に差し込む */
  onAddBlock: (input: NoteBlockInput & NoteBlockInsert) => Promise<{ id: string } | null>;
  onPatchBlock: (blockId: string, patch: NoteBlockPatch) => void;
  onMoveBlock: (blockId: string, toIndex: number) => void;
  onRemoveBlock: (blockId: string) => void;
  onOpenSource: (source: NoteSourceRef, blockId: string | null) => void;
  /** 画像の取り込みに失敗したときの通知 */
  onError: (message: string) => void;
}

export function NoteEditor({
  note,
  onRename,
  onAddBlock,
  onPatchBlock,
  onMoveBlock,
  onRemoveBlock,
  onOpenSource,
  onError,
}: NoteEditorProps) {
  const [titleDraft, setTitleDraft] = useState(note.title);

  const [tail, setTail] = useState('');
  const tailRef = useRef<HTMLTextAreaElement>(null);
  /**
   * 未保存の下書きを ref にも持つ。
   * 「保存する」を押すと textarea の blur と click が続けて走るので、
   * state だけで判定すると同じ文章を2回足してしまう。
   * ref を保存時に空にしておけば、2回目の呼び出しは何もしない。
   */
  const pendingRef = useRef('');

  /** ＋／ツールバーから作った直後のブロック。開いた瞬間に書き始められるよう編集状態で出す */
  const [autoEditId, setAutoEditId] = useState<string | null>(null);

  /** 画像の input は1つだけ持ち、どの位置に差し込むかは ref で覚える */
  const fileRef = useRef<HTMLInputElement>(null);
  const insertAtRef = useRef<number | undefined>(undefined);

  /** ⠿ のドラッグ。掴んでいる行と、線を出す行 */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<{ index: number; position: DropPosition } | null>(null);

  const isEmptyNote = note.blocks.length === 0;

  useEffect(() => {
    setTitleDraft(note.title);
    setTail('');
    pendingRef.current = '';
    setAutoEditId(null);
    setDragIndex(null);
    setDropAt(null);
  }, [note.id, note.title]);

  // 新規ノートは開いた瞬間から書ける（＝まっさらに書き始められる）
  useEffect(() => {
    if (isEmptyNote) tailRef.current?.focus();
  }, [note.id, isEmptyNote]);

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (!next) {
      setTitleDraft(note.title);
      return;
    }
    if (next !== note.title) onRename(next);
  };

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

  const insertText = async (kind: Exclude<InsertKind, 'image'>, index?: number) => {
    const block = await onAddBlock({ kind: 'text', text: TEXT_PREFIX[kind], index });
    if (block) setAutoEditId(block.id);
  };

  /** ＋（行の前に差し込む）とツールバー（末尾に足す）の共通入口。index 省略で末尾 */
  const pickInsert = (kind: InsertKind, index?: number) => {
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

  /** ドロップ先（行 index の前／後）を、配列上の移動先に直す */
  const handleDrop = (index: number, position: DropPosition) => {
    const from = dragIndex;
    setDragIndex(null);
    setDropAt(null);
    if (from === null) return;
    let to = position === 'before' ? index : index + 1;
    if (from < to) to -= 1; // 自分を抜いたぶん、下へ動かすときは1つ手前になる
    if (to === from) return;
    onMoveBlock(note.blocks[from].id, to);
  };

  return (
    <section
      aria-label="ノート"
      style={{
        width: '100%',
        maxWidth: 900,
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: 'var(--dc-shadow-card)',
        overflow: 'hidden',
        // 親（MyNotesPage のノート面）が伸びるので、紙もそれに合わせて伸びる
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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

      {/* ⑤ タイトルは入力欄として枠を持たせ、本文と境目を作る */}
      <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--dc-border)' }}>
        <label
          htmlFor={`note-title-${note.id}`}
          style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--dc-text-subtle)', marginBottom: 6 }}
        >
          タイトル
        </label>
        <input
          id={`note-title-${note.id}`}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setTitleDraft(note.title);
              e.currentTarget.blur();
            }
          }}
          placeholder="無題のノート"
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            padding: 0,
            border: 0,
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 22,
            fontWeight: 900,
            lineHeight: 1.4,
            color: '#1F1D1E',
            outline: 'none',
          }}
        />
        {note.source && (
          <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--dc-text-muted)' }}>
            {note.source.courseName} / {note.source.lessonTitle}
          </div>
        )}
      </div>

      {/* ⑥ 常設のツールバー */}
      <NoteEditorToolbar
        onInsert={(kind) => pickInsert(kind)}
        sourceLesson={
          note.source
            ? { label: note.source.lessonTitle, onOpen: () => onOpenSource(note.source!, null) }
            : null
        }
      />

      {/* ⑦ 本文はブロックの集まり。行にホバーすると左に ⠿ と ＋ が出る */}
      <div
        style={{ flex: 1, padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: 2 }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null);
        }}
      >
        {note.blocks.map((block, i) => (
          <NoteBlockRow
            key={block.id}
            index={i}
            total={note.blocks.length}
            onInsert={pickInsert}
            onMove={(from, to) => onMoveBlock(note.blocks[from].id, to)}
            onRemove={() => onRemoveBlock(block.id)}
            dragging={dragIndex === i}
            dropIndicator={dropAt?.index === i && dragIndex !== i ? dropAt.position : null}
            onDragStartRow={setDragIndex}
            onDragOverRow={(index, position) => {
              if (dropAt?.index !== index || dropAt.position !== position) setDropAt({ index, position });
            }}
            onDropRow={handleDrop}
            onDragEndRow={() => {
              setDragIndex(null);
              setDropAt(null);
            }}
          >
            <NoteBlockView
              block={block}
              autoEdit={block.id === autoEditId}
              onPatch={onPatchBlock}
              onOpenSource={onOpenSource}
            />
          </NoteBlockRow>
        ))}

        {/*
          ── 末尾の書き足し欄。常にここが「次に書く場所」になる ──
          🔴 紙の下端まで伸ばして、余白をクリックしても入力に入れる。
             以前は2行分の textarea だけで、下に広い空白が残って
             「ここから下は何なのか」が分からなかった。
        */}
        <NoteBlockRow tail index={note.blocks.length} total={note.blocks.length} onInsert={pickInsert}>
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
              placeholder={isEmptyNote ? 'ここに入力して、自由にメモを書いていきましょう…' : '続きを書く…'}
              rows={Math.max(2, tail.split('\n').length)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                flex: 1,
                border: 0,
                padding: '4px 0',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 13.5,
                lineHeight: 1.9,
                color: '#4A4245',
                resize: 'none',
                outline: 'none',
              }}
            />
          </div>
        </NoteBlockRow>

        {/*
          書いたものが確定したかどうかは、押せるボタンで示す。
          🔴 未確定の入力があるときだけ出す。常設すると、空のノートの下端に
             押せないボタンと注記が居座って余白が締まらない。
        */}
        {tail.trim() && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, paddingLeft: 34 }}>
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
                borderRadius: 'var(--dc-radius-md)',
                background: 'var(--dc-primary)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Check size={15} /> 保存する
            </button>
            <span style={{ fontSize: 11.5, color: 'var(--dc-text-subtle)' }}>Ctrl+Enter でも保存できます</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default NoteEditor;
