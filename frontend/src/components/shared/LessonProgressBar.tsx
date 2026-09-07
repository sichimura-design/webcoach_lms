import type { CSSProperties } from 'react';

/**
 * レッスンの進み具合を出すバー。1本の線をレッスン数で区切った「ステップ型」。
 *
 * なぜステップ型か:
 *   ベタ塗りのバーは「7割ぐらい」までしか読めず、あと何本残っているかを
 *   隣の分数（5 / 11 レッスン）から読み直すことになる。線をレッスン数で
 *   割っておけば、埋まっていないマスの数がそのまま「残り本数」になるので、
 *   バーと分数が同じことを言う。utils/lessonProgress.ts の「％より分数」と同じ理由。
 *
 * 🔴 マスが細くなりすぎたら自動で従来のベタ塗りに落とす（maxSteps）。
 *    レッスン30本のコースで30分割すると、1マスが線の隙間と同じ太さになり
 *    「点線」に見えて進捗が読めなくなる。分割は数えられる本数までにする。
 *
 * 🔴 レッスン総数が取れない画面（total 無し）もベタ塗り。分母が無いのに
 *    適当な数で割ると、実際のレッスン数と食い違うマスを見せてしまう。
 */
interface LessonProgressBarProps {
  /** 完了したレッスン数。total と一緒に渡すとステップ型になる */
  done?: number;
  /** コースの全レッスン数。不明なら渡さない（ベタ塗りにフォールバック） */
  total?: number;
  /** 進捗率(0-100)。done/total が無いときの塗り幅に使う */
  percent?: number;
  /** バーの太さ。既定 7px */
  height?: number;
  /** これを超える分割数はベタ塗りに落とす。既定 12 */
  maxSteps?: number;
  /** 空マス・トラックの色 */
  trackColor?: string;
  /** 埋まったマスの色 */
  fillColor?: string;
  /** 置き場所ごとの寸法（flex: 1 や width: 160 など）を外から渡す */
  style?: CSSProperties;
  /** 置き場所側のCSS（画面幅で隠す等）。index.css のクラスをそのまま渡せるように残す */
  className?: string;
  /**
   * 隣に同じ内容の文字（「1 / 7」など）がある飾りのバー。
   * role を持たせず aria-hidden にして、読み上げが2回同じことを言うのを避ける。
   */
  decorative?: boolean;
  'aria-label'?: string;
  /** 「11レッスン中 5レッスン完了」のような読み上げ文 */
  'aria-valuetext'?: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function LessonProgressBar({
  done,
  total,
  percent,
  height = 7,
  maxSteps = 12,
  trackColor = 'var(--dc-progress-track)',
  fillColor = 'var(--dc-primary)',
  style,
  className,
  decorative = false,
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
}: LessonProgressBarProps) {
  const hasCount = total != null && total > 0 && done != null;
  const pct = clamp(hasCount ? ((done as number) / (total as number)) * 100 : percent ?? 0, 0, 100);

  // 1本しかないコースを2マスに割っても意味が無いので 2 本以上から
  const stepped = hasCount && (total as number) >= 2 && (total as number) <= maxSteps;

  const aria = decorative
    ? { 'aria-hidden': true }
    : {
        role: 'progressbar' as const,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': Math.round(pct),
        'aria-label': ariaLabel,
        'aria-valuetext': ariaValueText,
      };

  if (!stepped) {
    return (
      <div
        {...aria}
        className={className}
        style={{ ...style, height, borderRadius: 9999, background: trackColor, overflow: 'hidden' }}
      >
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9999, background: fillColor }} />
      </div>
    );
  }

  const filled = clamp(Math.round(done as number), 0, total as number);

  return (
    <div
      {...aria}
      className={className}
      style={{
        ...style,
        display: 'flex',
        // 隙間は細く。太くすると「分割された1本の線」ではなく別々の点に見える
        gap: 3,
        height,
      }}
    >
      {Array.from({ length: total as number }, (_, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            // 端だけ丸めて全体を1本の線に見せる。中のマスは角丸にしない
            borderRadius:
              i === 0
                ? '9999px 2px 2px 9999px'
                : i === (total as number) - 1
                  ? '2px 9999px 9999px 2px'
                  : 2,
            background: i < filled ? fillColor : trackColor,
          }}
        />
      ))}
    </div>
  );
}

export default LessonProgressBar;
