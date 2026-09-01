/**
 * コーチングページ（受講生側）。
 *
 * 目指す体験:
 *   コーチから届いたリンクを貼る → LMSからコーチングに参加する → 終了後にノートとタスクが完成している
 *
 * 受講生は Google / Zoom のアカウント連携をしない。録画・文字起こしは
 * コーチの認証済み権限で行われるので、受講生の操作は
 * 「リンクを貼る」「参加する」「確認して確定する」の3つだけに収めている。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import bffClient from '../services/bffClient';
import { color, font } from '../theme/webcoachTheme';
import CoachingHeroCard from './coaching/CoachingHeroCard';
import CoachingHistoryList from './coaching/CoachingHistoryList';
import ConsentModal from './coaching/ConsentModal';
import ImportRecordCard from './coaching/ImportRecordCard';
import LastSessionCard from './coaching/LastSessionCard';
import NextActionsCard, { type GoalDraftRow } from './coaching/NextActionsCard';
import ProcessingStatus from './coaching/ProcessingStatus';
import RecordingStatus from './coaching/RecordingStatus';
import SessionReview from './coaching/SessionReview';
import { C } from './coaching/design1c';
import type {
  AutoImportReadiness,
  CoachingSessionDetail,
  CoachingSessions,
  ImportRecordPayload,
  MeetingLink,
} from '../types/coaching';
import type { CoachingGoalApi, CoachingGoalUpdateItem } from '../types/mypage';

type Mode =
  | { kind: 'list' }
  | { kind: 'recording'; session: CoachingSessionDetail }
  | { kind: 'processing'; session: CoachingSessionDetail }
  | { kind: 'review'; session: CoachingSessionDetail }
  | { kind: 'import'; session: CoachingSessionDetail };

/**
 * タイムライン左端のノード（丸＋下に伸びる縦線）。
 * デザイン1Cの 64px 列。狭い画面では index.css の .cg-node ごと畳まれる。
 */
function TimelineNode({ label, accent, last }: { label: string; accent?: boolean; last?: boolean }) {
  return (
    <div className="cg-node" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} aria-hidden>
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 9999,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          lineHeight: 1.2,
          whiteSpace: 'pre-line',
          fontSize: accent ? 10 : 11,
          fontWeight: 700,
          background: accent ? C.brand : '#fff',
          border: accent ? 'none' : `1.5px solid ${C.borderInput}`,
          color: accent ? '#fff' : C.muted,
          boxSizing: 'border-box',
        }}
      >
        {label}
      </span>
      {!last && <span style={{ flex: 1, width: 2, background: C.rail, marginTop: 8 }} />}
    </div>
  );
}

