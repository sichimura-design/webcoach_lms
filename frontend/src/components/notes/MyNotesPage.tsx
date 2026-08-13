import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { color, font, radius, space, t } from '../../theme/webcoachTheme';
import { AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNote } from '../../hooks/useNote';
import { useNoteList } from '../../hooks/useNoteList';
import { useScaleToFit } from '../../hooks/useScaleToFit';
import StudyRoomHeader from '../studyRoom/StudyRoomHeader';
import { NOTE_SORT_LABEL, NoteSort, NoteSourceRef } from '../../types/notes';
import NoteEditor from './NoteEditor';
import NoteListPanel from './NoteListPanel';

/**
 * ノート（/notes）。自習室タブの3つ目。
 *
 * 【何を作り替えたか】
 * 以前は メモ / クリップ / AI回答 を種別タブで切り替えて眺める「履歴」だった。
 * レビュー指摘は「単なるメモ履歴ではなく、ユーザーが自分でノートを作成し、
 * その中に文章・クリップ・AI回答を自由に追加して育てていけるもの」。
 * 器（ノート）と中身（ブロック）に分け、左＝ノート一覧／右＝ノート面の2カラムにした。
 *
 * 位置付けは「Notionほど多機能ではなく、学習に特化したシンプルな自由帳」。
 * タグ・フォルダ・色分けは入れない。道具は 検索 と 並び替え の2つだけ。
 *
 * 外枠は集中ブース・学習記録と同じ「1440pxで組んで transform:scale で収める」方式。
 * タブで行き来したときに文字サイズや上部の位置が動かないよう、3面で揃えている。
 */
const DESIGN_WIDTH = 1440;

const SORTS: NoteSort[] = ['updated', 'created', 'title'];

export function MyNotesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);

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

  // 何も選ばれていない／消えたIDを指しているときは先頭を開く。
  // 右側が空のままだと「ノートとは何か」が伝わらない。
  useEffect(() => {
    if (list.loading || list.items.length === 0) return;
    if (selectedId && list.items.some((n) => n.id === selectedId)) return;
    select(list.items[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.loading, list.items, selectedId]);

  const handleCreate = async () => {
    try {
      const note = await list.create({});
      select(note.id);
    } catch {
      showToast('ノートを作成できませんでした', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    try {
      await list.remove(selectedId);
      select(null);
      showToast('ノートを削除しました', 'success');
    } catch {
      showToast('削除できませんでした', 'error');
    }
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
    <div className="min-h-screen flex flex-col" style={{ background: color.pageBg }}>
      <AppHeader userName={user?.username || 'User'} />

      <div className="relative flex-1">
        <div
          ref={outerRef}
          style={{
            width: '100%',
            maxWidth: DESIGN_WIDTH,
            margin: '0 auto',
            position: 'relative',
            height: innerHeight ? innerHeight * scale : undefined,
          }}
        >
          <main
            ref={innerRef}
            className="notes-main flex flex-col"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DESIGN_WIDTH,
              boxSizing: 'border-box',
              gap: space.sectionGap,
              fontFamily: font.family,
              color: color.text,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <StudyRoomHeader active="notes" />

            {/* ── 作成・検索・並び替え。探す道具はこの2つだけに絞る ── */}
            <div className="flex items-center" style={{ gap: 14 }}>
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  gap: 9,
                  height: 46,
                  padding: '0 24px',
                  border: 0,
                  borderRadius: radius.md,
                  background: color.primary,
                  color: color.textOnPrimary,
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Plus size={17} /> 新しいノートを作成
              </button>

              <div
                className="flex items-center"
                style={{
                  flex: 1,
                  minWidth: 0,
                  gap: 12,
                  height: 46,
                  padding: '0 18px',
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  background: color.surface,
                }}
              >
                <Search size={17} style={{ color: color.textSubtle, flexShrink: 0 }} />
                <input
                  value={list.query}
                  onChange={(e) => list.setQuery(e.target.value)}
                  placeholder="ノートを検索"
                  aria-label="ノートを検索"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 0,
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: 'inherit',
                    fontSize: 13.5,
                    color: color.text,
                  }}
                />
              </div>

              <select
                value={list.sort}
                onChange={(e) => list.setSort(e.target.value as NoteSort)}
                aria-label="並び替え"
                style={{
                  height: 46,
                  padding: '0 16px',
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  background: color.surface,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 700,
                  color: color.textBody,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {NOTE_SORT_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            {list.error ? (
              <div style={{ ...t.card, padding: 24, ...font.meta, color: color.textMuted }}>{list.error}</div>
            ) : (
              <div className="notes-2col">
                <NoteListPanel
                  items={list.items}
                  loading={list.loading}
                  selectedId={selectedId}
                  onSelect={select}
                  searching={list.query.trim().length > 0}
                />

                {detail.note ? (
                  <NoteEditor
                    note={detail.note}
                    onRename={detail.renameNote}
                    onToggleFavorite={detail.toggleFavorite}
                    onDelete={handleDelete}
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
                      ...t.card,
                      padding: '60px 30px',
                      textAlign: 'center',
                      ...font.meta,
                      color: color.textMuted,
                      lineHeight: 1.9,
                    }}
                  >
                    {detail.loading
                      ? '読み込んでいます…'
                      : 'ノートを選ぶか、「新しいノートを作成」から始めましょう。'}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      <footer className="h-10 flex items-center justify-center" style={{ background: '#2B2629' }}>
        <span className="text-[11.4px] font-bold text-white">2026 &copy; WEBCOACH</span>
      </footer>
    </div>
  );
}

export default MyNotesPage;
