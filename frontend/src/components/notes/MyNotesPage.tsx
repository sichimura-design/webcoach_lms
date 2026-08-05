import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerUpLeft, Search, Trash2 } from 'lucide-react';
import { color, font, radius, shadow, space } from '../../theme/webcoachTheme';
import { AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useNotes } from '../../hooks/useNotes';
import { useScaleToFit } from '../../hooks/useScaleToFit';
import StudyRoomHeader from '../studyRoom/StudyRoomHeader';
import { NOTE_FILTER_LABEL, NoteFilter, NoteItem } from '../../types/notes';

/**
 * ノート（/notes）。自習室タブの3つ目。
 *
 * メモ・クリップ・⭐保存したAI回答を1つのページで横断管理する（要件§11）。
 * すべての項目から元のレッスンへ戻れることが要点なので、カードには必ず
 * 「元のレッスンへ」を置き、クリップ・AI回答は保存時の教材まで復帰させる。
 *
 * 外枠は集中ブース・学習記録と同じ「1440pxで組んで transform:scale で収める」方式。
 * タブで行き来したときに文字サイズや上部の位置が動かないよう、3面で揃えている。
 */

const DESIGN_WIDTH = 1440;
/** 本文（1行のノートカード）は読みやすい幅で止める。ヘッダ・タブは全幅のまま */
const CONTENT_WIDTH = 980;

const FILTERS: NoteFilter[] = ['all', 'memo', 'clip', 'answer'];

