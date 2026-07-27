import { Sparkles, Loader2 } from 'lucide-react';
import { AppHeader, MascotSvg } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useMypageData } from '../hooks/useMypageData';
import { bffClient } from '../services/bffClient';
import { useAsyncData } from '../hooks/useAsyncData';
import { useChatStore } from '../store/chatStore';

interface AIApp {
  id: number | string;
  name: string;
  description: string;
  category?: string;
  hook?: string;
  example?: string;
  icon?: string;
  iconBg?: string;
  accent?: string;
  url?: string;
  [key: string]: any;
}

const CATEGORY_EMOJI: Record<string, string> = {
  '学習中に': '📖',
  '制作・課題に': '🎨',
  'キャリア・コーチングに': '🚀',
};

function AIAppsPage() {
  const { user } = useAuth();
  const setChatOpen = useChatStore((s) => s.setChatOpen);
  const { userProfile, resumableCourse } = useMypageData(user?.userid);

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

  const displayName = userProfile?.nick_name || user?.username || 'あなた';
  const recommendAppName = apps[0]?.name;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-8 w-full flex-1" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>✦ AIサポート</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#B78F98' }}>困りごとから選べば、ぴったりのAIツールが見つかるよ。</p>
        </div>

        <div style={{ background: 'linear-gradient(120deg,#FBDCE2,#F9CDD6)', borderRadius: 22, padding: '22px 28px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <MascotSvg size={70} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#C24358' }}>いまの{displayName}さんへのおすすめ</div>
            <div style={{ fontSize: 17, fontWeight: 900, marginTop: 4 }}>
              {resumableCourse ? (
                <>{resumableCourse.title}を学習中だね。分からない言葉は{recommendAppName ? <span style={{ color: '#E0213A' }}>{recommendAppName}</span> : 'AIアシスタント'}が便利だよ！</>
              ) : (
                <>気になることがあったら、下のAIツールに何でも聞いてみてね！</>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#A05A6B', marginTop: 5 }}>教材の本文で引っかかったら、右下の ✦ からドラッグ引用質問もできるよ。</div>
          </div>
          <button
            onClick={() => setChatOpen(true)}
            style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', color: '#fff', border: 'none', borderRadius: 999, padding: '13px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 10px 24px rgba(224,33,58,.35)', flexShrink: 0 }}
          >
            ✦ 質問してみる
          </button>
        </div>

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
          grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Sparkles className="w-10 h-10 text-brand-subtle" />
              <p className="text-sm text-brand-muted">AIアプリが見つかりませんでした</p>
            </div>
          ) : (
            grouped.map(({ category, apps: catApps }) => (
              <section key={category} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{CATEGORY_EMOJI[category] || '✦'} {category}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
                  {catApps.map((app) => (
                    <AIAppCard key={app.id} app={app} />
                  ))}
                </div>
              </section>
            ))
          )
        )}
      </div>

      <footer className="flex items-center justify-center" style={{ height: '48px' }}>
        <span className="text-brand-muted" style={{ fontSize: '11.4px', fontWeight: 500, letterSpacing: '0.6px' }}>
          2026 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

function AIAppCard({ app }: { app: AIApp }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 14, background: app.iconBg || '#FDF0F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>
          {app.icon || '✦'}
        </span>
        <div>
          {app.hook && <div style={{ fontSize: 11, fontWeight: 700, color: app.accent || '#C24358' }}>{app.hook}</div>}
          <div style={{ fontSize: 15, fontWeight: 900 }}>{app.name}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#8A767D', lineHeight: 1.8 }}>{app.description}</div>
      {app.example && (
        <div style={{ background: '#FBF4F5', borderRadius: 10, padding: '9px 13px', fontSize: 11, color: '#A05A6B' }}>💡 使用例：{app.example}</div>
      )}
      {app.url && (
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: '#E0213A', textDecoration: 'none' }}
        >
          アプリを開く ↗
        </a>
      )}
    </div>
  );
}

export default AIAppsPage;
