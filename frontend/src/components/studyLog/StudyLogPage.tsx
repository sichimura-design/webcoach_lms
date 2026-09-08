import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';
import { GraduationCap, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { AppFooter, AppHeader, ConfirmDialog } from '../shared';
import { useStudyStats } from '../../hooks/useStudyStats';
import { useStudyActivityEditor } from '../../hooks/useStudyActivityEditor';
import { useMonthActivities } from '../../hooks/useMonthActivities';
import { useGoalDeclaration } from '../../hooks/useGoalDeclaration';
import { useEnrollment } from '../../hooks/useEnrollment';
import {
  ManualStudyEntryInput,
  StudyActivity,
  StudyActivityPatch,
  StudyDayTotal,
} from '../../types/studyActivity';
import { GoalDeclarationInput, GoalDeclarationPatch } from '../../types/goalDeclaration';
import { formatMinutesHM, toLocalDateKey } from '../../utils/studyStats';
import { createNoteFromStudyRecord } from '../../utils/studyRecordNote';
import bffClient from '../../services/bffClient';
import SessionReview from '../coaching/SessionReview';
import type { CoachingSessionDetail, CoachingSessionSummary } from '../../types/coaching';
import { formatDayLabel, formatTime } from '../focus/focusFormat';
import StudyRecordPanel from './StudyRecordPanel';
import StudySummaryStrip from './StudySummaryStrip';
import StudyCalendarCard from './StudyCalendarCard';
import DayDetailPanel from './DayDetailPanel';
import StudyRecordEditModal from './StudyRecordEditModal';
import GoalDeclarationBar from './GoalDeclarationBar';
import GoalDeclarationCard from './GoalDeclarationCard';
import GoalDeclarationModal from './GoalDeclarationModal';
import GraduationNudge from './GraduationNudge';
import CoachingRecordsCard from './CoachingRecordsCard';

/**
 * 学習記録（/study-log）。
 *
 * マイページのストリークカード・学習記録カードの
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
 *   ヘッダー（見出し ＋ 卒業予定 ＋ 記録を追加）
 *   ① 今月の目標（横長バー1本）
 *   ② 学習カレンダー ｜ その日の記録
 *   ③ 学習時間の推移（期間タブ／棒グラフ）
 *   ④ 累計の KPI 4枚
 *   ⑤ 目標宣言の振り返り（終わった期間と過去分）
 *   ⑥ コーチング記録（過去のコーチングはここにためる）
 *
 * 🔴 この並び順に意味がある。「いつ・何を学習したか」に一番早く答えるのが
 *    ①＋② なので、開いた瞬間にそこが見えるようにする。累計の KPI（④）を
 *    先頭に置くと、休んでいた人に数字を突きつけてから中身を見せることになる。
 *
 * 🔴 時間の計上単位は「日ごとの合計」だけ。教材ごと・コースごとの学習時間は
 *    どこにも出さない（日別パネルの各行も分数を出さない＝StudyLogRow の hideMinutes、
 *    KPI 帯にあった「教材別の累計」も削除済み）。教材については名前と
 *    学習した内容だけを出す。
 *    ただし stats.byCourse の集計自体は残っていて、記録の編集モーダルの
 *    教材セレクト（courseOptions）が選択肢として使っている。
 *
 * 🔴 全期間の記録を縦に並べる「学習履歴」セクションは廃止した。同じ記録を
 *    ② のカレンダー＋日別パネルが日単位で見せており、下に同じ行を全期間ぶん
 *    並べ直しているだけだった。記録の編集・削除・手動追加はすべて日別パネルが持つ。
 *
 * 【卒業予定日】
 * 🔴 実BFFに無い。mocks/handlers.ts の MSW モックだけが返すので、
 *    本番（モックOFF）では null になる。null のときはピルごと描かない。
 *    卒業45日前の相談リボン（GraduationNudge）も条件付きで、既定では出ない。
 *
 * 🔴 最下段にあった「学習時間ランキング」「ストリークランキング」（他人との比較）は
 *    受講生の画面から外した。このページは自分の記録だけを扱う。
 *    順位を返す API（getStudyRanking / getStreakRanking）とそのモックは残してある。
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

/**
 * 'YYYY-MM-DD' → '2026年12月31日'。
 * focusFormat の formatDayLabel は曜日まで付くので、卒業予定日には長い。
 */
function formatJpDate(key: string): string {
  return `${key.slice(0, 4)}年${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日`;
}

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
  const { showToast } = useToast();
  const navigate = useNavigate();

  // 受講開始日〜今日。カレンダーの月送りと期間タブが同じ配列を使う
  const { stats, loading: statsLoading, unavailable } = useStudyStats(userId, 'all');

  const editor = useStudyActivityEditor(userId);
  const goals = useGoalDeclaration(userId);
  // 卒業予定日。取れなければ（本番＝モックOFF）ヘッダーのピルを出さないだけ
  const { enrollment } = useEnrollment(userId);

  const [searchParams, setSearchParams] = useSearchParams();
  const openSessionId = searchParams.get('session');
  const goalParam = openSessionId ? null : searchParams.get('goal');

  const todayKey = toLocalDateKey(new Date());
  const [monthOverride, setMonthOverride] = useState<string | null>(null);

  /**
   * 選択を明示的に外したか。
   * 🔴 ?date= が無いときの既定を「今日」にするために要る。既定を今日にしないと、
   *    ページを開いた時点では右の列が案内文だけになり、左のカレンダーだけが背の高い
   *    2カラムになる（この画面は「今日のぶんを見に来る」のが一番多い動線）。
   *    ただし × で閉じられるようにもしたいので、URL から date が消えただけの状態と
   *    「本人が閉じた」状態を区別する。月送りも閉じた側に寄せる（表示していない月の
   *    日が選ばれたままになると、右の詳細だけ別の月を指すことになる）。
   */
  const [deselected, setDeselected] = useState(false);
  const dateParam = searchParams.get('date');
  const selectedDate =
    openSessionId || goalParam ? null : (dateParam ?? (deselected ? null : todayKey));
  // 日を選んでいればその月。選んでいなければ月送りの状態、既定は今月
  const monthKey = selectedDate ? selectedDate.slice(0, 7) : (monthOverride ?? todayKey.slice(0, 7));

  const month = useMonthActivities(userId, monthKey);

  // --- 卒業予定日 -----------------------------------------------------------

  const graduationDate = enrollment?.graduationDate ?? null;
  const daysToGraduation = useMemo(() => {
    if (!graduationDate) return null;
    const days = differenceInCalendarDays(new Date(`${graduationDate}T00:00:00`), new Date(`${todayKey}T00:00:00`));
    // 過ぎている（卒業済み）なら出さない
    return days >= 0 ? days : null;
  }, [graduationDate, todayKey]);

  /**
   * 卒業45日前の相談リボンを出すか。
   * 🔴 既定では出ない。基本の画面に警告カードを常設しないための条件分岐で、
   *    将来ここに「学習ペース」などの条件を足す想定。
   *    ペースから卒業の可否を推定して断定しないこと（GraduationNudge の注記を参照）。
   */
  const showGraduationNudge = daysToGraduation !== null && daysToGraduation <= 45;

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

  const saveRecord = async (
    value: StudyActivityPatch | Omit<ManualStudyEntryInput, 'id'>,
    options?: { keepInMyNotes?: boolean }
  ) => {
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
      return;
    }

    // 🔴 記録が残ったあとに作る。ここが失敗しても記録は成立しているので、
    //    保存自体を失敗扱いにしない（StudySessionFinishHost と同じ作法）。
    if (!options?.keepInMyNotes) return;
    const input = value as Omit<ManualStudyEntryInput, 'id'>;
    try {
      const noteId = await createNoteFromStudyRecord({
        localDate: input.localDate,
        minutes: input.durationMinutes,
        course: input.course,
        // 手動追加にはその回の学習目標が無い（集中ブースで立てるもの）
        goalText: '',
        contentNote: input.contentNote ?? '',
        memo: input.memo ?? '',
        achievement: input.achievement ?? null,
      });
      showToast('マイノートに残しました', 'success', {
        action: { label: 'マイノートを見る', onClick: () => navigate(`/notes?note=${noteId}`) },
      });
    } catch {
      showToast('学習記録は残りましたが、マイノートに残せませんでした', 'error');
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
              ← 学習の記録に戻る
            </button>
            {openSession ? (
              <SessionReview session={openSession} onDeleted={backToList} />
            ) : (
              <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)' }}>読み込み中…</p>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 14,
              flexWrap: 'wrap',
              marginBottom: 22,
            }}
          >
            <div style={{ flex: 1, minWidth: 240 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--dc-fs-display)',
                  lineHeight: 'var(--dc-lh-heading)',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'var(--dc-text)',
                }}
              >
                学習の記録
              </h1>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 'var(--dc-fs-body)',
                  color: 'var(--dc-text-muted)',
                  lineHeight: 'var(--dc-lh-ui)',
                }}
              >
                いつ・何を学習したかを、見やすく整理できます
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/*
               * 卒業予定。
               * 🔴 取れないとき（本番＝モックOFF）はピルごと出さない。
               *    「卒業予定 —」のような空表示にすると、設定漏れに見える。
               * 🔴 右隣の赤い CTA より目立たせない。地は白、太字は「あと N 日」だけ。
               */}
              {graduationDate && daysToGraduation !== null && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    minHeight: 40,
                    padding: '0 14px',
                    borderRadius: 9999,
                    border: '1px solid var(--dc-border)',
                    background: 'var(--dc-surface)',
                    fontSize: 'var(--dc-fs-body)',
                    color: 'var(--dc-text-body)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <GraduationCap size={15} strokeWidth={1.75} color="var(--dc-gold)" aria-hidden="true" />
                  卒業予定
                  <span className="dc-num">{formatJpDate(graduationDate)}</span>
                  <span className="dc-num" style={{ fontWeight: 700, color: 'var(--dc-primary)' }}>
                    （あと{daysToGraduation}日）
                  </span>
                </span>
              )}

              {/*
               * 記録を追加。既定は今日。
               * 日を選んでからその日に足したいときは日別パネルの下部ボタンが受ける
               * （同じ操作で既定の日付だけが違う）。
               */}
              <button
                type="button"
                onClick={() => setEditTarget({ mode: 'create', date: todayKey })}
                disabled={editor.saving}
                className="dc-cta-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 40,
                  padding: '0 18px',
                  borderRadius: 9999,
                  border: 'none',
                  background: 'var(--dc-primary)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--dc-fs-body)',
                  fontWeight: 700,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  cursor: editor.saving ? 'default' : 'pointer',
                  opacity: editor.saving ? 0.6 : 1,
                }}
              >
                <Plus size={15} strokeWidth={2.25} aria-hidden="true" />
                記録を追加
              </button>
            </div>
          </div>
        )}

        {openSessionId ? null : unavailable ? (
          <div style={{ ...cardStyle, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
            学習記録を表示できませんでした。この機能はモック環境でのみ利用できます。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dc-sp-gap)' }}>
            {/* 卒業が近いときだけの相談導線。既定では出ない */}
            {showGraduationNudge && daysToGraduation !== null && (
              <GraduationNudge daysLeft={daysToGraduation} />
            )}

            {/* ① 今月の目標（横長バー1本） */}
            <GoalDeclarationBar
              active={goals.active}
              loading={goals.loading}
              onCreate={() => patchParams({ goal: 'new' })}
              onEdit={() => patchParams({ goal: 'edit' })}
            />

            {/* ② カレンダー ｜ その日の記録（1023px以下で1カラムに落ちる） */}
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
                  setDeselected(true);
                  if (dateParam) patchParams({ date: null }, true);
                }}
                onSelectDate={(date) => {
                  setDeselected(!date);
                  patchParams({ date }, !date);
                }}
                onSelectToday={() => {
                  setMonthOverride(todayKey.slice(0, 7));
                  setDeselected(false);
                  patchParams({ date: todayKey });
                }}
              />
              <DayDetailPanel
                date={selectedDate}
                todayKey={todayKey}
                minDate={stats?.firstStudyDate ?? null}
                activities={dayActivities}
                coachingSessions={daySessions}
                loading={month.loading}
                busy={editor.saving}
                onOpenSession={showSession}
                onEdit={(activity) => setEditTarget({ mode: 'edit', activity })}
                onDelete={setDeleteTarget}
                onAdd={(date) => setEditTarget({ mode: 'create', date })}
                /*
                 * 前日・翌日。monthKey が selectedDate に追従するのでカレンダーの表示月も動く。
                 * 🔴 monthOverride も一緒に更新する。ここを省くと、矢印で月をまたいだあとに
                 *    選択を解除（×）した瞬間、カレンダーだけ前の月へ戻ってしまう
                 *    （monthKey の既定値が monthOverride なので）。
                 */
                onSelectDate={(date) => {
                  setMonthOverride(date.slice(0, 7));
                  setDeselected(false);
                  patchParams({ date });
                }}
                onClose={() => {
                  setDeselected(true);
                  patchParams({ date: null }, true);
                }}
              />
            </div>

            {/* ③ 推移 */}
            <StudyRecordPanel stats={stats} loading={statsLoading} />

            {/* ④ 累計の KPI */}
            <StudySummaryStrip stats={stats} loading={statsLoading} />

            {/* ⑤ 目標宣言の振り返り（進行中は ① のバーが持つ） */}
            <GoalDeclarationCard
              items={goals.items}
              active={goals.active}
              pendingReflection={goals.pendingReflection}
              daily={stats?.dailyTotals ?? []}
              loading={goals.loading}
              onCreate={() => patchParams({ goal: 'new' })}
              onReview={() => patchParams({ goal: 'review' })}
              onView={(d) => patchParams({ goal: d.id })}
            />

            {/* ⑥ コーチング記録 */}
            <CoachingRecordsCard
              sessions={pastSessions}
              loading={coachingLoading}
              onOpen={showSession}
            />
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
