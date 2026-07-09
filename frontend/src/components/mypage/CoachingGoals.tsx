import React, { useState, useRef } from 'react';
import { Plus, X, RotateCcw, GripVertical, Check, Pencil, Sparkles, Loader2, Mic } from 'lucide-react';
import { useCoachingGoals, Goal } from '../../hooks/useCoachingGoals';
import { bffClient } from '../../services/bffClient';

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
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<'goal' | 'coaching'>('goal');
  const [coachingNotes, setCoachingNotes] = useState('');
  const [recording, setRecording] = useState(false);

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

  const handleAiBreakdown = async (text: string, source: 'goal' | 'coaching') => {
    if (!text.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const { subgoals } = await bffClient.breakdownGoal(text.trim(), source);
      saveGoals(subgoals.map(t => ({ no: null, text: t, completed: false })));
      setAiInput('');
      setCoachingNotes('');
    } catch {
      // 失敗時は何もしない（プロトタイプ）
    } finally {
      setAiLoading(false);
    }
  };

  // コーチング音声からの取り込み（デモ：録音をシミュレートしてサンプル文字起こしを入れる）
  const handleDemoRecord = () => {
    if (recording) return;
    setRecording(true);
    setTimeout(() => {
      setCoachingNotes(
        '今日のコーチングでは、ポートフォリオ用にバナーを3枚作ることを目標にしました。前回の余白の取り方が課題だったのでそこを意識すること。参考サイトを3つ見て分析するのと、配色は2パターン用意して次回持ってくるよう言われました。',
      );
      setRecording(false);
    }, 1500);
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
            <div className="w-1 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #E86D78, #FA9262)' }} />
            <h2 className="text-lg font-bold text-brand-text">次回コーチングまでの目標</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
                style={{ background: '#FFFFFF', color: '#E86D78', border: '1px solid #E86D78' }}
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
                  style={{ color: '#7E6E68', border: '1px solid #E0D8D4' }}
                >
                  キャンセル
                </button>
                <button
                  onClick={saveEditing}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-bold text-white rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
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
                style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
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
          <p className="text-4xl font-extrabold mb-2" style={{ color: '#E86D78' }}>
            {progressPercent}%
          </p>
          <div className="h-2.5 bg-[#EFEFEF] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #FA9161, #E86D78)' }}
            />
          </div>
        </div>

        {/* Goals List */}
        {loading ? (
          <div className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#E86D78', borderTopColor: 'transparent' }} />
          </div>
        ) : displayGoals.length === 0 && !isEditing ? (
          <div className="rounded-2xl border border-dashed p-5 sm:p-6" style={{ borderColor: '#F0C9CE', background: '#FFF8F5' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-bold text-brand-text">AIが目標を細分化します</p>
            </div>

            {/* モード切替 */}
            <div className="inline-flex rounded-full bg-[#F3E4DE] p-1 mb-4">
              {([['goal', '達成したいこと'], ['coaching', '前回のコーチングから']] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setAiMode(m)}
                  className="text-xs font-bold rounded-full px-3 py-1.5 transition-colors"
                  style={aiMode === m
                    ? { background: '#fff', color: '#E86D78', boxShadow: '0 1px 2px rgba(0,0,0,.06)' }
                    : { background: 'transparent', color: '#9C8079' }}
                >
                  {label}
                </button>
              ))}
            </div>

            {aiMode === 'goal' ? (
              <>
                <p className="text-xs text-brand-muted mb-3">
                  達成したいことを一言で入れると、次回コーチングまでにやることに分解します。
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAiBreakdown(aiInput, 'goal')}
                    placeholder="例：3ヶ月でWebデザインの案件を1件獲得する"
                    className="flex-1 text-sm rounded-xl px-3 py-2.5 bg-white focus:outline-none"
                    style={{ border: '1px solid #E8D6D0' }}
                  />
                  <button
                    onClick={() => handleAiBreakdown(aiInput, 'goal')}
                    disabled={!aiInput.trim() || aiLoading}
                    className="flex items-center justify-center gap-1.5 text-sm font-bold text-white rounded-xl px-4 py-2.5 transition-opacity disabled:opacity-40 flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiLoading ? '分解中...' : 'AIで分解する'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs text-brand-muted">
                    前回コーチングで話したことを入れると、コーチと決めたタスクに分解します。
                  </p>
                  <button
                    onClick={handleDemoRecord}
                    disabled={recording}
                    className="flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5 flex-shrink-0 transition-colors disabled:opacity-60"
                    style={{ color: '#E86D78', border: '1px solid #E8B5BB', background: '#fff' }}
                  >
                    {recording ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                    {recording ? '文字起こし中...' : '録音から取り込む（デモ）'}
                  </button>
                </div>
                <textarea
                  value={coachingNotes}
                  onChange={e => setCoachingNotes(e.target.value)}
                  rows={4}
                  placeholder="コーチングで話した内容を貼り付け、または「録音から取り込む」で自動入力"
                  className="w-full text-sm rounded-xl px-3 py-2.5 bg-white focus:outline-none resize-none mb-2"
                  style={{ border: '1px solid #E8D6D0' }}
                />
                <button
                  onClick={() => handleAiBreakdown(coachingNotes, 'coaching')}
                  disabled={!coachingNotes.trim() || aiLoading}
                  className="w-full flex items-center justify-center gap-1.5 text-sm font-bold text-white rounded-xl px-4 py-2.5 transition-opacity disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiLoading ? 'タスク化中...' : 'この記録からタスクを作る'}
                </button>
              </>
            )}

            <button
              onClick={startEditing}
              className="mt-3 text-xs text-brand-muted underline hover:text-brand transition-colors"
            >
              自分で入力する
            </button>
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
                    borderColor: '#E86D78',
                    background: goal.completed ? '#E86D78' : '#FFFFFF',
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
                      color: '#4B3A33',
                      borderBottom: '1px solid #E0D8D4',
                    }}
                    onFocus={e => { e.currentTarget.style.borderBottomColor = '#E86D78'; }}
                    onBlur={e => { e.currentTarget.style.borderBottomColor = '#E0D8D4'; }}
                  />
                ) : (
                  <span
                    className="flex-1 text-sm"
                    style={{ color: goal.completed ? '#7E6E68' : '#4B3A33' }}
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
                  style={{ color: '#4B3A33' }}
                  autoFocus={editGoals.length === 0}
                />
                <button
                  onClick={addEditGoal}
                  disabled={!newGoalText.trim()}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white disabled:opacity-30 transition-opacity flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
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
                style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
              >
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: '#4B3A33' }}>目標をリセット</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#7E6E68' }}>
                すべての目標とチェック状態が削除されます。<br />この操作は元に戻せません。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors"
                style={{ border: '1px solid #E0D8D4', color: '#7E6E68' }}
              >
                キャンセル
              </button>
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
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
