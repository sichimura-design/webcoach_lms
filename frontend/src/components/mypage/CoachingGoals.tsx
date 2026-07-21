import React, { useState, useRef } from 'react';
import { Plus, X, RotateCcw, GripVertical, Check, Pencil } from 'lucide-react';
import { useCoachingGoals, Goal } from '../../hooks/useCoachingGoals';

interface CoachingGoalsProps {
  userId: number | undefined;
}

export function CoachingGoals({ userId }: CoachingGoalsProps) {
  const { goals, loading, saving, saveGoals } = useCoachingGoals(userId);

  const [isEditing, setIsEditing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editGoals, setEditGoals] = useState<Goal[]>([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const dragItem = useRef<number | null>(null);
  const lastDragOver = useRef<number | null>(null);

  const completedCount = goals.filter(g => g.completed).length;
  const progressPercent = goals.length === 0 ? 0 : Math.round((completedCount / goals.length) * 100);

  const toggleGoal = (index: number) => {
    const updated = goals.map((g, i) => i === index ? { ...g, completed: !g.completed } : g);
    saveGoals(updated);
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
      ? [...editGoals, { no: null, text: newGoalText.trim(), completed: false }]
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
    setEditGoals(prev => [...prev, { no: null, text: newGoalText.trim(), completed: false }]);
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
      <div className="bg-dash-surface border border-dash-border rounded-[28px] shadow-[0_16px_38px_rgba(96,70,65,0.08)] p-5 sm:p-7 lg:p-7 mb-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <div>
            <h2 className="flex items-center gap-2.5 m-0 font-bold text-dash-text" style={{ fontSize: 'clamp(16px, 1.6vw, 20px)' }}>
              <span className="w-1 rounded flex-shrink-0" style={{ height: 26, background: 'linear-gradient(180deg, #E0242B, #ff7d82)' }} />
              次回コーチングまでの目標
            </h2>
            <p className="mt-3 text-sm font-semibold text-dash-muted">全体の進捗</p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ border: '1px solid rgba(224,36,43,0.62)', color: '#E0242B', background: 'rgba(255,255,255,0.74)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFF1F2'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.74)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                目標をリセット
              </button>
            )}
            {isEditing ? (
              <>
                <button
                  onClick={cancelEditing}
                  className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ color: '#68707C', border: '1px solid #EBE7E5' }}
                >
                  キャンセル
                </button>
                <button
                  onClick={saveEditing}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ border: '1px solid #E0242B', background: 'linear-gradient(145deg, #ef4249, #D30F1A)', boxShadow: '0 9px 18px rgba(216,15,26,0.18)' }}
                >
                  <Check className="w-3.5 h-3.5" />
                  保存する
                </button>
              </>
            ) : (
              <button
                onClick={startEditing}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ border: '1px solid #E0242B', background: 'linear-gradient(145deg, #ef4249, #D30F1A)', boxShadow: '0 9px 18px rgba(216,15,26,0.18)' }}
              >
                <Pencil className="w-3.5 h-3.5" />
                目標を編集
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-5">
          <p className="font-extrabold leading-none text-dash-primary" style={{ fontSize: 'clamp(30px, 3.6vw, 40px)' }}>
            {progressPercent}%
          </p>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 10, background: '#eef0f2' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #E0242B, #D30F1A)' }}
              />
            </div>
            <span
              className="text-center font-extrabold flex-shrink-0"
              style={{ minWidth: 38, padding: '6px 8px', borderRadius: 999, background: '#f2f3f4', color: '#5b626d', fontSize: 11 }}
            >
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Goals List */}
        {loading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#E0242B', borderTopColor: 'transparent' }} />
          </div>
        ) : displayGoals.length === 0 && !isEditing ? (
          <div className="mt-6 pt-6 text-center" style={{ borderTop: '1px dashed #E3DFDD', color: '#5E6570' }}>
            <p className="text-sm">目標がありません。「目標を編集」から追加してください。</p>
            <div className="mt-3" style={{ color: '#F39A9E', fontSize: 20, letterSpacing: '-6px' }}>⌁⌁⌁</div>
          </div>
        ) : (
          <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#EBE7E5' }}>
            {displayGoals.map((goal, index) => (
              <div
                key={isEditing ? index : (goal.no ?? index)}
                data-goal-row
                className="flex items-center gap-3 px-4 py-3.5 transition-all"
                style={{
                  borderTop: index > 0 ? '1px solid #EBE7E5' : undefined,
                  background: draggingIndex === index ? '#F3EFEE' : goal.completed ? '#FFF1F2' : '#FFFFFF',
                  opacity: draggingIndex === index ? 0.5 : 1,
                }}
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
                    <GripVertical className="w-5 h-5" />
                  </div>
                )}

                <button
                  onClick={() => !isEditing && toggleGoal(index)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD] ${
                    isEditing ? 'cursor-default pointer-events-none' : 'cursor-pointer'
                  }`}
                  style={{
                    borderColor: '#E0242B',
                    background: goal.completed ? '#E0242B' : '#FFFFFF',
                  }}
                >
                  {goal.completed && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </button>

                {isEditing ? (
                  <input
                    type="text"
                    value={goal.text}
                    onChange={e => setEditGoals(prev => prev.map((g, i) => i === index ? { ...g, text: e.target.value } : g))}
                    className="flex-1 text-sm bg-transparent focus:outline-none py-0.5"
                    style={{
                      color: '#171D2A',
                      borderBottom: '1px solid #EBE7E5',
                    }}
                    onFocus={e => { e.currentTarget.style.borderBottomColor = '#E0242B'; }}
                    onBlur={e => { e.currentTarget.style.borderBottomColor = '#EBE7E5'; }}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm"
                    style={{ color: goal.completed ? '#68707C' : '#171D2A' }}
                  >
                    {goal.text}
                  </span>
                )}

                {isEditing && (
                  <button
                    onClick={() => deleteEditGoal(index)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{ color: '#C7C2BF' }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.color = '#D30F1A';
                      el.style.background = '#FFF1F2';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.color = '#C7C2BF';
                      el.style.background = 'transparent';
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {isEditing && (
              <div
                className="flex items-center gap-3 px-4 py-3.5"
                style={{
                  background: '#FAF8F7',
                  borderTop: displayGoals.length > 0 ? '1px dashed #EBE7E5' : undefined,
                }}
              >
                <div className="w-5 flex-shrink-0" />
                <div
                  className="w-5 h-5 rounded flex-shrink-0"
                  style={{ border: '2px dashed #C7C2BF' }}
                />
                <input
                  type="text"
                  value={newGoalText}
                  onChange={e => setNewGoalText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEditGoal()}
                  placeholder="新しい目標を入力..."
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                  style={{ color: '#171D2A' }}
                  autoFocus={editGoals.length === 0}
                />
                <button
                  onClick={addEditGoal}
                  disabled={!newGoalText.trim()}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-opacity flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: 'linear-gradient(135deg, #E0242B, #D30F1A)' }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
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
                style={{ background: 'linear-gradient(135deg, #E0242B, #D30F1A)' }}
              >
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: '#171D2A' }}>目標をリセット</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#68707C' }}>
                すべての目標とチェック状態が削除されます。<br />この操作は元に戻せません。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ border: '1px solid #EBE7E5', color: '#68707C' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ background: 'linear-gradient(135deg, #E0242B, #D30F1A)' }}
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
