import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Pause, Play, Square } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { STUDY_CATEGORY_LABEL, StudySegmentTotal } from '../../types/studyActivity';
import { displaySegments, formatHMS, formatMinutesHM } from '../../utils/studyStats';

/**
 * 記録中であることの常設表示。
 * ============================================================
 * 🔴 タイマーは学習の邪魔をしない。だから既定では「● 学習中 24分」だけを出し、
 *    一時停止・終了のボタンは押されるまで出さない。
 *    以前は常に3つのボタンが露出した右下のピルで、読んでいる最中ずっと
 *    操作UIが視界に入っていた。
 * 🔴 押すとポップオーバーが開き、そこで内訳と操作を見せる。
 * 🔴 z-index は 50（ドロワーと同じ層）。以前は 1000 でモーダル(70)より
 *    手前に出てしまっていた。
 * 🔴 ピルはドラッグで画面のどこへでも動かせる（useDraggablePill）。
 *    既定の右上は画面によって他のUIと重なる（AIコーチの使い方パネルの「×」など）。
 *    z を下げるだけでは「隠れて中身が読めない」ほうが残るので、
 *    どかせるようにしてある。位置は localStorage に残す。
 * ============================================================
 */

/** ドラッグ位置の保存先。開始ピルと記録中ピルは同じ場所に出るので座標を共有する */
const POS_KEY = 'wc-study-pill-pos';
/** 既定位置（右上）からの余白。画面端に寄せたときの最小マージンにも使う */
const INSET = 16;
/** これ未満の移動はクリックとして扱う（押しただけで動いてしまうのを防ぐ） */
const DRAG_THRESHOLD = 4;
/** 掴んでよい場所の目印。ポップオーバー内からドラッグが始まらないようにする */
const DRAG_HANDLE_ATTR = 'data-wc-drag-handle';

/** ポップオーバーの寸法。開く向きの判定に使う（実寸は内訳の行数で少し伸びる） */
const POPOVER_W = 260;
const POPOVER_H = 300;
const POPOVER_OFFSET = 40;

type PillPos = { x: number; y: number };

function readPos(): PillPos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PillPos;
    return typeof p?.x === 'number' && typeof p?.y === 'number' ? p : null;
  } catch {
    return null;
  }
}

/**
 * ピルをポインタで動かせるようにする。
 *
 * 位置を持っていないあいだは既定（右上）のまま `top/right` で置き、
 * 一度動かしたら `left/top` の実座標に切り替える。
 * クリック（ポップオーバーを開く）と両立させるため、
 * DRAG_THRESHOLD を超えて動いたときだけ直後の click を飲む。
 */
function useDraggablePill() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<PillPos | null>(readPos);
  const [dragging, setDragging] = useState(false);
  /** ドラッグ直後の click を飲むためのフラグ。次の pointerdown で降りる */
  const movedRef = useRef(false);
  const posRef = useRef<PillPos | null>(pos);
  const originRef = useRef<{ px: number; py: number; dx: number; dy: number } | null>(null);

  /** 画面外へ出さない。掴んだ縁のぶんだけは常に見えるようにする */
  const clamp = useCallback((x: number, y: number): PillPos => {
    const w = ref.current?.offsetWidth ?? 0;
    const h = ref.current?.offsetHeight ?? 0;
    return {
      x: Math.min(Math.max(x, INSET), Math.max(INSET, window.innerWidth - w - INSET)),
      y: Math.min(Math.max(y, INSET), Math.max(INSET, window.innerHeight - h - INSET)),
    };
  }, []);

  const apply = useCallback((next: PillPos) => {
    posRef.current = next;
    setPos(next);
  }, []);

  // 画面が縮んだとき、動かしたピルが外に取り残されないよう引き戻す。
  // 🔴 posRef が空でも購読する。未ドラッグ時に早期 return すると、
  //    このeffectの依存が安定なので初回ドラッグ後も購読され直さない。
  useEffect(() => {
    const onResize = () => {
      const p = posRef.current;
      if (p) apply(clamp(p.x, p.y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [apply, clamp]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current) return;
    // 掴めるのはピル本体だけ。ポップオーバーの中から始めた操作でドラッグが
    // 始まると、「終了」を押すときの僅かな手の揺れでクリックが飲まれてしまう。
    if (!(e.target as HTMLElement).closest?.(`[${DRAG_HANDLE_ATTR}]`)) return;
    const rect = ref.current.getBoundingClientRect();
    originRef.current = {
      px: e.clientX,
      py: e.clientY,
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    movedRef.current = false;
    ref.current.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const o = originRef.current;
    if (!o) return;
    if (
      !movedRef.current &&
      Math.abs(e.clientX - o.px) + Math.abs(e.clientY - o.py) < DRAG_THRESHOLD
    ) {
      return;
    }
    movedRef.current = true;
    apply(clamp(e.clientX - o.dx, e.clientY - o.dy));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!originRef.current) return;
    originRef.current = null;
    setDragging(false);
    if (ref.current?.hasPointerCapture(e.pointerId)) {
      ref.current.releasePointerCapture(e.pointerId);
    }
    // 保存はドラッグの終わりに1回だけ（移動中に毎回書くと同期書き込みが続く）
    if (movedRef.current && posRef.current) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(posRef.current));
      } catch {
        /* プライベートモード等。位置が残らないだけなので無視する */
      }
    }
  };

  return {
    ref,
    dragging,
    /** ラッパー div に展開する。className の fixed / z-50 は呼び出し側が持つ */
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      // ドラッグして離した直後の click は「移動」なので、中のボタンへ通さない
      onClickCapture: (e: React.MouseEvent) => {
        if (movedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      style: pos ? { left: pos.x, top: pos.y } : { top: INSET, right: INSET },
    },
    /** 掴む場所（ピル本体）に展開する */
    handleProps: {
      [DRAG_HANDLE_ATTR]: '',
      title: 'ドラッグで移動できます',
      // 触って動かすときにページがスクロールしないようにする
      style: { touchAction: 'none' as const, cursor: dragging ? 'grabbing' : 'grab' },
    },
  };
}

