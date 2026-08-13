import { Star } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { NoteSummary } from '../../types/notes';

/**
 * 左カラムの「マイノート」。
 *
 * ノートの数はタグやフォルダで捌く量にならない想定（要件でも「タグや分類機能を
 * 増やしすぎない」と切ってある）ので、並びは1本のリストだけにする。
 * 選択中は淡ピンク塗り＋赤い左アクセントで、右のノート面と対応が付くようにする。
 */
interface NoteListPanelProps {
  items: NoteSummary[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 検索で0件のときに文言を変える */
  searching: boolean;
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function NoteListPanel({ items, loading, selectedId, onSelect, searching }: NoteListPanelProps) {
  return (
    <div style={{ ...t.card, padding: '18px 14px' }}>
      <h2 style={{ ...font.cardTitle, color: color.text, margin: '0 0 14px', padding: '0 6px' }}>マイノート</h2>

      {loading && items.length === 0 ? (
        <p style={{ ...font.caption, color: color.textSubtle, padding: '8px 6px' }}>読み込んでいます…</p>
      ) : items.length === 0 ? (
        <p style={{ ...font.meta, color: color.textMuted, padding: '8px 6px', lineHeight: 1.9 }}>
          {searching
            ? '見つかりませんでした。別の言葉で探してみてください。'
            : 'まだノートがありません。「新しいノートを作成」から始めましょう。'}
        </p>
      ) : (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {items.map((note) => {
            const active = note.id === selectedId;
            return (
              <button
                key={note.id}
                type="button"
                onClick={() => onSelect(note.id)}
                aria-current={active}
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '13px 14px',
                  borderRadius: radius.md,
                  border: `1px solid ${active ? color.primaryBorder : color.border}`,
                  borderLeft: `3px solid ${active ? color.primary : color.border}`,
                  background: active ? color.primarySoft : color.surface,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <span className="flex items-center" style={{ gap: 8 }}>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      ...font.rowTitle,
                      color: active ? color.primary : color.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {note.title}
                  </span>
                  {note.favorite && (
                    <Star size={13} fill={color.primary} style={{ color: color.primary, flexShrink: 0 }} />
                  )}
                </span>

                {note.excerpt && (
                  <span
                    style={{
                      display: 'block',
                      ...font.caption,
                      color: color.textMuted,
                      marginTop: 5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {note.excerpt}
                  </span>
                )}

                <span
                  style={{ display: 'block', ...font.caption, color: color.textFaint, marginTop: 6 }}
                >
                  {formatStamp(note.updatedAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NoteListPanel;
