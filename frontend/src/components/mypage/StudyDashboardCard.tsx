import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Activity, Clock, Flame, RotateCcw } from 'lucide-react';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM, splitMinutesHM, toLocalDateKey, weekStartOf } from '../../utils/studyStats';

/**
 * 学習状況ダッシュボード（マイページ下段・全幅）。
 * claude.ai/design『トップページ 3案』8a 準拠。
 *
 * 5a では「学習ストリーク」「学習記録」の2枚に分かれていた数字を1枚に集約した。
 * 内訳は 左＝連続学習日数＋総学習時間／修了レッスン数、右＝今週の学習時間ゲージ＋今週の目標。
 *
 * 🔴 まだ来ていない曜日を「未学習」の灰色で塗らない（StudyRecordCard から引き継いだ方針）。
 *    金曜に見ると土日が凹んで見え、まだ起きていない不足を先に見せることになる。
 *    未来は破線の丸／極薄のスタブにして、判定していないことを形で示す。
 *
 * 🔴 このカードにCTAは置かない。「目標を変更」だけはアウトラインのピルで、
 *    マイページ唯一の Primary CTA（ResumeStudyCard）と競合させないこと。
 */
interface StudyDashboardCardProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
  /** 修了レッスン数（コースの進捗率からの推定値） */
  completedLessons: number;
  /** 修了レッスン数の今週ぶんの増分。取れないときは null */
  completedLessonsDelta: number | null;
  /** 今週の学習時間の目標（分） */
  goalMinutes: number;
  /** 「目標を変更」 */
  onEditGoal: () => void;
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/** ゲージの半径。8a は viewBox 118 の中に r=50 */
const RING_R = 50;
const RING_C = 2 * Math.PI * RING_R;

/** 棒の最大描画高さ（px）。8a の height:110 に合わせる */
const BAR_MAX_H = 110;
/** 実績0分の日に残す最小の芯。棒が消えると「その日が無い」ように見える */
const BAR_EMPTY_H = 5;

const CARD_STYLE: CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
};

/**
 * ブロックの見出しラベル（連続学習日数・総学習時間・今週の目標）。
 * 🔴 数値を大きくするぶん、ラベルは 14px / 500 に留める。
 *    ラベルまで太字にすると、隣の数字と強さが並んでダッシュボードが読めなくなる。
 */
const BLOCK_LABEL_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 'var(--dc-fs-body)',
  fontWeight: 500,
  color: 'var(--dc-text-body)',
  marginBottom: 14,
};

/**
 * 右カラムの2つの見出し（今週の学習時間・今週の目標）の行。
 * 🔴 「今週の目標」だけ行内に「目標を変更」ボタンが入るので、素だと行の高さが
 *    ボタンぶん高くなり、隣の「今週の学習時間」と文字の位置がずれる。
 *    ボタンの高さ（14px/normal + padding 5px + border 1px = 32px）を両方に敷いて揃える。
 */
const RIGHT_LABEL_ROW_STYLE: CSSProperties = {
  minHeight: 32,
  marginBottom: 12,
};

type Day = {
  key: string;
  label: string;
  minutes: number;
  isStudyDay: boolean;
  isToday: boolean;
  isFuture: boolean;
};

/** 目盛りの上限。1日の目標ペースと実績のうち大きいほうに合わせ、30分単位で切り上げる */
function scaleMaxOf(minutes: number[], perDayTarget: number): number {
  const peak = Math.max(0, perDayTarget, ...minutes);
  return Math.max(30, Math.ceil(peak / 30) * 30);
}

/** 「1.5h」。棒の上の小さなラベル用（8a 表記） */
function formatHoursShort(min: number): string {
  if (min <= 0) return '0h';
  return `${(min / 60).toFixed(1).replace(/\.0$/, '')}h`;
}

/**
 * ストリークの曜日1列に入れる学習時間。
 * 🔴 formatMinutesHM をそのまま使わない。「1時間20分」は5文字あり、
 *    左カラムが約500pxのとき1列62px（12px フォント）に入らず切れる。
 *    1時間未満は「45分」、それ以上は棒グラフのラベルと同じ h 表記に落として
 *    最長4文字（「1.3h」）に収める。
 */
