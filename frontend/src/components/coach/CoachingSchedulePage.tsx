import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Plus, ExternalLink, Trash2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import bffClient from '../../services/bffClient';
import { CoachingSchedule, CoachingScheduleStatus, CoachingNote, CoachingNoteStatus, UpdateCoachingNoteRequest } from '../../types/api';
import { color, font, t } from '../../theme/webcoachTheme';

const NOTE_FIELD_LABELS: { key: keyof UpdateCoachingNoteRequest; label: string }[] = [
  { key: 'session_summary', label: 'セッション概要' },
  { key: 'client_status_and_goal', label: 'Clientの現状と目標' },
  { key: 'main_issues', label: '主な課題' },
  { key: 'coach_feedback', label: 'Coachからのフィードバック' },
  { key: 'decisions', label: '今回決めたこと' },
  { key: 'client_next_actions', label: 'Clientの次回までのアクション' },
  { key: 'coach_follow_up', label: 'Coach側のフォロー事項' },
  { key: 'next_session_check', label: '次回確認すること' },
];

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
  coaching_summary: string;
  todo: string;
}

const emptyForm: ScheduleFormState = {
  coaching_date: new Date().toISOString().slice(0, 10),
  status: '',
  meeting_url: '',
  coaching_summary: '',
  todo: '',
};

