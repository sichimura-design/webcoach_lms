import { useMemo, useState } from 'react';
import { CornerUpLeft, Search, Trash2 } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { NOTE_FILTER_LABEL, NoteFilter, NoteItem } from '../../types/notes';
import { UseNotes } from '../../hooks/useNotes';

/**
 * 右下：自分のメモと保存物。
 *
 * 上段が教材単位のメモ（自動保存）、下段がメモカード・クリップ・⭐保存したAI回答の一覧。
 * ⭐保存は「あとでそのまま見返すもの」、メモ追加は「自分の学習記録へ組み込むもの」として
 * 分けている（要件§10）ので、一覧でも種別バッジで区別する。
 */
interface MemoPaneProps {
  notes: UseNotes;
  lessonTitle: string;
  onJumpToClip: (note: NoteItem) => void;
}

const FILTERS: NoteFilter[] = ['all', 'memo', 'clip', 'answer'];

const TYPE_BADGE: Record<NoteItem['kind'], { bg: string; color: string }> = {
  memo: { bg: '#EAF7F2', color: '#267454' },
  clip: { bg: '#FFF4CA', color: '#876700' },
  answer: { bg: color.primarySoft, color: color.primary },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function MemoPane({ notes, lessonTitle, onJumpToClip }: MemoPaneProps) {
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [query, setQuery] = useState('');

  // 一覧の絞り込みは手元で行う。サーバ往復せずタブ切り替えが即時に効くようにするため。
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.items.filter((n) => {
      if (filter !== 'all' && n.kind !== filter) return false;
      if (!q) return true;
      return [n.text, n.question ?? '', n.selectedText ?? '', n.lessonTitle, n.heading ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [notes.items, filter, query]);

  const statusLabel =
    notes.memoStatus === 'saving' ? '保存中…' : notes.memoStatus === 'saved' ? '自動保存済み' : '自動保存';

  return (
    <section className="flex flex-col" style={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <div
        className="flex items-center"
        style={{ gap: 8, minHeight: 45, padding: '0 14px', borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}
      >
        <strong style={{ ...font.label, fontWeight: 800, color: color.text }}>自分のメモ</strong>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9.5, color: color.textFaint }}>{statusLabel}</span>
      </div>

      {/* ── 教材単位のメモ（自動保存）── */}
      <div style={{ padding: 12, background: color.pageBg, borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}>
        <div className="flex flex-col" style={{ border: `1px solid ${color.border}`, borderRadius: 11, background: color.surface, overflow: 'hidden' }}>
          <textarea
            value={notes.memoDraft}
            onChange={(e) => notes.setMemoDraft(e.target.value)}
            placeholder="教材を見ながら、気づいたこと・試したいことを書く…"
            style={{
              minHeight: 74, resize: 'none', border: 0, padding: '10px 11px 4px',
              color: color.text, outline: 'none', fontSize: 12, lineHeight: 1.7, fontFamily: 'inherit',
            }}
          />
          <div className="flex items-center" style={{ gap: 6, padding: '5px 9px 8px', fontSize: 9.5, color: color.textFaint }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              「{lessonTitle}」に保存
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => void notes.addMemoCard()}
              disabled={!notes.memoDraft.trim()}
              className="disabled:opacity-45"
              style={{
                height: 26, padding: '0 9px',
                border: `1px solid ${color.border}`, borderRadius: 7,
                background: color.surface, color: color.textMuted, fontSize: 9.5,
                cursor: notes.memoDraft.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap',
              }}
            >
              メモとして残す
            </button>
          </div>
        </div>
      </div>

      {/* ── タブ＋検索 ── */}
      <div style={{ padding: '8px 12px 6px', background: color.surface, flexShrink: 0 }}>
        <div className="flex" style={{ gap: 5, overflowX: 'auto', marginBottom: 7 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                flex: '0 0 auto', height: 27, padding: '0 9px',
                border: `1px solid ${filter === f ? color.primaryBorder : color.border}`,
                borderRadius: 999,
                background: filter === f ? color.primarySoft : color.surface,
                color: filter === f ? color.primary : color.textMuted,
                fontSize: 9.5, fontWeight: filter === f ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {NOTE_FILTER_LABEL[f]}
            </button>
          ))}
        </div>
        <div
          className="flex items-center"
          style={{ gap: 6, padding: '0 9px', height: 30, border: `1px solid ${color.border}`, borderRadius: 8, background: color.pageBg }}
        >
          <Search size={12} style={{ color: color.textFaint, flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="メモ・クリップ・AI回答を検索"
            aria-label="保存した項目を検索"
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', fontSize: 10.5, color: color.text }}
          />
        </div>
      </div>

      {/* ── 一覧 ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 14px', background: color.surface, minHeight: 0 }}>
        {visible.length === 0 ? (
          <p style={{ padding: '22px 8px', color: color.textFaint, textAlign: 'center', fontSize: 10.5, lineHeight: 1.8 }}>
            保存した項目はまだありません。
            <br />
            教材を選択してクリップするか、AI回答を保存してください。
          </p>
        ) : (
          visible.map((note) => {
            const badge = TYPE_BADGE[note.kind];
            return (
              <article
                key={note.id}
                style={{ marginBottom: 8, padding: 10, border: `1px solid ${color.border}`, borderRadius: 10, background: color.surface }}
              >
                <div className="flex items-center" style={{ gap: 6, marginBottom: 7 }}>
                  <span style={{ padding: '3px 7px', borderRadius: 999, fontSize: 8.5, fontWeight: 800, background: badge.bg, color: badge.color }}>
                    {NOTE_FILTER_LABEL[note.kind]}
                  </span>
                  <span
                    style={{ minWidth: 0, fontSize: 8.5, color: color.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {note.heading || note.lessonTitle}
                  </span>
                  <time style={{ marginLeft: 'auto', fontSize: 8.5, color: color.textFaint, flexShrink: 0 }}>
                    {formatDate(note.createdAt)}
                  </time>
                </div>

                {note.question && (
                  <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 800, color: color.text }}>Q. {note.question}</p>
                )}
                <p style={{ margin: 0, fontSize: 10, lineHeight: 1.7, color: color.textBody, whiteSpace: 'pre-wrap' }}>
                  {note.text}
                </p>

                <div className="flex justify-end" style={{ gap: 5, marginTop: 8 }}>
                  {note.kind === 'clip' && note.blockId && (
                    <button
                      type="button"
                      onClick={() => onJumpToClip(note)}
                      className="inline-flex items-center"
                      style={smallButtonStyle}
                    >
                      <CornerUpLeft size={10} /> 元の場所
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void notes.remove(note.id)}
                    className="inline-flex items-center"
                    style={smallButtonStyle}
                  >
                    <Trash2 size={10} /> 削除
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

const smallButtonStyle: React.CSSProperties = {
  gap: 4,
  height: 24,
  padding: '0 8px',
  border: `1px solid ${color.border}`,
  borderRadius: 6,
  background: color.surface,
  color: color.textMuted,
  fontSize: 8.5,
  cursor: 'pointer',
};

export default MemoPane;
