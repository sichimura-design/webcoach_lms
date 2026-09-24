/**
 * コーチング画面（受講生側）。
 *
 * デザインは dev/miyabe の『コーチング トップ 3案.dc.html』案1C（CoachingHeroCard /
 * NextGoalsCard / LastSessionCard / タイムライン）に揃えている。
 *
 * dev/miyabeとの違い: あちらは受講生が会議リンクを貼って参加する招待URL方式・
 * LMS内録画の設計だったが、今の実装はOrganizer中心モデル（会社共有のGoogle
 * Workspaceアカウントが予約作成時にMeeting Spaceを自動発行し、コーチが共同主催者
 * として参加、終了後にAIノートを自動生成）に置き換わっている。そのため
 * 「会議リンクを登録する」操作は不要（常に既に発行済み）で、記録中/生成中/
 * 失敗といったLMS内録画の状態遷移も存在しない。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import bffClient from '../services/bffClient';
import { CoachingSchedule, CoachingNote } from '../types/api';
import { color, font, t } from '../theme/webcoachTheme';
import CoachingHeroCard from './coaching/CoachingHeroCard';
import LastSessionCard from './coaching/LastSessionCard';
import NextGoalsCard, { type GoalDraftRow } from './coaching/NextGoalsCard';
import { C } from './coaching/design1c';
import type { CoachingGoalUpdateItem } from '../types/mypage';
import { toSessionDetail, toSessionSummary } from '../utils/coachingScheduleAdapter';

const NOTE_FIELD_LABELS: { key: keyof CoachingNote; label: string }[] = [
  { key: 'session_summary', label: 'セッション概要' },
  { key: 'client_status_and_goal', label: '現状と目標' },
  { key: 'main_issues', label: '主な課題' },
  { key: 'coach_feedback', label: 'コーチからのフィードバック' },
  { key: 'decisions', label: '今回決めたこと' },
  { key: 'client_next_actions', label: '次回までのアクション' },
  { key: 'coach_follow_up', label: 'コーチからのフォロー' },
  { key: 'next_session_check', label: '次回確認すること' },
];

/** タイムライン左端のノード（丸＋下に伸びる縦線）。dev/miyabe版と同一 */
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

