import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { bffClient } from '../../services/bffClient';
import type { LessonSearchGroup, LessonSearchResponse } from '../../types/lessonSearch';

/**
 * コース内の教材本文をキーワードで探すパネル。
 *
 * カリキュラム画面（CourseTopPage）と学習画面（LearningWorkspacePage）で
 * 同じものを使う。探し方も結果の読み方も1つに揃えたいので、画面ごとに
 * 別の見た目を作らない。違うのは「押したときどこへ行くか」だけで、
 * それは onJump で呼び出し側が決める。
 *
 * 🔴 ルートに className="wc-warm" を付けている。--dc-* のトークンは :root ではなく
 *    .mypage-3d / .wc-warm に載っている opt-in（index.css の L87-92）。
 *    学習画面のルートは wc-warm を持たないので、ここで自分で引き込まないと
 *    カリキュラム画面と学習画面で色が変わってしまう。
 *
 * 🔴 Esc は capture フェーズで拾って stopPropagation する。
 *    LearningWorkspacePage が document のバブル側で Esc を拾い、AIコーチ・メモの
 *    パネルまで閉じてしまうため。NoteTargetPicker.tsx / LessonImageZoom.tsx と同じ手当て。
 */

/** 打鍵のたびには投げない。useNoteList の 500ms より短くしているのは、
 *  あちらが一覧の取り直しなのに対し、こちらは打ちながら結果を見る検索だから。 */
const DEBOUNCE_MS = 300;

/** 短すぎる語は当たりすぎて役に立たない（サーバ側も同じ2文字で弾く） */
const MIN_QUERY_LENGTH = 2;

export interface CourseSearchJump {
  lessonId: number;
  blockId: string;
}

interface CourseSearchPanelProps {
  courseId: number;
  /** 教材名。見出しに出して「どこを検索しているか」を明示する */
  courseName?: string;
  onClose: () => void;
  /** 結果を押したとき。遷移するかその場で飛ぶかは呼び出し側が決める */
  onJump: (jump: CourseSearchJump) => void;
  /** いま開いているレッスン。結果に「開いているレッスン」の印を出す */
  currentLessonId?: number | null;
}

/**
 * マーカーの見た目。ノート本文の .wc-note-mark（index.css）と同じ「下側だけの帯」。
 * 🔴 index.css にクラスを足さずインラインで持つ。あのファイルは他の作業と
 *    衝突しやすく、この1箇所のためだけに共有スタイルを増やす必要がない。
 */
const MARK_STYLE: React.CSSProperties = {
  background: 'linear-gradient(transparent 58%, #FFD9E0 58%)',
  color: 'inherit',
  fontWeight: 700,
  padding: 0,
};

/** ヒット語だけを <mark> で囲む。位置はサーバが返した値をそのまま使う
 *  （クエリを正規表現に組み立てないので、記号を打たれても壊れない）*/
function highlight(excerpt: string, start: number, length: number): React.ReactNode {
  if (start < 0 || length <= 0 || start + length > excerpt.length) return excerpt;
  return (
    <>
      {excerpt.slice(0, start)}
      <mark style={MARK_STYLE}>{excerpt.slice(start, start + length)}</mark>
      {excerpt.slice(start + length)}
    </>
  );
}

/** 結果の1行ぶん。キーボードで移動するので、階層をまたいで通し番号を振る */
interface FlatRow {
  group: LessonSearchGroup;
  hitIndex: number;
}

function flatten(groups: LessonSearchGroup[]): FlatRow[] {
  return groups.flatMap((group) => group.hits.map((_, hitIndex) => ({ group, hitIndex })));
}

