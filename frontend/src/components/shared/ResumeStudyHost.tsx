import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { useRecentCourseStore } from '../../store/recentCourseStore';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { canShowResumePrompt, useResumePromptStore } from '../../store/resumePromptStore';
import { getRelativeTime } from '../../utils/dateFormatting';

/**
 * 「前回は〇〇を学習しました」→ そこから再開できるカード。
 * ============================================================
 * 🔴 モーダルにしない。暗幕を張って操作を止めるほどの用事ではなく、
 *    毎回閉じさせるのは日常の入口で邪魔になる。右下に出して無視できる形にする。
 *
 * 🔴 出すのは /mypage と /courses に着いたときだけ。
 *    この2つは学習記録の打診（StudySessionHost / utils/studyCategory.ts の
 *    isStudyEntryPath）が意図的に除外しているパスなので、打診（z85）と
 *    2枚重なることがない。レッスン本文や /coaching では出さない。
 *
 * 🔴 同じ日に二度は出さない（store/resumePromptStore.ts の日付キー）。
 *    タイマーが動いている間も出さない ＝ いま学習しているのに「前回は」と
 *    言うのはおかしい。
 *
 * 🔴 置き場所は App.tsx の AppRoutes の外。ルート遷移で消えないためと、
 *    transform:scale を使うページ（/courses）の中に置くと position:fixed が
 *    ビューポート基準にならないため（StudySessionHost.tsx:29-32 と同じ理由）。
 * ============================================================
 */

/** このパスに着いたときだけ出す */
const ENTRY_PATHS = ['/mypage', '/courses'];

/** 直前に開いた教材で「前回は」と言わない。これより新しい履歴は出さない */
const TOO_RECENT_MS = 30 * 60 * 1000;

export function ResumeStudyHost() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const entries = useRecentCourseStore((s) => s.entries);
  const session = useStudyTimerStore((s) => s.session);
  const shownOn = useResumePromptStore((s) => s.shownOn);
  const markShown = useResumePromptStore((s) => s.markShown);

  const [open, setOpen] = useState(false);
  /** 出したカードの中身。開いた瞬間の履歴で固定する（裏で履歴が動いても入れ替わらない） */
  const [entry, setEntry] = useState(entries[0]);

  useEffect(() => {
    // /courses は子パス（/courses/category/...）を持つので完全一致で見る
    if (!ENTRY_PATHS.includes(pathname)) return;
    if (session) return;
    if (!canShowResumePrompt(shownOn)) return;

    const latest = entries[0];
    if (!latest) return;
    if (Date.now() - latest.openedAt < TOO_RECENT_MS) return;

    setEntry(latest);
    setOpen(true);
    // 出した時点で記録する。押さずに画面を移動しても、その日はもう出さない
    markShown();
    // shownOn / entries を依存に入れると markShown 直後に再評価が走るだけなので、
    // 着地したパスの変化だけを合図にする
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open || !entry) return null;

  const resume = () => {
    setOpen(false);
    navigate(
      entry.lessonId
        ? `/course/${entry.courseId}?module=${entry.lessonId}`
        : `/course/${entry.courseId}/curriculum`
    );
  };

  return (
    <div
      role="complementary"
      aria-label="前回の続き"
      className="fixed"
      style={{
        right: 24,
        bottom: 24,
        zIndex: 70,
        width: 300,
        maxWidth: 'calc(100vw - 32px)',
        padding: '14px 16px',
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: '0 16px 36px -16px rgba(60,48,32,.4)',
        fontFamily: font.family,
        animation: 'fadeInUp .22s ease-out',
      }}
    >
      <div className="flex items-center" style={{ gap: 8 }}>
        <span style={{ ...font.chip, color: color.primary, fontWeight: 700 }}>前回の続き</span>
        {/* openedAt は epoch ms。getRelativeTime は秒を取るので割って渡す */}
        <span style={{ ...font.caption, color: color.textFaint, marginLeft: 'auto' }}>
          {getRelativeTime(entry.openedAt / 1000)}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="閉じる"
          className="grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            width: 22,
            height: 22,
            border: 0,
            borderRadius: 999,
            background: 'transparent',
            color: color.textFaint,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      <p
        style={{
          margin: '8px 0 0',
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1.6,
          color: color.text,
        }}
      >
        {entry.lessonTitle
          ? `「${entry.lessonTitle}」を学習しました`
          : `「${entry.courseTitle}」を学習しました`}
      </p>
      {entry.lessonTitle && (
        <p
          style={{
            margin: '2px 0 0',
            ...font.caption,
            color: color.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.courseTitle}
        </p>
      )}

      <button
        type="button"
        onClick={resume}
        className="flex items-center justify-center w-full focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          gap: 7,
          marginTop: 12,
          height: 38,
          border: 0,
          borderRadius: radius.md,
          background: color.primary,
          color: color.textOnPrimary,
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        続きから学ぶ <ArrowRight size={15} />
      </button>
    </div>
  );
}

export default ResumeStudyHost;
