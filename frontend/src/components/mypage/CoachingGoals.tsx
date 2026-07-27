import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, RotateCcw, GripVertical, Check, Pencil, Minus } from 'lucide-react';
import { useCoachingGoals, Goal } from '../../hooks/useCoachingGoals';
import { useRoadmapSteps } from '../../hooks/useRoadmapSteps';
import { bffClient } from '../../services/bffClient';
import { RoadmapPath } from '../shared';

interface CoachingGoalsProps {
  userId: number | undefined;
  /** 目標保存に連動して「今日のスモールステップ」「今日のTODO」を更新した後に呼ばれる */
  onLinkedUpdate?: () => void;
}

export function CoachingGoals({ userId, onLinkedUpdate }: CoachingGoalsProps) {
  const { goals, loading, saving, saveGoals } = useCoachingGoals(userId, onLinkedUpdate);
  const { journey, steps: roadmapSteps } = useRoadmapSteps(userId);
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editGoals, setEditGoals] = useState<Goal[]>([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [nextSessionDate, setNextSessionDate] = useState<string | null>(null);

  const dragItem = useRef<number | null>(null);
  const lastDragOver = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    bffClient.getCoachingSessions(userId)
      .then((data) => setNextSessionDate(data.next?.date ?? null))
      .catch(() => setNextSessionDate(null));
  }, [userId]);

  const progressPercent = goals.length === 0
    ? 0
    : Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length);
  const ringDeg = Math.round((progressPercent / 100) * 360);

  const toggleGoal = (index: number) => {
    const updated = goals.map((g, i) => i === index ? { ...g, progress: g.completed ? 0 : 100 } : g);
    saveGoals(updated);
  };

  const adjustGoalProgress = (index: number, delta: number) => {
    setEditGoals(prev => prev.map((g, i) => {
      if (i !== index) return g;
      const progress = Math.min(100, Math.max(0, g.progress + delta));
      return { ...g, progress, completed: progress >= 100 };
    }));
  };

  const handleReset = () => {
    saveGoals([]);
    setShowResetConfirm(false);
  };

  const startEditing = () => {
    setEditGoals(goals.map(g => ({ ...g })));
    setNewGoalText('');
    setIsEditing(true);
  };

  const saveEditing = () => {
    const withNew = newGoalText.trim()
      ? [...editGoals, { no: null, text: newGoalText.trim(), progress: 0, completed: false }]
      : editGoals;
    saveGoals(withNew.filter(g => g.text.trim() !== ''));
    setIsEditing(false);
    setNewGoalText('');
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setNewGoalText('');
  };

  const deleteEditGoal = (index: number) => {
    setEditGoals(prev => prev.filter((_, i) => i !== index));
  };

  const addEditGoal = () => {
    if (!newGoalText.trim()) return;
    setEditGoals(prev => [...prev, { no: null, text: newGoalText.trim(), progress: 0, completed: false }]);
    setNewGoalText('');
  };

  // グリップハンドルからのドラッグ開始
  const handleGripDragStart = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    dragItem.current = index;
    lastDragOver.current = null;
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // 行全体をドラッグ画像として使う
    const row = (e.currentTarget as HTMLElement).closest('[data-goal-row]') as HTMLElement;
    if (row) {
      e.dataTransfer.setDragImage(row, 20, row.offsetHeight / 2);
    }
  };

  const handleRowDragOver = (index: number, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (dragItem.current === null || dragItem.current === index) return;
    if (lastDragOver.current === index) return; // 同じ行への連続発火を無視
    lastDragOver.current = index;

    setEditGoals(prev => {
      const updated = [...prev];
      const [dragged] = updated.splice(dragItem.current!, 1);
      updated.splice(index, 0, dragged);
      dragItem.current = index;
      return updated;
    });
  };

  const handleDragEnd = () => {
    dragItem.current = null;
    lastDragOver.current = null;
    setDraggingIndex(null);
  };

  const displayGoals = isEditing ? editGoals : goals;

  return (
    <>
      <div
        className="bg-white flex-1 lg:flex-[1.5] flex flex-col"
        style={{ borderRadius: 22, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: '24px 28px', gap: 18 }}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 900, color: '#20141A' }}>
            <span style={{ color: '#E0213A' }}>◎</span> 次回コーチングまでの目標
          </div>
          <div className="flex items-center gap-2.5">
            {nextSessionDate && !isEditing && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full font-bold"
                style={{ background: '#FDF0F2', color: '#C24358', padding: '7px 14px', fontSize: 12 }}
              >
                🗓 次回 {nextSessionDate}予約済み
              </span>
            )}
            {!isEditing && (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full font-bold transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ background: '#fff', color: '#E0213A', border: '1.5px solid #EEC0C4', padding: '9px 16px', fontSize: 14 }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                リセット
              </button>
            )}
            {isEditing ? (
              <>
                <button
                  onClick={cancelEditing}
                  className="inline-flex items-center gap-2 rounded-full font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ color: '#68707C', border: '1.5px solid #EBE7E5', padding: '9px 16px', fontSize: 14, background: '#fff' }}
                >
                  キャンセル
                </button>
                <button
                  onClick={saveEditing}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full text-white font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', padding: '10px 18px', fontSize: 14, boxShadow: '0 8px 20px rgba(224,33,58,.3)' }}
                >
                  <Check className="w-3.5 h-3.5" />
                  保存する
                </button>
              </>
            ) : (
              <button
                onClick={startEditing}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full text-white font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', padding: '10px 18px', fontSize: 14, boxShadow: '0 8px 20px rgba(224,33,58,.3)' }}
              >
                <Pencil className="w-3.5 h-3.5" />
                目標を編集
              </button>
            )}
          </div>
        </div>

        {/* Ring + Goals */}
        <div className="flex items-center gap-7 flex-1">
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: 132, height: 132, borderRadius: '50%', background: `conic-gradient(#E0213A 0 ${ringDeg}deg,#F5DFE1 ${ringDeg}deg 360deg)`, transition: 'background 500ms ease' }}
          >
            <div className="flex flex-col items-center justify-center" style={{ width: 100, height: 100, borderRadius: '50%', background: '#fff' }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#E0213A', lineHeight: 1 }}>{progressPercent}%</span>
              <span style={{ fontSize: 10, color: '#A9909A' }}>達成率</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {loading ? (
              <div className="py-6 flex justify-center">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#E0213A', borderTopColor: 'transparent' }} />
              </div>
            ) : displayGoals.length === 0 && !isEditing ? (
              <div className="text-center" style={{ color: '#9A8B8D' }}>
                <p className="text-sm">目標がありません。「目標を編集」から追加してください。</p>
              </div>
            ) : (
              displayGoals.map((goal, index) => (
                <div
                  key={isEditing ? index : (goal.no ?? index)}
                  data-goal-row
                  className="flex items-center gap-3 transition-all"
                  style={{ opacity: draggingIndex === index ? 0.5 : 1 }}
                  onDragOver={isEditing ? (e) => handleRowDragOver(index, e) : undefined}
                  onDragLeave={isEditing ? () => { lastDragOver.current = null; } : undefined}
                >
                  {isEditing && (
                    <div
                      draggable
                      onDragStart={(e) => handleGripDragStart(index, e)}
                      onDragEnd={handleDragEnd}
                      className="cursor-grab active:cursor-grabbing flex-shrink-0 select-none"
                      style={{ color: '#C7C2BF', touchAction: 'none' }}
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}

                  <button
                    onClick={() => !isEditing && toggleGoal(index)}
                    className={`rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD] ${
                      isEditing ? 'cursor-default pointer-events-none' : 'cursor-pointer'
                    }`}
                    style={{ width: 20, height: 20, borderColor: '#E0213A', background: goal.completed ? '#E0213A' : '#FFFFFF' }}
                  >
                    {goal.completed && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </button>

                  {isEditing ? (
                    <input
                      type="text"
                      value={goal.text}
                      onChange={e => setEditGoals(prev => prev.map((g, i) => i === index ? { ...g, text: e.target.value } : g))}
                      className="flex-1 text-sm bg-transparent focus:outline-none py-0.5"
                      style={{ color: '#3A2F35', borderBottom: '1px solid #EBE7E5' }}
                      onFocus={e => { e.currentTarget.style.borderBottomColor = '#E0213A'; }}
                      onBlur={e => { e.currentTarget.style.borderBottomColor = '#EBE7E5'; }}
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between" style={{ fontSize: 14, fontWeight: 700 }}>
                        <span style={{ color: goal.completed ? '#9A8B8D' : '#20141A', textDecoration: goal.completed ? 'line-through' : undefined }}>
                          {goal.text}
                        </span>
                        <span style={{ color: '#E0213A' }}>{goal.progress}%</span>
                      </div>
                      <div style={{ height: 9, borderRadius: 999, background: '#F5E4E6', overflow: 'hidden', marginTop: 7 }}>
                        <div style={{ width: `${goal.progress}%`, height: '100%', background: 'linear-gradient(90deg,#F0546A,#E0213A)', borderRadius: 999 }} />
                      </div>
                    </div>
                  )}

                  {isEditing && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => adjustGoalProgress(index, -10)}
                        className="rounded-full flex items-center justify-center appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                        style={{ width: 22, height: 22, background: '#FBF3F3', color: '#9A8B8D' }}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#3A2F35', width: 32, textAlign: 'center' }}>{goal.progress}%</span>
                      <button
                        onClick={() => adjustGoalProgress(index, 10)}
                        className="rounded-full flex items-center justify-center appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                        style={{ width: 22, height: 22, background: '#FBF3F3', color: '#9A8B8D' }}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {isEditing && (
                    <button
                      onClick={() => deleteEditGoal(index)}
                      className="rounded-full flex items-center justify-center transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                      style={{ width: 26, height: 26, color: '#C7C2BF' }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.color = '#B81026';
                        el.style.background = '#FCE7E7';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.color = '#C7C2BF';
                        el.style.background = 'transparent';
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}

            {isEditing && (
              <div className="flex items-center gap-3 pt-2" style={{ borderTop: displayGoals.length > 0 ? '1px dashed #EBE7E5' : undefined }}>
                <div style={{ width: 20 }} className="flex-shrink-0" />
                <div className="rounded flex-shrink-0" style={{ width: 20, height: 20, border: '2px dashed #C7C2BF' }} />
                <input
                  type="text"
                  value={newGoalText}
                  onChange={e => setNewGoalText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEditGoal()}
                  placeholder="新しい目標を入力..."
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                  style={{ color: '#3A2F35' }}
                  autoFocus={editGoals.length === 0}
                />
                <button
                  onClick={addEditGoal}
                  disabled={!newGoalText.trim()}
                  className="rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-opacity flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ width: 26, height: 26, background: '#E0213A' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* コーチと決めたロードマップ */}
        {journey && (
          <div style={{ borderTop: '1px dashed #F0DCDF', paddingTop: 16 }}>
            <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 14 }}>
              <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 900 }}>
                <span style={{ background: '#FBEACD', borderRadius: 8, padding: '3px 7px' }}>🛡</span>
                コーチと決めたロードマップ
                <span style={{ fontSize: 11, fontWeight: 400, color: '#B78F98' }}>・目標：{journey.goal}</span>
              </div>
              <button
                onClick={() => navigate('/profile')}
                className="appearance-none border-0 outline-none bg-transparent focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ fontSize: 12, color: '#E0213A', fontWeight: 700 }}
              >
                変更 ›
              </button>
            </div>
            <RoadmapPath steps={roadmapSteps} />
          </div>
        )}
      </div>

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowResetConfirm(false)} />
          <div className="relative bg-white rounded-3xl shadow-xl p-8 mx-4 w-full max-w-sm">
            <div className="text-center mb-6">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#E0213A' }}
              >
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: '#2A2230' }}>目標をリセット</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#9A8B8D' }}>
                すべての目標とチェック状態が削除されます。<br />この操作は元に戻せません。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ border: '1px solid #EBE7E5', color: '#9A8B8D' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ background: '#E0213A' }}
              >
                リセットする
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
