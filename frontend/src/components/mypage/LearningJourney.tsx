import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Play, Check, Lock, Trophy, Flag, ChevronRight, Sparkles } from 'lucide-react';
import { bffClient } from '../../services/bffClient';
import { useAsyncData } from '../../hooks/useAsyncData';
import { LearningJourney as Journey, JourneyNode, JourneyPhase } from '../../types/journey';

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

interface Props {
  userId?: number;
}

/**
 * マイページの主役。今日のクエスト＋ストリーク＋ゲーム風フェーズ・ロードマップ。
 * データは GET /api/webcoach/journey/{userid}（モック）から取得。
 */
export function LearningJourney({ userId }: Props) {
  const navigate = useNavigate();
  const { data, loading } = useAsyncData<Journey | null>(
    () => (userId ? bffClient.getLearningJourney(userId) : Promise.resolve(null)),
    [userId],
  );

  if (loading || !data) {
    return (
      <div className="bg-white rounded-[32px] shadow-sm p-8 mb-6 animate-pulse">
        <div className="h-6 w-40 bg-[#F0EAE6] rounded mb-4" />
        <div className="h-24 bg-[#F7F1EC] rounded-2xl" />
      </div>
    );
  }

  const { goal, todayQuest, streak, phases, nodes } = data;

  return (
    <div className="mb-6 flex flex-col gap-6">
      {/* ── ゴール＋ストリーク ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Flag className="w-5 h-5 text-brand flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-brand-muted">あなたのゴール</p>
            <p className="text-lg font-bold text-brand-text truncate">{goal}</p>
          </div>
        </div>
        <StreakBadge streak={streak} />
      </div>

      {/* ── 今日のクエスト ─────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-[28px] p-6 sm:p-7 text-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #FA9262 0%, #E8657A 100%)' }}
      >
        <div className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-6 w-32 h-32 rounded-full bg-white/10" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">今日のクエスト</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold leading-snug">{todayQuest.title}</h2>
            <p className="text-sm text-white/85 mt-1">{todayQuest.subtitle}</p>
          </div>
          <button
            onClick={() => navigate(`/course/${todayQuest.courseId}/curriculum`)}
            className="flex-shrink-0 inline-flex items-center justify-center gap-2 bg-white text-brand font-bold rounded-full px-6 py-3 hover:bg-white/90 transition-colors shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            {todayQuest.cta}
          </button>
        </div>
      </div>

      {/* ── ゲーム風ロードマップ ───────────────────────── */}
      <div className="bg-white rounded-[32px] shadow-sm p-5 sm:p-8">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-brand" />
          <h2 className="text-lg font-bold text-brand-text">学習ロードマップ</h2>
        </div>
        <p className="text-sm text-brand-muted mb-6">
          ゴールまでを{phases.length}つのフェーズに分解。いまここから、一歩ずつ。
        </p>

        <div className="flex flex-col gap-8">
          {phases.map((phase) => (
            <PhaseBlock
              key={phase.id}
              phase={phase}
              nodes={nodes.filter((n) => n.phaseId === phase.id)}
              onNodeClick={(node) => {
                if (node.status !== 'locked' && node.courseId) {
                  navigate(`/course/${node.courseId}/curriculum`);
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ストリークバッジ ─────────────────────────────────
function StreakBadge({ streak }: { streak: Journey['streak'] }) {
  return (
    <div className="flex items-center gap-3 bg-[#FFF5EA] rounded-2xl px-4 py-2.5 self-start">
      <div className="flex items-center gap-1.5">
        <Flame className="w-6 h-6 text-[#FA9262] fill-[#FDBA74]" />
        <div className="leading-none">
          <span className="text-2xl font-extrabold text-[#FA9262]">{streak.current}</span>
          <span className="text-xs font-bold text-[#FA9262] ml-0.5">日連続</span>
        </div>
      </div>
      <div className="flex items-center gap-1 pl-3 border-l border-[#F3D9C4]">
        {streak.last7days.map((done, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: done ? '#FA9262' : '#F0E4D8' }}
            >
              {done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span className="text-[9px] text-brand-muted">{DAY_LABELS[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── フェーズブロック（見出し＋到達目標＋ノード列） ───────
function PhaseBlock({
  phase,
  nodes,
  onNodeClick,
}: {
  phase: JourneyPhase;
  nodes: JourneyNode[];
  onNodeClick: (n: JourneyNode) => void;
}) {
  const statusStyle: Record<string, { badge: string; badgeBg: string; label: string }> = {
    done: { badge: '#2F9E6E', badgeBg: '#E4F3EC', label: '完了' },
    current: { badge: '#E8657A', badgeBg: '#FFEAEC', label: '進行中' },
    locked: { badge: '#9C8F87', badgeBg: '#F0EAE6', label: 'これから' },
  };
  const st = statusStyle[phase.status];

  return (
    <div className="relative">
      {/* フェーズ見出し */}
      <div className="rounded-2xl border border-[#F0EAE6] p-4 mb-2 bg-[#FCF9F6]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h3 className="font-bold text-brand-text text-[15px]">{phase.title}</h3>
          <span
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
            style={{ color: st.badge, background: st.badgeBg }}
          >
            {st.label}
          </span>
        </div>
        <div className="flex items-start gap-1.5 text-sm text-brand-muted">
          <Flag className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: st.badge }} />
          <span>到達目標：{phase.outcome}</span>
        </div>
        {phase.status !== 'locked' && (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-brand-muted mb-1">
              <span>進捗</span>
              <span className="font-bold" style={{ color: st.badge }}>{phase.progress}%</span>
            </div>
            <div className="h-1.5 bg-[#EFE7E0] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${phase.progress}%`, background: st.badge }} />
            </div>
          </div>
        )}
      </div>

      {/* ノード列（ゲーム風ジグザグ） */}
      <div className="relative py-2">
        {/* 中央の点線トレイル */}
        <div
          className="absolute top-6 bottom-6 left-1/2 -translate-x-1/2 w-0 border-l-2 border-dashed border-[#EFE4DB]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5">
          {nodes.map((node, i) => {
            const offset = [0, 56, 0, -56][i % 4];
            return (
              <div key={node.id} className="flex justify-center">
                <div style={{ transform: `translateX(${offset}px)` }} className="flex flex-col items-center">
                  <NodeCircle node={node} onClick={() => onNodeClick(node)} />
                  <span
                    className="mt-1.5 text-xs text-center max-w-[130px] leading-tight"
                    style={{ color: node.status === 'locked' ? '#B4A89F' : '#5A4F49', fontWeight: node.status === 'current' ? 700 : 400 }}
                  >
                    {node.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ノードの円（マス） ───────────────────────────────
function NodeCircle({ node, onClick }: { node: JourneyNode; onClick: () => void }) {
  const clickable = node.status !== 'locked' && !!node.courseId;

  let icon: React.ReactNode;
  let bg = '';
  let ring = false;
  if (node.status === 'locked') {
    icon = <Lock className="w-5 h-5 text-[#B4A89F]" />;
    bg = '#F0EAE6';
  } else if (node.status === 'done') {
    icon = <Check className="w-6 h-6 text-white" strokeWidth={3} />;
    bg = '#2FA372';
  } else {
    // current
    icon = node.type === 'boss'
      ? <Trophy className="w-6 h-6 text-white" />
      : <Play className="w-6 h-6 text-white fill-current" />;
    ring = true;
  }

  return (
    <div className="relative">
      {node.status === 'current' && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-white bg-brand rounded-full px-2.5 py-1 shadow-sm">
          今日はここから
        </span>
      )}
      {ring && (
        <span className="absolute inset-0 rounded-full bg-brand/40 animate-ping" aria-hidden />
      )}
      <button
        onClick={onClick}
        disabled={!clickable}
        aria-label={node.title}
        className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-sm transition-transform"
        style={{
          background: ring ? 'linear-gradient(135deg, #FA9262 0%, #E8657A 100%)' : bg,
          cursor: clickable ? 'pointer' : 'default',
          border: node.type === 'boss' && node.status !== 'locked' ? '3px solid #FFD454' : 'none',
        }}
      >
        {icon}
      </button>
    </div>
  );
}

export default LearningJourney;
