import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Plus, ExternalLink, Trash2, Pencil, Sparkles, ChevronDown, ChevronUp, Video, CalendarX } from 'lucide-react';
import { AppHeader, ConfirmDialog } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import bffClient from '../../services/bffClient';
import { CoachingSchedule, CoachingScheduleStatus, CoachingNote, CoachingNoteStatus, UpdateCoachingNoteRequest } from '../../types/api';
import { color, font, t } from '../../theme/webcoachTheme';
import { toLocalDateKey } from '../../utils/studyStats';
import { getUserMessage } from '../../utils/errorMessage';

type NoteState = CoachingNote | 'none' | 'forbidden' | 'error';
const isNote = (v: NoteState | undefined): v is CoachingNote => typeof v === 'object' && v !== null;

const NOTE_FIELD_LABELS: { key: keyof UpdateCoachingNoteRequest; label: string }[] = [
  { key: 'session_summary', label: 'セッション概要' },
  { key: 'client_status_and_goal', label: '受講生の現状と目標' },
  { key: 'main_issues', label: '主な課題' },
  { key: 'coach_feedback', label: 'コーチからのフィードバック' },
  { key: 'decisions', label: '今回決めたこと' },
  { key: 'client_next_actions', label: '受講生の次回までの目標' },
  { key: 'coach_follow_up', label: 'コーチ側のフォロー事項' },
  { key: 'next_session_check', label: '次回確認すること' },
];

function estimateNoteTextareaRows(text: string): number {
  if (!text) return 2;
  const lines = text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 45)), 0);
  return Math.max(2, Math.min(14, lines));
}

const NOTE_STATUS_LABEL: Record<CoachingNoteStatus, string> = {
  ai_suggested: 'AI下書き',
  coach_confirmed: '確認済み（未公開）',
  published: '公開済み',
};

const NOTE_STATUS_STYLE: Record<CoachingNoteStatus, React.CSSProperties> = {
  ai_suggested: { background: '#F1EFEA', color: color.textMuted },
  coach_confirmed: { background: '#E8F0FC', color: '#3A5C8F' },
  published: { background: '#E6F4EA', color: '#1E7A34' },
};

interface Student {
  id: number;
  username: string;
  fullname: string;
}

interface ScheduleFormState {
  coaching_date: string;
  status: CoachingScheduleStatus | '';
  meeting_url: string;
  meeting_provider: 'google_meet' | '';
}

/**
 * 回数の前後と実施日の前後が逆転しないかを見る（同日は可）。api-serverの
 * find_coaching_order_violation と同じ判定。同じコーチの回だけを比べ、リスケで流れた回は対象外。
 * target.coaching_no が null なら新規（既存の全回より後ろの回）として扱う。
 */
function findOrderViolation(
  schedules: CoachingSchedule[],
  target: { id: number | null; coach_user_id: number; coaching_no: number | null; coaching_date: string },
): string | null {
  const others = schedules
    .filter(s => s.id !== target.id && s.coach_user_id === target.coach_user_id && s.status !== 'rescheduled')
    .sort((a, b) => a.coaching_no - b.coaching_no);
  for (const other of others) {
    const earlier = target.coaching_no === null || other.coaching_no < target.coaching_no;
    if (earlier && other.coaching_date > target.coaching_date) {
      return `第${other.coaching_no}回（${other.coaching_date}）より前の日付は指定できません`;
    }
    if (!earlier && target.coaching_no !== null && other.coaching_no > target.coaching_no
      && other.coaching_date < target.coaching_date) {
      return `第${other.coaching_no}回（${other.coaching_date}）より後の日付は指定できません`;
    }
  }
  return null;
}

/** 400（入力の問題）はサーバーの理由をそのまま出し、それ以外は定型文にする */
function errorMessageFor(err: unknown, fallback: string): string {
  const isBadRequest = (err as { response?: { status?: number } })?.response?.status === 400;
  return isBadRequest ? getUserMessage(err, fallback) : fallback;
}

