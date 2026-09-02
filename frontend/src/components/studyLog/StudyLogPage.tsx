import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Flame } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AppFooter, AppHeader, ConfirmDialog } from '../shared';
import { useStudyStats } from '../../hooks/useStudyStats';
import { useStudyActivityEditor } from '../../hooks/useStudyActivityEditor';
import { useMonthActivities } from '../../hooks/useMonthActivities';
import { useGoalDeclaration } from '../../hooks/useGoalDeclaration';
import { useStreakRanking, useStudyRanking } from '../../hooks/useRankings';
import { StreakRankingPeriod, StudyRankingPeriod } from '../../types/focusBooth';
import {
  ManualStudyEntryInput,
  StudyActivity,
  StudyActivityPatch,
  StudyDayTotal,
} from '../../types/studyActivity';
import { GoalDeclarationInput, GoalDeclarationPatch } from '../../types/goalDeclaration';
import { formatMinutesHM, toLocalDateKey } from '../../utils/studyStats';
import { RankingRowItem } from '../shared/RankingRow';
import bffClient from '../../services/bffClient';
import SessionReview from '../coaching/SessionReview';
import type { CoachingSessionDetail, CoachingSessionSummary } from '../../types/coaching';
import { formatDayLabel, formatTime } from '../focus/focusFormat';
import StudyRecordPanel from './StudyRecordPanel';
import StudySummaryStrip from './StudySummaryStrip';
import StudyCalendarCard from './StudyCalendarCard';
import DayDetailPanel from './DayDetailPanel';
import StudyRecordEditModal from './StudyRecordEditModal';
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
 *    日別パネルだけは記録の実体（教材名・メモ）が要るので、見ている月のぶんを
 *    useMonthActivities が別に取る（月内の日送りでは再取得しない）。
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
 *    並べ直しているだけだった。記録の編集・削除・手動追加はすべて日別パネルが持つ。
 *
 * 🔴 ランキング（他人との比較）を最下段に置いている。カレンダーを主役にした結果、
 *    上から「自分の記録」を掘っていく並びになったので、その途中を他人の話で
 *    割らないようにするため。
 *
 * 【コーチング記録】
 * 🔴 /coaching は「次の1回」の画面で、残すのは前回分だけ。過去の積み上がりはここが持つ。
 *    1件開くときはルートを増やさず /study-log?session=<id> にする
 *    （マイノートの ?note= と同じ作法）。
 *
 * 【クエリの優先順位】
 * 🔴 session > goal > date。3つ同時に付いていても、この順で1つだけが効く。
 *    ここが唯一の判断場所で、各カードは自分のクエリだけを見ない。
 */

/** 学習アクティビティ1件を、削除確認の一覧に出す1行にする */
function describeActivity(a: StudyActivity): string {
  const where = a.course?.courseTitle ?? '教材を指定しない';
  return `${formatDayLabel(`${a.localDate}T00:00:00`)} ${formatTime(a.startedAt)} ${where} ${formatMinutesHM(a.session.durationMinutes)}`;
}

type EditTarget =
  | { mode: 'edit'; activity: StudyActivity }
  | { mode: 'create'; date: string }
  | null;

