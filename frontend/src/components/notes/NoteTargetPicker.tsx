import { useEffect, useId, useRef } from 'react';
import { NotebookPen, Plus, Search } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { useNoteList } from '../../hooks/useNoteList';
import { PendingCapture, previewOf } from '../../hooks/useNoteCapture';
import { useNoteTargetStore } from '../../store/noteTargetStore';
import { NOTE_BLOCK_LABEL, NoteSummary } from '../../types/notes';

/**
 * 「どのノートに入れるか」を毎回聞くピッカー。
 *
 * 🔴 以前は「1度だけ聞く」だった。追加先を覚えて以後は無言で書き込む作りで、
 *    ユーザーからは「勝手に『イントロダクション』に入る」「一度選べたが
 *    条件が分からない」という状態に見えていた。保存先は毎回ここで選ぶ。
 *
 * 毎回出るので、速いことと探せることの両方が要る:
 *   ・前回の追加先を先頭に置き、開いた瞬間フォーカスする（1タップ／Enter1回）
 *   ・このレッスンのノート → 最近 → 検索、の順に降りられる（ノートは100件規模）
 */
interface NoteTargetPickerProps {
  /** suggestedTitle / lessonId / block（プレビュー用）を全部持っている */
  pending: PendingCapture;
  /** 書き込み中。2度押しで同じブロックが2つ入るのを防ぐ */
  busy?: boolean;
  onPickNote: (noteId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

/** 一覧に出す件数。多いと「選ぶ」作業になってしまう */
const RECENT_COUNT = 5;
/** 検索結果はもう少し出す。探しに来ているので */
const SEARCH_COUNT = 8;
/** このレッスンのノート */
const LESSON_COUNT = 5;

const SECTION_LABEL: React.CSSProperties = {
  ...font.caption,
  color: color.textSubtle,
  margin: '18px 0 8px',
};

/** ノート1件の行。「最近」「検索結果」「このレッスン」で共通 */
function NoteRow({
  note,
  disabled,
  onPick,
}: {
  note: NoteSummary;
  disabled?: boolean;
  onPick: (noteId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(note.id)}
      disabled={disabled}
      className="disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
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
        cursor: disabled ? 'default' : 'pointer',
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
  );
}

/**
 * このレッスンから触ったノート。
 * 🔴 別コンポーネントに切り出しているのは、useNoteList({ lessonId }) に
 *    undefined を渡すと「絞り込みなし＝全件取得」になってしまうため。
 *    lessonId があるときだけマウントする。
 */
function LessonNoteSection({
  lessonId,
  excludeId,
  disabled,
  onPick,
}: {
  lessonId: number;
  excludeId?: string;
  disabled?: boolean;
  onPick: (noteId: string) => void;
}) {
  const { items } = useNoteList({ lessonId });
  const rows = items.filter((n) => n.id !== excludeId).slice(0, LESSON_COUNT);
  if (rows.length === 0) return null;

  return (
    <>
      <div style={SECTION_LABEL}>このレッスンのノート</div>
      <div className="flex flex-col" style={{ gap: 6 }}>
        {rows.map((note) => (
          <NoteRow key={note.id} note={note} disabled={disabled} onPick={onPick} />
        ))}
      </div>
    </>
  );
}

export function NoteTargetPicker({
  pending,
  busy = false,
  onPickNote,
  onCreateNew,
  onCancel,
}: NoteTargetPickerProps) {
  const titleId = useId();
  const previewId = useId();

  const list = useNoteList();
  const suggested = useNoteTargetStore((s) => s.suggestFor(pending.lessonId));

  const panelRef = useRef<HTMLDivElement>(null);
  const defaultRef = useRef<HTMLButtonElement>(null);

  /** 既定の操作にフォーカスする。Enter はボタン本来の挙動で発火させる。
   *  🔴 全体で Enter を拾うと、検索欄で打っている最中の Enter が
   *     「前回のノートへ保存」になってしまう。 */
  useEffect(() => {
    defaultRef.current?.focus();
  }, []);

  /** 開く前にフォーカスがあった場所へ戻す。毎回出るので、やめたあとに
   *  下書きの textarea へ戻れるかどうかで体感が変わる */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);

  /**
   * Esc でやめる。開いている間だけ購読する。
   * 🔴 capture フェーズで購読して stopPropagation する。
   *    LearningWorkspacePage が document のバブル側で Esc を拾ってメモ／AIの
   *    パネルまで閉じてしまうため、ここが開いている間はそこへ届かせない
   *    （やめただけでメモ欄が消えると、書きかけの場所を open し直すことになる）。
   *    LessonImageZoom.tsx と同じ手当て。
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }
      // 全保存の通り道になったので、この1枚だけは Tab を閉じ込める
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const searching = list.query.trim() !== '';
  const rows = list.items
    .filter((n) => n.id !== suggested?.noteId)
    .slice(0, searching ? SEARCH_COUNT : RECENT_COUNT);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={previewId}
      aria-busy={busy}
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
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '88vh',
          overflowY: 'auto',
          background: color.surface,
          borderRadius: radius.hero,
          boxShadow: shadow.hero,
          padding: '26px 26px 22px',
          fontFamily: font.family,
        }}
      >
        <h2 id={titleId} style={{ ...font.cardTitle, color: color.text, margin: 0 }}>
          どのノートに追加しますか？
        </h2>
        <p style={{ ...font.caption, color: color.textMuted, margin: '8px 0 14px', lineHeight: 1.8 }}>
          毎回ここで追加先を選べます。追加しても教材のページはそのままです。
        </p>

        {/* ── 何を保存しようとしているか ──
            AI回答は各メッセージに保存ボタンがあるので、これが無いと
            どれを入れようとしているのか分からない */}
        <div
          id={previewId}
          style={{
            padding: '11px 13px',
            background: color.notePaper,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            marginBottom: 18,
          }}
        >
          <span style={{ ...font.chip, color: color.noteClipAccent }}>
            {NOTE_BLOCK_LABEL[pending.block.kind]}
          </span>
          <p
            style={{
              margin: '5px 0 0',
              fontSize: 12,
              lineHeight: 1.8,
              color: color.textBody,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {previewOf(pending.block)}
          </p>
        </div>

        {/* ── 前回の追加先。普段はここを押すだけで済む ── */}
        {suggested && (
          <button
            ref={defaultRef}
            type="button"
            onClick={() => onPickNote(suggested.noteId)}
            disabled={busy}
            className="disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              width: '100%',
              padding: '14px 16px',
              border: 0,
              borderRadius: radius.md,
              background: color.primary,
              color: color.textOnPrimary,
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: busy ? 'default' : 'pointer',
              textAlign: 'left',
              marginBottom: 8,
            }}
          >
            <NotebookPen size={17} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              前回と同じ「{suggested.title}」に追加
            </span>
            <span aria-hidden style={{ flexShrink: 0, fontSize: 12, opacity: 0.85 }}>⏎</span>
          </button>
        )}

