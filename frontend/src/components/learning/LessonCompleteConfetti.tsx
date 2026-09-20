import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { color } from '../../theme/webcoachTheme';
import useMediaQuery from '../../hooks/useMediaQuery';

/**
 * レッスンを完了した瞬間に、達成カードの中で弾ける紙吹雪。
 *
 * 置き場所は達成カードの内側（position:absolute / inset:0）。画面全体を覆うレイヤーには
 * しない。祝いは押した場所で起きるほうが「自分がやったこと」に結びつくし、
 * オーバーレイは閉じる操作を強いるので、毎レッスンやると必ず邪魔になる。
 *
 * 🔴 prefers-reduced-motion のときは1粒も描かない。
 *    CSS の animation: none で止めると、散る前の粒が中央に固まって残ってしまう。
 * 🔴 撃ち終わったら自分で消える。粒を残しても見えないだけで、次の burst の
 *    ぶんだけ DOM が積み上がる。
 */
interface LessonCompleteConfettiProps {
  /**
   * 値が変わるたびに撃ち直す。完了 → 取り消し → 再完了でもう一度弾けるように、
   * 呼び出し側は完了のたびに新しい値を渡す。
   */
  burstKey: number;
  /** 節目（単元クリア・コース完走・連続日数の区切り）の回。粒を増やして長く飛ばす */
  big?: boolean;
}

/** 粒の色。テーマの4色だけを使う（祝い用の新色は作らない） */
const PIECE_COLORS = [color.primary, color.success, color.goalBorder, color.primaryBorderSoft];

interface Piece {
  /** 終点（落ちきる位置） */
  x: number;
  y: number;
  /** 山の頂点（45% 地点）。ここを通ることで弾けて見える */
  mx: number;
  up: number;
  rot: number;
  delayMs: number;
  durMs: number;
  size: number;
  round: boolean;
  fill: string;
}

/**
 * 粒の散り方。
 * 上へ弾いてから落とす。中央付近の粒ほど高く上げると、扇ではなく噴き上がりに見える。
 *
 * 🔴 Math.random は使わない。React の再レンダーで散り方が変わってしまうのと、
 *    「毎回まったく同じ」より「毎回それらしく違う」を狙って値がぶれるより、
 *    番号から決まる並びのほうが調整しやすい。
 */
function buildPieces(count: number, spread: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i += 1) {
    // 左右へ均等に配る。等間隔だと機械的なので、i ごとに少しだけ揺らす
    const t = count === 1 ? 0.5 : i / (count - 1);
    const jitter = ((i * 37) % 11) / 11 - 0.5;
    const x = (t - 0.5) * 2 * spread + jitter * 26;
    // 中央付近ほど高く上がる山なりにする。
    // 🔴 上げすぎない。湧く位置（top:52）より高く飛ばすとカードの上端で切れる
    //    （祝う面は overflow:hidden なので、はみ出したぶんは見えないまま終わる）。
    const lift = 16 + (1 - Math.abs(t - 0.5) * 2) * 32;
    pieces.push({
      x: Math.round(x),
      y: Math.round(80 + ((i * 53) % 7) * 14),
      mx: Math.round(x * 0.55),
      up: -Math.round(lift),
      rot: ((i * 97) % 5) * 120 - 240,
      delayMs: (i % 6) * 34,
      durMs: 780 + ((i * 29) % 5) * 110,
      size: 6 + ((i * 41) % 3) * 2,
      round: i % 3 === 0,
      fill: PIECE_COLORS[i % PIECE_COLORS.length],
    });
  }
  return pieces;
}

/**
 * 1粒ぶんの style。飛ぶ先は CSS 変数で keyframes（index.css の wcConfettiBurst）へ渡す。
 * CSSProperties は変数名を知らないので、ここだけ緩い型にする。
 */
function pieceStyle(p: Piece): CSSProperties {
  const vars: Record<string, string | number> = {
    position: 'absolute',
    left: '50%',
    // 達成カードのチェックアイコンあたりから湧かせる
    top: 52,
    width: p.size,
    height: p.round ? p.size : p.size * 1.6,
    borderRadius: p.round ? '50%' : 2,
    background: p.fill,
    animationDelay: `${p.delayMs}ms`,
    animationDuration: `${p.durMs}ms`,
    '--wc-cf-x': `${p.x}px`,
    '--wc-cf-y': `${p.y}px`,
    '--wc-cf-mx': `${p.mx}px`,
    '--wc-cf-up': `${p.up}px`,
    '--wc-cf-rot': `${p.rot}deg`,
  };
  return vars as CSSProperties;
}

export function LessonCompleteConfetti({ burstKey, big = false }: LessonCompleteConfettiProps) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [alive, setAlive] = useState(true);

  const pieces = useMemo(
    () => buildPieces(big ? 26 : 14, big ? 250 : 170),
    // burstKey が変わったら組み直す。再レンダーのたびに散り方が変わらないようにする
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey, big]
  );

  useEffect(() => {
    setAlive(true);
    const longest = Math.max(...pieces.map((p) => p.delayMs + p.durMs));
    const timer = window.setTimeout(() => setAlive(false), longest + 60);
    return () => window.clearTimeout(timer);
  }, [burstKey, pieces]);

  if (reduceMotion || !alive) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        borderRadius: 'inherit',
      }}
    >
      {pieces.map((p, i) => (
        <span key={`${burstKey}-${i}`} className="wc-confetti-piece" style={pieceStyle(p)} />
      ))}
    </div>
  );
}

export default LessonCompleteConfetti;
