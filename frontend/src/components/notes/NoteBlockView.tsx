import { BookOpen, X } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { NoteBlock, NoteBlockPatch, NoteSourceRef } from '../../types/notes';

/**
 * ノートの素材1つ（教材からの引用クリップ / AIの回答）。
 *
 * 🔴 本文（kind:'text'）はここでは描かない。本文は Note.body の1本で、
 *    NoteEditor の textarea が丸ごと受け持つ。v5 までは本文もここで
 *    「クリックで textarea → 保存する」を1段落ずつやっていたが撤去した。
 *
 * 出どころの違いは左罫の色だけで示す（教材＝ブランド色 / AI＝緑）。
 * バッジや枠を増やすと、自分で書いた本文より引用のほうが目立ってしまう。
 *
 * 🔴 並べ替えは無い（素材は追加順）。削除はこの中の × 1つだけ。
 *    行の左に ⠿ と ＋ を出す NoteBlockRow は本文の1本化と一緒に消している。
 */
interface NoteBlockViewProps {
  block: NoteBlock;
  onPatch: (blockId: string, patch: NoteBlockPatch) => void;
  /** この素材を外す */
  onRemove: () => void;
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
        {/* 押すと引用モーダルでこの箇所が開く。画面は移動しないので ↗ は使わない */}
        <BookOpen size={11} style={{ flexShrink: 0 }} />
      </button>
      <span style={{ flex: 1 }} />
      <span style={{ ...font.caption, color: color.textFaint, whiteSpace: 'nowrap' }}>{time}</span>
    </div>
  );
}

export function NoteBlockView({ block, onPatch, onRemove, onOpenSource }: NoteBlockViewProps) {
  /**
   * 素材を外す。
   * 🔴 確認は挟まない。素材は教材やAIから取り込んだもので、同じ操作で入れ直せる
   *    （自分で書いた本文とは違い、消しても書いたものは失われない）。
   */
  const removeButton = (label: string) => (
    <button
      type="button"
      onClick={onRemove}
      aria-label={label}
      title={label}
      className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        width: 26,
        height: 26,
        border: 0,
        borderRadius: 7,
        background: 'transparent',
        color: color.textFaint,
        cursor: 'pointer',
      }}
    >
      <X size={14} />
    </button>
  );

  if (block.kind === 'clip') {
    return (
      <div
        className="flex items-start"
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
        {removeButton('この引用を外す')}
      </div>
    );
  }

  // ---- AI回答 ----
  return (
    <div
      className="flex items-start"
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
        {/* 質問に添付していた画像。保存されていたのに描いていなかった（質問の意味が分からなくなる） */}
        {block.image && (
          <img
            src={block.image}
            alt="質問に添付した画像"
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 260,
              marginTop: 8,
              borderRadius: radius.sm,
              border: `1px solid ${color.border}`,
            }}
          />
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
      {removeButton('このAI回答を外す')}
    </div>
  );
}

export default NoteBlockView;
