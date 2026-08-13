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
import { color, font, radius, t } from '../theme/webcoachTheme';
import CoachingAgendaCard from './coaching/CoachingAgendaCard';
import CoachingSummaryStrip from './coaching/CoachingSummaryStrip';
import ConsentModal from './coaching/ConsentModal';
import ImportRecordCard from './coaching/ImportRecordCard';
import MeetingLinkModal from './coaching/MeetingLinkModal';
import NextCoachingCard from './coaching/NextCoachingCard';
import ProcessingStatus from './coaching/ProcessingStatus';
import RecordingStatus from './coaching/RecordingStatus';
import SessionReview from './coaching/SessionReview';
import { RECORDING_SOURCE_LABEL } from '../types/coaching';
import type {
  AutoImportReadiness,
  CoachingAgenda,
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

export default function CoachingNotesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.userid;

  const [sessions, setSessions] = useState<CoachingSessions | null>(null);
  const [goals, setGoals] = useState<CoachingGoalApi[]>([]);
  const [readiness, setReadiness] = useState<AutoImportReadiness | null>(null);
  const [agenda, setAgenda] = useState<CoachingAgenda | null>(null);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [importing, setImporting] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [list, goalList, ready, agendaData] = await Promise.all([
        bffClient.getCoachingSessions(userId),
        bffClient.getNextCoachingGoals(userId),
        bffClient.getAutoImportReadiness(userId),
        bffClient.getCoachingAgenda(userId),
      ]);
      setSessions(list);
      setGoals(goalList);
      setReadiness(ready);
      setAgenda(agendaData);
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

  const completedCount = useMemo(() => goals.filter((g) => g.is_completed === 1).length, [goals]);

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
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState<CoachingGoalUpdateItem[]>([]);
  const [savingGoals, setSavingGoals] = useState(false);

  const startGoalEdit = () => {
    setGoalDraft(
      goals.map((g) => ({
        no: g.no,
        description: g.description,
        is_completed: g.is_completed,
        progress: g.progress,
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

  /** 完了チェックは progress と連動させる（is_completed は progress>=100 の派生値） */
  const toggleGoalDone = (index: number, done: boolean) =>
    patchGoal(index, {
      is_completed: done ? 1 : 0,
      progress: done ? 100 : Math.min(99, goalDraft[index]?.progress ?? 0),
    });

  const removeGoal = (index: number) => setGoalDraft((prev) => prev.filter((_, i) => i !== index));

  const addGoal = () =>
    setGoalDraft((prev) => [
      ...prev,
      { no: prev.length + 1, description: '', is_completed: 0, progress: 0 },
    ]);

  const commitGoals = async () => {
    if (!userId) return;
    // 空行は保存しない（消したいときに空にする操作を許すため）
    const cleaned = goalDraft
      .map((g) => ({ ...g, description: g.description.trim() }))
      .filter((g) => g.description.length > 0)
      // no は表示順そのもの。削除で歯抜けにならないよう毎回振り直す
      .map((g, i) => ({ ...g, no: i + 1 }));
    setSavingGoals(true);
    try {
      const saved = await bffClient.updateNextCoachingGoals(userId, cleaned);
      setGoals(saved);
      setEditingGoals(false);
      setGoalDraft([]);
    } catch {
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

  const saveAgenda = async (text: string) => {
    if (!userId) return;
    setSavingAgenda(true);
    try {
      setAgenda(await bffClient.saveCoachingAgenda(userId, text));
      showToast('相談したいことを保存しました', 'success');
    } catch {
      showToast('保存できませんでした', 'error');
    } finally {
      setSavingAgenda(false);
    }
  };

  // --- 描画 -----------------------------------------------------------------

  const renderCurrentGoals = () => (
    <section id="goals" style={{ ...t.card, padding: 24, scrollMarginTop: 20, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>次回までのアクション</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {goals.length > 0 && !editingGoals && (
            <span style={{ ...font.link, color: color.primary }}>
              {completedCount} / {goals.length} 完了
            </span>
          )}
          {editingGoals ? (
            <>
              <button
                type="button"
                onClick={cancelGoalEdit}
                style={{ ...t.chip, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                やめる
              </button>
              <button
                type="button"
                onClick={commitGoals}
                disabled={savingGoals}
                style={{
                  ...t.chip,
                  border: 'none',
                  background: color.primary,
                  color: color.textOnPrimary,
                  padding: '7px 14px',
                  fontFamily: 'inherit',
                  cursor: savingGoals ? 'default' : 'pointer',
                  opacity: savingGoals ? 0.6 : 1,
                }}
              >
                {savingGoals ? '保存中…' : '保存する'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startGoalEdit}
              style={{ ...t.chip, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              編集
            </button>
          )}
        </div>
      </div>

      {editingGoals ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {goalDraft.map((g, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                border: `1px solid ${color.border}`,
                borderRadius: 14,
              }}
            >
              <input
                type="checkbox"
                checked={g.is_completed === 1}
                onChange={(e) => toggleGoalDone(i, e.target.checked)}
                aria-label="達成した"
                style={{ accentColor: color.primary, flexShrink: 0, width: 17, height: 17 }}
              />
              <input
                value={g.description}
                onChange={(e) => patchGoal(i, { description: e.target.value })}
                placeholder="例）バナーを1つ完成させる"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  color: color.textStrong,
                  background: 'transparent',
                  textDecoration: g.is_completed === 1 ? 'line-through' : 'none',
                }}
              />
              <button
                type="button"
                onClick={() => removeGoal(i)}
                aria-label="この目標を削除する"
                title="削除する"
                style={{
                  width: 30,
                  height: 30,
                  display: 'grid',
                  placeItems: 'center',
                  border: `1px solid ${color.borderSoft}`,
                  borderRadius: 9,
                  background: color.surface,
                  color: color.textMuted,
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addGoal}
            style={{
              border: `1px dashed ${color.primaryDashed}`,
              borderRadius: 14,
              padding: '11px 14px',
              background: color.surface,
              color: color.primary,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ＋ 目標を追加する
          </button>

          <p style={{ ...font.meta, color: color.textMuted, margin: '2px 0 0', lineHeight: 1.8 }}>
            コーチングで決めた目標は、コーチング記録を確定すると自動でここに入ります。
          </p>
        </div>
      ) : goals.length === 0 ? (
        <p style={{ ...font.meta, color: color.textSubtle, margin: '14px 0 0', lineHeight: 1.8 }}>
          まだアクションがありません。コーチングが終わると、AIが目標とタスクを整理します。
          いま決めたいことがあれば「編集」から自分でも書けます。
        </p>
      ) : (
        /* 1行1アクション。行そのものをカード状にして、達成済みが一目で分かるようにする。
           以前は素のリストで、達成/未達成の差がチェック丸の塗りだけだった。 */
        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {goals.map((goal) => {
            const done = goal.is_completed === 1;
            return (
              <li
                key={goal.no}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 13,
                  padding: '14px 16px',
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  background: done ? color.pageBg : color.surface,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    flex: '0 0 22px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 900,
                    color: '#fff',
                    background: done ? color.primary : 'transparent',
                    border: done ? 'none' : `2px solid ${color.borderNeutral}`,
                    boxSizing: 'border-box',
                  }}
                >
                  {done ? '✓' : ''}
                </span>
                <span
                  style={{
                    ...font.listItem,
                    flex: 1,
                    minWidth: 0,
                    color: done ? color.textSubtle : color.textStrong,
                    textDecoration: done ? 'line-through' : 'none',
                    lineHeight: 1.6,
                  }}
                >
                  {goal.description}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  /**
   * これまでのコーチング。
   *
   * 見出しを「成長の記録」に変えたのは言い換えではなく役割の変更。
   * 「このページって何をするためにあるのか伝わらない」という指摘の芯は、
   * 過去のコーチングが“ログ”として並んでいるだけで、
   * 自分が何を積み上げてきたかが読み取れないことだった。
   * 空のときも「まだ記録がありません」で終わらせず、次の行動を書く。
   */
  const renderHistory = () => {
    const past = (sessions?.past ?? []).filter((s) => s.id !== sessions?.next?.activeSessionId);
    return (
      <section style={{ ...t.card, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>成長の記録</h2>
          {past.length > 0 && (
            <span style={{ ...font.caption, color: color.textSubtle }}>{past.length}回のコーチング</span>
          )}
        </div>

        {past.length === 0 ? (
          <p style={{ ...font.meta, color: color.textMuted, margin: 0, lineHeight: 1.9 }}>
            まだ記録がありません。
            <br />
            初回のコーチングが終わると、話した内容と決めたことがここに残り、
            回を重ねるほど自分の変化を辿れるようになります。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {past.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openSession(s.id)}
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '16px 18px',
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  background: color.surface,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  width: '100%',
                }}
              >
                {/* 回数と日付を左に固定。何回目かが縦に揃うと積み上げが見える */}
                <span style={{ flex: '0 0 96px', minWidth: 0 }}>
                  <span style={{ display: 'block', ...font.rowTitle, color: color.text }}>{s.title}</span>
                  <span style={{ display: 'block', ...font.caption, color: color.textSubtle, marginTop: 3 }}>
                    {s.date}
                  </span>
                </span>

                <span style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '0 0 auto' }}>
                  {s.importedFrom === 'auto' && (
                    <span style={{ ...t.chip, background: '#EEF3FB', color: '#3A5C8F', textAlign: 'center' }}>自動取得</span>
                  )}
                  {s.importedFrom === 'manual' && s.source && (
                    <span style={{ ...t.chip, background: color.pageBg, color: color.textMuted, textAlign: 'center' }}>
                      {RECORDING_SOURCE_LABEL[s.source]}
                    </span>
                  )}
                  {s.tasksCreated ? (
                    <span style={{ ...t.chip, background: '#E4F3EC', color: '#2F7F5B', textAlign: 'center' }}>確定済み</span>
                  ) : s.status === 'review_required' ? (
                    <span style={{ ...t.chip, textAlign: 'center' }}>確認待ち</span>
                  ) : null}
                </span>

                <span
                  style={{
                    ...font.meta,
                    flex: 1,
                    minWidth: 0,
                    color: color.textMuted,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.8,
                  }}
                >
                  {s.summary}
                </span>

                <span style={{ ...font.link, color: color.primary, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  詳細を表示 ›
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  };

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
    <div style={{ minHeight: '100vh', background: color.pageBg, display: 'flex', flexDirection: 'column' }}>
      <AppHeader userName={user?.username} />

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: mode.kind === 'list' ? 1080 : 860,
          margin: '0 auto',
          padding: '32px 20px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          fontFamily: font.family,
        }}
      >
        <div>
          <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>コーチング</h1>
          <p style={{ ...font.meta, color: color.textMuted, margin: '6px 0 0', lineHeight: 1.8 }}>
            コーチと決めたことを実行に移し、積み上がった変化をふりかえる場所です。
          </p>
        </div>

        {loading ? (
          <p style={{ ...font.meta, color: color.textMuted, textAlign: 'center', padding: '48px 0' }}>読み込み中…</p>
        ) : mode.kind === 'list' ? (
          <>
            {/* 先頭で「次はいつ・あと何日・いまどこまで」に答える。
                このページに来た人が最初に知りたいのは操作方法ではなく自分の現在地。 */}
            <CoachingSummaryStrip
              next={sessions?.next ?? null}
              doneCount={completedCount}
              totalCount={goals.length}
            />

            {/* 左＝やること、右＝当日の入口。以前は縦一列で、
                「次に何をすればいいか」と「参加の準備」が離れて見えていた。 */}
            <div className="coaching-2col">
              {renderCurrentGoals()}
              {sessions?.next && (
                <NextCoachingCard
                  next={sessions.next}
                  readiness={readiness}
                  onRegisterLink={() => setLinkModalOpen(true)}
                  onChangeLink={() => setLinkModalOpen(true)}
                  onStart={handleStart}
                  onOpenSession={openSession}
                  starting={starting}
                />
              )}
            </div>

            <CoachingAgendaCard agenda={agenda} saving={savingAgenda} onSave={saveAgenda} />
            {renderHistory()}
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

        <p style={{ ...font.caption, color: color.textFaint, textAlign: 'center', marginTop: 24 }}>2026 © WEBCOACH</p>
      </main>

      {linkModalOpen && sessions?.next && (
        <MeetingLinkModal
          coachName={sessions.next.coach}
          currentLink={sessions.next.meetingLink}
          readiness={readiness}
          onRegister={registerLink}
          onClose={() => setLinkModalOpen(false)}
        />
      )}

      {consentModalOpen && (
        <ConsentModal onAgree={agreeAndStart} onClose={() => setConsentModalOpen(false)} />
      )}
    </div>
  );
}
