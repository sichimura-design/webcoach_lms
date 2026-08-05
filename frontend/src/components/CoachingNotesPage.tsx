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
import { color, font, t } from '../theme/webcoachTheme';
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
  CoachingSessionDetail,
  CoachingSessions,
  ImportRecordPayload,
  MeetingLink,
} from '../types/coaching';
import type { CoachingGoalApi } from '../types/mypage';

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
      const [list, goalList, ready] = await Promise.all([
        bffClient.getCoachingSessions(userId),
        bffClient.getNextCoachingGoals(userId),
        bffClient.getAutoImportReadiness(userId),
      ]);
      setSessions(list);
      setGoals(goalList);
      setReadiness(ready);
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

  const renderCurrentGoals = () => (
    <section style={{ ...t.card, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>次回までの目標</h2>
        {goals.length > 0 && (
          <span style={{ ...font.link, color: color.primary }}>
            {completedCount} / {goals.length} 完了
          </span>
        )}
      </div>
      {goals.length === 0 ? (
        <p style={{ ...font.meta, color: color.textSubtle, margin: '14px 0 0', lineHeight: 1.8 }}>
          まだ目標がありません。コーチングが終わると、AIが目標とタスクを整理します。
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {goals.map((goal) => (
            <li key={goal.no} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  flex: '0 0 20px',
                  marginTop: 1,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#fff',
                  background: goal.is_completed === 1 ? color.primary : 'transparent',
                  border: goal.is_completed === 1 ? 'none' : `2px solid ${color.borderNeutral}`,
                  boxSizing: 'border-box',
                }}
              >
                {goal.is_completed === 1 ? '✓' : ''}
              </span>
              <span
                style={{
                  ...font.listItem,
                  color: goal.is_completed === 1 ? color.textSubtle : color.textStrong,
                  textDecoration: goal.is_completed === 1 ? 'line-through' : 'none',
                  lineHeight: 1.6,
                }}
              >
                {goal.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const renderHistory = () => {
    const past = (sessions?.past ?? []).filter((s) => s.id !== sessions?.next?.activeSessionId);
    return (
      <section>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 12px' }}>これまでのコーチング</h2>
        {past.length === 0 ? (
          <p style={{ ...font.meta, color: color.textSubtle, margin: 0 }}>まだ記録がありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {past.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openSession(s.id)}
                style={{
                  ...t.card,
                  padding: '16px 18px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'block',
                  width: '100%',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ ...font.rowTitle, color: color.text }}>{s.title}</span>
                  <span style={{ ...font.caption, color: color.textSubtle }}>{s.date}</span>
                  {s.importedFrom === 'auto' && (
                    <span style={{ ...t.chip, background: '#EEF3FB', color: '#3A5C8F' }}>自動取得</span>
                  )}
                  {s.importedFrom === 'manual' && s.source && (
                    <span style={{ ...t.chip, background: color.pageBg, color: color.textMuted }}>
                      {RECORDING_SOURCE_LABEL[s.source]}
                    </span>
                  )}
                  {s.tasksCreated ? (
                    <span style={{ ...t.chip, background: '#E4F3EC', color: '#2F7F5B' }}>確定済み</span>
                  ) : s.status === 'review_required' ? (
                    <span style={t.chip}>確認待ち</span>
                  ) : null}
                </span>
                <span
                  style={{
                    ...font.meta,
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
          maxWidth: 860,
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
            コーチから届いた会議リンクを登録すると、LMSから参加できます。終了後はAIが内容を整理します。
          </p>
        </div>

        {loading ? (
          <p style={{ ...font.meta, color: color.textMuted, textAlign: 'center', padding: '48px 0' }}>読み込み中…</p>
        ) : mode.kind === 'list' ? (
          <>
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
            {renderCurrentGoals()}
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
