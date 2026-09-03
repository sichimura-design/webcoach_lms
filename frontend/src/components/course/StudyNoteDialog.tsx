import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Minimize2, StickyNote } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { UseStudyNote } from '../../hooks/useStudyNote';
import { CHAT_FOCUS_RING, iconButtonStyle } from '../chat';
import { MemoEditor, SaveStatusRow } from './MemoPanel';

/**
 * メモを全画面で書く。
 *
 * 右サイドバーは 320px しかなく、少し長い内容を書くと1行が短すぎて読み返せない。
 * 同じ useStudyNote のインスタンスを使うので、開いても取得も保存もやり直さない
 * （state が2つに割れて食い違うこともない）。
 */
interface StudyNoteDialogProps {
  note: UseStudyNote;
  lessonTitle?: string;
  onClose: () => void;
}

const TITLE_ID = 'study-note-dialog-title';

export function StudyNoteDialog({ note, lessonTitle, onClose }: StudyNoteDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      // 入力欄の Escape は blur（＝保存）に使っているので、
      // 閉じるのは入力欄の外にフォーカスがあるときだけにする
      if (e.key !== 'Escape') return;
      const active = document.activeElement;
      if (active && active.tagName === 'TEXTAREA') return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // inline style だけを退避・復元する（body のクラスは他が管理している）
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="wc-drawer-scrim fixed inset-0 grid place-items-center"
      style={{ zIndex: 65, background: 'rgba(31, 29, 30, .45)', padding: 12 }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="flex flex-col"
        style={{
          width: '100%',
          maxWidth: 860,
          height: 'min(80vh, 720px)',
          background: color.surface,
          border: `1px solid ${color.border}`,
          borderRadius: radius.card,
          boxShadow: shadow.hero,
          overflow: 'hidden',
          fontFamily: font.family,
        }}
      >
        <div
          className="flex items-center"
          style={{
            gap: 9,
            minHeight: 52,
            padding: '0 10px 0 16px',
            borderBottom: `1px solid ${color.border}`,
            flexShrink: 0,
          }}
        >
          <StickyNote size={16} style={{ color: color.primary }} />
          <h2
            id={TITLE_ID}
            style={{
              margin: 0,
              // index.css が h1〜h3 を Zen Maru Gothic に固定しているので戻す
              fontFamily: font.family,
              fontSize: 14.5,
              fontWeight: 800,
              color: color.text,
            }}
          >
            メモ
          </h2>
          {lessonTitle && (
            <span
              style={{
                minWidth: 0,
                fontSize: 11.5,
                color: color.textFaint,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              「{lessonTitle}」
            </span>
          )}
          <div style={{ flex: 1 }} />
          <SaveStatusRow note={note} />
          <button
            type="button"
            onClick={onClose}
            onMouseDown={e => e.preventDefault()}
            aria-label="全画面をやめてサイドバーに戻す"
            title="サイドバーに戻す"
            className={`wc-ai-icon-btn ${CHAT_FOCUS_RING}`}
            style={iconButtonStyle(30)}
          >
            <Minimize2 size={14} />
          </button>
        </div>

        <MemoEditor
          note={note}
          lessonTitle={lessonTitle}
          style={{ flex: 1, minHeight: 0 }}
          autoFocus
        />
      </div>
    </div>,
    document.body
  );
}

export default StudyNoteDialog;
