import React, { useState } from 'react';
import { ChevronDown, MessageCircle, ExternalLink } from 'lucide-react';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';

const FAQS = [
  { q: '学習は1日どれくらい進めればいいですか？', a: 'まずは1日15〜30分から。マイページの「今日のクエスト」を1つこなすだけでもストリークが伸び、習慣化しやすくなります。' },
  { q: '目標がうまく決められません。', a: '「次回コーチングまでの目標」で達成したいことを入れて「AIで分解する」を押すと、やることに分解してくれます。前回のコーチング記録からも作れます。' },
  { q: 'コーチングの記録は残りますか？', a: 'コーチングページでAIミーティングノートを起動すると、録音・要約が残り、そこからタスクを作れます。過去のコーチングも一覧で振り返れます。' },
  { q: '教材でわからないところがあります。', a: '各画面のAIコーチに質問できます。教材では、わからない文章を選択して質問すると、その内容に沿って解説します。' },
  { q: '案件応募の状況はどこで見られますか？', a: '「案件獲得」ダッシュボードで応募数・選考状況・結果を数値で確認でき、週次の振り返りと次の一手も表示されます。' },
];

export default function FaqPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />
      <main className="flex-1 w-full max-w-[760px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">よくある質問</h1>
          <p className="text-sm text-brand-muted mt-1">つまずきやすいポイントをまとめました。</p>
        </div>

        <div className="flex flex-col gap-2">
          {FAQS.map((f, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="font-bold text-sm text-brand-text">{f.q}</span>
                <ChevronDown className={`w-4 h-4 text-brand-muted flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              {open === i && (
                <p className="px-5 pb-4 text-sm text-brand-muted leading-relaxed">{f.a}</p>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between gap-3">
          <p className="text-sm text-brand-muted">解決しないときは運営へ。</p>
          <a
            href="https://o4dqp.channel.io/workflows/783132"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white rounded-full px-4 py-2.5 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
          >
            <MessageCircle className="w-4 h-4" /> 運営に相談 <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </main>
      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span className="text-[11.4px] font-bold text-white" style={{ letterSpacing: '0.6px' }}>2026 © WEBCOACH</span>
      </footer>
    </div>
  );
}
