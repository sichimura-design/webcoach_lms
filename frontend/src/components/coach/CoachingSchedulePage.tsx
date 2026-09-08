/**
 * コーチ向け コーチング記録（/coach/schedule/:studentId）。
 *
 * 色・角丸・影・文字は index.css の --dc-*（.wc-warm スコープ）。
 * 🔴 ルート要素の className に wc-warm が必要（CoachStudentsPage と同じ理由）。
 *
 * 🔴 青（#3A5C8F / #E8F0FC）は使わない。以前はノートのステータスと会議URLのリンクを
 *    青で出していたが、暖色クリーム＋ブランド赤の画面に寒色が1色だけ混ざって、
 *    そこだけ別のアプリに見えていた。
 *    ノートの3段階は「中立グレー → 琥珀（未公開＝まだやることが残っている）→ 緑（公開済み）」
 *    の既存トークンで表す。リンクはブランド赤（docs/typography.md §8 が赤を許す用途）。
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Plus, ExternalLink, Trash2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { AppHeader, AppFooter } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import bffClient from '../../services/bffClient';
import { CoachingSchedule, CoachingScheduleStatus, CoachingNote, CoachingNoteStatus, UpdateCoachingNoteRequest } from '../../types/api';

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

/** 下書き＝中立 / 確認済み（未公開）＝琥珀（まだ残っている）/ 公開済み＝緑（完了） */
const NOTE_STATUS_STYLE: Record<CoachingNoteStatus, React.CSSProperties> = {
  ai_suggested: { background: 'var(--dc-neutral-surface)', color: 'var(--dc-text-muted)' },
  coach_confirmed: { background: 'var(--dc-gold-surface)', color: 'var(--dc-gold-text)' },
  published: { background: 'var(--dc-success-surface)', color: 'var(--dc-success)' },
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
  coaching_summary: string;
  todo: string;
}

const emptyForm: ScheduleFormState = {
  coaching_date: new Date().toISOString().slice(0, 10),
  status: '',
  meeting_provider: '',
  meeting_url: '',
  coaching_summary: '',
  todo: '',
};

const SCHEDULE_STATUS_LABEL: Record<CoachingScheduleStatus, string> = {
  completed: '終了',
  interrupted: '中断',
  rescheduled: 'リスケ',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
};

/** クリックできない状態ラベル。pill と差をつけるため角丸は浅い */
const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 9px',
  borderRadius: 6,
  fontSize: 'var(--dc-fs-caption)',
  fontWeight: 600,
};