/** ピルの共通の見た目。インジケータと「記録する」の入口で使い回す */
const pillStyle: React.CSSProperties = {
  gap: 7,
  height: 32,
  padding: '0 12px',
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  boxShadow: shadow.soft,
  fontFamily: font.family,
  fontSize: 12.5,
  fontWeight: 700,
  color: color.textBody,
  cursor: 'pointer',
};

/**
 * 「記録する」の入口。
 * 🔴 打診を断った日にだけ出す。断ると翌日まで打診が出ないので、これが無いと
 *    「あとで記録したくなった」人がその日ずっと記録を始められない。
 *    ふだんは出さない（記録していない状態のUIを増やさない）。
 */
export function StudySessionStartPill({ onStart }: { onStart: () => void }) {
  const { ref, dragProps, handleProps } = useDraggablePill();
  return (
    <div ref={ref} className="fixed z-50" {...dragProps}>
      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        {...handleProps}
        style={{
          ...pillStyle,
          color: color.primary,
          borderColor: color.primaryBorder,
          ...handleProps.style,
        }}
      >
        <Clock size={13} />
        学習時間を記録する
      </button>
    </div>
  );
}

interface StudySessionIndicatorProps {
  /** 経過秒 */
  elapsedSeconds: number;
  running: boolean;
  /** いま何をしている時間か（教材名など） */
  subject?: string | null;
  segments: StudySegmentTotal[];
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  /** 記録せずにやめる。この学習ぶんは残らない */
  onDiscard: () => void;
}