function formatDayShort(min: number): string {
  if (min <= 0) return '0分';
  if (min < 60) return `${min}分`;
  return formatHoursShort(min);
}

/** KPI 1枚。StudyRecordCard の MiniStat と同じ折り返し方針（単位は数値より小さく） */
function MiniStat({
  label,
  icon,
  parts,
  footnote,
}: {
  label: string;
  icon: ReactNode;
  parts: { value: string; unit: string }[];
  footnote: string | null;
}) {
  return (
    <div
      style={{
        background: 'var(--dc-bg)',
        border: '1px solid var(--dc-border)',
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div style={BLOCK_LABEL_STYLE}>
        {icon}
        {label}
      </div>
      {/* 数字は display(28〜32px)、単位は lead(16px)。同じ大きさで組むより
          「128時間45分」の数字だけが立つほうがダッシュボードとして読みやすい。
          部品ごとに nowrap なので、狭いときは「128時間」「45分」で折り返す。 */}
      <div
        className="dc-num"
        style={{
          fontSize: 'var(--dc-fs-lead)',
          fontWeight: 700,
          color: 'var(--dc-text)',
          marginBottom: 8,
          lineHeight: 'var(--dc-lh-hero)',
        }}
      >
        {parts.map((p, i) => (
          <span key={i} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 'var(--dc-fs-display)' }}>{p.value}</span>
            {p.unit}
          </span>
        ))}
      </div>
      {footnote && (
        <div style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)', marginTop: 'auto' }}>
          {footnote}
        </div>
      )}
    </div>
  );
}

