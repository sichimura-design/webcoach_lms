import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStudySession } from '../../hooks/useStudySession';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { STUDY_CATEGORY_LABEL } from '../../types/studyActivity';
import { color, font } from '../../theme/webcoachTheme';
import { formatMinutesHM } from '../../utils/studyStats';
import StudySessionPopover from './StudySessionPopover';

/**
 * 記録中であることのサイドバー常設表示。
 * ============================================================
 * 🔴 かつては画面に浮かぶピル（StudySessionIndicator）で、ドラッグして
 *    好きな場所へ置ける代わりに、既定位置が画面ごとに他のUIと重なっていた。
 *    「どこに置けば邪魔にならないか」をユーザーに決めさせていたのが問題なので、
 *    サイドバーの定位置に移した。位置を覚える localStorage も無くなっている。
 *
 * 🔴 自分でストアを読む自己完結型。AppHeader に props を通さない
 *    （LessonMiniTimer と同じ方針。AppHeader は3面ぶん置くだけで済む）。
 *
 * 🔴 出す条件は「セッションがある」だけ。一時停止中も出す。定位置になって
 *    本文を隠さなくなったので、以前のように一時停止中だけ表示条件を
 *    絞る必要がない（止め忘れにも気づける）。
 *
 * 🔴 教材ページには出ない。あの画面は AppHeader（＝サイドバー）を描かず、
 *    トップバーの LessonMiniTimer が計測中の表示を担う。
 * ============================================================
 */
interface SidebarStudyTimerProps {
  /**
   * rail   … 閉じた72pxレール。丸＋分だけ
   * panel  … 展開した224pxの赤パネル。「● 学習中 6分」
   * mobile … SP下部ナビの上に敷く帯
   */
  variant: 'rail' | 'panel' | 'mobile';
  /** レール／パネルが畳まれている側では Tab で拾わせない */
  tabIndex?: number;
}

/** ポップオーバーを開く向き。バリアントごとに画面外へ出ない側を選ぶ */
const PLACEMENT: Record<SidebarStudyTimerProps['variant'], CSSProperties> = {
  // レールは幅72pxなので右へ出す。下端に近いので下揃え
  rail: { left: 'calc(100% + 10px)', bottom: 0 },
  // パネルは幅224px。真上に出す（ポップオーバー260pxが少しはみ出すぶんは左揃えで逃がす）
  panel: { left: 0, bottom: 'calc(100% + 10px)' },
  // SPは帯の真上
  mobile: { left: 12, bottom: 'calc(100% + 10px)' },
};

export function SidebarStudyTimer({ variant, tabIndex }: SidebarStudyTimerProps) {
  const { user } = useAuth();
  const session = useStudyTimerStore((s) => s.session);
  const s = useStudySession(user?.userid);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 外側クリックと Escape で閉じる（浮遊ピル時代と同じ作法）
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // セッションが終わったら開いたままにしない
  useEffect(() => {
    if (!session) setOpen(false);
  }, [session]);

  if (!session) return null;

  const running = s.running;
  const minutes = Math.floor(s.elapsedSeconds / 60);
  /** 最初の1分は「0分」になってしまうので、そこだけ秒で出す（記録されているか不安にさせない） */
  const elapsedLabel = minutes < 1 ? `${s.elapsedSeconds}秒` : formatMinutesHM(minutes);
  const stateLabel = running ? '学習中' : '一時停止中';
  // 教材が分かればそれを出す。分からなければ「いま何の時間か」（最後の区間＝進行中のカテゴリ）
  const currentCategory = session.segments[session.segments.length - 1]?.category ?? 'other';
  const subject = session.lessonTitle
    ? `${session.courseTitle ?? ''} / ${session.lessonTitle}`
    : session.courseTitle || STUDY_CATEGORY_LABEL[currentCategory];

  /** 稼働中だけ赤く点る。停止中は色を落として「止まっている」と分かるようにする */
  const dot = (size: number, onPanel: boolean) => (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: onPanel
          ? running ? '#fff' : 'rgba(253,247,243,.5)'
          : running ? color.primary : color.textFaint,
      }}
    />
  );

  const popover = open && (
    <StudySessionPopover
      elapsedSeconds={s.elapsedSeconds}
      running={running}
      subject={subject}
      segments={s.segmentTotals}
      onPause={s.pause}
      onResume={s.resume}
      onFinish={s.prepareFinish}
      onDiscard={s.discard}
      onClose={() => setOpen(false)}
      style={PLACEMENT[variant]}
    />
  );

  const ariaLabel = `${stateLabel} ${elapsedLabel}。詳細を開く`;

  if (variant === 'rail') {
    return (
      <div ref={wrapRef} className="relative" style={{ flex: 'none' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel}
          tabIndex={tabIndex}
          className="group relative flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: `1px solid ${running ? color.primaryBorder : color.borderNeutral}`,
            background: running ? color.primaryTint : color.surface,
            fontFamily: font.family,
            cursor: 'pointer',
            gap: 2,
          }}
        >
          {dot(6, false)}
          <span
            className="dc-num"
            style={{ fontSize: 9.5, fontWeight: 700, color: running ? color.primary : color.textSubtle, lineHeight: 1 }}
          >
            {minutes < 1 ? '0' : minutes}
          </span>
          {/* レールの他のアイコンと同じダークピルのツールチップ */}
          <span
            role="tooltip"
            aria-hidden="true"
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 whitespace-nowrap rounded-[7px] px-2.5 py-[5px] text-[12px] font-medium opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
            style={{ background: '#3A3532', color: '#FDF7F3' }}
          >
            {stateLabel} {elapsedLabel}
          </span>
        </button>
        {popover}
      </div>
    );
  }

  if (variant === 'panel') {
    return (
      <div ref={wrapRef} className="relative" style={{ flex: 'none' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel}
          tabIndex={tabIndex}
          className="flex flex-col w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{
            gap: 3,
            padding: '8px 12px',
            borderRadius: 12,
            border: 0,
            // 🔴 クリーム塗り。半透明（rgba(253,247,243,.14)）だと赤い面に沈んで
            //    「記録中であること」がまったく目に入らなかった。
            background: '#FDF7F3',
            fontFamily: font.family,
            color: color.primary,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {/* 上段: 何の記録か ＋ 経過時間。「一時停止中 36分」だけだと
              何が一時停止中なのか分からない、という指摘への対応 */}
          <span className="flex items-center w-full" style={{ gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>学習記録</span>
            <span className="dc-num" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>
              {elapsedLabel}
            </span>
          </span>
          {/* 下段: 記録中／一時停止中。止め忘れに気づけるよう、停止中も同じ強さで出す */}
          <span className="flex items-center" style={{ gap: 6, fontSize: 11.5, fontWeight: 700 }}>
            {dot(6, false)}
            {stateLabel}
          </span>
        </button>
        {popover}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex items-center w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          gap: 8,
          minHeight: 36,
          padding: '0 16px',
          border: 0,
          borderTop: `1px solid ${color.border}`,
          background: running ? color.primaryTint : color.surface,
          fontFamily: font.family,
          fontSize: 12.5,
          fontWeight: 700,
          color: running ? color.primary : color.textSubtle,
          cursor: 'pointer',
        }}
      >
        {dot(7, false)}
        <span>{stateLabel}</span>
        <span className="dc-num" style={{ marginLeft: 'auto', color: color.text }}>{elapsedLabel}</span>
      </button>
      {popover}
    </div>
  );
}

export default SidebarStudyTimer;
