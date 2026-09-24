import { useEffect, useRef, useState } from 'react';
import { Note, NoteBlockInput, NoteBlockPatch, NoteSourceRef } from '../../types/notes';
import NoteBlockView from './NoteBlockView';
import NoteBodyEditor, { replaceRange } from './NoteBodyEditor';
import { InsertKind, NoteEditorToolbar, TEXT_PREFIX } from './NoteEditorToolbar';
import QuoteFromLessonModal, { QuoteTarget } from './QuoteFromLessonModal';

/**
 * ノート面。上から「タイトル → ツールバー → 本文 → 素材」。
 *
 * 🔴 本文は1枚の textarea（NoteBodyEditor。記法は下に敷いたミラーで描く）。ブロックに割らない。
 *    v5 まではここが「1段落＝1ブロック」で、書くたびに blur か Ctrl+Enter か
 *    「保存する」ボタンでブロックを確定させ、次の段落はまた新しいブロックだった。
 *    段落を跨いだカーソル移動も Backspace での結合もできず、
 *    「一行書くのにこんな謎の保存方法が要るのか」という指摘で1本にした。
 *    ⠿ ハンドル・行の ＋ メニュー・ドラッグ並べ替え（NoteBlockRow）は一緒に消している。
 *    **戻さないこと。**
 *
 * 🔴 保存ボタンは置かない。打つのを止めれば useNote が自動で送る（デバウンス800ms）。
 *    保存されたかどうかは上部バー（NoteEditorBar）の「保存しました HH:MM」が出す。
 *
 * 🔴 素材（教材からの引用クリップ・AI回答）は本文の下にまとめる。
 *    本文の途中には差し込めない。本文が1本になって「段落と段落の間」という
 *    座標が無くなったため。並べ替えも無い（追加順）。
 *
 * 🔴 紙に maxWidth を掛けない。以前 900px で左寄せに固定していて、広い画面では
 *    右側に大きな空白が残っていた。幅は親（.notes-main の padding）に任せる。
 *
 * 🔴「クリップを追加」「AI回答を追加」のボタンは置かない。素材はこの画面には無い。
 *    ツールバーの「教材から引用」は、教材を **モーダル** で開いてその場で引く
 *    （QuoteFromLessonModal）。押しても画面は /notes のまま動かない。
 *
 * 重要・削除・保存先・保存状態は上部バー（NoteEditorBar）にある。紙の中は書く場所だけ。
 */
interface NoteEditorProps {
  note: Note;
  onRename: (title: string) => void;
  /** 本文が変わった。保存は useNote がデバウンスして送る */
  onBodyChange: (body: string) => void;
  /** 本文から離れた。待たずに送る */
  onBodyFlush: () => void;
  /** 素材（クリップ / AI回答）を末尾に足す */
  onAddBlock: (input: NoteBlockInput) => Promise<{ id: string } | null>;
  onPatchBlock: (blockId: string, patch: NoteBlockPatch) => void;
  onRemoveBlock: (blockId: string) => void;
}