const smallPrimaryButton: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'var(--dc-primary)',
  color: '#fff',
  border: 0,
  borderRadius: 'var(--dc-radius-md)',
  padding: '10px 18px',
  fontFamily: 'inherit',
  fontSize: 'var(--dc-fs-body)',
  fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const ghostSmallButton: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border-strong)',
  borderRadius: 'var(--dc-radius-md)',
  padding: '10px 18px',
  fontFamily: 'inherit',
  fontSize: 'var(--dc-fs-body)',
  fontWeight: 600,
  color: 'var(--dc-text-body)',
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-md)',
  padding: '9px 12px',
  fontFamily: 'inherit',
  fontSize: 'var(--dc-fs-body)',
  color: 'var(--dc-text-body)',
  outline: 'none',
  background: 'var(--dc-surface)',
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 'var(--dc-fs-caption)',
  fontWeight: 500,
  color: 'var(--dc-text-muted)',
};

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]';

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
        meeting_url: addForm.meeting_provider === 'google_meet' ? '' : addForm.meeting_url,
        meeting_provider: addForm.meeting_provider || null,
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
      meeting_provider: schedule.meeting_provider || '',
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
    <div className="wc-warm min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username} />

      <main
        className="wc-page flex-1"
        style={{
          '--wc-page-max': '860px',
          '--wc-page-bottom': '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        } as React.CSSProperties}
      >
        <Link
          to="/coach/students"
          className={`dc-link-primary ${focusRing}`}
          style={{
            alignSelf: 'flex-start',
            fontSize: 'var(--dc-fs-caption)',
            fontWeight: 600,
            color: 'var(--dc-primary)',
            textDecoration: 'none',
          }}
        >
          ← 受講生一覧に戻る
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--dc-fs-display)',
              fontWeight: 700,
              letterSpacing: '-.01em',
              lineHeight: 'var(--dc-lh-heading)',
              color: 'var(--dc-text)',
            }}
          >
            コーチング記録{studentName ? `：${studentName}` : ''}
          </h1>
          <button
            type="button"
            style={smallPrimaryButton}
            className={`dc-cta-primary ${focusRing}`}
            onClick={() => setShowAddForm(v => !v)}
          >
            <Plus size={16} strokeWidth={2.25} />
            新しいセッションを記録
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--dc-radius-md)',
              background: 'var(--dc-soft-100)',
              color: 'var(--dc-primary)',
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        )}

        {showAddForm && (
          <div style={{ ...cardStyle, padding: 20 }}>
            <ScheduleForm form={addForm} onChange={setAddForm} allowProviderChange />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" style={smallPrimaryButton} className={`dc-cta-primary ${focusRing}`} onClick={handleCreate} disabled={saving}>
                {saving ? '保存中…' : '記録する'}
              </button>
              <button type="button" style={ghostSmallButton} className={`dc-cta-outline ${focusRing}`} onClick={() => setShowAddForm(false)}>
                キャンセル
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <p style={{ margin: 0, padding: '48px 0', textAlign: 'center', fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)' }}>
              読み込み中…
            </p>
          ) : schedules.length === 0 ? (
            <p
              style={{
                margin: 0, padding: '48px 0', textAlign: 'center',
                fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)',
                lineHeight: 'var(--dc-lh-prose)',
              }}
            >
              まだコーチング記録がありません。「新しいセッションを記録」から1件目を残しましょう。
            </p>
          ) : (
            schedules.map(schedule => (
              <div key={schedule.id} style={{ ...cardStyle, padding: '16px 18px' }}>
                {editingId === schedule.id ? (
                  <>
                    <ScheduleForm form={editForm} onChange={setEditForm} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
                      <button type="button" style={smallPrimaryButton} className={`dc-cta-primary ${focusRing}`} onClick={() => handleUpdate(schedule.id)} disabled={saving}>
                        {saving ? '保存中…' : '保存'}
                      </button>
                      <button type="button" style={ghostSmallButton} className={`dc-cta-outline ${focusRing}`} onClick={() => setEditingId(null)}>
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(schedule.id)}
                        disabled={saving}
                        className={focusRing}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto',
                          fontSize: 'var(--dc-fs-body)', fontWeight: 600,
                          fontFamily: 'inherit',
                          color: 'var(--dc-primary)', background: 'var(--dc-soft-100)',
                          border: 0, borderRadius: 'var(--dc-radius-md)', padding: '10px 16px', cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                        削除
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(schedule)}
                    className={focusRing}
                    style={{ textAlign: 'left', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: 600, color: 'var(--dc-text)' }}>
                        第{schedule.coaching_no}回
                      </span>
                      <span
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)',
                        }}
                      >
                        <Calendar size={13} strokeWidth={2} />
                        {schedule.coaching_date}
                      </span>
                      {schedule.status && (
                        <span style={{ ...chipStyle, background: 'var(--dc-neutral-surface)', color: 'var(--dc-text-muted)' }}>
                          {SCHEDULE_STATUS_LABEL[schedule.status]}
                        </span>
                      )}
                      {schedule.todo && (
                        <span style={{ ...chipStyle, background: 'var(--dc-gold-surface)', color: 'var(--dc-gold-text)' }}>
                          TODOあり
                        </span>
                      )}
                    </span>
                    {schedule.meeting_url && (
                      <a
                        href={schedule.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className={`dc-link-primary ${focusRing}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6,
                          fontSize: 'var(--dc-fs-caption)', fontWeight: 600,
                          color: 'var(--dc-primary)', textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={12} strokeWidth={2} />
                        {schedule.meeting_url}
                      </a>
                    )}
                    {schedule.coaching_summary && (
                      <span
                        style={{
                          fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden', lineHeight: 'var(--dc-lh-prose)',
                        }}
                      >
                        {schedule.coaching_summary}
                      </span>
                    )}
                  </button>
                )}

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--dc-rule)' }}>
                  <button
                    type="button"
                    onClick={() => toggleNote(schedule.id)}
                    aria-expanded={noteOpenId === schedule.id}
                    className={focusRing}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 'var(--dc-fs-body)', fontWeight: 600, color: 'var(--dc-text-body)',
                    }}
                  >
                    <Sparkles size={14} strokeWidth={2} style={{ color: 'var(--dc-ai)' }} />
                    AIコーチングノート
                    {notes[schedule.id] && notes[schedule.id] !== 'none' && (
                      <span style={{ ...chipStyle, ...NOTE_STATUS_STYLE[(notes[schedule.id] as CoachingNote).status] }}>
                        {NOTE_STATUS_LABEL[(notes[schedule.id] as CoachingNote).status]}
                      </span>
                    )}
                    {noteOpenId === schedule.id
                      ? <ChevronUp size={14} strokeWidth={2} style={{ color: 'var(--dc-chevron)' }} />
                      : <ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--dc-chevron)' }} />}
                  </button>

                  {noteOpenId === schedule.id && (
                    <div style={{ marginTop: 12 }}>
                      {noteLoading ? (
                        <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)' }}>読み込み中…</p>
                      ) : notes[schedule.id] === 'none' ? (
                        <p
                          style={{
                            margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)',
                            lineHeight: 'var(--dc-lh-prose)',
                          }}
                        >
                          まだAIノートが生成されていません（文字起こし取得後に自動生成されます）。
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {NOTE_FIELD_LABELS.map(({ key, label }) => (
                            <div key={key}>
                              <label style={fieldLabelStyle}>{label}</label>
                              <textarea
                                value={(noteForm[key] as string) || ''}
                                onChange={e => setNoteForm(prev => ({ ...prev, [key]: e.target.value }))}
                                rows={2}
                                className={focusRing}
                                style={{ ...inputStyle, resize: 'none', lineHeight: 'var(--dc-lh-prose)' }}
                              />
                            </div>
                          ))}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" style={ghostSmallButton} className={`dc-cta-outline ${focusRing}`} onClick={() => handleSaveNote(schedule.id)} disabled={noteSaving}>
                              {noteSaving ? '保存中…' : '下書き保存'}
                            </button>
                            <button type="button" style={ghostSmallButton} className={`dc-cta-outline ${focusRing}`} onClick={() => handleSaveNote(schedule.id, 'coach_confirmed')} disabled={noteSaving}>
                              内容を確定
                            </button>
                            {/* この画面で唯一の塗りボタン。受講生に見えるようになる操作なので、
                                他の操作より一段強くしてある（docs/typography.md §9） */}
                            <button
                              type="button"
                              style={smallPrimaryButton}
                              className={`dc-cta-primary ${focusRing}`}
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

      <AppFooter />
    </div>
  );
}

function ScheduleForm({
  form,
  onChange,
  allowProviderChange = false,
}: {
  form: ScheduleFormState;
  onChange: (form: ScheduleFormState) => void;
  allowProviderChange?: boolean;
}) {
  const isGoogleMeet = form.meeting_provider === 'google_meet';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={fieldLabelStyle}>実施日</label>
          <input
            type="date"
            value={form.coaching_date}
            onChange={e => onChange({ ...form, coaching_date: e.target.value })}
            className={focusRing}
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label style={fieldLabelStyle}>ミーティングURL</label>
          {allowProviderChange && (
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)',
              }}
            >
              <input
                type="checkbox"
                checked={isGoogleMeet}
                onChange={e => onChange({ ...form, meeting_provider: e.target.checked ? 'google_meet' : '', meeting_url: '' })}
              />
              Google Meetを自動発行する
            </label>
          )}
          {isGoogleMeet ? (
            <div style={{ ...inputStyle, color: 'var(--dc-text-subtle)', display: 'flex', alignItems: 'center' }}>
              作成時に自動的にGoogle MeetのURLを発行します
            </div>
          ) : (
            <input
              type="url"
              value={form.meeting_url}
              onChange={e => onChange({ ...form, meeting_url: e.target.value })}
              placeholder="https://..."
              className={focusRing}
              style={inputStyle}
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={fieldLabelStyle}>実施結果</label>
          <select
            value={form.status}
            onChange={e => onChange({ ...form, status: e.target.value as ScheduleFormState['status'] })}
            className={focusRing}
            /* プルダウンは「押しボタンではないが操作はできる」ので、
               ボタン（--dc-radius-md=12px）より一段浅い角丸にする */
            style={{ ...inputStyle, borderRadius: 9 }}
          >
            <option value="">未設定</option>
            <option value="completed">終了</option>
            <option value="interrupted">中断</option>
            <option value="rescheduled">リスケ</option>
          </select>
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>コーチング内容の要約</label>
        <textarea
          value={form.coaching_summary}
          onChange={e => onChange({ ...form, coaching_summary: e.target.value })}
          rows={3}
          className={focusRing}
          style={{ ...inputStyle, resize: 'none', lineHeight: 'var(--dc-lh-prose)' }}
        />
      </div>
      <div>
        <label style={fieldLabelStyle}>次回までのTODO</label>
        <textarea
          value={form.todo}
          onChange={e => onChange({ ...form, todo: e.target.value })}
          rows={2}
          className={focusRing}
          style={{ ...inputStyle, resize: 'none', lineHeight: 'var(--dc-lh-prose)' }}
        />
      </div>
    </div>
  );
}
