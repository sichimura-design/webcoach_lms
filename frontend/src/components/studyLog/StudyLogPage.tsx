import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, Flame } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AppFooter, AppHeader } from '../shared';
import { useStudyStats } from '../../hooks/useStudyStats';
import { useDayDetail } from '../../hooks/useDayDetail';
import { useGoalDeclaration } from '../../hooks/useGoalDeclaration';
import { useStreakRanking, useStudyRanking } from '../../hooks/useRankings';
import { StreakRankingPeriod, StudyRankingPeriod } from '../../types/focusBooth';
import { StudyDayTotal } from '../../types/studyActivity';
import { GoalDeclarationInput, GoalDeclarationPatch } from '../../types/goalDeclaration';
import { formatMinutesHM, toLocalDateKey } from '../../utils/studyStats';
import { RankingRowItem } from '../shared/RankingRow';
import { withCfToken } from '../profile/AvatarPicker';
import bffClient from '../../services/bffClient';
import type { CoachingSessionSummary } from '../../types/coaching';
import { toSessionSummary } from '../../utils/coachingScheduleAdapter';
import StudyRecordPanel from './StudyRecordPanel';
import StudySummaryStrip from './StudySummaryStrip';
import StudyCalendarCard from './StudyCalendarCard';
import DayDetailPanel from './DayDetailPanel';
import GoalDeclarationCard from './GoalDeclarationCard';
import GoalDeclarationModal from './GoalDeclarationModal';
import RankingListCard from './RankingListCard';
import CoachingRecordsCard from './CoachingRecordsCard';

/**
 * 学習記録・ランキング（/study-log）。
 *
 * マイページのストリークカード・学習記録カード・みんなのランキングの
 * 「詳しく見る／もっと見る」がすべてここに着地する。
 *
 * 【レイアウト方式】
 * 🔴 useScaleToFit（1440px の固定キャンバスを transform:scale で縮小）は使わない。
 *    fr ベースの流動レイアウトで、マイページと同じく素直に折り返す。
 *    scale 方式は狭い画面で文字まで一緒に縮んで読めなくなるのが難点だった。
 *
 * 【データ取得】
 * 🔴 学習記録は useStudyStats(userId, 'all') の1本だけ。期間タブ（1週間〜月別）も
 *    カレンダーの月送りも、この受講開始日〜今日ぶんの dailyTotals から切り出す。
 *    タブごとに days を変えて叩くと、切り替えのたびに画面が読み込み中へ戻る。
 *    日別パネルは、選んだ日に完了した実セッション（Moodleログ由来、
 *    useDayDetail経由でGET /api/study/sessions/:userid/by-date）と、その日の
 *    振り返り（達成度・メモ、同じくuseDayDetail経由）を選択のたびに取る。
 *
 * 【構成】
 *   ① 総まとめ（KPI×4 ＋ 教材別の累計）
 *   ② 学習カレンダー ｜ その日の詳細
 *   ③ 学習の推移（期間タブ／棒グラフ）
 *   ④ 目標宣言と振り返り
 *   ⑤ コーチング記録（過去のコーチングはここにためる）
 *   ⑥ 学習時間ランキング ｜ ストリークランキング
 *
 * 🔴 全期間の記録を縦に並べる「学習履歴」セクションは廃止した。同じ記録を
 *    ② のカレンダー＋日別パネルが日単位で見せており、下に同じ行を全期間ぶん
 *    並べ直しているだけだった。セッション自体は自動記録の読み取り専用データなので
 *    日別パネルに編集・削除・手動追加は無く、書けるのはその日の振り返りだけ。
 *
 * 🔴 ランキング（他人との比較）を最下段に置いている。カレンダーを主役にした結果、
 *    上から「自分の記録」を掘っていく並びになったので、その途中を他人の話で
 *    割らないようにするため。
 *
 * 【コーチング記録】
 * 🔴 実データはコーチが登録するコーチング予約（/api/coaching/schedule）。実施日が今日以前の回を
 *    カレンダーと一覧に出す。以前は実BFFに存在しないモック専用API（/webcoach/coaching-sessions）を
 *    呼んでいて、実環境では常に0件＝コーチングの日付がどこにも出ていなかった。
 *    1件開くと /coaching?schedule=<id> へ移り、AIノートはそちら（MyCoachingPage）で読む。
 *
 * 【クエリの優先順位】
 * 🔴 goal > date。2つ同時に付いていても、この順で1つだけが効く。
 *    ここが唯一の判断場所で、各カードは自分のクエリだけを見ない。
 */

