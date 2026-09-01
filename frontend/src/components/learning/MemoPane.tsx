import { ChevronRight, NotebookPen } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { NoteSummary } from '../../types/notes';
import { UseNotes } from '../../hooks/useNotes';

/**
 * 教材ページのメモ欄。
 *
 * 【何を外したか】
 * 以前はここに 種別タブ（すべて/メモ/クリップ/AI回答）＋検索＋平坦なカード一覧が
 * 入っていた。ノートが「器＋中身」になったので、その一覧は /notes の役割になった。
 * 狭い右パネルに一覧の縮小版を置くと、同じものが2箇所にあって
 * どちらが正なのか分からなくなる。
 *
 * ここに残すのは2つだけ:
 *   ・下書き（自動保存）… 編集しながら考えるための場所
 *   ・このレッスンから触ったノートへの入口
 */
interface MemoPaneProps {
  notes: UseNotes;
  lessonTitle: string;
  /** このレッスンから触ったノート */
  relatedNotes: NoteSummary[];
  /** 下書きを追加先ノートの本文として取り込む */
  onKeepDraft: () => void;
  /** ノートを開く（/notes?note=...） */
  onOpenNote: (noteId: string) => void;
}

export function MemoPane({
  notes,
  lessonTitle,
  relatedNotes,
  onKeepDraft,
  onOpenNote,
}: MemoPaneProps) {
  const statusLabel =
    notes.memoStatus === 'saving' ? '保存中…' : notes.memoStatus === 'saved' ? '自動保存済み' : '自動保存';

  return (
    <section className="flex flex-col" style={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <div
        className="flex items-center"
        style={{ gap: 8, minHeight: 45, padding: '0 14px', borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}
      >
        <strong style={{ ...font.label, fontWeight: 800, color: color.text }}>メモ</strong>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9.5, color: color.textFaint }}>{statusLabel}</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* ── 下書き（自動保存）── */}
        <div style={{ padding: 12, background: color.pageBg, borderBottom: `1px solid ${color.border}` }}>
          <div
            className="flex flex-col"
            style={{
              border: `1px solid ${color.border}`,
              borderRadius: 11,
              background: color.surface,
              overflow: 'hidden',
            }}
          >
            <textarea
              value={notes.memoDraft}
              onChange={(e) => notes.setMemoDraft(e.target.value)}
              placeholder="教材を見ながら、気づいたこと・試したいことを書く…"
              style={{
                minHeight: 96,
                resize: 'none',
                border: 0,
                padding: '10px 11px 4px',
                color: color.text,
                outline: 'none',
                fontSize: 12,
                lineHeight: 1.8,
                fontFamily: 'inherit',
              }}
            />
            <div
              className="flex items-center"
              style={{ gap: 6, padding: '5px 9px 8px', fontSize: 9.5, color: color.textFaint }}
            >
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                「{lessonTitle}」の下書き
              </span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={onKeepDraft}
                disabled={!notes.memoDraft.trim()}
                className="disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  height: 26,
                  padding: '0 10px',
                  border: `1px solid ${color.primaryBorder}`,
                  borderRadius: 7,
                  background: color.surface,
                  color: color.primary,
                  fontSize: 9.5,
                  fontWeight: 700,
                  cursor: notes.memoDraft.trim() ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
              >
                ノートに残す
              </button>
            </div>
          </div>
          <p style={{ margin: '8px 2px 0', fontSize: 9.5, color: color.textFaint, lineHeight: 1.8 }}>
            下書きは自動保存されます。「ノートに残す」を押すと、追加先のノートを選ぶ画面が出ます。
          </p>
        </div>

        {/* ── このレッスンから触ったノート ── */}
        <div style={{ padding: '12px 12px 16px' }}>
          <div style={{ ...font.caption, color: color.textSubtle, marginBottom: 8 }}>
            このレッスンのノート
          </div>

          {relatedNotes.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: color.textFaint, lineHeight: 1.9 }}>
              まだありません。本文をドラッグして「クリップ」するか、上の下書きから残せます。
            </p>
          ) : (
            <div className="flex flex-col" style={{ gap: 6 }}>
              {relatedNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onOpenNote(note.id)}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    padding: '10px 11px',
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.sm,
                    background: color.surface,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <NotebookPen size={13} style={{ color: color.textFaint, flexShrink: 0 }} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: color.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {note.title}
                  </span>
                  <span style={{ fontSize: 10, color: color.textFaint, flexShrink: 0 }}>
                    {note.blockCount}件
                  </span>
                  <ChevronRight size={13} style={{ color: color.textFaint, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default MemoPane;