export function MyCoachingPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const userId = user?.userid;

  const [schedules, setSchedules] = useState<CoachingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, CoachingNote | null>>({});
  // /study-log のコーチング記録から ?schedule=<id> 付きで飛んでくる。その回を開いた状態で見せる
  const [searchParams] = useSearchParams();
  const linkedScheduleId = Number(searchParams.get('schedule')) || null;

  const reload = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    bffClient.getCoachingSchedules(userId)
      .then(setSchedules)
      .catch(() => setError('コーチング記録の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  const loadNote = useCallback((scheduleId: number) => {
    if (notes[scheduleId] !== undefined) return;
    bffClient.getCoachingNote(scheduleId)
      .then(n => setNotes(prev => ({ ...prev, [scheduleId]: n })))
      .catch(() => setNotes(prev => ({ ...prev, [scheduleId]: null })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  /** 今日以降の日付を持つ最も近い予約。無ければヒーローカードは出さない */
  const nextSchedule = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = schedules.filter(s => s.coaching_date >= today);
    return upcoming.length > 0 ? upcoming[upcoming.length - 1] : null;
  }, [schedules]);

  /** 直近の過去セッション（「前回の振り返り」用）。次回として出す回は除く */
  const lastSchedule = useMemo(
    () => schedules.find(s => s.id !== nextSchedule?.id) ?? null,
    [schedules, nextSchedule]
  );

  useEffect(() => {
    if (lastSchedule) loadNote(lastSchedule.id);
  }, [lastSchedule, loadNote]);

  useEffect(() => {
    if (!linkedScheduleId || !schedules.some(s => s.id === linkedScheduleId)) return;
    setOpenId(linkedScheduleId);
    loadNote(linkedScheduleId);
    document.getElementById(`coaching-schedule-${linkedScheduleId}`)?.scrollIntoView({ block: 'start' });
    // loadNote は notes が変わるたびに作り直されるので deps に入れると開き直しが繰り返される
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedScheduleId, schedules]);

  // --- 次回コーチングまでの目標 ---------------------------------------------

  const [goals, setGoals] = useState<import('../types/mypage').CoachingGoalApi[]>([]);
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState<GoalDraftRow[]>([]);
  const [savingGoals, setSavingGoals] = useState(false);

  useEffect(() => {
    if (!userId) return;
    bffClient.getNextCoachingGoals(userId).then(setGoals).catch(() => {});
  }, [userId]);

  const startGoalEdit = () => {
    setGoalDraft(goals.map(g => ({
      no: g.no, description: g.description, is_completed: g.is_completed, progress: g.progress,
      removed: false, isNew: false,
    })));
    setEditingGoals(true);
  };

  const cancelGoalEdit = () => { setEditingGoals(false); setGoalDraft([]); };

  const patchGoal = (index: number, next: Partial<CoachingGoalUpdateItem>) =>
    setGoalDraft(prev => prev.map((g, i) => (i === index ? { ...g, ...next } : g)));

  const removeGoal = (index: number) =>
    setGoalDraft(prev => prev.map((g, i) => (i === index ? { ...g, removed: true } : g)));

  const restoreGoal = (index: number) =>
    setGoalDraft(prev => prev.map((g, i) => (i === index ? { ...g, removed: false } : g)));

  const addGoal = (description: string) =>
    setGoalDraft(prev => [...prev, { no: 0, description, is_completed: 0, progress: 0, removed: false, isNew: true }]);

  const moveGoal = (index: number, to: number) =>
    setGoalDraft(prev => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const toggleGoalDone = async (no: number) => {
    if (!userId || editingGoals) return;
    const before = goals;
    const target = goals.find(g => g.no === no);
    if (!target) return;
    const done = target.is_completed !== 1;
    const next = goals.map(g => (g.no === no
      ? { ...g, is_completed: (done ? 1 : 0) as 0 | 1, progress: done ? 100 : Math.min(99, g.progress) }
      : g));
    setGoals(next);
    try {
      const saved = await bffClient.updateNextCoachingGoals(
        userId,
        next.map(g => ({ no: g.no, description: g.description, is_completed: g.is_completed, progress: g.progress }))
      );
      setGoals(saved);
    } catch {
      setGoals(before);
      showToast('保存できませんでした', 'error');
    }
  };

  const commitGoals = async () => {
    if (!userId) return;
    const removedCount = goalDraft.filter(g => g.removed).length;
    const cleaned = goalDraft
      .filter(g => !g.removed)
      .map(g => ({ no: g.no, description: g.description.trim(), is_completed: g.is_completed, progress: g.progress }))
      .filter(g => g.description.length > 0)
      .map((g, i) => ({ ...g, no: i + 1 }));
    setSavingGoals(true);
    try {
      const saved = await bffClient.updateNextCoachingGoals(userId, cleaned);
      setGoals(saved);
      setEditingGoals(false);
      setGoalDraft([]);
      showToast(removedCount > 0 ? `変更を保存しました（${removedCount}件を削除）` : '変更を保存しました', 'success');
    } catch {
      showToast('目標を保存できませんでした', 'error');
    } finally {
      setSavingGoals(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: color.pageBg, display: 'flex', flexDirection: 'column' }}>
      <AppHeader userName={user?.username} />

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 1080,
          margin: '0 auto',
          padding: '32px 20px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          fontFamily: font.family,
        }}
      >
        <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>コーチング</h1>

        {error && (
          <div style={{ ...t.chip, background: '#FDEAE6', color: color.primary, padding: '10px 14px', borderRadius: 12 }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ ...font.meta, color: color.textMuted, textAlign: 'center', padding: '48px 0' }}>読み込み中…</p>
        ) : (
          <>
            {nextSchedule && (
              <CoachingHeroCard
                coachName=""
                dateLabel={nextSchedule.coaching_date}
                startsAt={nextSchedule.coaching_date}
                meetingUrl={nextSchedule.meeting_url}
              />
            )}

            {(lastSchedule || goals.length > 0 || nextSchedule) && (
              <div className="cg-timeline">
                {lastSchedule && (
                  <>
                    <TimelineNode label="前回" />
                    <LastSessionCard
                      session={toSessionSummary(lastSchedule)}
                      detail={toSessionDetail(lastSchedule, notes[lastSchedule.id] ?? null)}
                      onOpen={(id) => setOpenId(id)}
                    />
                  </>
                )}

                <TimelineNode label={'次回\nまで'} accent last />
                <NextGoalsCard
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
                  onMove={moveGoal}
                />
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: '8px 0 0' }}>これまでのコーチング</h2>
          {!loading && schedules.length === 0 ? (
            <p style={{ ...font.meta, color: color.textSubtle, textAlign: 'center', padding: '48px 0' }}>
              まだ記録がありません。
            </p>
          ) : (
            schedules.map(schedule => {
              const isOpen = openId === schedule.id;
              const note = notes[schedule.id];
              return (
                <div key={schedule.id} id={`coaching-schedule-${schedule.id}`} style={{ ...t.card, padding: '16px 18px', scrollMarginTop: 80 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = isOpen ? null : schedule.id;
                      setOpenId(next);
                      if (next !== null) loadNote(next);
                    }}
                    style={{
                      textAlign: 'left', width: '100%', background: 'none', border: 'none', padding: 0,
                      cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
                      alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ ...font.rowTitle, color: color.text }}>第{schedule.coaching_no}回</span>
                        <span style={{ ...font.caption, color: color.textSubtle, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar className="w-3.5 h-3.5" />
                          {schedule.coaching_date}
                        </span>
                      </span>
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: color.textFaint }} />
                    ) : (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: color.textFaint }} />
                    )}
                  </button>

                  {isOpen && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color.divider}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {schedule.meeting_url && (
                        <a
                          href={schedule.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...font.link, color: '#3A5C8F', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {schedule.meeting_url}
                        </a>
                      )}
                      {note && (
                        <div style={{ borderTop: `1px solid ${color.divider}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <p style={{ ...font.rowTitle, color: color.text, margin: 0 }}>AIコーチングノート</p>
                          {NOTE_FIELD_LABELS.map(({ key, label }) => (
                            note[key] ? (
                              <div key={key}>
                                <p style={{ ...font.label, color: color.textSubtle, margin: '0 0 4px' }}>{label}</p>
                                <p style={{ ...font.meta, color: color.textBody, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                                  {note[key] as string}
                                </p>
                              </div>
                            ) : null
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