        {/* ── 新しく作る。前回の追加先が無い初回はここが既定 ── */}
        <button
          ref={suggested ? undefined : defaultRef}
          type="button"
          onClick={onCreateNew}
          disabled={busy}
          className="disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
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
            cursor: busy ? 'default' : 'pointer',
            textAlign: 'left',
          }}
        >
          <Plus size={17} style={{ flexShrink: 0 }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            「{pending.suggestedTitle}」のノートを作る
          </span>
        </button>

        {pending.lessonId != null && (
          <LessonNoteSection
            lessonId={pending.lessonId}
            excludeId={suggested?.noteId}
            disabled={busy}
            onPick={onPickNote}
          />
        )}

        {/* ── 探す。ノートは100件規模になるので一覧だけでは足りない ── */}
        <div style={SECTION_LABEL}>ほかのノートに追加する</div>
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 13,
              top: '50%',
              transform: 'translateY(-50%)',
              color: color.textFaint,
            }}
          />
          <input
            value={list.query}
            onChange={(e) => list.setQuery(e.target.value)}
            placeholder="タイトルや内容で検索"
            aria-label="ノートを検索"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              height: 44,
              padding: '0 14px 0 36px',
              border: `1px solid ${color.border}`,
              borderRadius: radius.md,
              background: color.surface,
              fontFamily: 'inherit',
              // 🔴 16px 未満だと iOS Safari がフォーカス時に画面を拡大する
              fontSize: 16,
              color: color.text,
              outline: 'none',
            }}
          />
        </div>

        <div className="flex flex-col" style={{ gap: 6, marginTop: 8 }}>
          {rows.map((note) => (
            <NoteRow key={note.id} note={note} disabled={busy} onPick={onPickNote} />
          ))}
        </div>

        {list.loading && rows.length === 0 && (
          <p style={{ ...font.caption, color: color.textSubtle, margin: '10px 0 0' }}>読み込んでいます…</p>
        )}
        {!list.loading && rows.length === 0 && searching && (
          <p style={{ ...font.caption, color: color.textSubtle, margin: '10px 0 0' }}>
            該当するノートがありません。
          </p>
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
        <p style={{ ...font.caption, color: color.textFaint, margin: '8px 0 0', textAlign: 'center' }}>
          Esc でもやめられます。書いた内容は消えません。
        </p>
      </div>
    </div>
  );
}

export default NoteTargetPicker;