/** 新規登録フォームの初期値。実施日は開いた日（ローカル日付）にする */
const newEmptyForm = (): ScheduleFormState => ({
  coaching_date: toLocalDateKey(new Date()),
  status: '',
  // 新規作成時は常にGoogle Meetを自動発行する前提(コーチが手動でURLを貼る経路は
  // 廃止した)。文字起こし自動取り込み(TranscriptSyncService)がGoogle Meet
  // Organizer発行のスケジュールしか対象にできないため、これを徹底しないと
  // AIコーチングノートが一部の回だけ生成されない不整合が生じる。
  meeting_provider: 'google_meet',
  meeting_url: '',
});

const SCHEDULE_STATUS_LABEL: Record<CoachingScheduleStatus, string> = {
  completed: '終了',
  interrupted: '中断',
  rescheduled: 'リスケ',
};

/** 実施した回に付ける結果。リスケは実施前に「リスケにする」から付けるので、ここには出さない */
type HeldResult = 'completed' | 'interrupted';

/**
 * 実施結果は「いつ決まるか」で入口を分けている。
 * - リスケ: 実施前に決まる → これからの回の「リスケにする」
 * - 終了・中断: 実施後に決まる → AIコーチングノートを直して公開するところで一緒に選ぶ
 * 🔴 以前は「編集」の中のセレクトで全部選ばせていたが、ノートを公開したあとに
 *    わざわざ編集を開き直す手順になっていて、記録されないことが多かった。
 */
const isUpcoming = (s: CoachingSchedule, today: string) => s.status === null && s.coaching_date >= today;
const isHeld = (s: CoachingSchedule, today: string) =>
  s.status === 'completed' || s.status === 'interrupted' || (s.status === null && s.coaching_date <= today);