const TYPE_BADGE: Record<NoteItem['kind'], { bg: string; color: string }> = {
  memo: { bg: '#EAF7F2', color: '#267454' },
  clip: { bg: '#FFF4CA', color: '#876700' },
  answer: { bg: color.primarySoft, color: color.primary },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function MyNotesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);

  const [filter, setFilter] = useState<NoteFilter>('all');
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState<number | 'all'>('all');
  const [lessonId, setLessonId] = useState<number | 'all'>('all');

  // 一覧は全件取ってから手元で絞り込む。件数が個人のノート規模で収まるうえ、
  // 絞り込みのたびにサーバ往復するとタブ切り替えが重くなるため。
  const notes = useNotes({ query: useMemo(() => ({}), []) });

  const courses = useMemo(() => {
    const map = new Map<number, string>();
    notes.items.forEach((n) => map.set(n.courseId, n.courseName));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [notes.items]);

  const lessons = useMemo(() => {
    const map = new Map<number, string>();
    notes.items
      .filter((n) => courseId === 'all' || n.courseId === courseId)
      .forEach((n) => map.set(n.lessonId, n.lessonTitle));
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [notes.items, courseId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.items.filter((n) => {
      if (filter !== 'all' && n.kind !== filter) return false;
      if (courseId !== 'all' && n.courseId !== courseId) return false;
      if (lessonId !== 'all' && n.lessonId !== lessonId) return false;
      if (!q) return true;
      return [n.text, n.question ?? '', n.selectedText ?? '', n.lessonTitle, n.courseName, n.heading ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [notes.items, filter, courseId, lessonId, query]);

  const openSource = (note: NoteItem) => {
    const params = new URLSearchParams({ module: String(note.lessonId) });
    if (note.blockId) params.set('block', note.blockId);
    navigate(`/course/${note.courseId}?${params.toString()}`);
  };

  const counts = useMemo(() => {
    const base: Record<NoteFilter, number> = { all: notes.items.length, memo: 0, clip: 0, answer: 0 };
    notes.items.forEach((n) => { base[n.kind] += 1; });
    return base;
  }, [notes.items]);

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

            <div style={{ width: CONTENT_WIDTH, maxWidth: '100%' }}>
              <p style={{ ...font.label, color: color.textMuted, margin: '0 0 18px' }}>
                レッスンを見ながら書いたメモ、クリップした本文、保存したAI回答をまとめて振り返れます。
              </p>

              {/* ── タブ ── */}
              <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 14 }}>
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      height: 36, padding: '0 15px',
                      border: `1px solid ${filter === f ? color.primaryBorder : color.border}`,
                      borderRadius: 999,
                      background: filter === f ? color.primarySoft : color.surface,
                      color: filter === f ? color.primary : color.textMuted,
                      ...font.buttonSm,
                      fontWeight: filter === f ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {NOTE_FILTER_LABEL[f]}
                    <span style={{ marginLeft: 6, opacity: 0.65 }}>{counts[f]}</span>
                  </button>
                ))}
              </div>

              {/* ── 検索と絞り込み ── */}
              <div
                className="flex flex-wrap items-center"
                style={{
                  gap: 10, marginBottom: 20, padding: 14,
                  border: `1px solid ${color.border}`, borderRadius: radius.md, background: color.surface,
                }}
              >
                <div
                  className="flex items-center"
                  style={{
                    flex: '1 1 240px', gap: 8, height: 38, padding: '0 12px',
                    border: `1px solid ${color.border}`, borderRadius: radius.nav, background: color.pageBg,
                  }}
                >
                  <Search size={14} style={{ color: color.textFaint, flexShrink: 0 }} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="キーワードで検索"
                    aria-label="ノートを検索"
                    style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', fontSize: 13, color: color.text }}
                  />
                </div>

                <select
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value === 'all' ? 'all' : Number(e.target.value));
                    setLessonId('all');
                  }}
                  aria-label="コースで絞り込み"
                  style={selectStyle}
                >
                  <option value="all">すべてのコース</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  aria-label="レッスンで絞り込み"
                  style={selectStyle}
                >
                  <option value="all">すべてのレッスン</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
                </select>
              </div>

              {/* ── 一覧 ── */}
              {notes.loading ? (
                <div className="flex justify-center" style={{ padding: 48 }}>
                  <span className="animate-spin rounded-full" style={{ width: 30, height: 30, borderBottom: `2px solid ${color.primary}` }} />
                </div>
              ) : visible.length === 0 ? (
                <div
                  style={{
                    padding: '56px 24px', textAlign: 'center',
                    border: `1px solid ${color.border}`, borderRadius: radius.card, background: color.surface,
                  }}
                >
                  <p style={{ ...font.listItem, color: color.textMuted, margin: '0 0 6px' }}>
                    {notes.items.length === 0 ? '保存した項目はまだありません。' : '条件に合う項目がありません。'}
                  </p>
                  <p style={{ ...font.caption, color: color.textFaint, margin: 0 }}>
                    レッスンページで本文を選択してクリップするか、AI回答を⭐保存すると、ここに集まります。
                  </p>
                </div>
              ) : (
                <div className="flex flex-col" style={{ gap: 12 }}>
                  {visible.map((note) => {
                    const badge = TYPE_BADGE[note.kind];
                    return (
                      <article
                        key={note.id}
                        style={{
                          padding: '16px 18px',
                          border: `1px solid ${color.border}`,
                          borderRadius: radius.md,
                          background: color.surface,
                          boxShadow: shadow.soft,
                        }}
                      >
                        <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: 10 }}>
                          <span style={{ padding: '4px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: badge.bg, color: badge.color }}>
                            {NOTE_FILTER_LABEL[note.kind]}
                          </span>
                          <span style={{ ...font.caption, color: color.textSubtle }}>
                            {note.courseName} › {note.lessonTitle}
                            {note.heading ? ` › ${note.heading}` : ''}
                          </span>
                          <time style={{ marginLeft: 'auto', ...font.caption, color: color.textFaint }}>
                            {formatDate(note.createdAt)}
                          </time>
                        </div>

                        {note.question && (
                          <p style={{ margin: '0 0 8px', ...font.rowTitle, color: color.text }}>Q. {note.question}</p>
                        )}

                        {note.selectedText && (
                          <p
                            style={{
                              margin: '0 0 8px', paddingLeft: 10,
                              borderLeft: `3px solid ${color.primaryBorder}`,
                              ...font.caption, color: color.textMuted, lineHeight: 1.7,
                            }}
                          >
                            {note.selectedText}
                          </p>
                        )}

                        {note.image && (
                          <img
                            src={note.image}
                            alt="保存時に添付した画像"
                            style={{ maxWidth: 220, borderRadius: radius.nav, marginBottom: 8, display: 'block' }}
                          />
                        )}

                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.85, color: color.textBody, whiteSpace: 'pre-wrap' }}>
                          {note.text}
                        </p>

                        <div className="flex justify-end" style={{ gap: 8, marginTop: 12 }}>
                          <button
                            type="button"
                            onClick={() => openSource(note)}
                            className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                            style={{
                              gap: 5, height: 30, padding: '0 12px',
                              border: `1px solid ${color.primaryBorder}`, borderRadius: 999,
                              background: color.surface, color: color.primary,
                              ...font.caption, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            <CornerUpLeft size={12} /> 元のレッスンへ
                          </button>
                          <button
                            type="button"
                            onClick={() => void notes.remove(note.id)}
                            className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                            style={{
                              gap: 5, height: 30, padding: '0 12px',
                              border: `1px solid ${color.border}`, borderRadius: 999,
                              background: color.surface, color: color.textMuted,
                              ...font.caption, cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={12} /> 削除
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <footer className="h-10 flex items-center justify-center" style={{ background: '#2B2629' }}>
        <span className="text-[11.4px] font-bold text-white">2026 &copy; WEBCOACH</span>
      </footer>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  height: 38,
  padding: '0 10px',
  border: `1px solid ${color.border}`,
  borderRadius: radius.nav,
  background: color.surface,
  color: color.textBody,
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export default MyNotesPage;