export function StudyDashboardCard({
  stats,
  loading,
  completedLessons,
  completedLessonsDelta,
  goalMinutes,
  onEditGoal,
}: StudyDashboardCardProps) {
  const days = useMemo<Day[]>(() => {
    const byDate = new Map((stats?.dailyTotals ?? []).map((d) => [d.date, d]));
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const start = weekStartOf(today);

    return WEEKDAY_LABELS.map((label, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toLocalDateKey(d);
      const hit = byDate.get(key);
      return {
        key,
        label,
        minutes: hit?.minutes ?? 0,
        isStudyDay: hit?.isStudyDay ?? false,
        isToday: key === todayKey,
        isFuture: key > todayKey,
      };
    });
  }, [stats]);

  const weekMinutes = stats?.week.minutes ?? 0;
  const perDayTarget = Math.round(goalMinutes / 7);
  const scaleMax = scaleMaxOf(days.map((d) => d.minutes), perDayTarget);
  const ratio = goalMinutes > 0 ? Math.min(1, weekMinutes / goalMinutes) : 0;
  const filled = RING_C * ratio;
  const remain = Math.max(0, goalMinutes - weekMinutes);
  const loadingParts = [{ value: '…', unit: '' }];

  const streakDays = stats?.streak.currentDays ?? 0;
  const bestDays = stats?.streak.bestDays ?? 0;
  // 自己ベストまでの進捗。判定は LearningStreakCard / StreakHeroCard と同じ式に揃える
  const isNewBest = streakDays > 0 && streakDays >= bestDays;
  const bestRemain = Math.max(0, bestDays - streakDays);
  const bestRatio = bestDays > 0 ? Math.min(1, streakDays / bestDays) : 0;

  return (
    <section style={CARD_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span
          style={{
            width: 'var(--dc-sz-badge)',
            height: 'var(--dc-sz-badge)',
            flex: 'none',
            borderRadius: 9999,
            background: 'var(--dc-soft-100)',
            color: 'var(--dc-primary)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Activity size={16} strokeWidth={2} />
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--dc-fs-lead)',
            fontWeight: 700,
            color: 'var(--dc-text)',
            lineHeight: 'var(--dc-lh-heading)',
          }}
        >
          学習状況ダッシュボード
        </h2>
      </div>

      <div className="mypage-dash-grid">
        {/* ── 左: 連続学習日数 ＋ KPI 2枚 ─────────────
            並びは幅で反転する（index.css の .mypage-dash-left）。
              ・このグリッドが2列＝左カラムが約500px:
                  連続学習日数が全幅、下に KPI 2枚を横並び
              ・1列＝左カラムがカード全幅（サイドバー展開時など）:
                  連続学習日数 ｜ KPI 2枚を縦積み
            🔴 どちらの向きも決め打ちにしない。7日ドットは1行に7列なので、
               狭いほうで横割りにすると1列が30px台になってドットが潰れ、
               広いほうで全幅にすると1400px を1行に間延びさせることになる。 */}
        <div className="mypage-dash-left">
          {/* 🔴 flex column。横割りのとき、この箱は隣の KPI 列（2枚ぶん）に
                 引き伸ばされる。中身が上に詰まったままだと下に大きな白が残るので、
                 曜日グリッドに flex:1 を持たせて余りを吸わせる。 */}
          <div
            style={{
              background: 'var(--dc-soft-100)',
              border: '1px solid var(--dc-soft-200)',
              borderRadius: 14,
              padding: '16px 18px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={BLOCK_LABEL_STYLE}>
              <Flame size={14} fill="var(--dc-primary)" strokeWidth={0} />
              連続学習日数
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
              <span
                className="dc-num"
                style={{ fontSize: 'var(--dc-fs-hero-xs)', fontWeight: 700, color: 'var(--dc-primary)', lineHeight: 1 }}
              >
                {loading ? '…' : streakDays}
              </span>
              <span style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: 700, color: 'var(--dc-text)' }}>
                日連続で学習中
              </span>
              <span style={{ flex: 1 }} />
              {/* 自己ベストは補足。nowrap は残すが、親の flexWrap:'wrap' で next-line に逃げる */}
              <span style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}>
                🔥 自己ベスト：{loading ? '…' : bestDays}日
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 4,
                flex: 1,
                alignContent: 'stretch',
              }}
            >
              {days.map((d) => {
                const on = d.isStudyDay || (d.isToday && d.minutes > 0);
                return (
                  <div
                    key={d.key}
                    title={`${d.label}曜日 ${formatMinutesHM(d.minutes)}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--dc-fs-caption)',
                        fontWeight: d.isToday ? 700 : 400,
                        color: d.isToday
                          ? 'var(--dc-primary)'
                          : d.isFuture
                            ? 'var(--dc-text-subtle)'
                            : 'var(--dc-text-muted)',
                      }}
                    >
                      {d.isToday ? '今日' : d.label}
                    </span>
                    {/* 🔴 丸は列幅に追従させる（最大34px）。26px 固定にすると、
                           スマホ幅で1列が33px前後まで落ちたときに隣とぶつかる。
                        🔴 margin:'auto 0' が余り高さの受け皿。箱が引き伸ばされたとき
                           丸が上下の中央に寄り、下だけに白が残るのを防ぐ。
                        🔴 学習した日は今日もそれ以前も「赤ベタ＋白い炎」で統一する。
                           かつては今日だけ赤ベタ、過去は薄いピンク(#FDECEC)＋赤い炎に
                           していたが、薄ピンクと未学習の白丸の差が弱く、
                           1行のうちどれが学習した日なのか読み取れなかった。
                           今日は丸の色ではなく「今日」ラベル・太字・影で示す。 */}
                    <span
                      style={{
                        width: '100%',
                        maxWidth: 34,
                        aspectRatio: '1 / 1',
                        margin: 'auto 0',
                        borderRadius: 9999,
                        display: 'grid',
                        placeItems: 'center',
                        background: on ? 'var(--dc-primary)' : 'transparent',
                        border: d.isFuture
                          ? '2px dashed #E5DED3'
                          : on
                            ? 0
                            : '2px solid var(--dc-idle-border)',
                        boxShadow: d.isToday && on ? '0 4px 10px -4px rgba(160,8,36,.5)' : undefined,
                      }}
                    >
                      {on && <Flame size={14} fill="#fff" strokeWidth={0} />}
                    </span>
                    {/* 🔴 まだ来ていない日に「0分」を出さない（このファイル冒頭の方針）。
                           起きていない不足を先に見せることになるので、来ていないことが
                           分かる「–」に留める。高さは常に確保して升目を揃える。 */}
                    <span
                      className="dc-num"
                      style={{
                        fontSize: 'var(--dc-fs-caption)',
                        fontWeight: d.isToday ? 700 : 400,
                        color: d.isFuture
                          ? 'var(--dc-text-subtle)'
                          : on
                            ? 'var(--dc-text-body)'
                            : 'var(--dc-text-muted)',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {loading ? '…' : d.isFuture ? '–' : formatDayShort(d.minutes)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 自己ベストまでの進捗。右ブロックの棒グラフが「今週の時間」を見せるのに対し、
                ここは「日数がどこまで伸びたか」を見せる。
                🔴 文言は LearningStreakCard / StreakHeroCard と揃える（更新中は煽らない）。
                🔴 ベストが0（記録がまだ無い）ときは出さない。0/0 の空バーになるだけ。 */}
            {!loading && bestDays > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 'var(--dc-fs-caption)',
                      fontWeight: 700,
                      color: isNewBest ? 'var(--dc-gold-text)' : 'var(--dc-text-body)',
                    }}
                  >
                    {isNewBest ? '自己ベスト更新中！' : `あと${bestRemain}日で自己ベスト`}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span
                    className="dc-num"
                    style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}
                  >
                    {streakDays} / {bestDays}日
                  </span>
                </div>
                {/* 進捗はすぐ上のテキストが言い切っているので、バーは装飾として隠す */}
                <div
                  aria-hidden="true"
                  style={{ height: 8, borderRadius: 9999, background: 'var(--dc-sunken)', overflow: 'hidden' }}
                >
                  <div
                    style={{
                      width: `${Math.round(bestRatio * 100)}%`,
                      height: '100%',
                      borderRadius: 9999,
                      background: isNewBest ? 'var(--dc-gold)' : 'var(--dc-primary)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mypage-dash-kpi">
            <MiniStat
              label="総学習時間"
              icon={<Clock size={14} strokeWidth={2} color="var(--dc-primary)" />}
              parts={loading ? loadingParts : splitMinutesHM(stats?.allTime.minutes ?? 0)}
              footnote={loading ? null : `今月：${formatMinutesHM(stats?.month.minutes ?? 0)}`}
            />
            <MiniStat
              label="修了レッスン数"
              icon={<RotateCcw size={14} strokeWidth={2} color="var(--dc-primary)" />}
              parts={loading ? loadingParts : [{ value: String(completedLessons), unit: 'レッスン' }]}
              // 8a は「今月：+4レッスン」だが、月ぶんの増分は持っていない。
              // useLearningSummary が出せるのは週の増分だけなので、期間の表記を合わせる
              footnote={
                completedLessonsDelta != null && completedLessonsDelta > 0
                  ? `今週：+${completedLessonsDelta}レッスン`
                  : null
              }
            />
          </div>
        </div>

        {/* ── 右: 今週の学習時間ゲージ ＋ 今週の目標 ───────────── */}
        <div className="mypage-dash-right">
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ ...BLOCK_LABEL_STYLE, alignSelf: 'flex-start', ...RIGHT_LABEL_ROW_STYLE }}>
              <span style={{ width: 9, height: 9, borderRadius: 9999, background: '#2BB49A' }} />
              今週の学習時間
            </div>

            <div style={{ position: 'relative', width: 128, height: 128, margin: 'auto 0' }}>
              <svg width="128" height="128" viewBox="0 0 118 118" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="59" cy="59" r={RING_R} fill="none" stroke="#F8E3E6" strokeWidth="9" />
                <circle
                  cx="59"
                  cy="59"
                  r={RING_R}
                  fill="none"
                  stroke="var(--dc-primary)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${RING_C - filled}`}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                {/* リングの内側は直径 128px しか無いので、ここは lead(16px) で止める。
                    title(20px) にすると「4時間35分」がリングの弧に当たる。 */}
                <div style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>合計</div>
                <div
                  className="dc-num"
                  style={{
                    fontSize: 'var(--dc-fs-lead)',
                    fontWeight: 700,
                    color: 'var(--dc-primary)',
                    lineHeight: 'var(--dc-lh-hero)',
                  }}
                >
                  {loading ? '…' : formatMinutesHM(weekMinutes)}
                </div>
                <div style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>
                  目標 {formatMinutesHM(goalMinutes)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...BLOCK_LABEL_STYLE, ...RIGHT_LABEL_ROW_STYLE }}>
              <span style={{ width: 9, height: 9, borderRadius: 9999, background: '#3B82F6' }} />
              今週の目標
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={onEditGoal}
                className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  border: '1px solid var(--dc-border-strong)',
                  background: 'var(--dc-surface)',
                  borderRadius: 9999,
                  padding: '5px 11px',
                  fontFamily: 'inherit',
                  fontSize: 'var(--dc-fs-body)',
                  fontWeight: 600,
                  color: 'var(--dc-text-body)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                目標を変更
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--dc-fs-body)', fontWeight: 600, color: 'var(--dc-text)' }}>目標</span>
              <span
                className="dc-num"
                style={{
                  fontSize: 'var(--dc-fs-title)',
                  fontWeight: 700,
                  color: 'var(--dc-text)',
                  lineHeight: 'var(--dc-lh-hero)',
                }}
              >
                {formatMinutesHM(goalMinutes)}
              </span>
              <span style={{ fontSize: 'var(--dc-fs-body)', fontWeight: 500, color: 'var(--dc-text-muted)' }}>/ 週</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 6,
                alignItems: 'end',
                height: BAR_MAX_H + 20,
                marginBottom: 8,
              }}
            >
              {days.map((d) => {
                const h = d.isFuture
                  ? BAR_EMPTY_H
                  : Math.max(BAR_EMPTY_H, Math.round((d.minutes / scaleMax) * BAR_MAX_H));
                const background = d.isFuture || d.minutes === 0
                  ? 'var(--dc-border)'
                  : d.isToday
                    ? 'var(--dc-primary)'
                    : 'var(--dc-bar-past)';
                return (
                  <div
                    key={d.key}
                    // mypage-dash-col: 値ラベルが列幅を超えたら ellipsis で切る。
                    // 隣の曜日と重なるのを幅のしきい値ではなく構造で防ぐ（index.css）
                    className="mypage-dash-col"
                    title={`${d.label}曜日 ${formatMinutesHM(d.minutes)}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 5,
                      height: '100%',
                    }}
                  >
                    <span
                      className="dc-num"
                      style={{
                        fontSize: 'var(--dc-fs-caption)',
                        fontWeight: d.isToday ? 700 : 400,
                        color: d.isToday
                          ? 'var(--dc-primary)'
                          : d.isFuture
                            ? 'var(--dc-chevron)'
                            : 'var(--dc-text-muted)',
                      }}
                    >
                      {formatHoursShort(d.minutes)}
                    </span>
                    <div style={{ width: 16, height: h, borderRadius: 8, background }} />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 }}>
              {days.map((d) =>
                d.isToday ? (
                  <span
                    key={d.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--dc-fs-caption)',
                      fontWeight: 700,
                      color: '#fff',
                      background: 'var(--dc-primary)',
                      borderRadius: 9999,
                      // 文字が 9.5px → 12px になったぶん丸を広げる。22px だと余白がほぼ残らない
                      width: 24,
                      height: 24,
                      margin: '0 auto',
                    }}
                  >
                    {d.label}
                  </span>
                ) : (
                  <span
                    key={d.key}
                    style={{
                      fontSize: 'var(--dc-fs-caption)',
                      textAlign: 'center',
                      color: d.isFuture ? 'var(--dc-text-subtle)' : 'var(--dc-text-muted)',
                    }}
                  >
                    {d.label}
                  </span>
                )
              )}
            </div>

            {/* 「目標まであと○分」は次の行動に直結するので caption には落とさない */}
            <div style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)', textAlign: 'right' }}>
              {remain > 0 ? (
                <>
                  目標まであと{' '}
                  <strong className="dc-num" style={{ color: 'var(--dc-primary)' }}>
                    {formatMinutesHM(remain)}
                  </strong>
                </>
              ) : (
                <strong style={{ color: 'var(--dc-primary)' }}>今週の目標を達成しました！</strong>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StudyDashboardCard;