export function CourseSearchPanel({
  courseId,
  courseName,
  onClose,
  onJump,
  currentLessonId,
}: CourseSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LessonSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** 応答が前後しても最後のリクエストの結果だけを採る（useNoteList と同じ手口） */
  const reqRef = useRef(0);

  const trimmed = query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;

  // ── 検索（デバウンス）──
  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      const seq = ++reqRef.current;
      bffClient
        .searchInCourse(courseId, trimmed)
        .then((res) => {
          if (seq !== reqRef.current) return;
          setResult(res);
          setCursor(0);
          setFailed(false);
          setLoading(false);
        })
        .catch(() => {
          if (seq !== reqRef.current) return;
          // モックOFF（本番）ではこのAPIが無い。機能ごと畳んで1行だけ断る
          setResult(null);
          setFailed(true);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [courseId, trimmed]);

  const rows = useMemo(() => flatten(result?.groups ?? []), [result]);

  const jumpTo = useCallback(
    (row: FlatRow) => {
      onJump({ lessonId: row.group.lessonId, blockId: row.group.hits[row.hitIndex].blockId });
    },
    [onJump]
  );

  // ── 開いたら入力へ。閉じたら元の場所へフォーカスを戻す ──
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  // ── キー操作。Esc は capture で止める（上のコメント参照）──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 🔴 IME変換中は横取りしない。日本語で検索する機能なので、
      //    変換中の Esc（変換の取り消し）や Enter（確定）を奪うと入力そのものが壊れる
      if (e.isComposing || e.keyCode === 229) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (rows.length === 0) return;
        e.preventDefault();
        setCursor((c) => {
          const next = e.key === 'ArrowDown' ? c + 1 : c - 1;
          return (next + rows.length) % rows.length;
        });
        return;
      }
      if (e.key === 'Enter') {
        const row = rows[cursor];
        if (!row) return;
        e.preventDefault();
        jumpTo(row);
        return;
      }
      // 開いている間は Tab を閉じ込める（NoteTargetPicker と同じ）
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
  }, [onClose, rows, cursor, jumpTo]);

  // 選択中の行を視界に入れる。↑↓ で送っていて画面外に出ると現在地を見失う
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-cursor="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  let rowIndex = -1;

  return (
    <div
      className="wc-warm"
      role="dialog"
      aria-modal="true"
      aria-label={courseName ? `${courseName} の教材内を検索` : '教材内を検索'}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(31,29,30,.38)',
        display: 'flex',
        justifyContent: 'center',
        // 上寄せ。結果が伸びても入力欄の位置が動かないほうが打ちながら読める
        alignItems: 'flex-start',
        padding: 'clamp(16px, 6vh, 72px) 16px 24px',
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--dc-surface)',
          border: '1px solid var(--dc-border)',
          borderRadius: 'var(--dc-radius-lg)',
          boxShadow: 'var(--dc-shadow-card)',
          overflow: 'hidden',
          color: 'var(--dc-text)',
        }}
      >
        {/* ── 入力 ── */}
        <div style={{ position: 'relative', padding: 16, borderBottom: '1px solid var(--dc-border)' }}>
          <Search
            size={17}
            aria-hidden
            style={{ position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)', color: 'var(--dc-text-muted)' }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={courseName ? `${courseName} の中を検索` : 'この教材の中を検索'}
            aria-label="教材の本文をキーワードで検索"
            className="outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              height: 44,
              padding: '0 44px 0 38px',
              border: '1px solid var(--dc-border-strong)',
              borderRadius: 9999,
              background: 'var(--dc-surface)',
              fontFamily: 'inherit',
              // 🔴 16px 未満だと iOS Safari がフォーカス時に画面を拡大する
              fontSize: 16,
              color: 'var(--dc-text)',
            }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="検索を閉じる"
            className="outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              position: 'absolute',
              right: 26,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              border: 0,
              background: 'transparent',
              padding: 4,
              color: 'var(--dc-text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── 状態の1行。件数は読み上げにも渡す ── */}
        <div
          aria-live="polite"
          style={{
            padding: '10px 20px',
            fontSize: 12.5,
            color: 'var(--dc-text-muted)',
            borderBottom: result && result.groups.length > 0 ? '1px solid var(--dc-border)' : undefined,
          }}
        >
          {failed
            ? 'この環境では教材内の検索を使えません。'
            : tooShort
              ? `${MIN_QUERY_LENGTH}文字以上で検索します。`
              : loading
                ? 'さがしています…'
                : result
                  ? result.totalHits > 0
                    ? `「${result.query}」 ${result.lessonCount}レッスン・${result.totalHits}件`
                    : `「${result.query}」は この教材の中に見つかりませんでした。`
                  : '教材の本文からことばを探します。例：プロンプト、配色、著作権'}
        </div>

        {/* ── 結果。カリキュラムと同じ「チャプター ＞ レッスン」の並び ── */}
        {result && result.groups.length > 0 && (
          <div ref={listRef} style={{ overflowY: 'auto', padding: '6px 0 12px' }}>
            {result.groups.map((group, i) => {
              const newChapter = i === 0 || result.groups[i - 1].sectionId !== group.sectionId;
              return (
                <div key={group.lessonId}>
                  {newChapter && (
                    <div
                      className="dc-num"
                      style={{
                        padding: '12px 20px 4px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '.1em',
                        color: 'var(--dc-label-warm)',
                      }}
                    >
                      CHAPTER {String(group.sectionIndex).padStart(2, '0')}｜{group.sectionName}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 20px 2px' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 0 }}>{group.lessonTitle}</span>
                    {group.lessonId === currentLessonId && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dc-primary)', flex: 'none' }}>
                        開いているレッスン
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, color: 'var(--dc-text-subtle)', flex: 'none', marginLeft: 'auto' }}>
                      {group.hitCount}件
                    </span>
                  </div>

                  {group.hits.map((hit, hitIndex) => {
                    rowIndex += 1;
                    const selected = rowIndex === cursor;
                    return (
                      <button
                        key={hit.blockId}
                        type="button"
                        data-cursor={selected ? 'true' : undefined}
                        onMouseEnter={() => setCursor(rows.findIndex((r) => r.group.lessonId === group.lessonId && r.hitIndex === hitIndex))}
                        onClick={() => onJump({ lessonId: group.lessonId, blockId: hit.blockId })}
                        className="outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          border: 0,
                          borderLeft: `3px solid ${selected ? 'var(--dc-primary)' : 'transparent'}`,
                          background: selected ? 'var(--dc-soft-100)' : 'transparent',
                          padding: '8px 20px 8px 17px',
                          fontFamily: 'inherit',
                          color: 'var(--dc-text-body)',
                          cursor: 'pointer',
                        }}
                      >
                        {hit.heading && (
                          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--dc-text-subtle)', marginBottom: 2 }}>
                            {hit.heading}
                          </span>
                        )}
                        <span style={{ display: 'block', fontSize: 13, lineHeight: 1.7 }}>
                          {highlight(hit.excerpt, hit.matchStart, hit.matchLength)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CourseSearchPanel;
