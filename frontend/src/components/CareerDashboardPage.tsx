import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, TrendingUp, Lightbulb, ArrowRight, Send, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { bffClient } from '../services/bffClient';
import { CareerDashboard } from '../types/career';

export default function CareerDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data } = useAsyncData<CareerDashboard | null>(
    () => (user?.userid ? bffClient.getCareerDashboard(user.userid) : Promise.resolve(null)),
    [user?.userid],
  );

  if (!data) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <AppHeader userName={user?.username || 'User'} />
        <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand" /></div>
      </div>
    );
  }

  const { totals, weekly, weeklyGoal, appliedThisWeek, review, nextAction } = data;
  const maxApplied = Math.max(...weekly.map(w => w.applied), 1);
  const kpis = [
    { label: '累計応募', value: totals.applied, icon: Send, color: '#E8657A', bg: '#FFEAEC' },
    { label: '選考中', value: totals.inProgress, icon: Clock, color: '#B9761A', bg: '#F7ECD9' },
    { label: '受注', value: totals.won, icon: CheckCircle2, color: '#2F9E6E', bg: '#E4F3EC' },
    { label: '見送り', value: totals.rejected, icon: XCircle, color: '#8A7F79', bg: '#F0EAE6' },
  ];

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />
      <main className="flex-1 w-full max-w-[960px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-brand" />
          <h1 className="text-2xl font-bold text-brand-text">案件獲得ダッシュボード</h1>
        </div>

        {/* 今週の応募（目標に対する進捗） */}
        <div className="bg-white rounded-[24px] shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-brand-text">今週の応募</span>
            <span className="text-sm text-brand-muted"><span className="text-lg font-extrabold" style={{ color: '#E8657A' }}>{appliedThisWeek}</span> / {weeklyGoal} 件</span>
          </div>
          <div className="h-2.5 bg-[#EFEFEF] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (appliedThisWeek / weeklyGoal) * 100)}%`, background: 'linear-gradient(90deg, #FA9161, #E8657A)' }} />
          </div>
          {appliedThisWeek < weeklyGoal && (
            <p className="text-xs text-brand-muted mt-2">目標まであと{weeklyGoal - appliedThisWeek}件。今週中に応募しましょう。</p>
          )}
        </div>

        {/* KPIタイル */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {kpis.map(k => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: k.bg }}>
                  <Icon className="w-4 h-4" style={{ color: k.color }} />
                </div>
                <div className="text-2xl font-extrabold tabular-nums" style={{ color: k.color }}>{k.value}</div>
                <div className="text-xs text-brand-muted mt-0.5">{k.label}</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 週次応募の推移 */}
          <div className="bg-white rounded-[24px] shadow-sm p-5 sm:p-6">
            <h2 className="font-bold text-brand-text mb-4">応募数の推移</h2>
            <div className="flex items-end justify-around gap-3" style={{ height: 140 }}>
              {weekly.map((w, i) => {
                const isNow = i === weekly.length - 1;
                return (
                  <div key={w.label} className="flex flex-col items-center gap-2 flex-1">
                    <span className="text-xs font-bold" style={{ color: isNow ? '#E8657A' : '#8A7F79' }}>{w.applied}</span>
                    <div className="w-full rounded-t-lg" style={{ height: `${(w.applied / maxApplied) * 100}px`, minHeight: 6, background: isNow ? 'linear-gradient(180deg, #FA9161, #E8657A)' : '#EAD9CF' }} />
                    <span className="text-[11px] text-brand-muted">{w.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 週次の振り返り */}
          <div className="rounded-[24px] p-5 sm:p-6" style={{ background: '#F3F0FB', border: '1px solid #E3DBF5' }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" style={{ color: '#8B6FC0' }} />
              <h2 className="font-bold text-brand-text">今週の振り返り</h2>
            </div>
            <p className="text-sm text-brand-text leading-relaxed mb-3">{review.comment}</p>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5" style={{ color: '#8B6FC0' }} />
              <span className="text-xs font-bold text-brand-text">改善アイデア</span>
            </div>
            <ul className="flex flex-col gap-1">
              {review.improvements.map((imp, i) => (
                <li key={i} className="text-sm text-brand-muted flex items-start gap-1.5"><span style={{ color: '#8B6FC0' }}>・</span>{imp}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 次の一手 */}
        <div className="rounded-[24px] p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ background: 'linear-gradient(135deg, #FA9262, #E8657A)' }}>
          <div>
            <p className="text-xs font-bold bg-white/20 rounded-full px-3 py-1 inline-block mb-2">次の一手</p>
            <p className="text-lg font-bold">{nextAction}</p>
          </div>
          <button onClick={() => navigate('/coaching')} className="inline-flex items-center gap-2 bg-white text-brand font-bold rounded-full px-5 py-3 flex-shrink-0 hover:bg-white/90 transition-colors">
            コーチに相談 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>
      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span className="text-[11.4px] font-bold text-white" style={{ letterSpacing: '0.6px' }}>2026 © WEBCOACH</span>
      </footer>
    </div>
  );
}
