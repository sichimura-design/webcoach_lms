import { useState } from 'react';
import { Folder, Image as ImageIcon, Inbox, Star } from 'lucide-react';
import { NOTE_ORIGIN_LABEL, NoteOrigin, NoteSummary } from '../../types/notes';
import { useNoteImageUrl } from '../../hooks/useNoteImageUrl';
import { formatNoteDateShort } from './noteDate';
import { INBOX_LABEL, NOTE_DRAG_TYPE } from './folderRows';

/**
 * 一覧の1枚。デザイン『マイノート 改善案』のノートカード。
 *
 * 構成: 出どころバッジ ／ ★（押して重要を切り替える）／
 *       ［サムネイル］タイトル ＋ 抜粋 ／ フッター＝入っているフォルダ ＋ 日付
 *
 * 中に画像ブロックがあるノートは、タイトルの左に正方形のサムネイルが付く。
 * 自分の制作物（バナー・LP など）を貼ったノートを、一覧で絵として見分けるため。
 * 文字だけのノートは今までどおり抜粋3行のまま（サムネの空きを作らない）。
 *
 * ⋮ メニュー（開く／重要／削除）は無くしたままにする。「開く」はカード自体、
 * 「削除」はノート面の「その他」だけ。ただし★は右上に常時出す。重要は一覧を
 * 見ながら付け外しするもので、1枚ずつ開いて戻る操作にすると溜まらない。
 * ★だけは押せる面なので、クリックとキー操作をカード側に伝えない。
 *
 * カードは draggable。フォルダ列の行に落とすと移動する（NoteFolderColumn）。
 */
interface NoteCardProps {
  note: NoteSummary;
  /** 入っているフォルダの名前。未整理なら null */
  folderName: string | null;
  onOpen: (id: string) => void;
  /** ★。押した後の状態を渡す */
  onToggleFavorite: (id: string, favorite: boolean) => void;
}

/**
 * 出どころごとの色。デザイン 1a の指定値を引き継ぐ。
 * 教材・コーチングはブランド赤系、AIコーチはAIのピンク、自分のノートは無彩色。
 */
const ORIGIN_STYLE: Record<NoteOrigin, { background: string; color: string }> = {
  coaching: { background: 'var(--dc-soft-100)', color: '#B80A29' },
  material: { background: 'var(--dc-soft-100)', color: '#B80A29' },
  ai: { background: '#FDF2F4', color: '#D14D6C' },
  self: { background: '#F7F3ED', color: 'var(--dc-text-muted)' },
};

/**
 * カード左のサムネイル。
 *
 * 🔴 読み込み中・見つからないときも枠は出したままにする。出し入れするとカードの
 *    高さが動いてグリッド全体が揺れる。「見つからない」は別の端末で貼った画像を
 *    見ているときに起きる（画像の実体はその端末の IndexedDB にしかない）ので、
 *    ノート面の「この端末に保存されていません」と同じく黙って隠さない。
 */
function NoteCardThumb({ imageId, title }: { imageId: string; title: string }) {
  const { url, status } = useNoteImageUrl(imageId);

  return (
    <div
      className="notes-card__thumb"
      style={{
        background: status === 'ready' ? 'var(--dc-surface)' : 'var(--dc-bg)',
        border: '1px solid var(--dc-border)',
      }}
    >
      {url ? (
        <img
          src={url}
          alt={`${title}の画像`}
          // カード全体が draggable。画像を掴むと画像だけのドラッグになり、
          // フォルダへの移動が始まらないので画像側は掴めなくする
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <ImageIcon
          size={18}
          aria-hidden
          style={{ color: 'var(--dc-text-subtle)', opacity: status === 'loading' ? 0.35 : 0.7 }}
        />
      )}
    </div>
  );
}

export function NoteCard({ note, folderName, onOpen, onToggleFavorite }: NoteCardProps) {
  const [hover, setHover] = useState(false);
  const [starHover, setStarHover] = useState(false);
  const [dragging, setDragging] = useState(false);

  const origin = ORIGIN_STYLE[note.origin] ?? ORIGIN_STYLE.self;
  const hasThumb = Boolean(note.thumbnailImageId);
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
        {/* 🔴 stopPropagation を外すとカードの onClick まで届いてノートが開く。
            ドラッグの掴み手にもしない（draggable=false）。★を掴んで動かしても何も起きないため */}
        <button
          type="button"
          draggable={false}
          aria-pressed={note.favorite}
          aria-label={note.favorite ? `${note.title}の重要を外す` : `${note.title}を重要にする`}
          title={note.favorite ? '重要を外す' : '重要にする'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(note.id, !note.favorite);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
          onMouseEnter={() => setStarHover(true)}
          onMouseLeave={() => setStarHover(false)}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            marginRight: -4,
            padding: 0,
            border: 0,
            borderRadius: 9999,
            background: starHover ? 'var(--dc-soft-100)' : 'transparent',
            color: note.favorite ? 'var(--dc-primary)' : 'var(--dc-text-subtle)',
            cursor: 'pointer',
            transition: 'background .15s var(--dc-ease), color .15s var(--dc-ease)',
          }}
        >
          <Star size={15} fill={note.favorite ? 'var(--dc-primary)' : 'none'} />
        </button>
      </div>

      {/* サムネイルがあるときだけ横並びにする。無いときは今までどおり縦に積む
          （空の左余白ができると、文字だけのノートのタイトルが右にずれて見える） */}
      <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
        {hasThumb && <NoteCardThumb imageId={note.thumbnailImageId!} title={note.title} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
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
                // サムネの横は幅が狭いので2行。サムネが無ければ従来どおり3行
                WebkitLineClamp: hasThumb ? 2 : 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {note.excerpt}
            </p>
          )}
        </div>
      </div>

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
