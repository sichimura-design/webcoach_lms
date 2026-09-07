import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ExternalLink, Undo2, X } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { Note, NoteSourceRef } from '../../types/notes';
import { useLessonDoc } from '../../hooks/useLessonDoc';
import { useTextSelection } from '../../hooks/useTextSelection';
import { useRecentCourseStore } from '../../store/recentCourseStore';
import { ClipAnchor } from '../learning/clipHighlight';
import SelectionToolbar from '../learning/SelectionToolbar';
import LessonQuoteReader from './LessonQuoteReader';

/**
 * ノート面から教材を引くためのモーダル。
 *
 * 🔴 教材ページへ遷移させない。以前はツールバーの「教材から引用」が
 *    /course/:id?module= へ飛ばしていて、飛んだ先でクリップすると保存先ノートを
 *    もう一度選ばされ、書きかけのノートへどう戻るのか分からなくなっていた（レビュー指摘）。
 *    ここでは本文をモーダルに出し、選んだ文章はそのまま **いま開いているノート** に入る。
 *    保存先が確定しているので NoteTargetPicker は出さない。
 * 🔴 閉じない。1回引いたら終わりではなく、続けて何箇所も引けるようにする。
 *    追加できたことは右下の小さな知らせと、本文に付く <mark> で分かる。
 */

/** モーダルの重ね順。NoteTargetPicker(90) より上、LessonImageZoom(120) より下 */
const MODAL_Z = 100;

export interface QuoteTarget {
  courseId: number;
  lessonId: number;
}

interface QuoteFromLessonModalProps {
  /** 追加先のノート。見出しの表示と、既にあるクリップの復元に使う */
  note: Note;
  /** 最初に開くレッスン。null なら「最近見た教材」から選ばせる */
  initial: QuoteTarget | null;
  /** 開いた直後にスクロールして光らせる教材ブロック（出どころ行から開いたとき） */
  focusBlockId?: string | null;
  /** ノートへ1件足す。成功したら true */
  onClip: (input: { text: string; source: NoteSourceRef }) => Promise<boolean>;
  onClose: () => void;
}

