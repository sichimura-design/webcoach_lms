import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { AppHeader } from '../shared/AppHeader';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import bffClient from '../../services/bffClient';
import { CoachingSchedule } from '../../types/api';

interface Student {
  id: number;
  username: string;
  fullname: string;
}

interface ScheduleFormState {
  coaching_date: string;
  meeting_url: string;
  coaching_summary: string;
  todo: string;
}

const emptyForm: ScheduleFormState = {
  coaching_date: new Date().toISOString().slice(0, 10),
  meeting_url: '',
  coaching_summary: '',
  todo: '',
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
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" style={{ zIndex: 0 }}>
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px', filter: 'blur(40px)' }} />
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(253,234,226,0.5) 0%, transparent 70%)', top: '-100px', right: '-400px', filter: 'blur(40px)' }} />
      </div>

      <div className="relative flex-1 max-w-[860px] w-full mx-auto px-4 sm:px-6 py-8 pb-24 sm:pb-8" style={{ zIndex: 1 }}>
        <Link to="/coach/students" className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: '#7E6E68' }}>
          <ArrowLeft className="w-4 h-4" />
          受講生一覧に戻る
        </Link>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: '#4B3A33' }}>
            コーチング記録{studentName ? `：${studentName}` : ''}
          </h1>
          <Button
            onClick={() => setShowAddForm(v => !v)}
            variant="brand-gradient"
            size="pill-sm"
          >
            <Plus className="w-4 h-4" />
            新しいセッションを記録
          </Button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#FDEAE6', color: '#E86D78' }}>
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="bg-white rounded-2xl p-5 mb-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0EAE6' }}>
            <ScheduleForm form={addForm} onChange={setAddForm} />
            <div className="flex items-center gap-2 mt-4">
              <Button onClick={handleCreate} variant="brand-gradient" size="pill-sm">
                {saving ? '保存中...' : '記録する'}
              </Button>
              <Button onClick={() => setShowAddForm(false)} variant="brand-ghost" size="pill-sm">
                キャンセル
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: '#7E6E68' }}>読み込み中...</div>
          ) : schedules.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: '#7E6E68' }}>
              まだコーチング記録がありません
            </div>
          ) : (
            schedules.map(schedule => (
              <div
                key={schedule.id}
                className="bg-white rounded-2xl p-5"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0EAE6' }}
              >
                {editingId === schedule.id ? (
                  <>
                    <ScheduleForm form={editForm} onChange={setEditForm} />
                    <div className="flex items-center gap-2 mt-4">
                      <Button onClick={() => handleUpdate(schedule.id)} variant="brand-gradient" size="pill-sm">
                        {saving ? '保存中...' : '保存'}
                      </Button>
                      <Button onClick={() => setEditingId(null)} variant="brand-ghost" size="pill-sm">
                        キャンセル
                      </Button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        disabled={saving}
                        className="flex items-center gap-1 ml-auto text-xs font-bold px-3 py-1.5 rounded-full hover:opacity-80 disabled:opacity-50"
                        style={{ color: '#E86D78', background: '#FDEAE6' }}
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
                    className="text-left w-full"
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-bold text-sm" style={{ color: '#4B3A33' }}>
                        第{schedule.coaching_no}回
                      </span>
                      <span className="text-xs flex items-center gap-1" style={{ color: '#7E6E68' }}>
                        <Calendar className="w-3.5 h-3.5" />
                        {schedule.coaching_date}
                      </span>
                      {schedule.todo && (
                        <span
                          className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                          style={{ background: '#FFF6E5', color: '#B26A00' }}
                        >
                          TODOあり
                        </span>
                      )}
                    </div>
                    {schedule.meeting_url && (
                      <a
                        href={schedule.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs flex items-center gap-1 mb-2 hover:underline"
                        style={{ color: '#3A5C8F' }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {schedule.meeting_url}
                      </a>
                    )}
                    {schedule.coaching_summary && (
                      <p className="text-sm line-clamp-2" style={{ color: '#7E6E68' }}>
                        {schedule.coaching_summary}
                      </p>
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
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
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-bold mb-1" style={{ color: '#7E6E68' }}>実施日</label>
          <input
            type="date"
            value={form.coaching_date}
            onChange={e => onChange({ ...form, coaching_date: e.target.value })}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: '#FAF8F4', color: '#4B3A33', border: '1px solid #EDE8E3' }}
          />
        </div>
        <div className="flex-[2] min-w-[220px]">
          <label className="block text-xs font-bold mb-1" style={{ color: '#7E6E68' }}>ミーティングURL</label>
          <input
            type="url"
            value={form.meeting_url}
            onChange={e => onChange({ ...form, meeting_url: e.target.value })}
            placeholder="https://..."
            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: '#FAF8F4', color: '#4B3A33', border: '1px solid #EDE8E3' }}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold mb-1" style={{ color: '#7E6E68' }}>コーチング内容の要約</label>
        <textarea
          value={form.coaching_summary}
          onChange={e => onChange({ ...form, coaching_summary: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
          style={{ background: '#FAF8F4', color: '#4B3A33', border: '1px solid #EDE8E3' }}
        />
      </div>
      <div>
        <label className="block text-xs font-bold mb-1" style={{ color: '#7E6E68' }}>次回までのTODO</label>
        <textarea
          value={form.todo}
          onChange={e => onChange({ ...form, todo: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
          style={{ background: '#FAF8F4', color: '#4B3A33', border: '1px solid #EDE8E3' }}
        />
      </div>
    </div>
  );
}
