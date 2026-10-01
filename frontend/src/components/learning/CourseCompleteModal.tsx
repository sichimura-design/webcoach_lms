import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import LessonCompleteConfetti from './LessonCompleteConfetti';

/**
 * コースの全レッスンを完了した瞬間に一度だけ出す、修了のお祝い。
 *
 * 🔴 1レッスンごとの祝いは完了カードの中の紙吹雪で足りている（LessonCompleteConfetti の
 *    コメントのとおり、毎回オーバーレイを出すと邪魔になる）。ここは「コース完走」という
 *    節目だけなので、閉じる操作を求める小窓にしてよい。
 * 🔴 出したかどうかは端末ごとに覚える（hasShownCourseComplete）。完了を取り消して
 *    付け直すたびに出ると、祝いの価値が下がる。
 */
interface CourseCompleteModalProps {
  courseName: string;
  onBackToCourse: () => void;
  onClose: () => void;
}

const SHOWN_KEY = 'webcoach-course-complete-shown';

function readShown(): string[] {
  try {
    const raw = window.localStorage.getItem(SHOWN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** このユーザー・このコースで、もう祝いを出したか */
export function hasShownCourseComplete(userId: number, courseId: number): boolean {
  return readShown().includes(`${userId}:${courseId}`);
}

export function markCourseCompleteShown(userId: number, courseId: number): void {
  try {
    const key = `${userId}:${courseId}`;
    const shown = readShown();
    if (shown.includes(key)) return;
    window.localStorage.setItem(SHOWN_KEY, JSON.stringify([...shown, key].slice(-200)));
  } catch {
    // 保存できない環境（プライベートモード等）では、次に完走し直したときにもう一度出るだけ
  }
}

export function CourseCompleteModal({ courseName, onBackToCourse, onClose }: CourseCompleteModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        background: 'rgba(20,14,8,.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wc-course-complete-title"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: color.surface,
          border: `1px solid ${color.goalBorder}`,
          borderRadius: radius.card,
          boxShadow: shadow.hero,
          padding: '28px 24px 22px',
          textAlign: 'center',
        }}
      >
        <LessonCompleteConfetti burstKey={1} big />
        <div
          aria-hidden
          style={{
            width: 132,
            height: 132,
            margin: '0 auto 14px',
            borderRadius: '50%',
            background: color.goalBg,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <img src={`${process.env.PUBLIC_URL}/mascot/fox-talking.png`} alt="" style={{ width: 108, height: 108, objectFit: 'contain' }} />
        </div>
        <p style={{ margin: '0 0 6px', ...font.eyebrow, color: color.goalText }}>COURSE COMPLETE</p>
        <h2
          id="wc-course-complete-title"
          style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, lineHeight: 1.5, color: color.text }}
        >
          「{courseName}」を
          <span style={{ display: 'inline-block' }}>修了しました！</span>
        </h2>
        <p style={{ margin: '0 0 20px', ...font.label, fontSize: 13, lineHeight: 1.9, color: color.textBody }}>
          すべてのレッスンを完了しました。
          <br />
          ここまで走りきった自分をたくさん褒めてあげましょう。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="wc-fx-primary"
            onClick={onBackToCourse}
            style={{
              minHeight: 44,
              border: 'none',
              borderRadius: radius.nav,
              background: color.primary,
              color: color.textOnPrimary,
              fontFamily: 'inherit',
              ...font.bodyLarge,
              boxShadow: shadow.primaryButton,
              cursor: 'pointer',
            }}
          >
            コースの目次へ
          </button>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            style={{
              minHeight: 40,
              border: 'none',
              background: 'none',
              color: color.textSecondary,
              fontFamily: 'inherit',
              ...font.buttonSm,
              cursor: 'pointer',
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default CourseCompleteModal;
