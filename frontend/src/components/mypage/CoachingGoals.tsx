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
      <div className="bg-white rounded-[32px] shadow-sm p-6 sm:p-8 mb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #FF5A7A, #FFC24B)' }} />
            <h2 className="text-lg font-bold text-brand-text">次回コーチングまでの目標</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
                style={{ background: '#FFFFFF', color: '#FF5A7A', border: '1px solid #FF5A7A' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFF5F0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; }}
              >
                <RotateCcw className="w-3 h-3" />
                目標をリセット
              </button>
            )}
            {isEditing ? (
              <>
                <button
                  onClick={cancelEditing}
                  className="flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 transition-colors"
                  style={{ color: '#7A7392', border: '1px solid #E0D8D4' }}
                >
                  キャンセル
                </button>
                <button
                  onClick={saveEditing}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-bold text-white rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #FF5A7A, #FFC24B)' }}
                >
                  <Check className="w-3 h-3" />
                  保存する
                </button>
              </>
            ) : (
              <button
                onClick={startEditing}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-bold text-white rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #FF5A7A, #FFC24B)' }}
              >
                <Pencil className="w-3 h-3" />
                目標を編集
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-5">
          <p className="text-xs text-brand-muted mb-1">全体の進捗</p>
          <p className="text-4xl font-extrabold mb-2" style={{ color: '#FF5A7A' }}>
            {progressPercent}%
          </p>
          <div className="h-2.5 bg-[#EFEFEF] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #FFC24B, #FF5A7A)' }}
            />
          </div>
        </div>

        {/* Goals List */}
        {loading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#FF5A7A', borderTopColor: 'transparent' }} />
          </div>
        ) : displayGoals.length === 0 && !isEditing ? (
          <div className="py-6 text-center text-sm" style={{ color: '#7A7392' }}>
            目標がありません。「目標を編集」から追加してください。
          </div>
        ) : (
          <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#F0EAE6' }}>
            {displayGoals.map((goal, index) => (
              <div
                key={isEditing ? index : (goal.no ?? index)}
                data-goal-row
                className="flex items-center gap-3 px-4 py-3.5 transition-all"
                style={{
                  borderTop: index > 0 ? '1px solid #F0EAE6' : undefined,
                  background: draggingIndex === index ? '#F5F0ED' : goal.completed ? '#FFF9F6' : '#FFFFFF',
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
                    style={{ color: '#C3BAB4', touchAction: 'none' }}
                  >
                    <GripVertical className="w-5 h-5" />
                  </div>
                )}

                <button
                  onClick={() => !isEditing && toggleGoal(index)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isEditing ? 'cursor-default pointer-events-none' : 'cursor-pointer'
                  }`}
                  style={{
                    borderColor: '#FF5A7A',
                    background: goal.completed ? '#FF5A7A' : '#FFFFFF',
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
                      color: '#2B2440',
                      borderBottom: '1px solid #E0D8D4',
                    }}
                    onFocus={e => { e.currentTarget.style.borderBottomColor = '#FF5A7A'; }}
                    onBlur={e => { e.currentTarget.style.borderBottomColor = '#E0D8D4'; }}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm"
                    style={{ color: goal.completed ? '#7A7392' : '#2B2440' }}
                  >
                    {goal.text}
                  </span>
                )}

                {isEditing && (
                  <button
                    onClick={() => deleteEditGoal(index)}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                    style={{ color: '#C3BAB4' }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.color = '#F87171';
                      el.style.background = '#FEF2F2';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.color = '#C3BAB4';
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
                  background: '#FAFAF9',
                  borderTop: displayGoals.length > 0 ? '1px dashed #D8D0CC' : undefined,
                }}
              >
                <div className="w-5 flex-shrink-0" />
                <div
                  className="w-5 h-5 rounded flex-shrink-0"
                  style={{ border: '2px dashed #C3BAB4' }}
                />
                <input
                  type="text"
                  value={newGoalText}
                  onChange={e => setNewGoalText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEditGoal()}
                  placeholder="新しい目標を入力..."
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                  style={{ color: '#2B2440' }}
                  autoFocus={editGoals.length === 0}
                />
                <button
                  onClick={addEditGoal}
                  disabled={!newGoalText.trim()}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-opacity flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #FF5A7A, #FFC24B)' }}
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
                style={{ background: 'linear-gradient(135deg, #FF5A7A, #FFC24B)' }}
              >
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: '#2B2440' }}>目標をリセット</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#7A7392' }}>
                すべての目標とチェック状態が削除されます。<br />この操作は元に戻せません。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors"
                style={{ border: '1px solid #E0D8D4', color: '#7A7392' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #FF5A7A, #FFC24B)' }}
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