function StudyLogPage() {
  const { user, contentToken } = useAuth();
  const userId = user?.userid;

  // 受講開始日〜今日。カレンダーの月送りと期間タブが同じ配列を使う
  const { stats, loading: statsLoading, unavailable } = useStudyStats(userId, 'all');

  const [timePeriod, setTimePeriod] = useState<StudyRankingPeriod>('week');
  const [streakPeriod, setStreakPeriod] = useState<StreakRankingPeriod>('month');
  const time = useStudyRanking(user?.isAdmin ? userId : undefined, timePeriod);
  const streak = useStreakRanking(user?.isAdmin ? userId : undefined, streakPeriod);
  const goals = useGoalDeclaration(userId);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const goalParam = searchParams.get('goal');
  const selectedDate = goalParam ? null : searchParams.get('date');

  const todayKey = toLocalDateKey(new Date());
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  // 日を選んでいればその月。選んでいなければ月送りの状態、既定は今月
  const monthKey = selectedDate ? selectedDate.slice(0, 7) : (monthOverride ?? todayKey.slice(0, 7));

  const dayDetail = useDayDetail(userId, selectedDate);

  // --- コーチング記録 -------------------------------------------------------

  const [pastSessions, setPastSessions] = useState<CoachingSessionSummary[]>([]);
  const [coachingLoading, setCoachingLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setCoachingLoading(true);
    bffClient
      .getCoachingSchedules(userId)
      .then((schedules) => {
        if (!alive) return;
        // 実施済みの回だけ。未来の予約とリスケで流れた回は「記録」ではないので出さない
        const done = schedules.filter((s) => s.coaching_date <= todayKey && s.status !== 'rescheduled');
        setPastSessions(done.map(toSessionSummary));
      })
      // コーチングを使っていない受講生でも学習記録側は出す
      .catch(() => { if (alive) setPastSessions([]); })
      .finally(() => { if (alive) setCoachingLoading(false); });
    return () => { alive = false; };
  }, [userId, todayKey]);

  /** クエリを1つ足す／消す。?date= を残したまま ?goal= を足せるようにする */
  const patchParams = useCallback(
    (changes: Record<string, string | null>, replace = false) => {
      const params = new URLSearchParams(searchParams);
      Object.entries(changes).forEach(([k, v]) => {
        if (v === null) params.delete(k);
        else params.set(k, v);
      });
      setSearchParams(params, { replace });
    },
    [searchParams, setSearchParams]
  );

  const showSession = (scheduleId: number) => navigate(`/coaching?schedule=${scheduleId}`);

  // --- カレンダー -----------------------------------------------------------

  const dayTotals = useMemo(() => {
    const map: Record<string, StudyDayTotal> = {};
    for (const d of stats?.dailyTotals ?? []) map[d.date] = d;
    return map;
  }, [stats]);

  // コーチング実施日。すでに取っている past から作るので追加のリクエストは無い
  const coachingDates = useMemo(
    () => new Set(pastSessions.map((s) => s.date)),
    [pastSessions]
  );

  const daySessions = useMemo(
    () => (selectedDate ? pastSessions.filter((s) => s.date === selectedDate) : []),
    [pastSessions, selectedDate]
  );

  /** 教材の選択肢。集計済みの byCourse から作るので追加のリクエストは無い */
  const courseOptions = useMemo(
    () =>
      (stats?.byCourse ?? [])
        .filter((c) => c.courseId !== null)
        .map((c) => ({ id: c.courseId as number, title: c.courseTitle })),
    [stats]
  );

  /** courseid → 教材名。日別詳細パネルのセッション行が使う */
  const courseTitleOf = useCallback(
    (courseid: number | null) => courseOptions.find((c) => c.id === courseid)?.title ?? null,
    [courseOptions]
  );

  // --- 目標宣言 -------------------------------------------------------------

  const goalTarget = useMemo(() => {
    if (!goalParam) return null;
    if (goalParam === 'new') return { mode: 'create' as const, declaration: undefined };
    if (goalParam === 'edit') {
      return goals.active ? { mode: 'edit' as const, declaration: goals.active } : null;
    }
    if (goalParam === 'review') {
      const d = goals.pendingReflection[0];
      return d ? { mode: 'review' as const, declaration: d } : null;
    }
    // 「これまでの宣言」の行からも状態・振り返り・手応えを直せるよう編集で開く
    // （以前は閲覧専用で、状態や手応えのピルが押しても何も起きなかった）
    const found = goals.items.find((d) => d.id === goalParam);
    return found ? { mode: 'edit' as const, declaration: found } : null;
  }, [goalParam, goals.active, goals.pendingReflection, goals.items]);

  const closeGoal = () => patchParams({ goal: null }, true);

  const saveGoal = async (value: Omit<GoalDeclarationInput, 'id'> | GoalDeclarationPatch) => {
    if (!goalTarget) return;
    try {
      if (goalTarget.mode === 'create') {
        await goals.create(value as Omit<GoalDeclarationInput, 'id'>);
      } else if (goalTarget.declaration) {
        await goals.update(goalTarget.declaration.id, value as GoalDeclarationPatch);
      }
      closeGoal();
    } catch {
      // 文言は goals.error。モーダルは開いたままにする
    }
  };

  // --- ランキング -----------------------------------------------------------

  const timeItems: RankingRowItem[] = (time.ranking?.entries ?? []).map((e) => ({
    rank: e.rank,
    nickname: e.isMe ? 'あなた' : e.nickname,
    avatarEmoji: e.avatarEmoji,
    avatarUrl: e.avatarUrl ? withCfToken(e.avatarUrl, contentToken) : undefined,
    value: formatMinutesHM(e.minutes),
    isMe: e.isMe,
  }));

  const streakItems: RankingRowItem[] = (streak.ranking?.entries ?? []).map((e) => ({
    rank: e.rank,
    nickname: e.isMe ? 'あなた' : e.nickname,
    avatarEmoji: e.avatarEmoji,
    avatarUrl: e.avatarUrl ? withCfToken(e.avatarUrl, contentToken) : undefined,
    value: `${e.days}日`,
    isMe: e.isMe,
  }));

  const cardStyle: React.CSSProperties = {
    background: 'var(--dc-surface)',
    border: '1px solid var(--dc-border)',
    borderRadius: 'var(--dc-radius-lg)',
    boxShadow: 'var(--dc-shadow-card)',
    padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
  };

  return (
    <div className="mypage-3d min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username || 'User'} />

      <main
        className="dc-page-main flex flex-col"
        style={{ flex: 1, padding: 'var(--dc-sp-page-y) var(--dc-sp-page-x) calc(var(--dc-sp-page-y) * 0.8)', color: 'var(--dc-text)' }}
      >
        <div style={{ marginBottom: 22 }}>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 'var(--dc-fs-display)',
              lineHeight: 'var(--dc-lh-heading)',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--dc-text)',
            }}
          >
            学習記録・ランキング
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)' }}>
            いつ何をどれだけ学習したかと、これまでの積み上がりを確認できます。
          </p>
        </div>

        {unavailable ? (
          <div style={{ ...cardStyle, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
            学習記録を表示できませんでした。しばらくしてからもう一度お試しください。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dc-sp-gap)' }}>
            {/* ① 総まとめ */}
            <StudySummaryStrip stats={stats} loading={statsLoading} />

            {/* ② カレンダー ｜ その日の詳細（1023px以下で1カラムに落ちる） */}
            <div className="studylog-calendar-grid">
              <StudyCalendarCard
                monthKey={monthKey}
                dayTotals={dayTotals}
                coachingDates={coachingDates}
                selectedDate={selectedDate}
                minMonthKey={stats?.firstStudyDate ? stats.firstStudyDate.slice(0, 7) : null}
                loading={statsLoading}
                onMonthChange={(next) => {
                  setMonthOverride(next);
                  // 月を動かしたら選択は解除する。表示していない月の日が選ばれたままになると、
                  // 右の詳細だけ別の月を指すことになる
                  if (selectedDate) patchParams({ date: null }, true);
                }}
                onSelectDate={(date) => patchParams({ date }, !date)}
                onSelectToday={() => {
                  setMonthOverride(null);
                  patchParams({ date: todayKey }, false);
                }}
              />
              <DayDetailPanel
                date={selectedDate}
                sessions={dayDetail.sessions}
                courseTitleOf={courseTitleOf}
                reflection={dayDetail.reflection}
                coachingSessions={daySessions}
                loading={dayDetail.loading}
                saving={dayDetail.saving}
                saveError={dayDetail.error}
                onOpenSession={showSession}
                onSaveReflection={dayDetail.saveReflection}
                onClose={() => patchParams({ date: null }, true)}
              />
            </div>

            {/* ③ 推移 */}
            <StudyRecordPanel stats={stats} loading={statsLoading} />

            {/* ④ 目標宣言 */}
            <GoalDeclarationCard
              items={goals.items}
              active={goals.active}
              pendingReflection={goals.pendingReflection}
              daily={stats?.dailyTotals ?? []}
              loading={goals.loading}
              onCreate={() => patchParams({ goal: 'new' })}
              onEdit={(d) => patchParams({ goal: d.id === goals.active?.id ? 'edit' : d.id })}
              onReview={() => patchParams({ goal: 'review' })}
              onOpen={(d) => patchParams({ goal: d.id })}
            />

            {/* ⑤ コーチング記録 */}
            <CoachingRecordsCard
              sessions={pastSessions}
              loading={coachingLoading}
              onOpen={showSession}
            />

            {/* ⑥ ランキング（管理者のみ表示） */}
            {user?.isAdmin && (
            <div className="studylog-rank-grid">
              <RankingListCard
                title="学習時間ランキング"
                icon={<Clock size={16} strokeWidth={1.75} />}
                iconBackground="var(--dc-soft-100)"
                iconColor="var(--dc-primary)"
                periods={[
                  { key: 'week', label: '週間' },
                  { key: 'month', label: '月間' },
                ]}
                activePeriod={timePeriod}
                onPeriodChange={(k) => setTimePeriod(k as StudyRankingPeriod)}
                items={timeItems}
                footer={
                  time.ranking
                    ? `${time.ranking.periodLabel}・${time.ranking.participantCount}人中 ${time.ranking.me.rank}位`
                    : undefined
                }
                loading={time.loading}
                failed={time.failed}
              />

              <RankingListCard
                title="ストリークランキング"
                icon={<Flame size={16} strokeWidth={1.75} />}
                iconBackground="var(--dc-gold-surface)"
                iconColor="var(--dc-gold)"
                periods={[
                  { key: 'month', label: '月間' },
                  { key: 'total', label: '累計' },
                ]}
                activePeriod={streakPeriod}
                onPeriodChange={(k) => setStreakPeriod(k as StreakRankingPeriod)}
                items={streakItems}
                footer={
                  streak.ranking
                    ? `${streak.ranking.periodLabel}の学習日数・${streak.ranking.participantCount}人中 ${streak.ranking.me.rank}位`
                    : undefined
                }
                loading={streak.loading}
                failed={streak.failed}
              />
            </div>
            )}
          </div>
        )}


        {goalTarget && (
          <GoalDeclarationModal
            mode={goalTarget.mode}
            declaration={goalTarget.declaration}
            saving={goals.saving}
            error={goals.error}
            onSave={saveGoal}
            onDelete={async (d) => {
              await goals.remove(d.id);
              closeGoal();
            }}
            onClose={closeGoal}
          />
        )}

        <AppFooter />
      </main>
    </div>
  );
}

export default StudyLogPage;
