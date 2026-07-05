import React from 'react';
import { Sparkles, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { AppHeader, AppIcon } from './shared';
import { Card } from './shared/Card';
import { useAuth } from '../contexts/AuthContext';
import { bffClient } from '../services/bffClient';
import { useAsyncData } from '../hooks/useAsyncData';
import { useNavigate } from 'react-router-dom';

interface AIApp {
  id: number | string;
  name: string;
  description: string;
  category?: string;
  icon?: string;
  icon_url?: string;
  url?: string;
  [key: string]: any;
}

function AIAppsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, loading, error } = useAsyncData(
    () => bffClient.getAIApplications(),
    [],
  );
  const apps: AIApp[] = data ?? [];

  // カテゴリごとにグループ化（順序保持）
  const grouped: { category: string; apps: AIApp[] }[] = [];
  const seen = new Map<string, AIApp[]>();
  for (const app of apps) {
    const cat = app.category || 'その他';
    if (!seen.has(cat)) {
      seen.set(cat, []);
      grouped.push({ category: cat, apps: seen.get(cat)! });
    }
    seen.get(cat)!.push(app);
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      <div className="relative flex-1">
        {/* 背景装飾 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div
            className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px', filter: 'blur(40px)' }}
          />
          <div
            className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(253,234,226,0.5) 0%, transparent 70%)', top: '-100px', right: '-400px', filter: 'blur(40px)' }}
          />
          <div
            className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(242,147,103,0.3) 0%, transparent 70%)', bottom: '-300px', left: '30%', filter: 'blur(40px)' }}
          />
        </div>

        {/* ページヘッダーバー */}
        <div
          className="relative border-b py-6 sm:py-8 lg:py-[40px]"
          style={{ backgroundColor: 'rgba(255,255,255,0.5)', borderColor: '#FEFAF8' }}
        >
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 flex flex-col" style={{ gap: '24px' }}>
            {/* 戻るボタン */}
            <button
              onClick={() => navigate('/mypage')}
              className="flex items-center gap-1 bg-white border border-brand-border rounded-[30px] text-brand-muted hover:bg-gray-50 transition-colors self-start"
              style={{ fontSize: '12px', fontWeight: 500, padding: '6px 22px 6px 16px' }}
            >
              <ChevronLeft className="w-3 h-3" />
              <span>TOPに戻る</span>
            </button>

            {/* タイトル */}
            <div className="flex items-center" style={{ gap: '24px' }}>
              <div
                className="w-14 h-14 sm:w-[79px] sm:h-[79px] flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#A688D4', borderRadius: '24px' }}
              >
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="flex flex-col" style={{ gap: '4px' }}>
                <span
                  className="inline-block self-start px-2.5 py-0.5 text-xs font-bold"
                  style={{ fontSize: '12px', color: '#E86D78', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '6px' }}
                >
                  MEMBER ONLY
                </span>
                <h1
                  className="font-bold text-brand-text text-2xl sm:text-3xl lg:text-[32px]"
                  style={{ lineHeight: '1.2' }}
                >
                  会員限定AIアプリ
                </h1>
                <p
                  className="text-brand-muted"
                  style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 400 }}
                >
                  学習や業務を加速させる、専用のAIツール群です。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div
          className="relative max-w-[1100px] mx-auto px-4 sm:px-6"
          style={{ paddingTop: '40px', paddingBottom: '40px' }}
        >
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Sparkles className="w-12 h-12 text-brand-subtle" />
              <p className="text-sm text-brand-muted">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="flex flex-col" style={{ gap: '48px' }}>
              {grouped.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Sparkles className="w-10 h-10 text-brand-subtle" />
                  <p className="text-sm text-brand-muted">AIアプリが見つかりませんでした</p>
                </div>
              ) : (
                grouped.map(({ category, apps: catApps }) => (
                  <section key={category} className="flex flex-col" style={{ gap: '24px' }}>
                    {/* セクションヘッダー */}
                    <div
                      className="flex items-center justify-between"
                      style={{ borderBottom: '1px solid #c2b9b3', paddingBottom: '12px' }}
                    >
                      <div className="flex items-center" style={{ gap: '8px' }}>
                        <Sparkles className="w-5 h-5" style={{ color: '#A688D4' }} />
                        <h2
                          className="font-bold text-brand-muted"
                          style={{ fontSize: '18px', lineHeight: '28px' }}
                        >
                          {category}
                        </h2>
                      </div>
                      <button
                        className="flex items-center gap-1 bg-white border border-brand-border rounded-full text-brand-muted hover:bg-gray-50 transition-colors"
                        style={{ fontSize: '12px', fontWeight: 500, padding: '4px 12px' }}
                      >
                        <span>すべて見る</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* アプリグリッド */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: '20px' }}>
                      {catApps.map((app) => (
                        <AIAppCard
                          key={app.id}
                          app={app}
                          onClick={() => {
                            if (app.url) window.open(app.url, '_blank', 'noopener,noreferrer');
                          }}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* フッター */}
      <footer className="flex items-center justify-center" style={{ height: '48px' }}>
        <span
          className="text-brand-muted"
          style={{ fontSize: '11.4px', fontWeight: 500, letterSpacing: '0.6px' }}
        >
          2026 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

function AIAppCard({ app, onClick }: { app: AIApp; onClick: () => void }) {
  return (
    <Card onClick={onClick} minHeight="200px" className="justify-start">
      <div className="flex flex-col gap-3">
        <div
          className="w-full flex items-center justify-center"
          style={{ backgroundColor: '#F7F2FF', borderRadius: '12px', height: '100px' }}
        >
          <AppIcon iconUrl={app.icon_url} url={app.url} icon={app.icon} alt={app.name} size={48} />
        </div>
        <div className="flex flex-col gap-2">
          <h3
            className="font-bold text-brand-text"
            style={{ fontSize: '16px', lineHeight: '20px' }}
          >
            {app.name}
          </h3>
          <p
            className="font-bold text-brand-muted"
            style={{ fontSize: '11px', lineHeight: '20px' }}
          >
            {app.description}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default AIAppsPage;
