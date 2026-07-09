import React, { useEffect, useState } from 'react';
import { Calendar, Sparkles, Loader2, Check, Clock, TrendingUp, Lightbulb } from 'lucide-react';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { bffClient } from '../services/bffClient';
import { StudyPlan } from '../types/studyPlan';

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

/**
 * 学習計画ページ。月間カレンダー＋週間の予定を持ち、「AIで生成」で週間予定を作る。
 * 来週分を作るときは、前週の進捗をもとにAIが振り返り＋改善提案を出す。
 * データはモック（/webcoach/study-plan）。
 */
export default function StudyPlanPage() {
  const { user } = useAuth();
  const { data } = useAsyncData<StudyPlan | null>(
    () => (user?.userid ? bffClient.getStudyPlan(user.userid) : Promise.resolve(null)),
    [user?.userid],
  );
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => { if (data) setPlan(data); }, [data]);

  const generate = async (mode: 'this' | 'next') => {
    setGenLoading(true);
    try {
      const r = await bffClient.generateStudyPlan(mode);
      setPlan(r);
    } finally {
      setGenLoading(false);
    }
  };

  const toggleSession = (dayIdx: number, sIdx: number) => {
    setPlan(p => {
      if (!p) return p;
      const days = p.days.map((d, i) =>
        i !== dayIdx ? d : { ...d, sessions: d.sessions.map((s, j) => (j === sIdx ? { ...s, done: !s.done } : s)) },
      );
      return { ...p, days };
    });
  };

  // ── 月間カレンダー用の計算（当月） ──
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const startPad = (new Date(year, month, 1).getDay() + 6) % 7; // 月曜始まり
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const iso = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const plannedDates = new Set((plan?.days || []).filter(d => d.sessions.length > 0).map(d => d.date));
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const totalMinutes = (plan?.days || []).reduce((sum, d) => sum + d.sessions.reduce((a, s) => a + s.minutes, 0), 0);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      <main className="flex-1 w-full max-w-[980px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-brand-text">学習計画</h1>
            <p className="text-sm text-brand-muted mt-1">月間の見通しと、今週やることをAIと一緒に決めましょう。</p>
          </div>
          <button
            onClick={() => generate(plan?.hasPlan ? 'next' : 'this')}
            disabled={genLoading}
            className="inline-flex items-center justify-center gap-2 text-sm font-bold text-white rounded-full px-5 py-2.5 shadow-sm disabled:opacity-50 self-start sm:self-auto"
            style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
          >
            {genLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {genLoading ? '生成中...' : plan?.hasPlan ? 'AIで来週の計画を作る' : 'AIで今週の計画を作る'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* 月間カレンダー */}
          <div className="bg-white rounded-[24px] shadow-sm p-5 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-brand" />
              <h2 className="font-bold text-brand-text">{year}年{month + 1}月</h2>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map(w => (
                <div key={w} className="text-[11px] font-bold text-brand-muted py-1">{w}</div>
              ))}
              {cells.map((d, i) => {
                if (d === null) return <div key={`p${i}`} />;
                const dIso = iso(d);
                const planned = plannedDates.has(dIso);
                const isToday = dIso === todayIso;
                return (
                  <div key={d} className="aspect-square flex flex-col items-center justify-center rounded-lg text-xs"
                    style={{ background: isToday ? '#FFEAEC' : 'transparent', color: isToday ? '#E8657A' : '#5A4F49', fontWeight: isToday ? 700 : 400 }}
                  >
                    {d}
                    <span className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: planned ? '#FA9262' : 'transparent' }} />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-[11px] text-brand-muted">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FA9262' }} />
              学習予定のある日
            </div>
          </div>

          {/* 週間予定 */}
          <div className="flex flex-col gap-4">
            {/* 振り返り（来週分を生成したとき） */}
            {plan?.review && (
              <div className="rounded-[24px] p-5" style={{ background: '#F3F0FB', border: '1px solid #E3DBF5' }}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4" style={{ color: '#8B6FC0' }} />
                  <h3 className="font-bold text-brand-text">AIの振り返り（{plan.review.lastWeekLabel}）</h3>
                </div>
                <div className="flex gap-4 mb-3 text-sm">
                  <span className="text-brand-muted">達成 <span className="font-bold text-brand-text">{plan.review.completed}/{plan.review.planned}</span></span>
                  <span className="text-brand-muted">連続 <span className="font-bold text-brand-text">{plan.review.streak}日</span></span>
                </div>
                <p className="text-sm text-brand-text leading-relaxed mb-3">{plan.review.comment}</p>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="w-3.5 h-3.5" style={{ color: '#8B6FC0' }} />
                  <span className="text-xs font-bold text-brand-text">今週の改善アイデア</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {plan.review.improvements.map((imp, i) => (
                    <li key={i} className="text-sm text-brand-muted flex items-start gap-1.5"><span style={{ color: '#8B6FC0' }}>・</span>{imp}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white rounded-[24px] shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-brand-text">今週の計画 <span className="text-brand-muted font-normal text-sm">（{plan?.weekLabel}）</span></h2>
                {plan?.hasPlan && (
                  <span className="text-xs text-brand-muted flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />合計 {Math.floor(totalMinutes / 60)}h{totalMinutes % 60}m
                  </span>
                )}
              </div>

              {!plan?.hasPlan ? (
                <div className="flex flex-col items-center text-center py-10 gap-3">
                  <Calendar className="w-10 h-10 text-brand-subtle" />
                  <p className="text-sm text-brand-muted">まだ今週の計画がありません。<br />「AIで今週の計画を作る」から始めましょう。</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: '#F0EAE6' }}>
                  {plan.days.map((day, di) => (
                    <div key={day.date} className="flex gap-3 py-3">
                      <div className="w-12 flex-shrink-0 text-center">
                        <div className="text-xs text-brand-muted">{day.weekday}</div>
                        <div className="text-sm font-bold" style={{ color: day.date === todayIso ? '#E8657A' : '#5A4F49' }}>{day.md.split('/')[1]}</div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        {day.sessions.length === 0 ? (
                          <span className="text-xs text-brand-subtle py-1">予定なし（休養日）</span>
                        ) : (
                          day.sessions.map((s, si) => (
                            <button
                              key={si}
                              onClick={() => toggleSession(di, si)}
                              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors"
                              style={{ background: s.done ? '#F1F8F4' : '#FCF9F6', border: '1px solid #F0EAE6' }}
                            >
                              <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                                style={{ borderColor: s.done ? '#2FA372' : '#E0D8D4', background: s.done ? '#2FA372' : '#fff' }}>
                                {s.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                              </span>
                              <span className="flex-1 min-w-0 text-sm" style={{ color: s.done ? '#7E6E68' : '#4B3A33', textDecoration: s.done ? 'line-through' : 'none' }}>
                                {s.title}
                              </span>
                              <span className="text-xs text-brand-muted flex items-center gap-1 flex-shrink-0"><Clock className="w-3 h-3" />{s.minutes}分</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span className="text-[11.4px] font-bold text-white" style={{ letterSpacing: '0.6px' }}>2026 © WEBCOACH</span>
      </footer>
    </div>
  );
}
