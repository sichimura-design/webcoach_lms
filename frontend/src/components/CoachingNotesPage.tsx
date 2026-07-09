import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, Square, Loader2, Sparkles, Check, Share2, FileText, Calendar, ListChecks, ChevronRight,
} from 'lucide-react';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { bffClient } from '../services/bffClient';
import { CoachingSessions, CoachingNote } from '../types/coaching';

type Phase = 'idle' | 'recording' | 'summarizing' | 'done';

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * コーチング準備ページ。開くと AIミーティングノート（録音→要約→タスク化）を起動できる。
 * データはモック（/webcoach/coaching-sessions, /webcoach/coaching-note）。
 */
export default function CoachingNotesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: sessions } = useAsyncData<CoachingSessions | null>(
    () => (user?.userid ? bffClient.getCoachingSessions(user.userid) : Promise.resolve(null)),
    [user?.userid],
  );

  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState<CoachingNote | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const startRecording = () => {
    setNote(null);
    setElapsed(0);
    setPhase('recording');
    timer.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const stopAndSummarize = async () => {
    if (timer.current) clearInterval(timer.current);
    setPhase('summarizing');
    try {
      const n = await bffClient.generateCoachingNote();
      setNote(n);
      setPhase('done');
    } catch {
      showToast('要約の生成に失敗しました', 'error');
      setPhase('idle');
    }
  };

  const createTasks = async () => {
    if (!note || !user?.userid) return;
    const payload = note.suggestedTasks.map((t, i) => ({ no: i + 1, description: t, is_completed: 0 as 0 | 1 }));
    await bffClient.updateNextCoachingGoals(user.userid, payload);
    showToast('タスクを作成しました。マイページで確認できます', 'success');
    navigate('/mypage');
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      <main className="flex-1 w-full max-w-[860px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* タイトル */}
        <div>
          <h1 className="text-2xl font-bold text-brand-text">コーチング</h1>
          <p className="text-sm text-brand-muted mt-1">
            コーチングの前にこのページを開くと、AIミーティングノートで録音・要約でき、終了後に記録からタスクを作れます。
          </p>
        </div>

        {/* 次回コーチング＋AIミーティングノート */}
        <div className="bg-white rounded-[28px] shadow-sm p-6 sm:p-7">
          {sessions?.next && (
            <div className="flex items-center gap-2 text-sm text-brand-muted mb-4">
              <Calendar className="w-4 h-4 text-brand" />
              次回コーチング：<span className="font-bold text-brand-text">{sessions.next.date}</span>
              <span className="text-brand-muted">/ {sessions.next.coach}</span>
            </div>
          )}

          {/* 状態別 */}
          {phase === 'idle' && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}>
                <Mic className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="font-bold text-brand-text">AIミーティングノート</p>
                <p className="text-xs text-brand-muted mt-1">起動すると録音が始まり、終了時に自動で要約とタスク候補を作成します。</p>
              </div>
              <button
                onClick={startRecording}
                className="inline-flex items-center gap-2 text-sm font-bold text-white rounded-full px-6 py-3 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
              >
                <Mic className="w-4 h-4" />
                AIミーティングノートを起動
              </button>
            </div>
          )}

          {phase === 'recording' && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="relative">
                <span className="absolute inset-0 rounded-full bg-red-400/40 animate-ping" aria-hidden />
                <div className="relative w-16 h-16 rounded-full flex items-center justify-center bg-red-500">
                  <Mic className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <p className="font-bold text-brand-text">録音中…</p>
                <p className="text-2xl font-extrabold tabular-nums mt-1" style={{ color: '#E8657A' }}>{fmt(elapsed)}</p>
                <p className="text-xs text-brand-muted mt-1">コーチングが終わったら停止してください。</p>
              </div>
              <button
                onClick={stopAndSummarize}
                className="inline-flex items-center gap-2 text-sm font-bold text-white rounded-full px-6 py-3 bg-brand-text"
              >
                <Square className="w-4 h-4 fill-current" />
                停止して要約する
              </button>
            </div>
          )}

          {phase === 'summarizing' && (
            <div className="flex flex-col items-center text-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand" />
              <p className="font-bold text-brand-text">AIが議事録を要約しています…</p>
              <p className="text-xs text-brand-muted">録音から要点とタスク候補を抽出中</p>
            </div>
          )}

          {phase === 'done' && note && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}>
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <p className="font-bold text-brand-text">ミーティングノートができました</p>
                </div>
                <button
                  onClick={() => showToast('サマリーを共有しました（デモ）', 'success')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5"
                  style={{ color: '#E8657A', border: '1px solid #E8B5BB', background: '#fff' }}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  共有
                </button>
              </div>

              {/* サマリー */}
              <div className="rounded-2xl p-4" style={{ background: '#FCF9F6', border: '1px solid #F0EAE6' }}>
                <p className="text-xs font-bold text-brand-muted mb-1.5">サマリー</p>
                <p className="text-sm text-brand-text leading-relaxed">{note.summary}</p>
              </div>

              {/* 要点 */}
              <div>
                <p className="text-xs font-bold text-brand-muted mb-2">話したこと（要点）</p>
                <ul className="flex flex-col gap-1.5">
                  {note.keyPoints.map((k, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-brand-text">
                      <Check className="w-4 h-4 mt-0.5 text-brand flex-shrink-0" />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>

              {/* タスク候補 */}
              <div className="rounded-2xl p-4" style={{ background: '#FFF5F0', border: '1px dashed #F0C9CE' }}>
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="w-4 h-4 text-brand" />
                  <p className="text-sm font-bold text-brand-text">この記録からのタスク候補</p>
                </div>
                <ul className="flex flex-col gap-1 mb-4">
                  {note.suggestedTasks.map((t, i) => (
                    <li key={i} className="text-sm text-brand-text flex items-start gap-2">
                      <span className="text-brand">・</span>{t}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={createTasks}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-white rounded-xl px-4 py-3"
                  style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
                >
                  <Sparkles className="w-4 h-4" />
                  この記録からタスクを作る（マイページに反映）
                </button>
              </div>

              {/* 文字起こし（折りたたみ） */}
              <details className="rounded-2xl p-4" style={{ background: '#FAFAF9', border: '1px solid #F0EAE6' }}>
                <summary className="text-xs font-bold text-brand-muted cursor-pointer flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> 文字起こしを見る
                </summary>
                <p className="text-sm text-brand-muted leading-relaxed mt-3">{note.transcript}</p>
              </details>

              <button onClick={startRecording} className="text-xs text-brand-muted underline self-center">
                もう一度録音する
              </button>
            </div>
          )}
        </div>

        {/* 過去のコーチング */}
        <div>
          <h2 className="text-lg font-bold text-brand-text mb-3">これまでのコーチング</h2>
          <div className="flex flex-col gap-3">
            {sessions?.past?.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFF0EF' }}>
                  <FileText className="w-4 h-4 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-brand-text">{s.title}</span>
                    <span className="text-xs text-brand-muted">{s.date}</span>
                    {s.tasksCreated && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: '#2F9E6E', background: '#E4F3EC' }}>
                        タスク化済み
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-brand-muted mt-1">{s.summary}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-brand-subtle mt-1 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span className="text-[11.4px] font-bold text-white" style={{ letterSpacing: '0.6px' }}>2026 © WEBCOACH</span>
      </footer>
    </div>
  );
}