export function StudySessionIndicator({
  elapsedSeconds,
  running,
  subject,
  segments,
  onPause,
  onResume,
  onFinish,
  onDiscard,
}: StudySessionIndicatorProps) {
  const [open, setOpen] = useState(false);
  /** 破棄は取り消せないので、同じ場所で1回確認する（別モーダルは出さない） */
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { ref, dragging, dragProps, handleProps } = useDraggablePill();

  /**
   * ポップオーバーの開く向き。
   * ピルを動かせるようになったので「右上にあるから左下へ開く」を前提にできない。
   * 画面からはみ出す側には開かないよう、開く瞬間にピルの位置から決める。
   */
  const [place, setPlace] = useState<{ v: 'down' | 'up'; h: 'left' | 'right' }>({
    v: 'down',
    h: 'right',
  });
  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPlace({
      v: r.bottom + POPOVER_OFFSET + POPOVER_H > window.innerHeight ? 'up' : 'down',
      h: r.left + POPOVER_W <= window.innerWidth ? 'left' : 'right',
    });
  }, [open, ref]);

  // ドラッグを始めたら閉じる（掴んで動かすあいだ中身が付いてくると読めない）
  useEffect(() => {
    if (dragging) {
      setOpen(false);
      setConfirmDiscard(false);
    }
  }, [dragging]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirmDiscard(false); }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setConfirmDiscard(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, ref]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const breakdown = displaySegments(segments, minutes);

  return (
    <div ref={ref} className="fixed z-50" {...dragProps}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          running
            ? `学習中 ${minutes}分。詳細を開く。ドラッグで移動できます`
            : `一時停止中 ${minutes}分。詳細を開く。ドラッグで移動できます`
        }
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        {...handleProps}
        style={{ ...pillStyle, ...handleProps.style }}
      >
        {/* 稼働中だけ赤く点る。停止中は色を落として「止まっている」と分かるようにする */}
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: running ? color.primary : color.textFaint,
            flexShrink: 0,
          }}
        />
        <span>{running ? '学習中' : '一時停止中'}</span>
        <span className="dc-num" style={{ color: color.text }}>
          {minutes}分
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="学習セッション"
          style={{
            position: 'absolute',
            ...(place.v === 'down' ? { top: POPOVER_OFFSET } : { bottom: POPOVER_OFFSET }),
            ...(place.h === 'left' ? { left: 0 } : { right: 0 }),
            width: POPOVER_W,
            background: color.surface,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            boxShadow: shadow.hero,
            padding: '16px 18px',
            fontFamily: font.family,
            animation: 'fadeInUp 0.16s ease-out',
          }}
        >
          {subject && (
            <div className="truncate" style={{ ...font.rowTitle, color: color.text }} title={subject}>
              {subject}
            </div>
          )}
          <div className="dc-num" style={{ fontSize: 26, fontWeight: 800, color: color.text, marginTop: subject ? 6 : 0 }}>
            {formatHMS(elapsedSeconds)}
          </div>

          {/* 内訳は2行以上あるときだけ。1行なら上の経過時間と同じことになる */}
          {breakdown.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {breakdown.map((s) => (
                <div key={s.category} className="flex items-center justify-between" style={{ ...font.caption, color: color.textMuted }}>
                  <span>{STUDY_CATEGORY_LABEL[s.category]}</span>
                  <span className="dc-num">{formatMinutesHM(s.minutes)}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              onClick={running ? onPause : onResume}
              className="flex-1 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                gap: 6,
                height: 38,
                border: `1px solid ${color.borderSoft}`,
                borderRadius: radius.sm,
                background: color.surface,
                color: color.textBody,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {running ? <Pause size={14} /> : <Play size={14} />}
              {running ? '一時停止' : '再開'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onFinish(); }}
              className="flex-1 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                gap: 6,
                height: 38,
                border: 0,
                borderRadius: radius.sm,
                background: color.primary,
                color: color.textOnPrimary,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Square size={13} />
              終了
            </button>
          </div>

          {/*
            記録せずにやめる。誤操作で始めた／中断して実質学習していなかったセッションを
            終わらせる唯一の手段（集中ブースを廃止したとき、それまで唯一の入口だった
            放置セッションの「破棄」バナーも一緒に無くなっている）。
            🔴 取り消せないので同じ場所で1回確認する。別モーダルは出さない。
            🔴 確認では「記録を続ける」を主役にする。ここまで測った時間を捨てるのは
               戻せない操作なので、既定の視線を安全側に置く。
          */}
          <div style={{ marginTop: 10, borderTop: `1px solid ${color.border}`, paddingTop: 10 }}>
            {confirmDiscard ? (
              <>
                <div style={{ ...font.caption, color: color.textMuted, lineHeight: 1.6 }}>
                  ここまでの {formatMinutesHM(minutes)} は残りません
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setConfirmDiscard(false)}
                    className="flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      height: 34,
                      border: 0,
                      borderRadius: radius.sm,
                      background: color.primary,
                      color: color.textOnPrimary,
                      fontFamily: 'inherit',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    記録を続ける
                  </button>
                  <button
                    type="button"
                    onClick={() => { setConfirmDiscard(false); setOpen(false); onDiscard(); }}
                    className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{ border: 0, background: 'transparent', color: color.textSubtle, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: 0, flexShrink: 0 }}
                  >
                    破棄する
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ border: 0, background: 'transparent', color: color.textSubtle, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: 0 }}
              >
                記録せずにやめる
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StudySessionIndicator;
