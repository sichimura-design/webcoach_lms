import { BookOpen, ChevronLeft, ChevronRight, Clock, Headphones, Pencil, Plus, X } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { StudyActivity } from '../../types/studyActivity';
import type { CoachingSessionSummary } from '../../types/coaching';
import { STUDY_DAY_MIN_MINUTES, formatMinutesHM } from '../../utils/studyStats';
import { formatDayLabel } from '../focus/focusFormat';
import StudyLogRow, { EmptyStudyLog } from './StudyLogRow';

/**
 * カレンダーで選んだ日の中身。
 * ============================================================
 * 広い画面ではカレンダーの右横、1023px 以下ではカレンダーの真下に回り込む
 * （.studylog-calendar-grid が1カラムに落ちるだけで、DOM は同じ）。
 *
 * 🔴 モーダルにしない。カレンダーが隠れると「隣の日はどうだったか」を
 *    続けて見られなくなる。記録の編集モーダルとも階層が二重になる。
 *
 * 🔴 カレンダー直下に展開もしない。日を選ぶたびに下の推移・履歴が大きく動き、
 *    記録の無い日を選ぶと高さが急に縮む。
 *
 * 【時間の出し方】
 * 🔴 時間を出すのは「合計の学習時間」の1箇所だけ。
 *    記録1件ごとの分数とカテゴリ別の内訳は StudyLogRow に hideMinutes で隠させる。
 *    教材名の隣に分数が並ぶと「教材ごとの学習時間」として読まれる。日ごとの合計を
 *    唯一の計上値にする、というのがこの画面の方針。
 *
 * 🔴 記録が0件の日は合計ブロックごと出さない。「合計 0分」を大きく出すと、
 *    休んだ日に成績表を突きつけることになる。
 * ============================================================
 */
interface DayDetailPanelProps {
  /** 選択中の日（YYYY-MM-DD）。null なら「日付を選んでください」 */
  date: string | null;
  /**
   * 日付未選択のときに「記録を追加」が使う日（＝今日）。
   * 🔴 未選択の状態にも追加ボタンを置くための引数。学習履歴セクションを廃止して
   *    「手動で記録を追加」の入口がこのパネルだけになったので、日を選ばないと
   *    1件も足せない状態にしない。
   */
  todayKey: string;
  /** 前日へ動ける下限（＝最初の記録の日）。null なら遡り不可 */
  minDate: string | null;
  /** その日の学習記録（新しい順） */
  activities: StudyActivity[];
  /** その日のコーチング */
  coachingSessions: CoachingSessionSummary[];
  loading: boolean;
  busy?: boolean;
  onOpenSession: (sessionId: number) => void;
  onEdit: (activity: StudyActivity) => void;
  onDelete: (activity: StudyActivity) => void;
  onAdd: (date: string) => void;
  /** 前日・翌日へ。月をまたぐ場合も呼び出し側の monthKey が追従する */
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

const CARD: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
};

/** 記録を追加するボタン。日を選んでいる時（この日）といない時（今日）で共用する */
const ADD_BUTTON: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  marginTop: 16,
  minHeight: 40,
  borderRadius: 9999,
  border: '1px solid var(--dc-border-strong)',
  background: 'var(--dc-surface)',
  fontFamily: 'inherit',
  fontSize: 'var(--dc-fs-body)',
  fontWeight: 700,
  color: 'var(--dc-text-body)',
};

/** 節の見出し。アイコン＋文字で、カード内の区切りを作る */
function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: '0 0 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 'var(--dc-fs-body)',
        fontWeight: 700,
        color: 'var(--dc-text)',
      }}
    >
      {icon}
      {children}
    </h3>
  );
}