const smallPrimaryButton: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: color.primary,
  color: color.textOnPrimary,
  border: 'none',
  borderRadius: t.chip.borderRadius,
  padding: '10px 18px',
  fontFamily: 'inherit',
  ...font.buttonSm,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const ghostSmallButton: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: color.surface,
  border: `1px solid ${color.borderSoft}`,
  borderRadius: t.chip.borderRadius,
  padding: '10px 18px',
  fontFamily: 'inherit',
  ...font.buttonSm,
  color: color.textStrong,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${color.border}`,
  borderRadius: 12,
  padding: '9px 12px',
  fontFamily: 'inherit',
  ...font.listItem,
  color: color.textBody,
  outline: 'none',
  background: color.surface,
};

interface CoachingSchedulePageProps {
  studentId: number;
}

export function CoachingSchedulePage({ studentId }: CoachingSchedulePageProps) {
  const { user } = useAuth();
  const [studentName, setStudentName] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<CoachingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<ScheduleFormState>(newEmptyForm);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ScheduleFormState>(newEmptyForm);

  const [noteOpenId, setNoteOpenId] = useState<number | null>(null);
  // 'none' … まだ作られていない（404）／'forbidden' … 担当ではない（403。コーチ交代で外れた旧コーチ）
  // 'error' … それ以外の失敗。開き直すと取り直す（M-5。以前はどの失敗も 'none' 扱いで
  // 「まだ作られていません」と出て、担当外のコーチにも保存ボタンが出ていた）
  const [notes, setNotes] = useState<Record<number, NoteState>>({});
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteForm, setNoteForm] = useState<UpdateCoachingNoteRequest>({});
  const [noteSaving, setNoteSaving] = useState(false);
  const [resultDraft, setResultDraft] = useState<Record<number, HeldResult>>({});

  const [rescheduleTarget, setRescheduleTarget] = useState<CoachingSchedule | null>(null);
  const [rescheduleMode, setRescheduleMode] = useState<'date' | 'later'>('date');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoachingSchedule | null>(null);

  const today = toLocalDateKey(new Date());
  /** 未記録の回は「終了」を選んだ状態で出す。ほとんどの回は終了なので、迷わず公開できるように */
  const resultOf = (s: CoachingSchedule): HeldResult =>
    resultDraft[s.id] ?? (s.status === 'interrupted' ? 'interrupted' : 'completed');

  const loadSchedules = () => {
    setLoading(true);
    bffClient.getCoachingSchedules(studentId)
      .then(setSchedules)
      .catch(() => setError('コーチングの予定の取得に失敗しました'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSchedules();
    bffClient.getStudents()
      .then(data => {
        const found = data.students.find((s: Student) => s.id === studentId);
        if (found) setStudentName(found.fullname);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleCreate = async () => {
    if (!user || saving) return;
    // 過去日の新規登録は不可（BFF・api-serverでも同じチェックをしている）
    if (!addForm.coaching_date || addForm.coaching_date < toLocalDateKey(new Date())) {
      setError('実施日には今日以降の日付を指定してください');
      return;
    }
    const createViolation = findOrderViolation(schedules, {
      id: null, coach_user_id: user.userid, coaching_no: null, coaching_date: addForm.coaching_date,
    });
    if (createViolation) {
      setError(createViolation);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await bffClient.createCoachingSchedule(studentId, {
        coach_user_id: user.userid,
        coaching_date: addForm.coaching_date,
        meeting_url: addForm.meeting_provider === 'google_meet' ? '' : addForm.meeting_url,
        meeting_provider: addForm.meeting_provider || null,
      });
      setAddForm(newEmptyForm());
      setShowAddForm(false);
      loadSchedules();
    } catch (err) {
      setError(errorMessageFor(err, 'コーチングの予定の作成に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (schedule: CoachingSchedule) => {
    setEditingId(schedule.id);
    setEditForm({
      coaching_date: schedule.coaching_date,
      status: schedule.status || '',
      meeting_url: schedule.meeting_url,
      meeting_provider: schedule.meeting_provider || '',
    });
  };

  const handleUpdate = async (id: number) => {
    if (saving) return;
    // 日付を動かすときだけ前後の回との順序を見る（リスケの回は日付が前にずれうるので対象外）
    const current = schedules.find(s => s.id === id);
    if (current && editForm.coaching_date !== current.coaching_date
      && current.status !== 'rescheduled') {
      const updateViolation = findOrderViolation(schedules, {
        id, coach_user_id: current.coach_user_id, coaching_no: current.coaching_no,
        coaching_date: editForm.coaching_date,
      });
      if (updateViolation) {
        setError(updateViolation);
        return;
      }
    }
    setError(null);
    setSaving(true);
    try {
      await bffClient.updateCoachingSchedule(studentId, id, {
        coaching_date: editForm.coaching_date,
        meeting_url: editForm.meeting_url,
      });
      setEditingId(null);
      loadSchedules();
    } catch (err) {
      setError(errorMessageFor(err, 'コーチングの予定の更新に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  const toggleNote = async (scheduleId: number) => {
    if (noteOpenId === scheduleId) {
      setNoteOpenId(null);
      return;
    }
    setNoteOpenId(scheduleId);
    const existing = notes[scheduleId];
    if (existing && existing !== 'error') {
      setNoteForm(isNote(existing) ? { ...existing } : {});
      return;
    }
    await loadNote(scheduleId);
  };

  const loadNote = async (scheduleId: number) => {
    setNoteLoading(true);
    try {
      const note = await bffClient.getCoachingNote(scheduleId);
      setNotes(prev => ({ ...prev, [scheduleId]: note }));
      setNoteForm({ ...note });
    } catch (err: any) {
      const status = err?.response?.status;
      const state: NoteState = status === 404 ? 'none' : status === 403 ? 'forbidden' : 'error';
      setNotes(prev => ({ ...prev, [scheduleId]: state }));
      setNoteForm({});
    } finally {
      setNoteLoading(false);
    }
  };

  /** 選んでいる実施結果を保存する。すでに同じなら何もしない */
  const saveResult = async (schedule: CoachingSchedule) => {
    const result = resultOf(schedule);
    if (schedule.status === result) return;
    const updated = await bffClient.updateCoachingSchedule(studentId, schedule.id, { status: result });
    setSchedules(prev => prev.map(s => (s.id === schedule.id ? { ...s, ...updated, status: result } : s)));
  };

  /** ノートの保存（下書き／公開）と実施結果の保存を一度に行う */
  const handleSaveNote = async (schedule: CoachingSchedule, status?: CoachingNoteStatus) => {
    if (noteSaving) return;
    setNoteSaving(true);
    setError(null);
    try {
      const updated = await bffClient.updateCoachingNote(schedule.id, {
        ...noteForm,
        ...(status ? { status } : {}),
      });
      setNotes(prev => ({ ...prev, [schedule.id]: updated }));
      setNoteForm({ ...updated });
    } catch {
      setError('コーチング記録の保存に失敗しました');
      setNoteSaving(false);
      return;
    }
    try {
      await saveResult(schedule);
    } catch {
      setError('コーチング記録は保存しましたが、実施結果の保存に失敗しました。もう一度お試しください');
    } finally {
      setNoteSaving(false);
    }
  };

  /** AIノートが届かなかった回でも、実施結果だけは残せるようにする */
  const handleSaveResultOnly = async (schedule: CoachingSchedule) => {
    if (noteSaving) return;
    setNoteSaving(true);
    setError(null);
    try {
      await saveResult(schedule);
    } catch {
      setError('実施結果の保存に失敗しました');
    } finally {
      setNoteSaving(false);
    }
  };

  const openReschedule = (schedule: CoachingSchedule) => {
    setRescheduleTarget(schedule);
    setRescheduleMode('date');
    setRescheduleDate('');
    setRescheduleError(null);
  };

  /**
   * リスケ = 元の回を「リスケ」にして、振替日があれば新しい回として登録する。
   * 🔴 振替日の検証は元の回をリスケ扱いにした一覧で行う（リスケの回は前後の比較から外れるため）。
   *    先に検証してから書き込むので、日付の誤りで「リスケだけされて振替が無い」状態にはならない。
   * 🔴 リスケは取り消せない（api-server は status を null に戻せない）ので、必ず確認を挟む。
   */
  const handleReschedule = async () => {
    const target = rescheduleTarget;
    if (!target || !user || saving) return;
    const withDate = rescheduleMode === 'date';
    if (withDate) {
      if (!rescheduleDate || rescheduleDate < today) {
        setRescheduleError('振替日には今日以降の日付を選んでください');
        return;
      }
      const violation = findOrderViolation(
        schedules.map(s => (s.id === target.id ? { ...s, status: 'rescheduled' as const } : s)),
        { id: null, coach_user_id: user.userid, coaching_no: null, coaching_date: rescheduleDate },
      );
      if (violation) {
        setRescheduleError(violation);
        return;
      }
    }
    setSaving(true);
    setRescheduleError(null);
    try {
      await bffClient.updateCoachingSchedule(studentId, target.id, { status: 'rescheduled' });
    } catch (err) {
      setRescheduleError(errorMessageFor(err, 'リスケにできませんでした。もう一度お試しください'));
      setSaving(false);
      return;
    }
    try {
      if (withDate) {
        await bffClient.createCoachingSchedule(studentId, {
          coach_user_id: user.userid,
          coaching_date: rescheduleDate,
          meeting_url: '',
          meeting_provider: 'google_meet',
        });
      }
      setRescheduleTarget(null);
    } catch (err) {
      setRescheduleTarget(null);
      setError(errorMessageFor(err, 'リスケにしましたが、振替日の登録に失敗しました。「コーチングを追加」から登録してください'));
    } finally {
      setSaving(false);
      loadSchedules();
    }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    if (!target || saving) return;
    setSaving(true);
    try {
      await bffClient.deleteCoachingSchedule(studentId, target.id);
      setEditingId(null);
      setDeleteTarget(null);
      loadSchedules();
    } catch {
      setDeleteTarget(null);
      setError('この回の削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

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
        <Link
          to="/coach/students"
          style={{ ...font.link, color: color.textMuted, alignSelf: 'flex-start', textDecoration: 'none' }}
        >
          ← 受講生一覧に戻る
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>
            コーチング{studentName ? `：${studentName}` : ''}
          </h1>
          <button type="button" style={smallPrimaryButton} onClick={() => { setAddForm(newEmptyForm()); setShowAddForm(v => !v); }}>
            <Plus className="w-4 h-4" />
            コーチングを追加
          </button>
        </div>

        {error && (
          <div style={{ ...t.chip, background: '#FDEAE6', color: color.primary, padding: '10px 14px', borderRadius: 12 }}>
            {error}
          </div>
        )}

        {showAddForm && (
          <div style={{ ...t.card, padding: 20 }}>
            <ScheduleForm form={addForm} onChange={setAddForm} mode="create" />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" style={smallPrimaryButton} onClick={handleCreate} disabled={saving}>
                {saving ? '保存中...' : '記録する'}
              </button>
              <button type="button" style={ghostSmallButton} onClick={() => setShowAddForm(false)}>
                キャンセル
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <p style={{ ...font.meta, color: color.textMuted, textAlign: 'center', padding: '48px 0' }}>読み込み中…</p>
          ) : schedules.length === 0 ? (
            <p style={{ ...font.meta, color: color.textSubtle, textAlign: 'center', padding: '48px 0' }}>
              まだコーチングの予定がありません。
            </p>
          ) : (
            schedules.map(schedule => (
              <div key={schedule.id} style={{ ...t.card, padding: '16px 18px' }}>
                {editingId === schedule.id ? (
                  <>
                    <ScheduleForm form={editForm} onChange={setEditForm} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                      <button type="button" style={smallPrimaryButton} onClick={() => handleUpdate(schedule.id)} disabled={saving}>
                        {saving ? '保存中...' : '保存'}
                      </button>
                      <button type="button" style={ghostSmallButton} onClick={() => setEditingId(null)}>
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(schedule)}
                        disabled={saving}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
                          ...font.buttonSm, color: color.primary, background: color.primarySoft,
                          border: 'none', borderRadius: t.chip.borderRadius, padding: '10px 16px', cursor: 'pointer',
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        削除
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ ...font.rowTitle, color: color.text }}>第{schedule.coaching_no}回</span>
                        <span style={{ ...font.caption, color: color.textSubtle, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar className="w-3.5 h-3.5" />
                          {schedule.coaching_date}
                        </span>
                        {schedule.status ? (
                          <span style={{ ...t.chip, background: '#F1EFEA', color: color.textMuted }}>
                            {SCHEDULE_STATUS_LABEL[schedule.status]}
                          </span>
                        ) : isUpcoming(schedule, today) && (
                          <span style={{ ...t.chip, background: '#E8F0FC', color: '#3A5C8F' }}>予定</span>
                        )}
                      </span>
                      {schedule.meeting_url && schedule.status !== 'rescheduled' && (
                        <a
                          href={schedule.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...font.link, color: '#3A5C8F', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, textDecoration: 'none' }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {schedule.meeting_url}
                        </a>
                      )}
                      {isUpcoming(schedule, today) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                          {schedule.meeting_url && (
                            <a
                              href={schedule.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ ...smallPrimaryButton, textDecoration: 'none' }}
                            >
                              <Video className="w-4 h-4" />
                              Meetに参加
                            </a>
                          )}
                          <button type="button" style={ghostSmallButton} onClick={() => openReschedule(schedule)} disabled={saving}>
                            <CalendarX className="w-4 h-4" />
                            リスケにする
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => startEdit(schedule)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        ...font.buttonSm, color: color.textStrong, background: color.surface,
                        border: `1px solid ${color.borderSoft}`, borderRadius: t.chip.borderRadius,
                        padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      編集
                    </button>
                  </div>
                )}

                {isHeld(schedule, today) && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${color.borderSoft}` }}>
                  <button
                    type="button"
                    onClick={() => toggleNote(schedule.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                      ...font.buttonSm, color: '#3A5C8F',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    コーチング記録
                    {isNote(notes[schedule.id]) && (
                      <span style={{ ...t.chip, ...NOTE_STATUS_STYLE[(notes[schedule.id] as CoachingNote).status] }}>
                        {NOTE_STATUS_LABEL[(notes[schedule.id] as CoachingNote).status]}
                      </span>
                    )}
                    {noteOpenId === schedule.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {noteOpenId === schedule.id && (
                    <div style={{ marginTop: 12 }}>
                      {noteLoading ? (
                        <p style={{ ...font.meta, color: color.textMuted }}>読み込み中…</p>
                      ) : notes[schedule.id] === 'forbidden' ? (
                        <p style={{ ...font.meta, color: color.textSubtle, margin: 0 }}>
                          この受講生の担当ではないため、コーチング記録を表示できません。担当の変更は運営にお問い合わせください。
                        </p>
                      ) : notes[schedule.id] === 'error' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <p style={{ ...font.meta, color: color.textSubtle, margin: 0 }}>
                            コーチング記録を読み込めませんでした。
                          </p>
                          <button type="button" style={ghostSmallButton} onClick={() => loadNote(schedule.id)} disabled={noteLoading}>
                            もう一度読み込む
                          </button>
                        </div>
                      ) : notes[schedule.id] === 'none' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <p style={{ ...font.meta, color: color.textSubtle, margin: 0 }}>
                            まだコーチング記録がありません（録画の文字起こしが届くと、記録から要約を作成します）。
                          </p>
                          <ResultPicker
                            value={resultOf(schedule)}
                            onChange={v => setResultDraft(prev => ({ ...prev, [schedule.id]: v }))}
                          />
                          <div>
                            <button type="button" style={ghostSmallButton} onClick={() => handleSaveResultOnly(schedule)} disabled={noteSaving}>
                              {noteSaving ? '保存中...' : '実施結果を保存'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {NOTE_FIELD_LABELS.map(({ key, label }) => (
                            <div key={key}>
                              <label style={{ ...font.label, color: color.textSubtle, display: 'block', marginBottom: 4 }}>{label}</label>
                              <textarea
                                value={(noteForm[key] as string) || ''}
                                onChange={e => setNoteForm(prev => ({ ...prev, [key]: e.target.value }))}
                                rows={estimateNoteTextareaRows((noteForm[key] as string) || '')}
                                style={{ ...inputStyle, resize: 'vertical' }}
                              />
                            </div>
                          ))}
                          <ResultPicker
                            value={resultOf(schedule)}
                            onChange={v => setResultDraft(prev => ({ ...prev, [schedule.id]: v }))}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" style={ghostSmallButton} onClick={() => handleSaveNote(schedule)} disabled={noteSaving}>
                              {noteSaving ? '保存中...' : '下書き保存'}
                            </button>
                            <button
                              type="button"
                              style={{ ...smallPrimaryButton, background: '#1E7A34' }}
                              onClick={() => handleSaveNote(schedule, 'published')}
                              disabled={noteSaving}
                            >
                              受講生に公開
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* 🔴 記録画面は webcoachTheme の色で組んでいて .wc-warm が無い。ダイアログは --dc-* を
          使うので、ここだけ .wc-warm で包んでトークンを効かせる */}
      {rescheduleTarget && (
        <div className="wc-warm">
          <ConfirmDialog
            title={`第${rescheduleTarget.coaching_no}回（${rescheduleTarget.coaching_date}）をリスケにしますか？`}
            description="受講生の画面ではこの回に「リスケ」と表示され、参加ボタンが消えます。リスケは取り消せません。"
            confirmLabel={saving ? '保存中...' : 'リスケにする'}
            busy={saving}
            onConfirm={handleReschedule}
            onCancel={() => setRescheduleTarget(null)}
          >
            <RescheduleChoice
              mode={rescheduleMode}
              date={rescheduleDate}
              min={today}
              error={rescheduleError}
              onMode={setRescheduleMode}
              onDate={setRescheduleDate}
            />
          </ConfirmDialog>
        </div>
      )}

      {deleteTarget && (
        <div className="wc-warm">
          <ConfirmDialog
            title={`第${deleteTarget.coaching_no}回（${deleteTarget.coaching_date}）を削除しますか？`}
            description="この回の予定とコーチング記録が消え、受講生の画面からも見えなくなります。元に戻せません。"
            confirmLabel={saving ? '削除中...' : '削除する'}
            busy={saving}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        </div>
      )}
    </div>
  );
}

function ScheduleForm({
  form,
  onChange,
  mode = 'edit',
}: {
  form: ScheduleFormState;
  onChange: (form: ScheduleFormState) => void;
  // 'create': 新規作成用。Google Meet自動発行が前提(手動URL入力の経路は無い)なので
  // URL欄は案内文のみ表示し、実施結果・要約・TODOは実施後に編集で入力する運用にする。
  // 'edit'(デフォルト): 既存回の編集。過去に手動URLで作られた回の値もそのまま編集できる。
  mode?: 'create' | 'edit';
}) {
  const isGoogleMeet = mode === 'create' || form.meeting_provider === 'google_meet';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ ...font.label, color: color.textSubtle, display: 'block', marginBottom: 4 }}>実施日</label>
          <input
            type="date"
            value={form.coaching_date}
            min={mode === 'create' ? toLocalDateKey(new Date()) : undefined}
            onChange={e => onChange({ ...form, coaching_date: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label style={{ ...font.label, color: color.textSubtle, display: 'block', marginBottom: 4 }}>ミーティングURL</label>
          {isGoogleMeet ? (
            <div style={{ ...inputStyle, color: color.textSubtle, display: 'flex', alignItems: 'center', wordBreak: 'break-all' }}>
              {mode === 'create' || !form.meeting_url ? '作成時に自動的にGoogle MeetのURLを発行します' : form.meeting_url}
            </div>
          ) : (
            <input
              type="url"
              value={form.meeting_url}
              onChange={e => onChange({ ...form, meeting_url: e.target.value })}
              placeholder="https://..."
              style={inputStyle}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** 実施した回の結果（終了／中断）。AIコーチングノートの保存・公開と一緒に保存される */
function ResultPicker({ value, onChange }: { value: HeldResult; onChange: (v: HeldResult) => void }) {
  const options: { v: HeldResult; label: string }[] = [
    { v: 'completed', label: '終了' },
    { v: 'interrupted', label: '中断' },
  ];
  return (
    <div role="radiogroup" aria-label="実施結果" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ ...font.label, color: color.textSubtle, marginRight: 4 }}>実施結果</span>
      {options.map(o => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.v)}
            style={{
              ...font.buttonSm, fontFamily: 'inherit', cursor: 'pointer',
              padding: '7px 16px', borderRadius: t.chip.borderRadius,
              border: `1px solid ${on ? color.textStrong : color.borderSoft}`,
              background: on ? color.textStrong : color.surface,
              color: on ? color.surface : color.textStrong,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** リスケの確認ダイアログの中身。振替日をその場で登録するか、あとで登録するかを選ぶ */
function RescheduleChoice({
  mode, date, min, error, onMode, onDate,
}: {
  mode: 'date' | 'later';
  date: string;
  min: string;
  error: string | null;
  onMode: (m: 'date' | 'later') => void;
  onDate: (d: string) => void;
}) {
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={row}>
        <input type="radio" name="reschedule-mode" checked={mode === 'date'} onChange={() => onMode('date')} />
        振替日を登録する
      </label>
      {mode === 'date' && (
        <input
          type="date"
          aria-label="振替日"
          value={date}
          min={min}
          onChange={e => onDate(e.target.value)}
          style={{ ...inputStyle, marginLeft: 24, width: 'calc(100% - 24px)' }}
        />
      )}
      <label style={row}>
        <input type="radio" name="reschedule-mode" checked={mode === 'later'} onChange={() => onMode('later')} />
        振替日はあとで登録する
      </label>
      {mode === 'date' && (
        <p style={{ margin: 0, fontSize: 'var(--dc-fs-caption, 12px)', color: 'var(--dc-text-muted)', lineHeight: 1.7 }}>
          振替日は新しい回として登録され、Meet の URL も新しく発行されます。
        </p>
      )}
      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-primary)' }}>{error}</p>
      )}
    </div>
  );
}
