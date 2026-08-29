import { ArrowLeft, ChevronRight } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import LessonMiniTimer from './LessonMiniTimer';

/**
 * 教材画面の上部バー。
 *
 * 以前は 目次トグル / パンくず / 進捗 / 完了ボタン / サポートトグル が
 * 1本に詰まっていて、ここだけで押せるものが5種類あった。
 * 「色々表示あると集中途切れる」というレビュー指摘に沿って、
 * 押せるものは出口（コースに戻る）だけに絞り、あとは現在地の表示だけにしている。
 *
 * 中央の「コース名 › レッスン名」はデザイン案 2a の形。表示は増えるが押せる物は
 * 増えないので、集中を切る類の情報ではない（読み進めて本文の見出しが流れたあとに
 * 「いまどこを読んでいるか」が残るほうが、迷いは減る）。
 *
 * 完了操作は本文末尾のボタンに一本化した。長いスクロールの自然な終点に置くほうが、
 * 読み終わる前に押させないという意味でも正しい。
 */
interface LessonTopBarProps {
  courseName: string;
  /** いま開いているレッスン名。中央のパンくずの下段 */
  lessonTitle?: string;
  /** 何番目のレッスンか（1始まり）。目次が取れないときは null */
  lessonIndex: number | null;
  lessonTotal: number;
  courseId: number;
  lessonId: number | null;
  onBackToCourse: () => void;
}

export function LessonTopBar({
  courseName,
  lessonTitle,
  lessonIndex,
  lessonTotal,
  courseId,
  lessonId,
  onBackToCourse,
}: LessonTopBarProps) {
  // 進捗バーは「完了率」ではなく「いま何本目か」。数字と長さが食い違わないようにする
  const positionPercent =
    lessonIndex && lessonTotal > 0 ? Math.round((lessonIndex / lessonTotal) * 100) : 0;

  return (
    <header
      className="flex items-center"
      style={{
        position: 'relative',
        gap: 20,
        padding: '0 24px',
        borderBottom: `1px solid ${color.border}`,
        background: color.surface,
      }}
    >
      <span
        className="wc-lesson-wordmark"
        style={{ ...font.logo, color: color.primary, flexShrink: 0 }}
      >
        WEBCOACH
      </span>

      <button
        type="button"
        onClick={onBackToCourse}
        className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          gap: 7,
          border: 0,
          background: 'transparent',
          padding: '6px 4px',
          color: color.textBody,
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <ArrowLeft size={16} />
        <span className="wc-lesson-backlabel">コースに戻る</span>
      </button>

      {/* 中央は「コース名 › レッスン名」のパンくず（デザイン案 2a）。
          本文のタイトルと二重になるのは承知の上で、スクロールして見出しが
          流れたあとも「どのコースのどのレッスンか」が残るようにする。
          狭い画面ではコース名側から落とす（.wc-lesson-crumb-course）。 */}
      <div
        className="flex items-center justify-center"
        style={{ flex: 1, minWidth: 0, gap: 6 }}
      >
        <span
          className="wc-lesson-crumb-course"
          style={{
            ...font.caption,
            color: color.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 1,
          }}
        >
          {courseName}
        </span>
        {lessonTitle && (
          <ChevronRight
            aria-hidden
            size={13}
            className="wc-lesson-crumb-course"
            style={{ color: color.textFaint, flexShrink: 0 }}
          />
        )}
        <span
          style={{
            ...font.rowTitle,
            fontSize: 14,
            color: color.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {lessonTitle || courseName}
        </span>
      </div>

      <div className="flex items-center" style={{ gap: 12, flexShrink: 0 }}>
        {lessonIndex && lessonTotal > 0 && (
          <>
            <span style={{ ...font.caption, color: color.textMuted, whiteSpace: 'nowrap' }}>
              <span className="wc-lesson-progress-label">レッスン </span>
              {lessonIndex} / {lessonTotal}
            </span>
            <span
              aria-hidden
              className="wc-lesson-progress-bar"
              style={{ width: 120, height: 5, borderRadius: 999, background: color.trackBg, overflow: 'hidden' }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${positionPercent}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: color.primary,
                }}
              />
            </span>
          </>
        )}

        {/* 記録中のときだけ出す。この画面は右上の StudySessionIndicator を出さない
            （二重表示になる）ので、ここを消すと計測中であることが分からなくなる。
            開始は StudySessionHost の打診ポップが担うので、ここに開始CTAは無い。 */}
        <LessonMiniTimer courseId={courseId} />
      </div>

      {/* SPではバー内に収まらないので、下端の帯として全幅で出す */}
      {lessonIndex && lessonTotal > 0 && (
        <span
          aria-hidden
          className="wc-lesson-progress-strip"
          style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, background: color.trackBg }}
        >
          <span
            style={{ display: 'block', width: `${positionPercent}%`, height: '100%', background: color.primary }}
          />
        </span>
      )}
    </header>
  );
}

export default LessonTopBar;
