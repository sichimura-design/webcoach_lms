import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Trash2 } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { NoteBlock, NoteBlockPatch, NoteSourceRef } from '../../types/notes';
import { getNoteImageUrl } from '../../utils/noteImageStore';
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
  /** ＋ から作った直後の本文ブロック。開いた瞬間に書けるよう編集状態で出す */
  autoEdit?: boolean;
  onPatch: (blockId: string, patch: NoteBlockPatch) => void;
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

/**
 * IndexedDB に置いた画像を表示する。
 * 🔴 objectURL は使い終わりに revoke する。ノート面を開き閉じするたびに
 *    作りっぱなしにすると、そのタブが画像を掴んだままになる。
 */
function NoteImage({ imageId, alt }: { imageId: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let revoked = false;
    let current: string | null = null;
    setMissing(false);
    void getNoteImageUrl(imageId).then((next) => {
      if (revoked) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      current = next;
      setUrl(next);
      if (!next) setMissing(true);
    });
    return () => {
      revoked = true;
      if (current) URL.revokeObjectURL(current);
      setUrl(null);
    };
  }, [imageId]);

  if (missing) {
    return (
      <div
        style={{
          padding: '20px 16px',
          border: `1px dashed ${color.borderSoft}`,
          borderRadius: radius.md,
          background: color.surface,
          ...font.caption,
          color: color.textFaint,
          textAlign: 'center',
        }}
      >
        画像を読み込めませんでした（この端末に保存されていません）
      </div>
    );
  }

  return (
    <img
      src={url ?? undefined}
      alt={alt}
      style={{
        display: 'block',
        maxWidth: '100%',
        borderRadius: radius.md,
        border: `1px solid ${color.border}`,
        // 読み込み前に高さ0で行が飛ばないように最低限の背は持たせる
        minHeight: url ? undefined : 80,
        background: color.surface,
      }}
    />
  );
}

/** 画像の説明。クリックで編集できる（本文ブロックと同じ作法） */
function NoteImageCaption({
  caption,
  onSave,
}: {
  caption: string | null;
  onSave: (caption: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption ?? '');

  useEffect(() => setDraft(caption ?? ''), [caption]);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== (caption ?? '')) onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(caption ?? '');
            setEditing(false);
          }
        }}
        placeholder="画像の説明（任意）"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 6,
          border: 0,
          borderBottom: `1px solid ${color.primaryBorderSoft}`,
          background: 'transparent',
          fontFamily: 'inherit',
          ...font.caption,
          color: color.textBody,
          outline: 'none',
          padding: '2px 0',
        }}
      />
    );
  }

  return (
    <figcaption
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
      style={{
        marginTop: 6,
        ...font.caption,
        color: caption ? color.textMuted : color.textFaint,
        cursor: 'text',
        outline: 'none',
      }}
    >
      {caption || '説明を書く（任意）'}
    </figcaption>
  );
}

export function NoteBlockView({ block, autoEdit, onPatch, onRemove, onOpenSource }: NoteBlockViewProps) {
  // ---- 本文：クリックで編集、blur で確定 ----
  const isText = block.kind === 'text';
  const [editing, setEditing] = useState(Boolean(autoEdit) && block.kind === 'text');
  const [draft, setDraft] = useState(isText ? block.text : '');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  /** 保存・取り消しの判定は ref を見る。blur と click の二重発火で戻り値がぶれないように */
  const draftRef = useRef(isText ? block.text : '');

  useEffect(() => {
    if (isText) {
      setDraft(block.text);
      draftRef.current = block.text;
    }
  }, [isText, block]);

  useEffect(() => {
    if (!editing) return;
    const el = areaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  if (block.kind === 'text') {
    const save = () => {
      setEditing(false);
      if (draftRef.current !== block.text) onPatch(block.id, { text: draftRef.current });
    };

    const cancel = () => {
      draftRef.current = block.text;
      setDraft(block.text);
      setEditing(false);
    };

    if (editing) {
      return (
        <div style={{ margin: '4px 0 12px' }}>
          <textarea
            ref={areaRef}
            value={draft}
            onChange={(e) => {
              draftRef.current = e.target.value;
              setDraft(e.target.value);
            }}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel();
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                save();
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
          <div className="flex items-center flex-wrap" style={{ gap: 10, marginTop: 8 }}>
            <button
              type="button"
              // クリックで textarea が blur し、この click が届く前に消える。
              // フォーカスを移さないでおけば、押した意図どおりに処理できる。
              onMouseDown={(e) => e.preventDefault()}
              onClick={save}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 34,
                padding: '0 16px',
                border: 0,
                borderRadius: radius.md,
                background: color.primary,
                color: color.textOnPrimary,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Check size={14} /> 保存する
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancel}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                height: 34,
                padding: '0 14px',
                border: `1px solid ${color.borderSoft}`,
                borderRadius: radius.md,
                background: color.surface,
                color: color.textMuted,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              取り消す
            </button>
            <span style={{ ...font.caption, color: color.textFaint }}>{NOTE_SYNTAX_HINT}</span>
          </div>
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

  if (block.kind === 'image') {
    return (
      <div className="group flex items-start" style={{ gap: 8, margin: '12px 0' }}>
        <figure style={{ flex: 1, minWidth: 0, margin: 0 }}>
          <NoteImage imageId={block.imageId} alt={block.alt} />
          <NoteImageCaption
            caption={block.caption}
            onSave={(caption) => onPatch(block.id, { caption: caption || null })}
          />
        </figure>
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
      <RemoveButton onClick={() => onRemove(block.id)} />
    </div>
  );
}

export default NoteBlockView;
