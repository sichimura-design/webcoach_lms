import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, BookOpen, TrendingUp, Code, Sparkles, Video, Lightbulb, Palette, Layers, Loader2, FolderOpen } from 'lucide-react';
import { AppHeader, AppIcon } from './shared';
import { Card } from './shared/Card';
import { useAuth } from '../contexts/AuthContext';
import { bffClient } from '../services/bffClient';
import { useToast } from '../contexts/ToastContext';
import type { Category } from '../types/api';

// カテゴリ表示用のカラーパレット（循環利用）
const categoryColorPalette = [
  { color: '#E86D78', iconLightColor: '#FFEDEE', icon: Palette },
  { color: '#F0AF23', iconLightColor: '#FFFAEA', icon: TrendingUp },
  { color: '#FA9161', iconLightColor: '#FFF4EF', icon: Code },
  { color: '#A688D4', iconLightColor: '#F7F2FF', icon: Sparkles },
  { color: '#E6819D', iconLightColor: '#FFF1F5', icon: Video },
  { color: '#5B9BD5', iconLightColor: '#EBF3FB', icon: BookOpen },
  { color: '#6BBF8A', iconLightColor: '#EEF8F1', icon: Lightbulb },
];

interface AIApp {
  id: number | string;
  name: string;
  description: string;
  icon?: string;
  url?: string;
  [key: string]: any;
}

// --- Component ---

function CoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [aiApps, setAiApps] = useState<AIApp[]>([]);
  const [aiAppsLoading, setAiAppsLoading] = useState(true);

  useEffect(() => {
    bffClient.getCategories()
      .then((data) => setCategories(data))
      .catch((err) => {
        console.error('Failed to fetch categories:', err);
        showToast('カテゴリの取得に失敗しました。', 'error');
      })
      .finally(() => setCategoriesLoading(false));
    bffClient.getAIApplications()
      .then((data) => setAiApps(data))
      .catch((err) => {
        console.error('Failed to fetch AI applications:', err);
        showToast('AIアプリ一覧の取得に失敗しました。', 'error');
      })
      .finally(() => setAiAppsLoading(false));
  }, []);

  const filteredCategories = searchQuery
    ? categories.filter((cat) =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      {/* Background with gradient circles */}
      <div className="relative flex-1">
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
          <div
            className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', bottom: '-400px', right: '-200px', filter: 'blur(40px)' }}
          />
          <div
            className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(242,147,103,0.3) 0%, transparent 70%)', top: '200px', left: '50%', filter: 'blur(40px)' }}
          />
        </div>

        {/* Main Content */}
        <main className="relative max-w-[1100px] mx-auto px-4 sm:px-6 pt-24 sm:pt-28 lg:pt-[120px] pb-16 flex flex-col gap-10 sm:gap-12 lg:gap-[60px]">

          {/* Page Title + Search */}
          <section className="flex flex-col items-center" style={{ gap: '12px' }}>
            <div className="w-full max-w-[620px]" style={{ borderBottom: '1px solid #C2B9B3', paddingBottom: '60px' }}>
              <div className="flex flex-col" style={{ gap: '8px' }}>
                <h1
                  className="text-xl font-bold text-brand-muted"
                  style={{ fontSize: '20px', lineHeight: '28px' }}
                >
                  学習コンテンツ
                </h1>
                <p
                  className="text-sm text-brand-muted"
                  style={{ fontSize: '14px', lineHeight: '20px', fontWeight: 300 }}
                >
                  自分の目的に合わせて教材を探しましょう。
                </p>
              </div>

              {/* Search Bar */}
              <div className="mt-3">
                <div
                  className="flex items-center bg-white rounded-full border border-brand-border shadow-sm"
                  style={{ height: '48px', paddingLeft: '24px', paddingRight: '16px' }}
                >
                  <Search className="w-[18px] h-[18px] text-brand-subtle flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="キーワードでさがす..."
                    className="flex-1 ml-2.5 text-sm text-brand-text placeholder-[#C2B9B3] bg-transparent outline-none"
                    style={{ fontSize: '14px' }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section: カテゴリから選ぶ */}
          <section>
            <SectionHeading icon={<Layers className="w-6 h-6 text-brand-muted" />} title="カテゴリから選ぶ" />
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-brand-muted animate-spin" />
                <span className="ml-2 text-sm text-brand-muted">読み込み中...</span>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="w-10 h-10 text-brand-subtle" />
                <span className="mt-2 text-sm text-brand-muted">
                  {searchQuery ? '該当するカテゴリが見つかりません' : 'カテゴリがありません'}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-10 mt-5">
                {filteredCategories.map((cat, index) => {
                  const palette = categoryColorPalette[index % categoryColorPalette.length];
                  return (
                    <CategoryCard
                      key={cat.id}
                      card={{
                        id: String(cat.id),
                        title: cat.name,
                        description: cat.description || `${cat.coursecount ?? 0}コース`,
                        color: palette.color,
                        iconLightColor: palette.iconLightColor,
                        icon: palette.icon,
                        categoryImage: cat.categoryimage,
                      }}
                      onClick={() => navigate(`/courses/category/${cat.id}`)}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {/* Section: AIアプリ一覧 */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <SectionHeading icon={<Sparkles className="w-6 h-6 text-brand-muted" />} title="AIアプリ一覧" />
              <button
                className="flex items-center gap-1 bg-white border border-brand-border rounded-full text-xs font-medium text-brand-muted hover:bg-gray-50 transition-colors"
                style={{ padding: '6px 16px 6px 22px', fontSize: '12px' }}
                onClick={() => navigate('/ai-apps')}
              >
                すべて見る
                <ChevronRight className="w-3 h-3 text-brand-muted" />
              </button>
            </div>
            {aiAppsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-[#A688D4] animate-spin" />
                <span className="ml-2 text-sm text-brand-muted">読み込み中...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-10">
                {aiApps.slice(0, 4).map((app) => (
                  <AIAppCard key={app.id} app={app} onClick={() => {
                    if (app.url) window.open(app.url, '_blank', 'noopener,noreferrer');
                  }} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-center" style={{ height: '48px' }}>
        <span
          className="text-brand-muted"
          style={{ fontSize: '11.4px', fontWeight: 500, letterSpacing: '0.6px' }}
        >
          2024 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

// --- Sub Components ---

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <h2
        className="font-bold text-brand-muted"
        style={{ fontSize: '18px', lineHeight: '28px' }}
      >
        {title}
      </h2>
    </div>
  );
}

function CategoryCard({ card, onClick }: { card: { id: string; title: string; description: string; color: string; iconLightColor: string; icon: React.ComponentType<any>; categoryImage?: string }; onClick: () => void }) {
  const Icon = card.icon;
  return (
    <Card onClick={onClick} minHeight="192px">
      <div className="flex gap-3">
        <div
          className="w-12 h-12 flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: card.color, borderRadius: '12px' }}
        >
          {card.categoryImage ? (
            <img src={card.categoryImage} alt={card.title} className="w-full h-full object-cover" />
          ) : (
            <Icon className="w-6 h-6" style={{ color: card.iconLightColor }} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h3
            className="font-bold"
            style={{ fontSize: '20px', lineHeight: '20px', color: card.color }}
          >
            {card.title}
          </h3>
          <p
            className="font-bold text-brand-muted"
            style={{ fontSize: '11px', lineHeight: '20px' }}
          >
            {card.description}
          </p>
        </div>
      </div>
      <Card.Button />
    </Card>
  );
}

function AIAppCard({ app, onClick }: { app: AIApp; onClick: () => void }) {
  return (
    <Card onClick={onClick} minHeight="200px" className="justify-start">
      <div className="flex flex-col gap-3">
        <div
          className="w-full flex items-center justify-center"
          style={{ backgroundColor: '#FFF5F0', borderRadius: '12px', height: '100px' }}
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

export default CoursesPage;
