import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, Plus, Search, SlidersHorizontal, Star } from 'lucide-react';
import { AppHeader } from '../shared';
import { MOCKS_ENABLED } from '../../mocks/config';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNote } from '../../hooks/useNote';
import { useNoteList } from '../../hooks/useNoteList';
import { BackTo } from '../../hooks/useNoteCapture';
import bffClient from '../../services/bffClient';
import {
  NOTE_ORIGIN_LABEL,
  NOTE_SORT_LABEL,
  NoteOrigin,
  NoteSort,
  NoteSourceRef,
  NoteSummary,
} from '../../types/notes';
import NoteEditor from './NoteEditor';
import NoteGrid from './NoteGrid';
import NoteReviewCard from './NoteReviewCard';
import NotesPagination from './NotesPagination';

/**
 * マイノート（/notes）。デザイン『マイノート 3案』1a を実装したもの。
 *
 * 【何を作り替えたか】
 * 「左＝ノート一覧／右＝ノート面」の2カラムから、出どころバッジ付きの
 * カードグリッド＋ページ送りへ。役割が「書く場所」から「残したものを
 * 見返す場所」に寄ったため（CONTENTS §10）。
 *
 * 書く機能（ブロックのノート面）は捨てず、URLで切り替える。
 *   /notes            … カードグリッド
 *   /notes?note=<id>  … そのノートのノート面（全幅）
 * ルートを増やさないのは、教材画面のメモ欄とAI回答の保存後の遷移が
 * すでに /notes?note=<id> を指しているため（useNoteCapture / MemoPane）。
 *
 * 外枠は 1440px 固定キャンバスの transform:scale をやめ、マイページと同じ
 * 可変幅＋暖色クリームのトークン（.wc-warm の --dc-*）に揃えた。
 */

/** 1ページの件数。3列 × 8行 */
const PAGE_SIZE = 24;

/**
 * デモデータの件数を差し替える開発用パネル（モック時のみ）。
 * ページ送りの操作性は件数を変えないと確かめられないため。
 * 本番ビルドでは MOCKS_ENABLED が false なので読み込まれない。
 */
const NotesDevPanel = React.lazy(() => import('../dev/NotesDevPanel'));

const SORTS: NoteSort[] = ['updated', 'created', 'title'];

/** チップ行の出どころ。「すべて」を先頭に置く（CONTENTS §10-3） */
const ORIGIN_CHIPS: NoteOrigin[] = ['self', 'material', 'ai', 'coaching'];

/**
 * 「〈教材名〉に戻る」。隣の「マイノートに戻る」とは行き先が違うので、
 * 枠付き＋別アイコンにして押し間違いを防ぐ。
 */