const SCHEDULE_STATUS_LABEL: Record<CoachingScheduleStatus, string> = {
  completed: '終了',
  interrupted: '中断',
  rescheduled: 'リスケ',
};

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
  const [addForm, setAddForm] = useState<ScheduleFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ScheduleFormState>(emptyForm);

  const [noteOpenId, setNoteOpenId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, CoachingNote | 'none'>>({});
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteForm, setNoteForm] = useState<UpdateCoachingNoteRequest>({});
  const [noteSaving, setNoteSaving] = useState(false);

  const loadSchedules = () => {
    setLoading(true);
    bffClient.getCoachingSchedules(studentId)
      .then(setSchedules)
      .catch(() => setError('コーチング記録の取得に失敗しました'))
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
    setSaving(true);
    try {
      await bffClient.createCoachingSchedule(studentId, {
        coach_user_id: user.userid,
        coaching_date: addForm.coaching_date,
        meeting_url: addForm.meeting_url,
        coaching_summary: addForm.coaching_summary || null,
        todo: addForm.todo || null,
      });
      setAddForm(emptyForm);
      setShowAddForm(false);
      loadSchedules();
    } catch {
      setError('コーチング記録の作成に失敗しました');
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
      coaching_summary: schedule.coaching_summary || '',
      todo: schedule.todo || '',
    });
  };

  const handleUpdate = async (id: number) => {
    if (saving) return;
    setSaving(true);
    try {
      await bffClient.updateCoachingSchedule(studentId, id, {
        coaching_date: editForm.coaching_date,
        status: editForm.status || undefined,
        meeting_url: editForm.meeting_url,
        coaching_summary: editForm.coaching_summary || null,
        todo: editForm.todo || null,
      });
      setEditingId(null);
      loadSchedules();
    } catch {
      setError('コーチング記録の更新に失敗しました');
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
    if (notes[scheduleId]) {
      const existing = notes[scheduleId];
      setNoteForm(existing === 'none' ? {} : { ...existing });
      return;
    }
    setNoteLoading(true);
    try {
      const note = await bffClient.getCoachingNote(scheduleId);
      setNotes(prev => ({ ...prev, [scheduleId]: note }));
      setNoteForm({ ...note });
    } catch {
      setNotes(prev => ({ ...prev, [scheduleId]: 'none' }));
      setNoteForm({});
    } finally {
      setNoteLoading(false);
    }
  };

  const handleSaveNote = async (scheduleId: number, status?: CoachingNoteStatus) => {
    if (noteSaving) return;
    setNoteSaving(true);
    try {
      const updated = await bffClient.updateCoachingNote(scheduleId, {
        ...noteForm,
        ...(status ? { status } : {}),
      });
      setNotes(prev => ({ ...prev, [scheduleId]: updated }));
      setNoteForm({ ...updated });
    } catch {
      setError('コーチングノートの保存に失敗しました');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (saving) return;
    setSaving(true);
    try {
      await bffClient.deleteCoachingSchedule(studentId, id);
      setEditingId(null);
      loadSchedules();
    } catch {
      setError('コーチング記録の削除に失敗しました');
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
            コーチング記録{studentName ? `：${studentName}` : ''}
          </h1>
          <button type="button" style={smallPrimaryButton} onClick={() => setShowAddForm(v => !v)}>
            <Plus className="w-4 h-4" />
            新しいセッションを記録
          </button>
        </div>

        {error && (
          <div style={{ ...t.chip, background: '#FDEAE6', color: color.primary, padding: '10px 14px', borderRadius: 12 }}>
            {error}
          </div>
        )}

        {showAddForm && (
          <div style={{ ...t.card, padding: 20 }}>
            <ScheduleForm form={addForm} onChange={setAddForm} />
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
              まだコーチング記録がありません。
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
                        onClick={() => handleDelete(schedule.id)}
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
                  <button
                    type="button"
                    onClick={() => startEdit(schedule)}
                    style={{ textAlign: 'left', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ ...font.rowTitle, color: color.text }}>第{schedule.coaching_no}回</span>
                      <span style={{ ...font.caption, color: color.textSubtle, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar className="w-3.5 h-3.5" />
                        {schedule.coaching_date}
                      </span>
                      {schedule.status && (
                        <span style={{ ...t.chip, background: '#F1EFEA', color: color.textMuted }}>
                          {SCHEDULE_STATUS_LABEL[schedule.status]}
                        </span>
                      )}
                      {schedule.todo && (
                        <span style={{ ...t.chip, background: '#FFF6E5', color: '#B26A00' }}>TODOあり</span>
                      )}
                    </span>
                    {schedule.meeting_url && (
                      <a
                        href={schedule.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ ...font.link, color: '#3A5C8F', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6, textDecoration: 'none' }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {schedule.meeting_url}
                      </a>
                    )}
                    {schedule.coaching_summary && (
                      <span
                        style={{
                          ...font.meta, color: color.textMuted,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden', lineHeight: 1.8,
                        }}
                      >
                        {schedule.coaching_summary}
                      </span>
                    )}
                  </button>
                )}

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
                    AIコーチングノート
                    {notes[schedule.id] && notes[schedule.id] !== 'none' && (
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
                      ) : notes[schedule.id] === 'none' ? (
                        <p style={{ ...font.meta, color: color.textSubtle }}>
                          まだAIノートが生成されていません（文字起こし取得後に自動生成されます）。
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {NOTE_FIELD_LABELS.map(({ key, label }) => (
                            <div key={key}>
                              <label style={{ ...font.label, color: color.textSubtle, display: 'block', marginBottom: 4 }}>{label}</label>
                              <textarea
                                value={(noteForm[key] as string) || ''}
                                onChange={e => setNoteForm(prev => ({ ...prev, [key]: e.target.value }))}
                                rows={2}
                                style={{ ...inputStyle, resize: 'none' }}
                              />
                            </div>
                          ))}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" style={ghostSmallButton} onClick={() => handleSaveNote(schedule.id)} disabled={noteSaving}>
                              {noteSaving ? '保存中...' : '下書き保存'}
                            </button>
                            <button type="button" style={smallPrimaryButton} onClick={() => handleSaveNote(schedule.id, 'coach_confirmed')} disabled={noteSaving}>
                              内容を確定
                            </button>
                            <button
                              type="button"
                              style={{ ...smallPrimaryButton, background: '#1E7A34' }}
                              onClick={() => handleSaveNote(schedule.id, 'published')}
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
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function ScheduleForm({
  form,
  onChange,
}: {
  form: ScheduleFormState;
  onChange: (form: ScheduleFormState) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ ...font.label, color: color.textSubtle, display: 'block', marginBottom: 4 }}>実施日</label>
          <input
            type="date"
            value={form.coaching_date}
            onChange={e => onChange({ ...form, coaching_date: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label style={{ ...font.label, color: color.textSubtle, display: 'block', marginBottom: 4 }}>ミーティングURL</label>
          <input
            type="url"
            value={form.meeting_url}
            onChange={e => onChange({ ...form, meeting_url: e.target.value })}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ ...font.label, color: color.textSubtle, display: 'block', marginBottom: 4 }}>実施結果</label>
          <select
            value={form.status}
            onChange={e => onChange({ ...form, status: e.target.value as ScheduleFormState['status'] })}
            style={inputStyle}
          >
            <option value="">未設定</option>
            <option value="completed">終了</option>
            <option value="interrupted">中断</option>
            <option value="rescheduled">リスケ</option>
          </select>
        </div>
      </div>
      <div>
        <label style={{ ...font.label, color: color.textSubtle, display: 'block', marginBottom: 4 }}>コーチング内容の要約</label>
        <textarea
          value={form.coaching_summary}
          onChange={e => onChange({ ...form, coaching_summary: e.target.value })}
          rows={3}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </div>
      <div>
        <label style={{ ...font.label, color: color.textSubtle, display: 'block', marginBottom: 4 }}>次回までのTODO</label>
        <textarea
          value={form.todo}
          onChange={e => onChange({ ...form, todo: e.target.value })}
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </div>
    </div>
  );
}
