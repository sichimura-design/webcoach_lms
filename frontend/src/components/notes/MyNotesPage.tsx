import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, ChevronDown, Plus, Search } from 'lucide-react';
import { AppFooter, AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDismissable } from '../../hooks/useDismissable';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNote } from '../../hooks/useNote';
import { useNoteFolders } from '../../hooks/useNoteFolders';
import { useNoteList } from '../../hooks/useNoteList';
import { BackTo } from '../../hooks/useNoteCapture';
import {
  NOTE_ORIGIN_LABEL,
  NOTE_SORT_LABEL,
  NoteFolder,
  NoteFolderFilter,
  NoteOrigin,
  NoteSort,
  NoteSourceRef,
  folderParamOf,
  matchesFolderFilter,
  parseFolderParam,
} from '../../types/notes';
import NoteEditor from './NoteEditor';
import NoteEditorBar from './NoteEditorBar';
import NoteFolderColumn from './NoteFolderColumn';
import NoteFolderStrip from './NoteFolderStrip';
import NoteGrid from './NoteGrid';
import NotesPagination from './NotesPagination';
import { countByFolder, filterLabel, folderNameOf } from './folderRows';

/**
 * マイノート（/notes）。デザイン『マイノート 改善案』を実装したもの。
 *
 * 【構成】
 *   左＝フォルダ列（自分で決める入れ物。すべて／重要／フォルダ…／未整理）
 *   右＝一覧（パンくず・検索・種類チップ・カードグリッド）か、ノート面（上部バー＋紙）
 * フォルダと「種類」（出どころ）は別の軸として掛け合わさる。種類は自動で付くラベル、
 * フォルダは手で選ぶ置き場所。未整理は「とりあえず保存」の行き先で、取り込んだものは
 * まずそこに入る。
 *
 * 【URL】
 *   /notes                 … カードグリッド
 *   /notes?folder=<id>     … そのフォルダ（star＝重要、inbox＝未整理）
 *   /notes?note=<id>       … そのノートのノート面（全幅）。folder は保ったまま
 * ルートを増やさないのは、教材画面のメモ欄とAI回答の保存後の遷移が
 * すでに /notes?note=<id> を指しているため（useNoteCapture / MemoPane）。
 *
 * 外枠はマイページと同じ可変幅＋暖色クリームのトークン（.wc-warm の --dc-*）。
 */

/** 1ページの件数。3列 × 8行 */
const PAGE_SIZE = 24;

const SORTS: NoteSort[] = ['updated', 'updatedAsc', 'created', 'createdAsc', 'title'];