export default function CoachingNotesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.userid;

  const [sessions, setSessions] = useState<CoachingSessions | null>(null);
  const [goals, setGoals] = useState<CoachingGoalApi[]>([]);
  const [readiness, setReadiness] = useState<AutoImportReadiness | null>(null);
  /** 直近セッションの詳細。「前回の振り返り」のキーポイントを出すために使う */
  const [lastDetail, setLastDetail] = useState<CoachingSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [importing, setImporting] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [list, goalList, ready] = await Promise.all([
        bffClient.getCoachingSessions(userId),
        bffClient.getNextCoachingGoals(userId),
        bffClient.getAutoImportReadiness(userId),
      ]);
      setSessions(list);
      setGoals(goalList);
      setReadiness(ready);

      /*
       * 「前回の振り返り」は一覧の要約文字列だけでは足りない（決まったことが出せない）。
       * 直近1件だけ詳細を追加で取る。失敗しても一覧の要約で描けるので、
       * ここで画面全体をエラーにはしない。
       */
      const latest = list.past.find((s) => s.id !== list.next?.activeSessionId);
      if (!latest) {
        setLastDetail(null);
      } else {
        try {
          setLastDetail(await bffClient.getCoachingSession(latest.id));
        } catch {
          setLastDetail(null);
        }
      }
    } catch {
      showToast('コーチング情報を取得できませんでした', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, showToast]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    void reload();
  }, [userId, reload]);

  /** 一覧に出す過去のコーチング。進行中のものは「次回」側に出ているので除く */
  const pastSessions = useMemo(
    () => (sessions?.past ?? []).filter((s) => s.id !== sessions?.next?.activeSessionId),
    [sessions]
  );

  // --- 目標の編集 -------------------------------------------------------------
  //
  // 🔴 この編集UIはもともとマイページの「次回コーチングまでの目標」カードにあった。
  //    マイページ側に「編集」「続ける」「コーチング記録を取り込む」と入口が散らばっていて
  //    どれが何をするのか分からない、というレビュー指摘を受け、
  //    目標に対する操作はこのコーチングページに集約した。
  //    マイページのカードは表示専用で、「編集」「詳しく」ともにここへ飛ばす。
  //
  // 編集は「編集モードに入って、まとめて保存」。1文字ごとに保存すると
  // 打っている途中の文言が正になってしまうため。
  //
  // 🔴 削除は下書きの上で「削除予定」にするだけで、行は消さない（removed フラグ）。
  //    間違って × を押しても「戻す」で復活し、「編集をやめる」で丸ごと元に戻る。
  //    サーバーに渡すのは commitGoals で removed を落としたあとの配列だけ。
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState<GoalDraftRow[]>([]);
  const [savingGoals, setSavingGoals] = useState(false);

  const startGoalEdit = () => {
    setGoalDraft(
      goals.map((g) => ({
        no: g.no,
        description: g.description,
        is_completed: g.is_completed,
        progress: g.progress,
        removed: false,
        isNew: false,
      }))
    );
    setEditingGoals(true);
  };

  const cancelGoalEdit = () => {
    setEditingGoals(false);
    setGoalDraft([]);
  };

  const patchGoal = (index: number, next: Partial<CoachingGoalUpdateItem>) =>
    setGoalDraft((prev) => prev.map((g, i) => (i === index ? { ...g, ...next } : g)));

  /** 削除予定にする。実際に消えるのは保存したとき */
  const removeGoal = (index: number) =>
    setGoalDraft((prev) => prev.map((g, i) => (i === index ? { ...g, removed: true } : g)));

  const restoreGoal = (index: number) =>
    setGoalDraft((prev) => prev.map((g, i) => (i === index ? { ...g, removed: false } : g)));

  // 追加行は no を持たない（0）。保存時に表示順で振り直すため
  const addGoal = (description: string) =>
    setGoalDraft((prev) => [
      ...prev,
      { no: 0, description, is_completed: 0, progress: 0, removed: false, isNew: true },
    ]);

  /*
   * 表示モードでの完了トグルは即保存する。
   * 「終わった」を記録するたびに保存ボタンを押させるのは日々の操作として重すぎるため
   * （文言の書き換えだけは編集モードでまとめて保存する。上のコメント参照）。
   * 楽観更新して、失敗したら元に戻す。
   */
  const toggleGoalDone = async (no: number) => {
    if (!userId || editingGoals) return;
    const before = goals;
    const target = goals.find((g) => g.no === no);
    if (!target) return;

    const done = target.is_completed !== 1;
    const next = goals.map((g) =>
      g.no === no
        ? { ...g, is_completed: (done ? 1 : 0) as 0 | 1, progress: done ? 100 : Math.min(99, g.progress) }
        : g
    );
    setGoals(next);

    try {
      const saved = await bffClient.updateNextCoachingGoals(
        userId,
        next.map((g) => ({
          no: g.no,
          description: g.description,
          is_completed: g.is_completed,
          progress: g.progress,
        }))
      );
      setGoals(saved);
    } catch {
      setGoals(before);
      showToast('保存できませんでした', 'error');
    }
  };

  const commitGoals = async () => {
    if (!userId) return;
    const removedCount = goalDraft.filter((g) => g.removed).length;
    const cleaned = goalDraft
      .filter((g) => !g.removed)
      .map((g) => ({
        no: g.no,
        description: g.description.trim(),
        is_completed: g.is_completed,
        progress: g.progress,
      }))
      // 空行はカード側で保存を止めているが、念のため落とす
      .filter((g) => g.description.length > 0)
      // no は表示順そのもの。削除で歯抜けにならないよう毎回振り直す
      .map((g, i) => ({ ...g, no: i + 1 }));
    setSavingGoals(true);
    try {
      const saved = await bffClient.updateNextCoachingGoals(userId, cleaned);
      setGoals(saved);
      setEditingGoals(false);
      setGoalDraft([]);
      showToast(
        removedCount > 0 ? `変更を保存しました（${removedCount}件を削除）` : '変更を保存しました',
        'success'
      );
    } catch {
      // 下書きは残す。ここで編集モードを閉じると入力が消えてしまう
      showToast('目標を保存できませんでした', 'error');
    } finally {
      setSavingGoals(false);
    }
  };

  // --- 会議リンク -----------------------------------------------------------

  const registerLink = async (link: MeetingLink) => {
    if (!userId) return;
    await bffClient.registerMeetingLink(userId, link);
    await reload();
  };

  // --- 参加 -----------------------------------------------------------------

  /** 同意済みならそのまま開始、未同意なら先に同意モーダルを出す */
  const handleStart = () => {
    if (sessions?.consent?.agreed) void startSession();
    else setConsentModalOpen(true);
  };

  const startSession = async () => {
    if (!userId || starting) return;
    setStarting(true);
    try {
      const session = await bffClient.startCoachingSession(userId);
      setConsentModalOpen(false);
      // 会議は別タブで開く。LMS側は記録中の表示に切り替える
      if (session.meetingLink) {
        window.open(session.meetingLink.url, '_blank', 'noopener,noreferrer');
      }
      setMode({ kind: 'recording', session });
      await reload();
    } catch {
      showToast('コーチングを開始できませんでした', 'error');
    } finally {
      setStarting(false);
    }
  };

  const agreeAndStart = async () => {
    if (!userId) return;
    await bffClient.setCoachingConsent(userId);
    await startSession();
  };

  const finishSession = async () => {
    if (mode.kind !== 'recording' || finishing) return;
    setFinishing(true);
    try {
      const updated = await bffClient.finishCoachingSession(mode.session.id);
      // 自動取得できない状態だったときは failed で返る。嘘の「生成中」を見せない
      setMode(updated.status === 'failed' ? { kind: 'import', session: updated } : { kind: 'processing', session: updated });
      await reload();
    } catch {
      showToast('処理を開始できませんでした', 'error');
    } finally {
      setFinishing(false);
    }
  };

  // --- 手動取り込み（フォールバック） ---------------------------------------

  const submitImport = async (payload: ImportRecordPayload) => {
    if (mode.kind !== 'import') return;
    setImporting(true);
    try {
      const updated = await bffClient.importCoachingRecord(mode.session.id, payload);
      setMode(updated.status === 'failed' ? { kind: 'import', session: updated } : { kind: 'processing', session: updated });
      await reload();
    } catch {
      showToast('記録を取り込めませんでした', 'error');
    } finally {
      setImporting(false);
    }
  };

  // --- セッションを開く -----------------------------------------------------

  const openSession = async (sessionId: number) => {
    try {
      const detail = await bffClient.getCoachingSession(sessionId);
      if (detail.status === 'recording') setMode({ kind: 'recording', session: detail });
      else if (detail.status === 'failed' || detail.status === 'draft') setMode({ kind: 'import', session: detail });
      else if (['uploading', 'transcribing', 'summarizing'].includes(detail.status)) {
        setMode({ kind: 'processing', session: detail });
      } else setMode({ kind: 'review', session: detail });
    } catch {
      showToast('記録を開けませんでした', 'error');
    }
  };

  const backToList = () => {
    setMode({ kind: 'list' });
    void reload();
  };

  // --- 描画 -----------------------------------------------------------------

  const backLink = (
    <button
      type="button"
      onClick={backToList}
      style={{
        ...font.link,
        color: color.textMuted,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        alignSelf: 'flex-start',
      }}
    >
      ← コーチング一覧に戻る
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <AppHeader userName={user?.username} />

      <main
        className="wc-page"
        style={{
          '--wc-page-max': mode.kind === 'list' ? '1080px' : '860px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          fontFamily: font.family,
          color: C.ink,
        } as React.CSSProperties}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, color: C.ink }}>
            コーチング
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted }}>
            コーチと決めたことを実行に移し、積み上がった変化をふりかえる場所です。
          </p>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: C.muted, textAlign: 'center', padding: '48px 0' }}>読み込み中…</p>
        ) : mode.kind === 'list' ? (
          <>
            {/* 当日の入口（いつ・あと何日・参加・連絡手段）。ここだけ見れば
                コーチング当日に迷わない、が1Cのヒーローの役割。 */}
            {sessions?.next && (
              <CoachingHeroCard
                next={sessions.next}
                readiness={readiness}
                onRegisterLink={registerLink}
                onStart={handleStart}
                onOpenSession={openSession}
                starting={starting}
              />
            )}

            {/* 前回 → 次回まで の1本のタイムライン。
                「何を話したか」の直下に「だから次に何をするか」が来る並びにする。 */}
            <div className="cg-timeline">
              {pastSessions[0] && (
                <>
                  <TimelineNode label="前回" />
                  <LastSessionCard session={pastSessions[0]} detail={lastDetail} onOpen={openSession} />
                </>
              )}

              <TimelineNode label={'次回\nまで'} accent last />
              <NextActionsCard
                goals={goals}
                editing={editingGoals}
                draft={goalDraft}
                saving={savingGoals}
                onToggle={(no) => void toggleGoalDone(no)}
                onStartEdit={startGoalEdit}
                onCommit={() => void commitGoals()}
                onCancel={cancelGoalEdit}
                onPatch={patchGoal}
                onRemove={removeGoal}
                onRestore={restoreGoal}
                onAdd={addGoal}
              />
            </div>

            <CoachingHistoryList sessions={pastSessions} onOpen={openSession} />
          </>
        ) : mode.kind === 'recording' ? (
          <>
            {backLink}
            <RecordingStatus session={mode.session} onFinish={finishSession} finishing={finishing} />
          </>
        ) : mode.kind === 'processing' ? (
          <>
            {backLink}
            <ProcessingStatus
              session={mode.session}
              onDone={(session) => setMode({ kind: 'review', session })}
              onFallback={(session) => setMode({ kind: 'import', session })}
            />
          </>
        ) : mode.kind === 'import' ? (
          <>
            {backLink}
            <ImportRecordCard
              onSubmit={submitImport}
              onCancel={backToList}
              submitting={importing}
              reason={mode.session.error}
            />
          </>
        ) : (
          <>
            {backLink}
            <SessionReview
              session={mode.session}
              userId={userId}
              onReflected={(updated) => {
                setMode({ kind: 'review', session: updated });
                void reload();
              }}
              onDeleted={backToList}
            />
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: 12, color: C.faint, marginTop: 4 }}>© 2026 WEBCOACH Inc.</p>
      </main>

      {consentModalOpen && (
        <ConsentModal onAgree={agreeAndStart} onClose={() => setConsentModalOpen(false)} />
      )}
    </div>
  );
}
