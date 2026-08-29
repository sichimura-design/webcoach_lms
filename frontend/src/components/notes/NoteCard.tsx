import { useEffect, useRef, useState } from 'react';
import { BookOpen, MoreVertical, PenLine, Sparkles, Star, Trash2, Users } from 'lucide-react';
import { NOTE_ORIGIN_LABEL, NoteOrigin, NoteSummary } from '../../types/notes';
import { formatNoteDate } from './noteDate';

/**
 * 一覧の1枚。デザイン『マイノート 3案』1a のノートカード。
 *
 * 構成は CONTENTS §10-4 のとおり
 *   出どころバッジ ／ ⋮メニュー ／ タイトル ／ 抜粋（3行まで） ／ ラベル ／ 日付
 *
 * ⋮ は「複製する」を持たない。複製は新しいエンドポイントが要るうえ、
 * ノートを増やす手段としては「新しいノートを作成」で足りるため。
 */
interface NoteCardProps {
  note: NoteSummary;
  onOpen: (id: string) => void;
  onToggleFavorite: (note: NoteSummary) => void;
  onDelete: (note: NoteSummary) => void;
}

/**
 * 出どころごとの見た目。色は 1a の指定値。
 * 教材・コーチングはブランド赤系、AIコーチはAIのピンク、自分のメモは無彩色。
 * （--dc-* に同値のトークンが無いものはデザイン値をそのまま置く）
 */
const ORIGIN_STYLE: Record<
  NoteOrigin,
  { background: string; color: string; Icon: typeof BookOpen }
> = {
  coaching: { background: 'var(--dc-soft-100)', color: '#B80A29', Icon: Users },
  material: { background: 'var(--dc-soft-100)', color: '#B80A29', Icon: BookOpen },
  ai: { background: '#FDF2F4', color: '#D14D6C', Icon: Sparkles },
  self: { background: '#F7F3ED', color: 'var(--dc-text-muted)', Icon: PenLine },
};

export function NoteCard({ note, onOpen, onToggleFavorite, onDelete }: NoteCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 外側クリックと Esc で閉じる。カードが並ぶので開いたままだと隣を押せない
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const origin = ORIGIN_STYLE[note.origin] ?? ORIGIN_STYLE.self;
  const { Icon } = origin;

  const open = () => onOpen(note.id);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${note.title}を開く`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 20,
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: hover
          ? '0 4px 18px -6px rgba(60,48,32,.2)'
          : 'var(--dc-shadow-card)',
        transform: hover ? 'translateY(-2px)' : undefined,
        transition: 'transform .2s var(--dc-ease), box-shadow .2s var(--dc-ease)',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 9999,
            background: origin.background,
            color: origin.color,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <Icon size={13} />
          {NOTE_ORIGIN_LABEL[note.origin] ?? NOTE_ORIGIN_LABEL.self}
        </span>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label={`${note.title}のメニュー`}
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              border: 0,
              borderRadius: 6,
              background: menuOpen ? 'var(--dc-sunken)' : 'none',
              color: 'var(--dc-text-subtle)',
              cursor: 'pointer',
            }}
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 30,
                right: 0,
                zIndex: 20,
                minWidth: 190,
                padding: 6,
                background: 'var(--dc-surface)',
                border: '1px solid var(--dc-border)',
                borderRadius: 'var(--dc-radius-md)',
                boxShadow: 'var(--dc-shadow-float)',
              }}
            >
              <MenuItem
                icon={<PenLine size={14} />}
                label="開く"
                onClick={() => {
                  setMenuOpen(false);
                  open();
                }}
              />
              <MenuItem
                icon={
                  <Star
                    size={14}
                    fill={note.favorite ? 'var(--dc-primary)' : 'none'}
                    style={{ color: 'var(--dc-primary)' }}
                  />
                }
                label={note.favorite ? '重要をはずす' : '重要に追加'}
                onClick={() => {
                  setMenuOpen(false);
                  onToggleFavorite(note);
                }}
              />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="削除する"
                danger
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(note);
                }}
              />
            </div>
          )}
        </div>
      </div>

      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.5, color: 'var(--dc-text)' }}>
        {note.title}
      </h3>

      {note.excerpt && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
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
          gap: 14,
          marginTop: 'auto',
          paddingTop: 8,
          borderTop: '1px solid var(--dc-border)',
        }}
      >
        {note.favorite && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              fontWeight: 700,
              color: '#B80A29',
            }}
          >
            <Star size={13} fill="var(--dc-primary)" style={{ color: 'var(--dc-primary)' }} />
            重要
          </span>
        )}
        <span
          className="dc-num"
          style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dc-text-subtle)' }}
        >
          {formatNoteDate(note.updatedAt)}
        </span>
      </div>
    </article>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        padding: '9px 10px',
        border: 0,
        borderRadius: 8,
        background: hover ? 'var(--dc-sunken)' : 'transparent',
        color: danger ? 'var(--dc-primary)' : 'var(--dc-text-body)',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default NoteCard;
