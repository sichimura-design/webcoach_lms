import React from 'react';
import { BookOpen, PlayCircle, Target, MessageCircle, ExternalLink } from 'lucide-react';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';

const SECTIONS = [
  {
    icon: PlayCircle,
    title: 'はじめかた',
    body: 'マイページの「今日のクエスト」から学習を始めましょう。ロードマップで現在地とゴールが一目でわかります。毎日続けるとストリーク（連続日数）が伸びます。',
  },
  {
    icon: Target,
    title: '目標の立て方',
    body: '「次回コーチングまでの目標」は、達成したいことを入れて「AIで分解する」を押すと、やることに自動で分解されます。前回のコーチング記録からタスクを作ることもできます。',
  },
  {
    icon: BookOpen,
    title: '学習コンテンツの進め方',
    body: '「学習する」からカテゴリ→コース→カリキュラムへ。教材は本文を読み、完了にするとロードマップと計画に反映されます。学習計画ページで週間予定をAIに立ててもらえます。',
  },
  {
    icon: MessageCircle,
    title: 'AIコーチの使い方',
    body: '右上・各画面のAIコーチにいつでも相談できます。教材で分からないところは、文章を選択して質問すると、その内容に沿って解説します。',
  },
];

export default function HelpPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />
      <main className="flex-1 w-full max-w-[760px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-text">利用マニュアル</h1>
          <p className="text-sm text-brand-muted mt-1">WEBCOACH の使い方をまとめています。</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFF0EF' }}>
                    <Icon className="w-4 h-4 text-brand" />
                  </div>
                  <h2 className="font-bold text-brand-text">{s.title}</h2>
                </div>
                <p className="text-sm text-brand-muted leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-brand-text text-sm">解決しないときは</p>
            <p className="text-xs text-brand-muted mt-0.5">運営スタッフがチャットでサポートします。</p>
          </div>
          <a
            href="https://o4dqp.channel.io/workflows/783132"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white rounded-full px-4 py-2.5 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
          >
            <MessageCircle className="w-4 h-4" /> 運営に相談
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </main>
      <footer className="h-10 flex items-center justify-center bg-brand-footer">
        <span className="text-[11.4px] font-bold text-white" style={{ letterSpacing: '0.6px' }}>2026 © WEBCOACH</span>
      </footer>
    </div>
  );
}
