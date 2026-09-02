import { useState } from 'react';
import { Folder, Inbox, Star } from 'lucide-react';
import { NOTE_ORIGIN_LABEL, NoteOrigin, NoteSummary } from '../../types/notes';
import { formatNoteDateShort } from './noteDate';
import { INBOX_LABEL, NOTE_DRAG_TYPE } from './folderRows';

/**
 * 一覧の1枚。デザイン『マイノート 改善案』のノートカード。
 *
 * 構成: 出どころバッジ ／ ★（重要のときだけ）／ タイトル ／ 抜粋（3行まで）／
 *       フッター＝入っているフォルダ ＋ 日付
 *
 * 以前あった ⋮ メニュー（開く／重要／削除）は無くした。「開く」はカード自体、
 * 「重要」と「削除」はノート面の上部バーに1か所ずつある。カードに操作を残すと
 * 掴んでドラッグする面と押す面が重なって、どちらになるか分からなくなる。
 *
 * カードは draggable。フォルダ列の行に落とすと移動する（NoteFolderColumn）。
 */
interface NoteCardProps {
  note: NoteSummary;
  /** 入っているフォルダの名前。未整理なら null */
  folderName: string | null;
  onOpen: (id: string) => void;
}

/**
 * 出どころごとの色。デザイン 1a の指定値を引き継ぐ。
 * 教材・コーチングはブランド赤系、AIコーチはAIのピンク、自分のメモは無彩色。
 */
const ORIGIN_STYLE: Record<NoteOrigin, { background: string; color: string }> = {
  coaching: { background: 'var(--dc-soft-100)', color: '#B80A29' },
  material: { background: 'var(--dc-soft-100)', color: '#B80A29' },
  ai: { background: '#FDF2F4', color: '#D14D6C' },
  self: { background: '#F7F3ED', color: 'var(--dc-text-muted)' },
};

export function NoteCard({ note, folderName, onOpen }: NoteCardProps) {
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);

  const origin = ORIGIN_STYLE[note.origin] ?? ORIGIN_STYLE.self;
  const open = () => onOpen(note.id);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${note.title}を開く`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(NOTE_DRAG_TYPE, note.id);
        e.dataTransfer.effectAllowed = 'move';
        setHover(false);
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`notes-card focus-visible:ring-2 focus-visible:ring-[#F6B9BD] ${dragging ? 'is-dragging' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 18,
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: hover
          ? '0 2px 4px rgba(60,48,32,.06), 0 18px 30px -18px rgba(60,48,32,.2)'
          : 'var(--dc-shadow-card)',
        transform: hover ? 'translateY(-2px)' : undefined,
        transition: 'transform .2s var(--dc-ease), box-shadow .2s var(--dc-ease)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 9px',
            borderRadius: 9999,
            background: origin.background,
            color: origin.color,
            fontSize: 11.5,
            fontWeight: 700,
          }}
        >
          {NOTE_ORIGIN_LABEL[note.origin] ?? NOTE_ORIGIN_LABEL.self}
        </span>
        {note.favorite && (
          <Star size={14} fill="var(--dc-primary)" style={{ color: 'var(--dc-primary)' }} aria-label="重要" />
        )}
      </div>

      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: 'var(--dc-text)' }}>
        {note.title}
      </h3>

      {note.excerpt && (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            lineHeight: 1.7,
            color: 'var(--dc-text-muted)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {note.excerpt}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 'auto',
          paddingTop: 8,
          borderTop: '1px solid var(--dc-border)',
        }}
      >
        {/* 未整理はブランド色で出す。「まだ置き場所を決めていない」が一覧で見えるように */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            fontSize: 11.5,
            color: folderName === null ? 'var(--dc-primary)' : 'var(--dc-text-subtle)',
          }}
        >
          {folderName === null ? <Inbox size={12} style={{ flexShrink: 0 }} /> : <Folder size={12} style={{ flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folderName ?? INBOX_LABEL}
          </span>
        </span>
        <span
          className="dc-num"
          style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 11.5, color: 'var(--dc-text-subtle)' }}
        >
          {formatNoteDateShort(note.updatedAt)}
        </span>
      </div>
    </article>
  );
}

export default NoteCard;