/** 行頭の記法（## / - / - [ ]）。差し替えるときに一度落とすために使う */
const LINE_PREFIX_RE = /^(##\s+|-\s+\[[ xX]\]\s+|-\s+)/;

/**
 * ツールバーの記法を本文へ差し込む差分。[from, to) を insert で置き換え、選択を sel に置く。
 * 全文ではなく差分で返すのは、textarea に execCommand で流し込んで Ctrl+Z を効かせるため。
 */
function applyInsert(
  kind: InsertKind,
  text: string,
  start: number,
  end: number
): { from: number; to: number; insert: string; selStart: number; selEnd: number } {
  if (kind === 'marker') {
    // 選択があれば囲む。無ければ ==== を置いて真ん中にカーソルを入れる
    const selected = text.slice(start, end);
    return {
      from: start,
      to: end,
      insert: `==${selected}==`,
      selStart: start + 2,
      selEnd: start + 2 + selected.length,
    };
  }

  // 行頭の記法。カーソルのある行の頭に付ける（別の記法が付いていたら差し替える）
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEnd = text.indexOf('\n', lineStart);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const current = line.slice(0, line.length - line.replace(LINE_PREFIX_RE, '').length);
  // 同じ記法がもう付いている行でもう一度押したら外す（付け外しのトグル）
  const already =
    kind === 'task' ? /^-\s+\[[ xX]\]\s+$/.test(current) : current === TEXT_PREFIX[kind];
  const prefix = already ? '' : TEXT_PREFIX[kind];
  // カーソルは行末へ。付けた直後に続きを打てる
  const caret = lineStart + prefix.length + (line.length - current.length);
  return { from: lineStart, to: lineStart + current.length, insert: prefix, selStart: caret, selEnd: caret };
}

export function NoteEditor({
  note,
  onRename,
  onBodyChange,
  onBodyFlush,
  onAddBlock,
  onPatchBlock,
  onRemoveBlock,
}: NoteEditorProps) {
  const [titleDraft, setTitleDraft] = useState(note.title);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 教材の引用モーダル。ツールバーの「教材から引用」と、クリップ／AI回答の
   * 出どころ行の両方から開く。どちらも「教材を見に行く」操作で、ノートを離れる理由がない。
   */
  const [quote, setQuote] = useState<{ initial: QuoteTarget | null; focusBlockId: string | null } | null>(
    null
  );

  useEffect(() => {
    setTitleDraft(note.title);
    // 別のノートに切り替わったら、前のノート向けに開いていた引用モーダルは閉じる
    setQuote(null);
  }, [note.id, note.title]);

  // まっさらなノートは開いた瞬間から書ける
  const isEmptyNote = !note.body && note.blocks.length === 0;
  useEffect(() => {
    if (isEmptyNote) bodyRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (!next) {
      setTitleDraft(note.title);
      return;
    }
    if (next !== note.title) onRename(next);
  };

  /** ツールバー。本文のカーソル位置に記法を入れて、そこへ戻す */
  const handleInsert = (kind: InsertKind) => {
    const el = bodyRef.current;
    if (!el) return;
    const { from, to, insert, selStart, selEnd } = applyInsert(
      kind,
      el.value,
      el.selectionStart ?? el.value.length,
      el.selectionEnd ?? el.value.length
    );
    const done = replaceRange(el, from, to, insert, (next) => onBodyChange(next));
    if (done) {
      // execCommand が通れば textarea はもう書き換わっている。ここで選択を置けば終わり。
      // 🔴 rAF で置き直さない。押してすぐ打ち始めると、打った文字の後ろから
      //    キャレットを引き戻してしまう
      el.setSelectionRange(selStart, selEnd);
      return;
    }
    // 直書きの経路は state が textarea に反映されるのを待ってから置く
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  /**
   * クリップ・AI回答の「出どころ」行から、引用元の教材を見に行く。
   * 遷移ではなく引用モーダルを開き、保存した箇所まで送る。
   * 見ながらそのまま続きを引けるので、確認と引用が同じ操作になる。
   */
  const handleOpenSource = (source: NoteSourceRef, blockId: string | null) => {
    setQuote({
      initial: { courseId: source.courseId, lessonId: source.lessonId },
      focusBlockId: source.blockId ?? blockId,
    });
  };

  /** モーダルからのクリップ。素材の末尾に足す */
  const handleQuoteClip = async ({ text, source }: { text: string; source: NoteSourceRef }) =>
    !!(await onAddBlock({ kind: 'clip', text, source }));

  return (
    <section
      aria-label="ノート"
      style={{
        width: '100%',
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
      {/* タイトルは入力欄として枠を持たせ、本文と境目を作る */}
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

      <NoteEditorToolbar
        onInsert={handleInsert}
        onQuote={() =>
          setQuote({
            // 教材から作られたノートは元レッスンを開く。そうでなければモーダル側で選ばせる
            initial: note.source
              ? { courseId: note.source.courseId, lessonId: note.source.lessonId }
              : null,
            focusBlockId: null,
          })
        }
      />

      {/*
        本文。1枚の textarea を紙の底まで伸ばす。
        🔴 余白をクリックしても書き始められるよう、包む div ではなく textarea 自身を
           flex:1 で伸ばす。以前は下に 96px の空白ゾーンがあって、
           そこが何なのか画面から読めなかった。
      */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 28px 8px' }}>
        <NoteBodyEditor
          ref={bodyRef}
          value={note.body}
          onChange={onBodyChange}
          onBlur={onBodyFlush}
          placeholder="ここに入力して、自由に書いていきましょう…"
        />
      </div>

      {/* 素材。無ければ見出しごと出さない（空の器を見せない） */}
      {note.blocks.length > 0 && (
        <div style={{ padding: '4px 28px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--dc-text-subtle)',
            }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>教材の引用・AIの回答</span>
            <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--dc-border)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {note.blocks.map((block) => (
              <NoteBlockView
                key={block.id}
                block={block}
                onPatch={onPatchBlock}
                onRemove={() => onRemoveBlock(block.id)}
                onOpenSource={handleOpenSource}
              />
            ))}
          </div>
        </div>
      )}

      {/* 教材から引用。追加先はこのノートで確定しているので、保存先の選び直しは出さない */}
      {quote && (
        <QuoteFromLessonModal
          note={note}
          initial={quote.initial}
          focusBlockId={quote.focusBlockId}
          onClip={handleQuoteClip}
          onClose={() => setQuote(null)}
        />
      )}
    </section>
  );
}

export default NoteEditor;