/** 種類チップの並び。「すべて」を先頭に置く */
const ORIGIN_CHIPS: NoteOrigin[] = ['self', 'material', 'ai', 'coaching'];

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
   *    state が無いときだけ source を保険に使う（下の backToSource）。
   */
  const backTo = (location.state as { backTo?: BackTo } | null)?.backTo ?? null;

  const list = useNoteList();
  const folderApi = useNoteFolders();
  const { folders } = folderApi;

  // 1023px 以下はフォルダ列を畳んで横並びのピルにする（HTML5 のドラッグも効かない幅）
  const narrow = useMediaQuery('(max-width: 1023px)');

  // 選択中のノートとフォルダはURLに持つ。教材画面の取り込みトーストから
  // /notes?note=<id> で直接開けるようにするため（ルート定義は増やさない）。
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('note');
  const rawFilter = useMemo(() => parseFolderParam(searchParams.get('folder')), [searchParams]);

  // 消えたフォルダを指す ?folder= は「すべて」として扱う（読み込み中は判定しない）
  const filter: NoteFolderFilter = useMemo(() => {
    if (rawFilter.kind === 'folder' && !folderApi.loading && !folders.some((f) => f.id === rawFilter.id)) {
      return { kind: 'all' };
    }
    return rawFilter;
  }, [rawFilter, folders, folderApi.loading]);

  /*
   * 開くときは履歴を積み（push）、閉じるときは積まない（replace）。
   * 🔴 開くのを replace にすると、ノートを見てからブラウザバックしても
   *    一覧に戻れず、来る前のページまで飛んでしまう。
   *    逆に閉じるのを push にすると、戻るでさっき閉じたノートに引き戻される。
   * フォルダの切り替えは絞り込みなので履歴に積まない（replace）。
   */
  const select = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('note', id);
    else next.delete('note');
    setSearchParams(next, { replace: id === null });
    // ノート面で本文を書くと updatedAt と書き出しが変わる。一覧へ戻るときに取り直して並びを合わせる
    if (id === null && selectedId) void list.reload();
  };

  const [page, setPage] = useState(1);

  const setFolder = useCallback(
    (next: NoteFolderFilter) => {
      const params = new URLSearchParams(searchParams);
      const value = folderParamOf(next);
      if (value) params.set('folder', value);
      else params.delete('folder');
      // ノート面でフォルダを押したら一覧に戻る
      params.delete('note');
      setSearchParams(params, { replace: true });
      setPage(1);
    },
    [searchParams, setSearchParams]
  );

  const detail = useNote(selectedId);

  // 絞り込みとページ送りは、取得済みの一覧に対してその場でかける。
  // チップごとに再取得しないので、押した瞬間に切り替わる。
  const [origin, setOrigin] = useState<NoteOrigin | 'all'>('all');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  useDismissable(sortRef, sortOpen, () => setSortOpen(false));

  // 件数は検索語でスコープされる（items は検索済み）。グリッドに出る枚数と常に一致する
  const counts = useMemo(() => countByFolder(list.items), [list.items]);

  const filtered = useMemo(
    () =>
      list.items.filter(
        (n) => matchesFolderFilter(n, filter) && (origin === 'all' || n.origin === origin)
      ),
    [list.items, filter, origin]
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

  /** 「新しいノート」。フォルダを開いていればそこに、すべて／重要／未整理なら未整理に作る */
  const handleCreate = async () => {
    try {
      const note = await list.create({ folderId: filter.kind === 'folder' ? filter.id : null });
      select(note.id);
    } catch {
      showToast('ノートを作成できませんでした', 'error');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    // カードから削除が消え、入口はノート面の「その他」だけ。元に戻せないので一度確かめる
    if (!window.confirm(`「${title}」を削除しますか？\nこの操作は元に戻せません。`)) return;
    try {
      await list.remove(id);
      if (selectedId === id) select(null);
      showToast('ノートを削除しました', 'success');
    } catch {
      showToast('削除できませんでした', 'error');
    }
  };

  const clearFilters = () => {
    changeFilter(() => {
      setOrigin('all');
      list.setQuery('');
    });
    setFolder({ kind: 'all' });
  };

  /** クリップ・AI回答から元のレッスンへ。?block= で保存した箇所まで戻す */
  const openSource = (source: NoteSourceRef, blockId: string | null) => {
    const params = new URLSearchParams({ module: String(source.lessonId) });
    if (source.blockId) params.set('block', source.blockId);
    else if (blockId) params.set('block', blockId);
    navigate(`/course/${source.courseId}?${params.toString()}`);
  };

  // ── フォルダの操作 ──
  const handleCreateFolder = async (name: string) => {
    try {
      const folder = await folderApi.create(name);
      setFolder({ kind: 'folder', id: folder.id });
      showToast(`フォルダ「${folder.name}」を作りました`, 'success');
    } catch {
      showToast('フォルダを作成できませんでした', 'error');
    }
  };

  const handleRenameFolder = async (id: string, name: string) => {
    try {
      await folderApi.rename(id, name);
    } catch {
      showToast('名前を変更できませんでした', 'error');
    }
  };

  const handleDeleteFolder = async (folder: NoteFolder) => {
    const n = counts.byFolder[folder.id] ?? 0;
    const body = n > 0 ? `\n中のノート ${n}件 は未整理に移ります。` : '';
    if (!window.confirm(`フォルダ「${folder.name}」を削除しますか？${body}`)) return;
    try {
      const { moved } = await folderApi.remove(folder.id);
      if (filter.kind === 'folder' && filter.id === folder.id) setFolder({ kind: 'all' });
      // 一覧側の folderId も変わっているので取り直す
      await list.reload();
      showToast(moved > 0 ? `フォルダを削除しました（${moved}件を未整理へ）` : 'フォルダを削除しました', 'success');
    } catch {
      showToast('フォルダを削除できませんでした', 'error');
    }
  };

  /** カードをフォルダ行に落とした／ノート面のピルで選んだ */
  const moveNote = async (noteId: string, folderId: string | null, viaEditor: boolean) => {
    const target = folderNameOf(folderId, folders) ?? '未整理';
    try {
      if (viaEditor) {
        await detail.moveToFolder(folderId);
        // 一覧側にも映す。戻ったときに元のフォルダに残って見えないように
        list.patchItem(noteId, { folderId });
      } else {
        await list.moveToFolder(noteId, folderId);
      }
      showToast(`「${target}」に移動しました`, 'success');
    } catch {
      showToast('移動できませんでした', 'error');
    }
  };

  /** ノート面の「重要」。フォルダ列の「重要」の件数も同時に動かす */
  const toggleFavoriteInEditor = async () => {
    if (!detail.note) return;
    const next = !detail.note.favorite;
    await detail.toggleFavorite();
    list.patchItem(detail.note.id, { favorite: next });
  };

  const renameInEditor = (title: string) => {
    if (!detail.note) return;
    void detail.renameNote(title);
    list.patchItem(detail.note.id, { title });
  };

  const hasOtherFilters = origin !== 'all' || list.query.trim() !== '';
  const crumb = filterLabel(filter, folders);

  const backToSource = backTo
    ? { label: backTo.label, onClick: () => navigate(backTo.to) }
    : detail.note?.source
    ? {
        label: `「${detail.note.source.lessonTitle}」に戻る`,
        onClick: () => openSource(detail.note!.source!, null),
      }
    : null;

  return (
    <div className="wc-warm min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username || 'User'} />

      <div className="notes-shell">
        {!narrow && (
          <NoteFolderColumn
            folders={folders}
            counts={counts}
            active={filter}
            onSelect={setFolder}
            onCreate={handleCreateFolder}
            onRename={handleRenameFolder}
            onDelete={(folder) => void handleDeleteFolder(folder)}
            onDropNote={(noteId, folderId) => void moveNote(noteId, folderId, false)}
          />
        )}

        <div className="notes-content">
          <main className="notes-main flex flex-col" style={{ flex: 1, gap: 20, color: 'var(--dc-text)' }}>
            {selectedId ? (
              /* ── ノート面。一覧から1枚を開いた状態 ──
                 🔴 紙をページの高さいっぱいに伸ばす。伸ばさないと、書きかけの
                    空ノートの下にフッターまでの空白が残って落ち着かない。 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
                {detail.note ? (
                  <>
                    <NoteEditorBar
                      note={detail.note}
                      folders={folders}
                      saveState={detail.saveState}
                      onBack={() => select(null)}
                      backToSource={backToSource}
                      onMoveToFolder={(folderId) => void moveNote(detail.note!.id, folderId, true)}
                      onToggleFavorite={() => void toggleFavoriteInEditor()}
                      onDelete={() => void handleDelete(detail.note!.id, detail.note!.title)}
                    />
                    <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <NoteEditor
                        note={detail.note}
                        onRename={renameInEditor}
                        onAddBlock={detail.addBlock}
                        onPatchBlock={detail.patchBlock}
                        onMoveBlock={detail.moveBlock}
                        onRemoveBlock={detail.removeBlock}
                        onOpenSource={openSource}
                        onError={(message) => showToast(message, 'error')}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => select(null)}
                      className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                      style={{
                        alignSelf: 'flex-start',
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
                      ‹ マイノートに戻る
                    </button>
                    <div
                      style={{
                        maxWidth: 900,
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
                  </>
                )}
              </div>
            ) : (
              <>
                {narrow && (
                  <NoteFolderStrip folders={folders} counts={counts} active={filter} onSelect={setFolder} />
                )}

                {/* ── パンくず＋見出し、検索、新規作成 ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <nav
                      aria-label="現在の場所"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--dc-text-muted)' }}
                    >
                      {crumb ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setFolder({ kind: 'all' })}
                            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                            style={{
                              padding: 0,
                              border: 0,
                              background: 'none',
                              color: 'inherit',
                              fontFamily: 'inherit',
                              fontSize: 'inherit',
                              cursor: 'pointer',
                            }}
                          >
                            マイノート
                          </button>
                          <span style={{ color: 'var(--dc-text-subtle)' }}>›</span>
                          <span style={{ color: 'var(--dc-text)', fontWeight: 700 }}>{crumb}</span>
                        </>
                      ) : (
                        <span>マイノート</span>
                      )}
                    </nav>
                    <h1
                      style={{
                        margin: '6px 0 0',
                        fontSize: 22,
                        lineHeight: 1.35,
                        fontWeight: 700,
                        letterSpacing: '-.01em',
                      }}
                    >
                      マイノート
                    </h1>
                  </div>

                  {/* 🔴 検索欄は幅いっぱいにしない。左端の入力から右端のボタンまで
                         視線が横断してしまう。 */}
                  <div style={{ position: 'relative', flex: '0 1 300px', minWidth: 160 }}>
                    <Search
                      size={17}
                      style={{
                        position: 'absolute',
                        left: 13,
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
                      className="notes-search-input"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        height: 42,
                        padding: '0 14px 0 38px',
                        border: '1px solid var(--dc-border-strong)',
                        borderRadius: 'var(--dc-radius-md)',
                        background: 'var(--dc-surface)',
                        fontFamily: 'inherit',
                        color: 'var(--dc-text)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCreate}
                    className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      flex: 'none',
                      height: 42,
                      padding: '0 20px',
                      border: 0,
                      borderRadius: 'var(--dc-radius-md)',
                      background: 'var(--dc-primary)',
                      color: '#FFFFFF',
                      fontFamily: 'inherit',
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={16} /> 新しいノート
                  </button>
                </div>

                {/* ── 種類の絞り込み。フォルダとは別の軸だと分かるよう見出しを付ける ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--dc-text-subtle)', marginRight: 2 }}>
                    種類
                  </span>
                  <Chip active={origin === 'all'} onClick={() => changeFilter(() => setOrigin('all'))}>
                    すべて
                  </Chip>
                  {ORIGIN_CHIPS.map((o) => (
                    <Chip key={o} active={origin === o} onClick={() => changeFilter(() => setOrigin(o))}>
                      {NOTE_ORIGIN_LABEL[o]}
                    </Chip>
                  ))}

                  {/* ── 並び替え。現在の並び順を文字で出す ── */}
                  <div ref={sortRef} style={{ position: 'relative', marginLeft: 'auto' }}>
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={sortOpen}
                      onClick={() => setSortOpen((v) => !v)}
                      className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 30,
                        padding: '0 12px',
                        border: '1px solid var(--dc-border-strong)',
                        borderRadius: 9999,
                        background: sortOpen ? 'var(--dc-sunken)' : 'var(--dc-surface)',
                        color: 'var(--dc-text-body)',
                        fontFamily: 'inherit',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <ArrowUpDown size={13} style={{ color: 'var(--dc-text-muted)' }} />
                      {NOTE_SORT_LABEL[list.sort]}
                      <ChevronDown size={13} style={{ color: 'var(--dc-text-muted)' }} />
                    </button>

                    {sortOpen && (
                      <div role="menu" className="notes-menu" style={{ top: 36, right: 0 }}>
                        {SORTS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            role="menuitemradio"
                            aria-checked={list.sort === s}
                            className={`notes-menu-item ${list.sort === s ? 'is-selected' : ''}`}
                            onClick={() => {
                              changeFilter(() => list.setSort(s));
                              setSortOpen(false);
                            }}
                          >
                            {NOTE_SORT_LABEL[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                      folders={folders}
                      filter={filter}
                      hasOtherFilters={hasOtherFilters}
                      onOpen={select}
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

          <AppFooter style={{ padding: '32px 0 24px' }} />
        </div>
      </div>

    </div>
  );
}

/** 種類チップ。選択中はブランド赤で塗る（見た目は index.css の .notes-chip） */
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
      className={`notes-chip focus-visible:ring-2 focus-visible:ring-[#F6B9BD] ${active ? 'is-active' : ''}`}
    >
      {children}
    </button>
  );
}

export default MyNotesPage;