export function DayDetailPanel({
  date,
  todayKey,
  minDate,
  activities,
  coachingSessions,
  loading,
  busy = false,
  onOpenSession,
  onEdit,
  onDelete,
  onAdd,
  onSelectDate,
  onClose,
}: DayDetailPanelProps) {
  /** 記録の追加モーダルを開くボタン。日を選んでいなければ今日で開く */
  const addButton = (targetDate: string, label: string) => (
    <button
      type="button"
      onClick={() => onAdd(targetDate)}
      disabled={busy}
      className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{ ...ADD_BUTTON, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}
    >
      <Plus size={15} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  );

  if (!date) {
    return (
      <section style={CARD} aria-label="選んだ日の学習内容">
        <p
          style={{
            margin: 0,
            fontSize: 'var(--dc-fs-body)',
            color: 'var(--dc-text-muted)',
            lineHeight: 'var(--dc-lh-prose)',
          }}
        >
          カレンダーの日付を選ぶと、その日に学習した教材と時間、受けたコーチングがここに出ます。
        </p>
        {addButton(todayKey, '今日の記録を追加')}
      </section>
    );
  }

  const totalMinutes = activities.reduce((sum, a) => sum + a.session.durationMinutes, 0);
  const isStudyDay = totalMinutes >= STUDY_DAY_MIN_MINUTES;
  const hasRecords = activities.length > 0;

  // 前日・翌日。未来と最初の記録より前へは行かせない
  const shiftDay = (delta: number) => format(addDays(new Date(`${date}T00:00:00`), delta), 'yyyy-MM-dd');
  const prevKey = shiftDay(-1);
  const nextKey = shiftDay(1);
  const canGoPrev = minDate === null ? false : prevKey >= minDate;
  const canGoNext = nextKey <= todayKey;

  /*
   * 🔴 44px ではなく 36px。タップ最小の 44px を満たしたいが、この2つは
   *    カードの見出し行に × と3つ並ぶので、44px だと見出しの折り返しを起こす。
   *    既存の 24px の ‹ › より広げることを優先した。
   */
  const dayNavButton = (label: string, icon: React.ReactNode, enabled: boolean, target: string) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!enabled}
      onClick={() => onSelectDate(target)}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        width: 36,
        height: 36,
        flex: 'none',
        borderRadius: 9999,
        border: '1px solid var(--dc-border-strong)',
        background: 'var(--dc-surface)',
        color: enabled ? 'var(--dc-text-body)' : 'var(--dc-text-subtle)',
        display: 'grid',
        placeItems: 'center',
        cursor: enabled ? 'pointer' : 'not-allowed',
      }}
    >
      {icon}
    </button>
  );

  return (
    <section style={CARD} aria-label={`${formatDayLabel(`${date}T00:00:00`)}の記録`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2
          style={{
            margin: 0,
            flex: 1,
            minWidth: 0,
            fontSize: 'var(--dc-fs-lead)',
            fontWeight: 700,
            color: 'var(--dc-text)',
          }}
        >
          {formatDayLabel(`${date}T00:00:00`)}の記録
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          {dayNavButton('前の日へ', <ChevronLeft size={17} strokeWidth={2} />, canGoPrev, prevKey)}
          {dayNavButton('次の日へ', <ChevronRight size={17} strokeWidth={2} />, canGoNext, nextKey)}
          <button
            type="button"
            aria-label="選択を解除する"
            onClick={onClose}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 26,
              height: 26,
              flex: 'none',
              borderRadius: 9999,
              border: '1px solid var(--dc-border)',
              background: 'var(--dc-surface)',
              color: 'var(--dc-text-muted)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/*
       * その日の合計学習時間。この画面で時間を大きく出すのはここだけ。
       * 🔴 記録が0件の日は出さない（「合計 0分」を大きく見せない）。
       */}
      {loading ? (
        <p style={{ margin: 0, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>
          読み込んでいます…
        </p>
      ) : (
        hasRecords && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              padding: '14px 16px',
              borderRadius: 'var(--dc-radius-md)',
              background: 'var(--dc-soft-100)',
              marginBottom: 18,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--dc-fs-body)',
                  color: 'var(--dc-text-body)',
                }}
              >
                <Clock size={14} strokeWidth={2} color="var(--dc-primary)" aria-hidden="true" />
                合計の学習時間
              </div>
              <div
                className="dc-num"
                style={{
                  fontSize: 'var(--dc-fs-display)',
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color: 'var(--dc-text)',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatMinutesHM(totalMinutes)}
              </div>
              {/* 件数と「学習した日に届かない」注記は数字の添え物として小さく */}
              <div
                className="dc-num"
                style={{ marginTop: 2, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}
              >
                {`記録${activities.length}件`}
                {isStudyDay ? '' : ` ・ ${STUDY_DAY_MIN_MINUTES}分未満`}
              </div>
            </div>

            {/*
             * 🔴 記録が1件のときだけ出す。複数あるときにここを押させると
             *    「どれを編集するのか」が決まらない。2件以上は各行の鉛筆が受ける。
             */}
            {activities.length === 1 && (
              <button
                type="button"
                onClick={() => onEdit(activities[0])}
                disabled={busy}
                className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  flex: 'none',
                  minHeight: 34,
                  padding: '0 14px',
                  borderRadius: 9999,
                  border: '1px solid var(--dc-border-strong)',
                  background: 'var(--dc-surface)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--dc-fs-body)',
                  fontWeight: 700,
                  color: 'var(--dc-text-body)',
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Pencil size={13} strokeWidth={2} aria-hidden="true" />
                この日の記録を編集
              </button>
            )}
          </div>
        )
      )}

      {/* 学んだ教材。🔴 hideMinutes で「教材名 + 分数」の並びを作らない */}
      {!loading && (
        <div>
          <SectionHeading icon={<BookOpen size={14} strokeWidth={2} color="var(--dc-primary)" aria-hidden="true" />}>
            学んだ教材
          </SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hasRecords ? (
              activities.map((a) => (
                <StudyLogRow
                  key={a.id}
                  activity={a}
                  timeOnly
                  hideMinutes
                  onEdit={onEdit}
                  onDelete={onDelete}
                  busy={busy}
                />
              ))
            ) : (
              <EmptyStudyLog message="この日の学習記録はありません。記録し忘れた分は下から足せます。" />
            )}
          </div>
        </div>
      )}

      {/* コーチング。受けていない日はこの節ごと出さない（空カードを出さない） */}
      {coachingSessions.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--dc-border)' }}>
          <SectionHeading icon={<Headphones size={14} strokeWidth={2} color="var(--dc-gold)" aria-hidden="true" />}>
            コーチング
          </SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {coachingSessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpenSession(s.id)}
                className="studylog-coaching-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--dc-radius-md)',
                  border: '1px solid var(--dc-border)',
                  background: 'var(--dc-surface)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--dc-fs-body)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 30,
                    height: 30,
                    flex: 'none',
                    borderRadius: 8,
                    background: 'var(--dc-gold-surface)',
                    color: 'var(--dc-gold)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Headphones size={15} strokeWidth={1.75} />
                </span>

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--dc-text)' }}>{s.title}</span>
                    {/* 🔴 実BFFは時刻を返さない。無いときは行ごと出さない */}
                    {s.startTime && (
                      <span
                        className="dc-num"
                        style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}
                      >
                        {s.endTime ? `${s.startTime}〜${s.endTime}` : `${s.startTime}〜`}
                      </span>
                    )}
                  </span>
                  {s.summary && (
                    <span
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginTop: 3,
                        fontSize: 'var(--dc-fs-caption)',
                        color: 'var(--dc-text-subtle)',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {s.summary}
                    </span>
                  )}
                </span>

                <span style={{ flex: 'none', color: 'var(--dc-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  詳しく見る ›
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 記録の手動追加。選んだ日が入った状態で開く */}
      {addButton(date, 'この日の記録を追加')}
    </section>
  );
}

export default DayDetailPanel;