const BACK_TO_SOURCE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  border: '1px solid var(--dc-border-strong)',
  borderRadius: 8,
  background: 'var(--dc-surface)',
  color: 'var(--dc-text-body)',
  fontFamily: 'inherit',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export function MyNotesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  /**
   * 「どこから来たか」。教材のメモ欄やトーストの「ノートを見る」が預けてくれる。
   * 🔴 ノート自身の source では代用できない。あれは"そのノートが生まれた
   *    レッスン"なので、第5レッスンのクリップを第1レッスン由来のノートへ
   *    入れた場合に、誤ったレッスンへ戻すボタンになってしまう。
   *    state が無いときだけ source を保険に使う（下の backButton）。
   */
  const backTo = (location.state as { backTo?: BackTo } | null)?.backTo ?? null;

  const list = useNoteList();

  // 選択中のノートはURLに持つ。教材画面の取り込みトーストから
  // /notes?note=<id> で直接開けるようにするため（ルート定義は増やさない）。
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('note');

  const select = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('note', id);
    else next.delete('note');
    setSearchParams(next, { replace: true });
  };

  const detail = useNote(selectedId);

  // 絞り込みとページ送りは、取得済みの一覧に対してその場でかける。
  // チップごとに再取得しないので、押した瞬間に切り替わる。
  const [origin, setOrigin] = useState<NoteOrigin | 'all'>('all');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      list.items.filter(
        (n) => (origin === 'all' || n.origin === origin) && (!favoriteOnly || n.favorite)
      ),
    [list.items, origin, favoriteOnly]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // 条件が変わって今のページが消えたら先頭に戻す
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  const from = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(from, from + PAGE_SIZE);

  const changeFilter = (next: () => void) => {
    next();
    setPage(1);
  };

  useEffect(() => {
    if (!sortOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSortOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sortOpen]);

  const handleCreate = async () => {
    try {
      const note = await list.create({});
      select(note.id);
    } catch {
      showToast('ノートを作成できませんでした', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await list.remove(id);
      if (selectedId === id) select(null);
      showToast('ノートを削除しました', 'success');
    } catch {
      showToast('削除できませんでした', 'error');
    }
  };

  /** カードの⋮から「重要」を付け外しする。ノート面の★と同じ操作 */
  const handleToggleFavorite = async (note: NoteSummary) => {
    try {
      await bffClient.updateNote(note.id, { favorite: !note.favorite });
      await list.reload();
      showToast(note.favorite ? '重要をはずしました' : '重要に追加しました', 'success');
    } catch {
      showToast('変更できませんでした', 'error');
    }
  };

  const clearFilters = () => {
    changeFilter(() => {
      setOrigin('all');
      setFavoriteOnly(false);
      list.setQuery('');
    });
  };

  /** クリップ・AI回答から元のレッスンへ。?block= で保存した箇所まで戻す */
  const openSource = (source: NoteSourceRef, blockId: string | null) => {
    const params = new URLSearchParams({ module: String(source.lessonId) });
    if (source.blockId) params.set('block', source.blockId);
    else if (blockId) params.set('block', blockId);
    navigate(`/course/${source.courseId}?${params.toString()}`);
  };

  /**
   * 「クリップを追加」「AI回答を追加」は、このページ単体では素材が無い。
   * 空のブロックを置くと嘘になるので、素材のある場所へ案内する。
   */
  const guideToLesson = (what: 'clip' | 'answer') => {
    const source = detail.note?.source;
    showToast(
      what === 'clip'
        ? '教材の文章をドラッグして「クリップ」すると、このノートに入ります'
        : 'AIコーチの回答の「保存」から、このノートに入れられます',
      'success'
    );
    if (source) navigate(`/course/${source.courseId}?module=${source.lessonId}`);
    else navigate('/courses');
  };

  return (
    <div className="wc-warm min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username || 'User'} />

      <main
        className="notes-main flex flex-col"
        style={{ flex: 1, gap: 24, color: 'var(--dc-text)' }}
      >
        {selectedId ? (
          /* ── ノート面。一覧から1枚を開いた状態 ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 戻り先は2つ出る。一覧へ戻るのと、来た教材へ帰るのは別の用事なので
                どちらかに寄せない（教材から見に来た人が一覧経由で帰らずに済む）。 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => select(null)}
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px 6px 4px',
                  border: 0,
                  borderRadius: 8,
                  background: 'none',
                  color: 'var(--dc-primary)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={16} /> マイノートに戻る
              </button>

              {backTo ? (
                <button
                  type="button"
                  onClick={() => navigate(backTo.to)}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={BACK_TO_SOURCE_STYLE}
                >
                  <BookOpen size={15} /> {backTo.label}
                </button>
              ) : (
                detail.note?.source && (
                  <button
                    type="button"
                    onClick={() => openSource(detail.note!.source!, null)}
                    className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={BACK_TO_SOURCE_STYLE}
                  >
                    <BookOpen size={15} /> 「{detail.note.source.lessonTitle}」に戻る
                  </button>
                )
              )}
            </div>

            <div style={{ width: '100%', maxWidth: 900 }}>
              {detail.note ? (
                <NoteEditor
                  note={detail.note}
                  onRename={detail.renameNote}
                  onToggleFavorite={detail.toggleFavorite}
                  onDelete={() => void handleDelete(detail.note!.id)}
                  onAddText={(text) => void detail.addBlock({ kind: 'text', text })}
                  onAddClipPrompt={() => guideToLesson('clip')}
                  onAddAnswerPrompt={() => guideToLesson('answer')}
                  onPatchBlock={detail.patchBlock}
                  onRemoveBlock={detail.removeBlock}
                  onOpenSource={openSource}
                />
              ) : (
                <div
                  style={{
                    padding: '60px 30px',
                    background: 'var(--dc-surface)',
                    border: '1px solid var(--dc-border)',
                    borderRadius: 'var(--dc-radius-lg)',
                    boxShadow: 'var(--dc-shadow-card)',
                    textAlign: 'center',
                    fontSize: 13.5,
                    lineHeight: 1.9,
                    color: 'var(--dc-text-muted)',
                  }}
                >
                  {detail.loading
                    ? '読み込んでいます…'
                    : 'このノートは見つかりませんでした。一覧から選び直してください。'}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ── ヘッダー。左に見出しとリード文、右にふりかえりカード ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 24,
                flexWrap: 'wrap',
              }}
            >
              {/* 見出しは主役だが、この画面の主役はカードの一覧。
                  1a の 32px は一覧より目立つので落としている */}
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 22,
                    lineHeight: 1.35,
                    fontWeight: 700,
                    letterSpacing: '-.01em',
                  }}
                >
                  マイノート
                </h1>
                <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--dc-text-muted)' }}>
                  学習やコーチング、AIコーチで残したメモをまとめて確認できます。
                </p>
              </div>
              <NoteReviewCard />
            </div>

            {/* ── 検索・並び替え・作成 ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <Search
                  size={18}
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--dc-text-muted)',
                  }}
                />
                <input
                  value={list.query}
                  onChange={(e) => changeFilter(() => list.setQuery(e.target.value))}
                  placeholder="タイトルや内容で検索"
                  aria-label="ノートを検索"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    height: 48,
                    padding: '0 52px 0 44px',
                    border: '1px solid var(--dc-border-strong)',
                    borderRadius: 'var(--dc-radius-md)',
                    background: 'var(--dc-surface)',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    color: 'var(--dc-text)',
                    outline: 'none',
                  }}
                />

                {/* 1a の右端アイコン。チップがすでに絞り込みなので、ここは並び替えを担う */}
                <div
                  ref={sortRef}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
                >
                  <button
                    type="button"
                    aria-label="並び替えを開く"
                    aria-expanded={sortOpen}
                    onClick={() => setSortOpen((v) => !v)}
                    className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 36,
                      height: 36,
                      border: 0,
                      borderRadius: 8,
                      background: sortOpen ? 'var(--dc-sunken)' : 'none',
                      color: 'var(--dc-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <SlidersHorizontal size={18} />
                  </button>

                  {sortOpen && (
                    <div
                      role="menu"
                      style={{
                        position: 'absolute',
                        top: 42,
                        right: 0,
                        zIndex: 20,
                        minWidth: 170,
                        padding: 6,
                        background: 'var(--dc-surface)',
                        border: '1px solid var(--dc-border)',
                        borderRadius: 'var(--dc-radius-md)',
                        boxShadow: 'var(--dc-shadow-float)',
                      }}
                    >
                      {SORTS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="menuitemradio"
                          aria-checked={list.sort === s}
                          onClick={() => {
                            changeFilter(() => list.setSort(s));
                            setSortOpen(false);
                          }}
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '9px 10px',
                            border: 0,
                            borderRadius: 8,
                            background: list.sort === s ? 'var(--dc-soft-100)' : 'transparent',
                            color: list.sort === s ? 'var(--dc-primary)' : 'var(--dc-text-body)',
                            fontFamily: 'inherit',
                            fontSize: 13,
                            fontWeight: 700,
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                        >
                          {NOTE_SORT_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 1a に無いが残す。ここを外すとノートを作る手段が画面から消える */}
              <button
                type="button"
                onClick={handleCreate}
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 'none',
                  height: 48,
                  padding: '0 24px',
                  border: 0,
                  borderRadius: 'var(--dc-radius-md)',
                  background: 'var(--dc-primary)',
                  color: '#FFFFFF',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={17} /> 新しいノートを作成
              </button>
            </div>

            {/* ── 絞り込みチップ。出どころ（自動付与）＋ 重要（手動ラベル）── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Chip active={origin === 'all'} onClick={() => changeFilter(() => setOrigin('all'))}>
                すべて
              </Chip>
              {ORIGIN_CHIPS.map((o) => (
                <Chip key={o} active={origin === o} onClick={() => changeFilter(() => setOrigin(o))}>
                  {NOTE_ORIGIN_LABEL[o]}
                </Chip>
              ))}

              <span style={{ width: 1, height: 20, background: 'var(--dc-border-strong)' }} />

              <Chip
                active={favoriteOnly}
                onClick={() => changeFilter(() => setFavoriteOnly((v) => !v))}
              >
                <Star
                  size={13}
                  fill={favoriteOnly ? '#FFFFFF' : 'var(--dc-primary)'}
                  style={{ color: favoriteOnly ? '#FFFFFF' : 'var(--dc-primary)' }}
                />
                重要
              </Chip>
            </div>

            {list.error ? (
              <div
                style={{
                  padding: 24,
                  background: 'var(--dc-surface)',
                  border: '1px solid var(--dc-border)',
                  borderRadius: 'var(--dc-radius-lg)',
                  fontSize: 13.5,
                  color: 'var(--dc-text-muted)',
                }}
              >
                {list.error}
              </div>
            ) : (
              <>
                <NoteGrid
                  items={paged}
                  loading={list.loading}
                  totalCount={list.items.length}
                  onOpen={select}
                  onToggleFavorite={handleToggleFavorite}
                  onDelete={(note) => void handleDelete(note.id)}
                  onCreate={handleCreate}
                  onClearFilters={clearFilters}
                />

                {filtered.length > 0 && (
                  <NotesPagination
                    page={page}
                    pageCount={pageCount}
                    total={filtered.length}
                    from={from + 1}
                    to={from + paged.length}
                    onChange={setPage}
                  />
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="h-10 flex items-center justify-center" style={{ background: '#2B2629' }}>
        <span className="text-[11.4px] font-bold text-white">2026 &copy; WEBCOACH</span>
      </footer>

      {MOCKS_ENABLED && (
        <React.Suspense fallback={null}>
          <NotesDevPanel
            pageSize={PAGE_SIZE}
            total={list.items.length}
            onDone={async () => {
              setPage(1);
              select(null);
              await list.reload();
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
}

/** 絞り込みチップ。選択中はブランド赤で塗る */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        border: active ? 0 : '1px solid var(--dc-border-strong)',
        borderRadius: 9999,
        background: active ? 'var(--dc-primary)' : 'var(--dc-surface)',
        color: active ? '#FFFFFF' : 'var(--dc-text-body)',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export default MyNotesPage;
