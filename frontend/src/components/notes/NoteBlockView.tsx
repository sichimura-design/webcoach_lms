import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { NoteBlock, NoteSourceRef } from '../../types/notes';
import { renderNoteText, NOTE_SYNTAX_HINT } from './noteText';

/**
 * ノート内の1ブロック。
 *
 * 3種（本文・クリップ・AI回答）が同じ流れの中に混ざって並ぶのが、この画面の要点。
 * 「メモ・クリップ・AI回答は別々の履歴として管理するのではなく、1つのノートの中に
 * 混在して配置できる」という要件そのものなので、種別ごとにセクションを分けない。
 *
 * 出どころの違いは左罫の色だけで示す（教材＝ブランド色 / AI＝緑）。
 * バッジや枠を増やすと、自分で書いた文章より引用のほうが目立ってしまう。
 */
interface NoteBlockViewProps {
  block: NoteBlock;
  onPatch: (blockId: string, patch: { text?: string; answer?: string }) => void;
  onRemove: (blockId: string) => void;
  /** クリップ・AI回答から元のレッスンへ戻る */
  onOpenSource: (source: NoteSourceRef, blockId: string | null) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function sourceLabel(source: NoteSourceRef): string {
  return [source.courseName, source.lessonTitle, source.heading].filter(Boolean).join(' > ');
}

/** ホバーで出す削除ボタン。常時出すとノート面が操作パネルに見えてしまう */
function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="このブロックを削除"
      title="削除"
      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        width: 26,
        height: 26,
        display: 'grid',
        placeItems: 'center',
        border: 0,
        borderRadius: 7,
        background: 'transparent',
        color: color.textFaint,
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'opacity .15s ease',
      }}
    >
      <Trash2 size={14} />
    </button>
  );
}

function SourceLine({
  source,
  blockId,
  time,
  onOpenSource,
}: {
  source: NoteSourceRef;
  blockId: string | null;
  time: string;
  onOpenSource: NoteBlockViewProps['onOpenSource'];
}) {
  return (
    <div className="flex items-center" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => onOpenSource(source, blockId)}
        className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          gap: 5,
          border: 0,
          background: 'transparent',
          padding: 0,
          ...font.caption,
          color: color.textMuted,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {sourceLabel(source)}
        <ExternalLink size={11} style={{ flexShrink: 0 }} />
      </button>
      <span style={{ flex: 1 }} />
      <span style={{ ...font.caption, color: color.textFaint, whiteSpace: 'nowrap' }}>{time}</span>
    </div>
  );
}

export function NoteBlockView({ block, onPatch, onRemove, onOpenSource }: NoteBlockViewProps) {
  // ---- 本文：クリックで編集、blur で確定 ----
  const isText = block.kind === 'text';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(isText ? block.text : '');
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isText) setDraft(block.text);
  }, [isText, block]);

  useEffect(() => {
    if (!editing) return;
    const el = areaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  if (block.kind === 'text') {
    if (editing) {
      return (
        <div style={{ margin: '4px 0 12px' }}>
          <textarea
            ref={areaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (draft !== block.text) onPatch(block.id, { text: draft });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDraft(block.text);
                setEditing(false);
              }
            }}
            rows={Math.max(3, draft.split('\n').length + 1)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: `1px solid ${color.primaryBorderSoft}`,
              borderRadius: radius.md,
              padding: '12px 14px',
              fontFamily: 'inherit',
              fontSize: 13.5,
              lineHeight: 2,
              color: color.textStrong,
              background: color.surface,
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <div style={{ ...font.caption, color: color.textFaint, marginTop: 5 }}>{NOTE_SYNTAX_HINT}</div>
        </div>
      );
    }

    return (
      <div className="group flex items-start" style={{ gap: 8, margin: '4px 0 10px' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{ flex: 1, minWidth: 0, cursor: 'text', borderRadius: radius.sm, outline: 'none' }}
        >
          {block.text.trim() ? (
            renderNoteText(block.text)
          ) : (
            <p style={{ margin: 0, ...font.meta, color: color.textFaint }}>（空の段落。クリックで書く）</p>
          )}
        </div>
        <RemoveButton onClick={() => onRemove(block.id)} />
      </div>
    );
  }

  if (block.kind === 'clip') {
    return (
      <div
        className="group flex items-start"
        style={{
          gap: 8,
          margin: '10px 0',
          padding: '13px 16px',
          background: color.noteClipBg,
          borderLeft: `3px solid ${color.noteClipAccent}`,
          borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center" style={{ gap: 8 }}>
            <span style={{ ...font.chip, color: color.noteClipAccent }}>クリップ</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.95, color: color.textStrong }}>
            {block.text}
          </p>
          <SourceLine
            source={block.source}
            blockId={block.source.blockId}
            time={formatTime(block.createdAt)}
            onOpenSource={onOpenSource}
          />
        </div>
        <RemoveButton onClick={() => onRemove(block.id)} />
      </div>
    );
  }

  // ---- AI回答 ----
  return (
    <div
      className="group flex items-start"
      style={{
        gap: 8,
        margin: '10px 0',
        padding: '13px 16px',
        background: color.noteAnswerBg,
        borderLeft: `3px solid ${color.noteAnswerAccent}`,
        borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <span style={{ ...font.chip, color: color.noteAnswerAccent }}>AI回答</span>
        </div>
        {block.question && (
          <p style={{ margin: '6px 0 0', fontSize: 13.5, fontWeight: 700, lineHeight: 1.8, color: color.text }}>
            {block.question}
          </p>
        )}
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 13,
            lineHeight: 1.95,
            color: color.textBody,
            whiteSpace: 'pre-wrap',
          }}
        >
          {block.answer}
        </p>
        {block.source ? (
          <SourceLine
            source={block.source}
            blockId={block.source.blockId}
            time={formatTime(block.createdAt)}
            onOpenSource={onOpenSource}
          />
        ) : (
          <div style={{ ...font.caption, color: color.textFaint, marginTop: 8, textAlign: 'right' }}>
            {formatTime(block.createdAt)}
          </div>
        )}
      </div>
      <RemoveButton onClick={() => onRemove(block.id)} />
    </div>
  );
}

export default NoteBlockView;