export function QuoteFromLessonModal({
  note,
  initial,
  focusBlockId = null,
  onClip,
  onClose,
}: QuoteFromLessonModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [target, setTarget] = useState<QuoteTarget | null>(initial);

  /**
   * 開く前にフォーカスがあった場所（＝「教材から引用」ボタン）へ戻す。
   * 🔴 この effect は下の初期フォーカスより **前** に置く。effect は宣言順に走るので、
   *    先に closeRef へフォーカスを移すと、覚える相手が閉じるボタン自身になり、
   *    閉じたあとフォーカスが body に落ちる（＝キーボードで元の位置に戻れない）。
   */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  /**
   * 開いている間は背後のノートを動かさない。
   * body のクラス（learning-immersive）は使わない。あれは教材ページ専用で、
   * 閉じたときに誰が外すのかが曖昧になる。
   */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /**
   * Esc で閉じる／Tab を閉じ込める。
   * 🔴 capture フェーズで購読して stopPropagation する。バブル側で Esc を拾っている
   *    画面（LearningWorkspacePage）へ届かせないため。NoteTargetPicker と同じ手当て。
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
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
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="notes-quote-overlay"
      /* 🔴 背景クリックでは閉じない。本文をドラッグで選んで、指をパネルの外で
         離した瞬間に閉じてしまうため（この画面の主操作がドラッグ選択なので致命的）。
         閉じ方は ✕ と Esc の2つに絞る。 */
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(31,29,30,.42)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <div
        ref={panelRef}
        className="notes-quote-panel"
        style={{
          width: '100%',
          maxWidth: 860,
          height: 'min(88vh, 900px)',
          // 「ノートに追加しました」の知らせをこの箱の右下に置くための基準
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: color.surface,
          borderRadius: radius.hero,
          boxShadow: shadow.hero,
          overflow: 'hidden',
          fontFamily: font.family,
        }}
      >
        {/* ── 見出し。どのノートに入るのかを最初に見せる ── */}
        <div
          className="flex items-center"
          style={{
            gap: 12,
            padding: '16px 20px',
            borderBottom: `1px solid ${color.border}`,
            flex: 'none',
          }}
        >
          <BookOpen size={16} style={{ color: color.primary, flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id={titleId} style={{ ...font.cardTitle, color: color.text, margin: 0 }}>
              教材から引用
            </h2>
            <p
              style={{
                ...font.caption,
                color: color.textMuted,
                margin: '3px 0 0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              選んだ文章は「{note.title || '無題のノート'}」に入ります
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="閉じてノートに戻る"
            className="grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 32,
              height: 32,
              flex: 'none',
              border: `1px solid ${color.border}`,
              borderRadius: radius.sm,
              background: color.surface,
              color: color.textMuted,
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {target ? (
          <QuoteLessonPane
            key={`${target.courseId}-${target.lessonId}`}
            target={target}
            note={note}
            /* 送り先の教材ブロックは最初のレッスンにしか無い。
               setTarget は必ず新しいオブジェクトを作るので、同一性で「まだ動いていない」が分かる */
            focusBlockId={target === initial ? focusBlockId : null}
            onChangeLesson={setTarget}
            onBackToPicker={() => setTarget(null)}
            onClip={onClip}
            onClose={onClose}
          />
        ) : (
          <RecentLessonPicker onPick={setTarget} onClose={onClose} />
        )}
      </div>
    </div>,
    document.body
  );
}

/* ────────────────────────────────────────────────────────────
   教材が決まっていないとき（教材から作られていないノート）
   ──────────────────────────────────────────────────────────── */

function RecentLessonPicker({
  onPick,
  onClose,
}: {
  onPick: (target: QuoteTarget) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  // 「最近開いた教材」。useLessonDoc がレッスンを開くたびに積んでいる端末ごとの履歴
  const entries = useRecentCourseStore((s) => s.entries).filter((e) => e.lessonId);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 22px' }}>
      <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 14px', lineHeight: 1.8 }}>
        このノートは教材から作られていないので、どの教材から引くかを選んでください。
      </p>

      {entries.length === 0 ? (
        <div
          style={{
            padding: '22px 20px',
            border: `1px dashed ${color.border}`,
            borderRadius: radius.md,
            textAlign: 'center',
          }}
        >
          <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 12px', lineHeight: 1.8 }}>
            最近開いた教材がありません。一度教材を開くと、ここから引けるようになります。
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate('/courses');
            }}
            className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              gap: 6,
              padding: '8px 14px',
              border: `1px solid ${color.primaryBorderSoft}`,
              borderRadius: radius.nav,
              background: color.primarySoft,
              color: color.primary,
              ...font.chip,
              cursor: 'pointer',
            }}
          >
            <ExternalLink size={13} />
            教材一覧を開く
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map((entry) => (
            <button
              key={`${entry.courseId}-${entry.lessonId}`}
              type="button"
              onClick={() => onPick({ courseId: entry.courseId, lessonId: entry.lessonId! })}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                border: `1px solid ${color.border}`,
                borderRadius: radius.md,
                background: color.surface,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  display: 'block',
                  ...font.caption,
                  color: color.textMuted,
                  marginBottom: 3,
                }}
              >
                {entry.courseTitle}
              </span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: color.text }}>
                {entry.lessonTitle || 'レッスン'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   教材本文と、選択→クリップ
   ──────────────────────────────────────────────────────────── */

function QuoteLessonPane({
  target,
  note,
  focusBlockId,
  onChangeLesson,
  onBackToPicker,
  onClip,
  onClose,
}: {
  target: QuoteTarget;
  note: Note;
  focusBlockId: string | null;
  onChangeLesson: (target: QuoteTarget) => void;
  onBackToPicker: () => void;
  onClip: QuoteFromLessonModalProps['onClip'];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  // trackRecent: false —— 数行引きに来ただけなので「最近開いた教材」は動かさない
  const { outline, doc, loading, error } = useLessonDoc(target.courseId, target.lessonId, {
    trackRecent: false,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);

  const [flashBlockId, setFlashBlockId] = useState<string | null>(null);
  /** 追加できたことの知らせ。数秒で消す（モーダルは開いたままなので、これが唯一の合図） */
  const [added, setAdded] = useState(0);
  const [saving, setSaving] = useState(false);

  // 構造化教材でないと data-block-id が無く、選択もクリップも成立しない
  const canQuote = !!doc && doc.source === 'structured';
  const { selection, clear } = useTextSelection(articleRef, canQuote);

  /** すでにこのノートへ引いてある箇所。API は叩かず、開いているノートから組む */
  const clips: ClipAnchor[] = useMemo(() => {
    if (!doc) return [];
    return note.blocks.flatMap((block) =>
      block.kind === 'clip' && block.source.lessonId === doc.lessonId && block.source.blockId
        ? [{ id: block.id, blockId: block.source.blockId, text: block.text, offset: block.source.offset }]
        : []
    );
  }, [note.blocks, doc]);

  /** 出どころ行から開いたとき、その箇所まで送って一瞬光らせる */
  useEffect(() => {
    if (!doc || !focusBlockId) return;
    const timer = window.setTimeout(() => {
      scrollRef.current
        ?.querySelector(`#block-${CSS.escape(focusBlockId)}`)
        ?.scrollIntoView({ block: 'start', behavior: 'auto' });
      setFlashBlockId(focusBlockId);
      window.setTimeout(() => setFlashBlockId(null), 1200);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [doc, focusBlockId]);

  useEffect(() => {
    if (added === 0) return;
    const timer = window.setTimeout(() => setAdded(0), 2200);
    return () => window.clearTimeout(timer);
  }, [added]);

  const handleClip = async () => {
    if (!doc || !selection || saving) return;
    setSaving(true);
    // LearningWorkspacePage の sourceOf と同じ組み立て。あちらは doc をクロージャで
    // 掴んでいて切り出せないので、この7行だけ持つ。
    const source: NoteSourceRef = {
      courseId: doc.courseId,
      courseName: doc.courseName,
      lessonId: doc.lessonId,
      lessonTitle: doc.title,
      heading: selection.heading || null,
      blockId: selection.blockId,
      offset: selection.offset,
    };
    const ok = await onClip({ text: selection.text, source });
    setSaving(false);
    if (!ok) return;
    clear();
    window.getSelection()?.removeAllRanges();
    setAdded((n) => n + 1);
  };

  const openLessonPage = () => {
    onClose();
    navigate(`/course/${target.courseId}?module=${target.lessonId}`);
  };

  return (
    <>
      {/* ── どの教材を見ているか。同じコースの中なら、ここで移れる ── */}
      <div
        className="flex items-center"
        style={{
          gap: 10,
          padding: '10px 20px',
          borderBottom: `1px solid ${color.border}`,
          background: color.pageBg,
          flex: 'none',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            ...font.caption,
            color: color.textMuted,
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {outline?.courseName || doc?.courseName || 'コース'}
        </span>
        <select
          aria-label="開く教材"
          value={doc?.lessonId ?? target.lessonId}
          onChange={(e) => onChangeLesson({ courseId: target.courseId, lessonId: Number(e.target.value) })}
          style={{
            flex: 1,
            minWidth: 180,
            maxWidth: 420,
            padding: '6px 10px',
            border: `1px solid ${color.border}`,
            borderRadius: radius.sm,
            background: color.surface,
            fontFamily: 'inherit',
            fontSize: 12.5,
            color: color.text,
          }}
        >
          {outline
            ? outline.sections.map((section) => (
                <optgroup key={section.id} label={section.name}>
                  {section.lessons.map((lesson) => (
                    <option key={lesson.lessonId} value={lesson.lessonId}>
                      {lesson.title}
                    </option>
                  ))}
                </optgroup>
              ))
            : doc && (
                <option value={doc.lessonId}>{doc.title}</option>
              )}
        </select>
        <button
          type="button"
          onClick={onBackToPicker}
          className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            gap: 5,
            padding: '6px 10px',
            border: `1px solid ${color.border}`,
            borderRadius: radius.sm,
            background: color.surface,
            ...font.caption,
            color: color.textMuted,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Undo2 size={12} />
          別の教材
        </button>
      </div>

      {/* ── 使い方。ポップオーバーで出していた説明はここへ移した ── */}
      {canQuote && (
        <p
          style={{
            margin: 0,
            padding: '8px 20px',
            borderBottom: `1px solid ${color.border}`,
            background: color.hoverBgTint,
            ...font.caption,
            color: color.textMuted,
          }}
        >
          読みたい文章をドラッグで選ぶと「クリップ」が出ます。押すとノートに入り、この画面は開いたままです。
        </p>
      )}

      {/* ── 本文 ── */}
      <div
        ref={scrollRef}
        /* キーボードだけでも本文を送れるように、スクロール枠自体をフォーカスできる箱にする */
        tabIndex={0}
        role="region"
        aria-label="教材本文"
        style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px', position: 'relative' }}
      >
        {loading && (
          <p style={{ ...font.caption, color: color.textMuted, textAlign: 'center', padding: '40px 0' }}>
            教材を読み込んでいます…
          </p>
        )}

        {!loading && error && (
          <p style={{ ...font.caption, color: color.textMuted, textAlign: 'center', padding: '40px 0' }}>
            {error}
          </p>
        )}

        {!loading && !error && doc && !canQuote && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 12px', lineHeight: 1.8 }}>
              この教材はここから引用できません（本文の位置を特定できない形式のため）。
              <br />
              教材ページで開いてクリップしてください。
            </p>
            <button
              type="button"
              onClick={openLessonPage}
              className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                gap: 6,
                padding: '8px 14px',
                border: `1px solid ${color.primaryBorderSoft}`,
                borderRadius: radius.nav,
                background: color.primarySoft,
                color: color.primary,
                ...font.chip,
                cursor: 'pointer',
              }}
            >
              <ExternalLink size={13} />
              教材ページを開く
            </button>
          </div>
        )}

        {!loading && !error && doc && canQuote && (
          <LessonQuoteReader
            doc={doc}
            articleRef={articleRef}
            clips={clips}
            flashBlockId={flashBlockId}
          />
        )}
      </div>

      {/* 選択ツールバー。モーダルより上に出す（既定の 80 だとオーバーレイに隠れる） */}
      {selection && (
        <SelectionToolbar selection={selection} onClip={() => void handleClip()} zIndex={MODAL_Z + 2} />
      )}

      {/* 追加できたことの知らせ。閉じない代わりに、ここで結果を出す */}
      {added > 0 && (
        <div
          role="status"
          style={{
            position: 'absolute',
            right: 22,
            bottom: 18,
            zIndex: 1,
            padding: '8px 14px',
            borderRadius: radius.nav,
            background: color.text,
            color: '#fff',
            ...font.chip,
            boxShadow: '0 12px 32px rgba(33,42,57,.26)',
          }}
        >
          ノートに追加しました{added > 1 ? `（${added}件）` : ''}
        </div>
      )}
    </>
  );
}

export default QuoteFromLessonModal;