function StudyLogPage() {
  const { user } = useAuth();
  const userId = user?.userid;

  // 受講開始日〜今日。カレンダーの月送りと期間タブが同じ配列を使う
  const { stats, loading: statsLoading, unavailable } = useStudyStats(userId, 'all');

  const [timePeriod, setTimePeriod] = useState<StudyRankingPeriod>('week');
  const [streakPeriod, setStreakPeriod] = useState<StreakRankingPeriod>('month');
  const time = useStudyRanking(userId, timePeriod);
  const streak = useStreakRanking(userId, streakPeriod);

  const editor = useStudyActivityEditor(userId);
  const goals = useGoalDeclaration(userId);

  const [searchParams, setSearchParams] = useSearchParams();
  const openSessionId = searchParams.get('session');
  const goalParam = openSessionId ? null : searchParams.get('goal');
  const selectedDate = openSessionId || goalParam ? null : searchParams.get('date');

  const todayKey = toLocalDateKey(new Date());
  const [monthOverride, setMonthOverride] = useState<string | null>(null);
  // 日を選んでいればその月。選んでいなければ月送りの状態、既定は今月
  const monthKey = selectedDate ? selectedDate.slice(0, 7) : (monthOverride ?? todayKey.slice(0, 7));

  const month = useMonthActivities(userId, monthKey);

  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyActivity | null>(null);

  // --- コーチング記録 -------------------------------------------------------

  const [pastSessions, setPastSessions] = useState<CoachingSessionSummary[]>([]);
  const [coachingLoading, setCoachingLoading] = useState(true);
  const [openSession, setOpenSession] = useState<CoachingSessionDetail | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setCoachingLoading(true);
    bffClient
      .getCoachingSessions(userId)
      .then((res) => { if (alive) setPastSessions(res.past ?? []); })
      // コーチングを使っていない受講生・実BFF未対応でも学習記録側は出す
      .catch(() => { if (alive) setPastSessions([]); })
      .finally(() => { if (alive) setCoachingLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  // ?session= の中身が唯一の入口。ブラウザバックと直リンクもここが受ける
  useEffect(() => {
    if (!openSessionId) {
      setOpenSession(null);
      return;
    }
    let alive = true;
    setOpenSession(null);
    bffClient
      .getCoachingSession(Number(openSessionId))
      .then((d) => { if (alive) setOpenSession(d); })
      .catch(() => { if (alive) setOpenSession(null); });
    return () => { alive = false; };
  }, [openSessionId]);

  /** クエリを1つ足す／消す。?date= を残したまま ?session= を足せるようにする */
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

  const showSession = (sessionId: number) => patchParams({ session: String(sessionId) });
  const backToList = () => patchParams({ session: null }, true);

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

  const dayActivities = useMemo(
    () => (selectedDate ? month.activities.filter((a) => a.localDate === selectedDate) : []),
    [month.activities, selectedDate]
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

  // --- 記録の編集 -----------------------------------------------------------

  const saveRecord = async (value: StudyActivityPatch | Omit<ManualStudyEntryInput, 'id'>) => {
    if (!editTarget) return;
    try {
      if (editTarget.mode === 'edit') {
        await editor.update(editTarget.activity, value as StudyActivityPatch);
      } else {
        await editor.addManual(value as Omit<ManualStudyEntryInput, 'id'>);
      }
      setEditTarget(null);
    } catch {
      // 文言は editor.error に入っている。モーダルは開いたままにして直させる
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await editor.remove(deleteTarget);
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
    }
  };

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
    const found = goals.items.find((d) => d.id === goalParam);
    return found ? { mode: 'view' as const, declaration: found } : null;
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
    value: formatMinutesHM(e.minutes),
    isMe: e.isMe,
  }));

  const streakItems: RankingRowItem[] = (streak.ranking?.entries ?? []).map((e) => ({
    rank: e.rank,
    nickname: e.isMe ? 'あなた' : e.nickname,
    avatarEmoji: e.avatarEmoji,
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
        {/* 記録を1件開いているときは、その記録が見出しを持つのでページの見出しは出さない */}
        {openSessionId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 22 }}>
            <button
              type="button"
              onClick={backToList}
              style={{
                alignSelf: 'flex-start',
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'inherit',
                fontSize: 'var(--dc-fs-body)',
                color: 'var(--dc-text-muted)',
                cursor: 'pointer',
              }}
            >
              ← 学習記録に戻る
            </button>
            {openSession ? (
              <SessionReview session={openSession} onDeleted={backToList} />
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)' }}>読み込み中…</p>
            )}
          </div>
        ) : (
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
        )}

        {openSessionId ? null : unavailable ? (
          <div style={{ ...cardStyle, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
            学習記録を表示できませんでした。この機能はモック環境でのみ利用できます。
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
              />
              <DayDetailPanel
                date={selectedDate}
                todayKey={todayKey}
                activities={dayActivities}
                coachingSessions={daySessions}
                loading={month.loading}
                busy={editor.saving}
                onOpenSession={showSession}
                onEdit={(activity) => setEditTarget({ mode: 'edit', activity })}
                onDelete={setDeleteTarget}
                onAdd={(date) => setEditTarget({ mode: 'create', date })}
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
              onView={(d) => patchParams({ goal: d.id })}
            />

            {/* ⑤ コーチング記録 */}
            <CoachingRecordsCard
              sessions={pastSessions}
              loading={coachingLoading}
              onOpen={showSession}
            />

            {/* ⑥ ランキング */}
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
          </div>
        )}

        {editTarget && (
          <StudyRecordEditModal
            mode={editTarget.mode}
            activity={editTarget.mode === 'edit' ? editTarget.activity : undefined}
            defaultDate={editTarget.mode === 'create' ? editTarget.date : undefined}
            courses={courseOptions}
            saving={editor.saving}
            error={editor.error}
            onSave={saveRecord}
            onClose={() => {
              editor.clearError();
              setEditTarget(null);
            }}
          />
        )}

        {deleteTarget && (
          <ConfirmDialog
            title="この学習記録を削除しますか？"
            description="削除すると、学習時間の合計・ストリーク・カレンダーからも取り除かれます。元に戻せません。"
            items={[describeActivity(deleteTarget)]}
            confirmLabel="削除する"
            busy={editor.saving}
            onConfirm={confirmDelete}
            onCancel={() => setDeleteTarget(null)}
          />
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
