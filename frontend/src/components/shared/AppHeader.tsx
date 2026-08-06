import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Send, X, User, Home, BookOpen, Sparkles, ShieldCheck, BookMarked, HelpCircle, FileText, ChevronRight, ChevronsLeft, ChevronsRight, Video } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationStore } from '../../store/notificationStore';
import { useNewContentNotification } from '../../hooks/useNewContentNotification';
import { useAiChat } from '../../hooks/useAiChat';
import { useChatStore } from '../../store/chatStore';
import { withCfToken } from '../profile/AvatarPicker';

interface AppHeaderProps {
  userName?: string;
  avatarUrl?: string;
}

export function AppHeader({ userName, avatarUrl }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, avatarUrl: ctxAvatarUrl, nickName: ctxNickName, contentToken } = useAuth();
  const isStudentsPage = location.pathname.startsWith('/coach/students');
  const isCoachSettingsPage = location.pathname.startsWith('/coach/settings');

  const resolvedUserName = userName ?? ctxNickName ?? user?.username ?? 'User';
  // avatarUrl は呼び出し元が既にcf_token付与済みの前提。ctxAvatarUrlはcontextの生URLなのでここで付与する
  const resolvedAvatarUrl = avatarUrl ?? (ctxAvatarUrl ? withCfToken(ctxAvatarUrl, contentToken) : undefined);

  const { chatOpen, setChatOpen } = useChatStore();
  const { messages, input, setInput, loading, messagesEndRef, sendMessage, handleKeyPress } = useAiChat();

  const { items: notificationItems, markAllRead } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  useNewContentNotification();

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const avatarSrc = resolvedAvatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedUserName)}&background=F0EAE6&color=CDC6C6`;

  const isMyPage = location.pathname === '/mypage' || location.pathname === '/';
  // 教材ページは /course/:id（単数形）。ここを含めないと学習中にナビがどこも点灯しない。
  const isCoursesPage = location.pathname === '/courses' || location.pathname.startsWith('/courses/')
    || location.pathname.startsWith('/course/') || location.pathname === '/learning-courses';
  const isAIApps = location.pathname === '/ai-apps';
  const isAdmin = location.pathname.startsWith('/admin');

  // サイドバーの開閉(初期状態は展開。クリックで折りたたみ、その状態を保持する)
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('webcoach-sidebar-expanded');
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });

  // PC版サイドバーぶんの余白を body に付与(このヘッダーを描画するページのみ)
  useEffect(() => {
    document.body.classList.add('with-sidebar');
    return () => { document.body.classList.remove('with-sidebar'); document.body.classList.remove('sidebar-expanded'); };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('sidebar-expanded', expanded);
    try { localStorage.setItem('webcoach-sidebar-expanded', expanded ? '1' : '0'); } catch { /* noop */ }
  }, [expanded]);

  // ナビ項目(サイドバー・下部ナビ共通の定義。既存ルートのみを使用)
  const navItems = [
    { label: 'マイページ', icon: Home, path: '/mypage', active: isMyPage },
    { label: '学習コンテンツ', icon: BookOpen, path: '/courses', active: isCoursesPage },
    { label: 'AIアプリ', icon: Sparkles, path: '/ai-apps', active: isAIApps },
  ];
  const learnItems = navItems;
  const manageItems = [
    ...(user?.isAdmin ? [{ label: '管理', icon: ShieldCheck, path: '/admin', active: isAdmin }] : []),
    ...(!user?.isAdmin && user?.isCoach ? [{ label: '受講生一覧', icon: BookOpen, path: '/coach/students', active: isStudentsPage }] : []),
    ...(user?.isCoach || user?.isAdmin ? [{ label: '連携設定', icon: Video, path: '/coach/settings', active: isCoachSettingsPage }] : []),
  ];

  // キーボードフォーカス時の共通フィードバック(色だけに依存しないよう ring + 背景色の両方を使う)
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD] focus-visible:ring-offset-0';

  // アイコンチップ(白〜オフホワイトの立体的な面。アクティブ時のみ赤グラデーション)
  const iconChipStyle = (active: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    background: active
      ? 'linear-gradient(150deg, #ff7d82, #D30F1A)'
      : 'linear-gradient(145deg, rgba(255,255,255,0.94), rgba(248,244,243,0.92))',
    boxShadow: active
      ? '0 8px 17px rgba(216,15,26,0.24)'
      : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 12px rgba(102,78,73,0.035)',
    color: active ? '#FFFFFF' : '#27303D',
  });

  const renderSideItem = (item: { label: string; icon: any; path: string; active: boolean }) => {
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        aria-label={item.label}
        aria-current={item.active ? 'page' : undefined}
        className={`group relative w-full appearance-none outline-none rounded-xl border transition-all duration-200 motion-reduce:transition-none ${focusRing} ${
          expanded ? 'grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2.5 px-2.5' : 'flex items-center justify-center px-1.5'
        } min-h-[42px] ${
          item.active
            ? 'text-[#E0242B]'
            : 'bg-transparent text-[#303845] border-transparent hover:text-[#E0242B] hover:bg-white/[0.76] hover:border-[rgba(224,36,43,0.09)]'
        }`}
        style={
          item.active
            ? {
                borderColor: 'rgba(224,36,43,0.2)',
                background: 'linear-gradient(145deg, rgba(255,255,255,0.98), rgba(255,241,242,0.9))',
                boxShadow: '0 10px 24px rgba(151,103,96,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
              }
            : undefined
        }
      >
        <span className="grid place-items-center rounded-lg flex-shrink-0" style={iconChipStyle(item.active)}>
          <Icon className="w-[16px] h-[16px]" />
        </span>
        {expanded && (
          <span className="truncate text-[12.5px] font-bold text-left">{item.label}</span>
        )}
        {/* 折りたたみ時: アイコンのみになるためホバー/フォーカスでラベルをツールチップ表示 */}
        {!expanded && (
          <span
            role="tooltip"
            aria-hidden="true"
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#262C35] px-2 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          >
            {item.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* ── PC版 左サイドバー(ライト・開閉式・sm以上) ───────── */}
      <aside
        id="app-sidebar"
        className="hidden sm:flex flex-col fixed left-0 top-0 bottom-0 z-40 transition-[width,padding] duration-200 motion-reduce:transition-none"
        style={{
          width: expanded ? 216 : 68,
          padding: expanded ? '20px 16px 26px' : '20px 10px 26px',
          background:
            'radial-gradient(ellipse at 48% 42%, rgba(248,226,227,0.46) 0%, rgba(250,235,234,0.2) 38%, transparent 67%), linear-gradient(180deg, #fff9f8 0%, #fdf3f2 24%, #fbeeed 52%, #fcf2f1 76%, #fff7f5 100%)',
          borderRight: '1px solid rgba(218,207,203,0.72)',
          boxShadow:
            'inset 1px 0 0 rgba(255,255,255,0.74), inset -12px 0 28px rgba(202,181,176,0.055), inset 0 22px 38px rgba(255,255,255,0.26), 7px 0 25px rgba(87,63,58,0.045)',
        }}
      >
        {/* 極薄の斜めハッチングテクスチャ(真っ白にしない質感) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'repeating-linear-gradient(135deg, rgba(171,141,135,0.018) 0 1px, transparent 1px 7px), linear-gradient(90deg, rgba(255,255,255,0.22), transparent 30%, rgba(190,164,158,0.018))',
            opacity: 0.72,
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            left: -84, bottom: '8%', width: 280, height: 320, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.28) 0%, rgba(255,244,243,0.15) 42%, transparent 72%)',
            filter: 'blur(3px)',
          }}
        />

        {/* ブランド + 開閉トグル(一体化。ホバー/フォーカスでロゴがトグル矢印に切り替わる) */}
        <button
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          aria-controls="app-sidebar"
          aria-label={expanded ? 'サイドバーを折りたたむ' : 'サイドバーを展開する'}
          className={`group relative z-[1] mx-auto appearance-none outline-none border-0 rounded-2xl grid place-items-center cursor-pointer overflow-visible transition-all duration-200 motion-reduce:transition-none ${focusRing} ${
            expanded ? 'w-[150px] min-h-[52px] mt-2.5 mb-4 bg-transparent' : 'w-10 h-10 mt-2.5 mb-3'
          }`}
          style={!expanded ? { background: 'linear-gradient(145deg, #ef454c, #D30F1A)', boxShadow: '0 8px 17px rgba(216,15,26,0.22)' } : undefined}
        >
          <span
            className={`flex flex-col items-center gap-0.5 transition-all duration-150 group-hover:opacity-0 group-hover:scale-95 group-focus-visible:opacity-0 group-focus-visible:scale-95 ${
              expanded ? '' : 'text-white text-[15px] font-extrabold'
            }`}
          >
            {expanded ? (
              <>
                <b className="text-[17px] font-bold tracking-[0.03em]" style={{ color: '#E0242B' }}>WEBCOACH</b>
                <small className="text-[9px] font-bold" style={{ color: '#343B46' }}>キャリアを、もっと自由に。</small>
              </>
            ) : (
              'W'
            )}
          </span>
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center rounded-2xl opacity-0 scale-90 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100"
            style={
              expanded
                ? { color: '#E0242B', border: '1px solid rgba(224,36,43,0.16)', background: '#FFF0F1', boxShadow: '0 8px 20px rgba(224,36,43,0.08)' }
                : { color: '#FFFFFF', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)' }
            }
          >
            {expanded ? <ChevronsLeft className="w-[18px] h-[18px]" /> : <ChevronsRight className="w-[18px] h-[18px]" />}
          </span>
          <span
            role="tooltip"
            aria-hidden="true"
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#262C35] px-2 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          >
            {expanded ? 'サイドバーを折りたたむ' : 'サイドバーを展開する'}
          </span>
        </button>

        {/* ナビ(グループ) */}
        <nav className="relative z-[1] flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-1.5">
          {expanded && <p className="text-[9px] font-bold text-[#68707C] px-2 pb-0.5 tracking-wider">学習</p>}
          {learnItems.map(renderSideItem)}
          {manageItems.length > 0 && (
            <>
              {expanded && <p className="text-[9px] font-bold text-[#68707C] px-2 pt-1.5 pb-0.5 tracking-wider">管理</p>}
              {manageItems.map(renderSideItem)}
            </>
          )}
        </nav>

        {/* 下部: AIコーチ・ヘルプ・通知・アカウント */}
        <div
          className="relative z-[1] pt-3.5 flex flex-col gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(210,201,197,0.58)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }}
        >
          {/* AIコーチに相談(チャットドロワーを開く) */}
          <button
            onClick={() => setChatOpen(true)}
            aria-label="AIコーチに相談"
            className={`group relative flex items-center gap-2 w-full appearance-none border-0 outline-none bg-transparent cursor-pointer rounded-lg text-[10px] font-bold no-underline text-[#303845] hover:text-[#E0242B] hover:bg-white/[0.76] transition-colors ${focusRing} ${
              expanded ? 'px-2.5 py-1' : 'justify-center px-1.5 py-1.5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            {expanded && <span className="truncate">AIコーチに相談</span>}
            {!expanded && (
              <span
                role="tooltip"
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#262C35] px-2 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              >
                AIコーチに相談
              </span>
            )}
          </button>

          <a
            href="https://slime-gruyere-92d.notion.site/WEBCOACH-6-0-7a07e36455e848c4b4d262ef3a1c1cd4"
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative flex items-center gap-2 rounded-lg text-[10px] font-bold no-underline text-[#303845] hover:text-[#E0242B] hover:bg-white/[0.76] transition-colors ${focusRing} ${
              expanded ? 'px-2.5 py-1' : 'justify-center px-1.5 py-1.5'
            }`}
          >
            <FileText className="w-3 h-3 flex-shrink-0" />
            {expanded && <span className="truncate">利用マニュアル</span>}
            {!expanded && (
              <span
                role="tooltip"
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#262C35] px-2 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              >
                利用マニュアル
              </span>
            )}
          </a>
          <a
            href="https://slime-gruyere-92d.notion.site/1fddd266074f809e9f0cfdbdd8e60ffd"
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative flex items-center gap-2 rounded-lg text-[10px] font-bold no-underline text-[#303845] hover:text-[#E0242B] hover:bg-white/[0.76] transition-colors ${focusRing} ${
              expanded ? 'px-2.5 py-1' : 'justify-center px-1.5 py-1.5'
            }`}
          >
            <HelpCircle className="w-3 h-3 flex-shrink-0" />
            {expanded && <span className="truncate">よくある質問</span>}
            {!expanded && (
              <span
                role="tooltip"
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#262C35] px-2 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              >
                よくある質問
              </span>
            )}
          </a>

          {/* 通知(アカウントの上) */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(v => !v)}
              aria-label="通知"
              className={`group relative flex items-center gap-2 w-full appearance-none border-0 outline-none bg-transparent cursor-pointer rounded-lg text-[10px] font-bold no-underline text-[#303845] hover:text-[#E0242B] hover:bg-white/[0.76] transition-colors ${focusRing} ${
                expanded ? 'px-2.5 py-1' : 'justify-center px-1.5 py-1.5'
              }`}
            >
              <span className="relative flex-shrink-0">
                <Bell className="w-3.5 h-3.5" />
                {notificationItems.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center bg-[#E0242B] rounded-full text-white font-extrabold" style={{ minWidth: '12px', height: '12px', fontSize: '7px', padding: '0 1px' }}>
                    {notificationItems.length > 9 ? '9+' : notificationItems.length}
                  </span>
                )}
              </span>
              {expanded && <span className="truncate">お知らせ</span>}
              {!expanded && (
                <span
                  role="tooltip"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#262C35] px-2 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                >
                  お知らせ
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                className="absolute left-full bottom-0 ml-2 bg-white overflow-hidden z-50"
                style={{ width: '300px', borderRadius: '16px', border: '1px solid #EBE7E5', boxShadow: '0 16px 38px rgba(96,70,65,0.14)' }}
              >
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #EBE7E5' }}>
                  <span className="font-bold text-sm text-dash-text">新着通知</span>
                  {notificationItems.length > 0 && (
                    <button onClick={() => { markAllRead(); setNotifOpen(false); }} className="text-xs font-medium text-dash-primary hover:opacity-70">すべて既読</button>
                  )}
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
                  {notificationItems.length === 0 ? (
                    <p className="text-xs text-center py-8 text-dash-muted">新着はありません</p>
                  ) : (
                    notificationItems.map(item => (
                      <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-dash-soft transition-colors" style={{ borderBottom: '1px solid #F3EFEE' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-dash-gradient">
                          <BookMarked className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-dash-text">{item.name}</p>
                          <p className="text-xs mt-0.5 text-dash-muted">新しいコースが追加されました・{new Date(item.timemodified).toLocaleDateString('ja-JP')}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* アカウント(行全体をクリック可能にするため AccountSettingsDropdown の遷移先へ直接ナビゲート) */}
          <button
            onClick={() => navigate('/account-settings')}
            aria-label={`アカウント設定: ${resolvedUserName}`}
            className={`group relative w-full appearance-none outline-none bg-transparent border border-transparent rounded-xl min-h-[42px] text-[#303845] hover:text-[#E0242B] hover:bg-white/[0.76] hover:border-[rgba(224,36,43,0.09)] transition-all duration-200 motion-reduce:transition-none ${focusRing} ${
              expanded ? 'grid grid-cols-[32px_minmax(0,1fr)_16px] items-center gap-2.5 px-2.5' : 'flex items-center justify-center px-1.5'
            }`}
          >
            <span
              className="grid place-items-center rounded-full flex-shrink-0 overflow-hidden"
              style={{ width: 32, height: 32, background: 'linear-gradient(145deg, #fff, #ffe7e9)', border: '1px solid rgba(224,36,43,0.14)' }}
            >
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            </span>
            {expanded && <span className="truncate text-[12.5px] font-bold text-left">{resolvedUserName}</span>}
            {expanded && <ChevronRight className="w-[14px] h-[14px] justify-self-end" />}
            {!expanded && (
              <span
                role="tooltip"
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#262C35] px-2 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              >
                {resolvedUserName}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Bottom Navigation — mobile only */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#F0EAE6]"
        style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.06)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch h-16">
          <button
            onClick={() => navigate('/mypage')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isMyPage ? 'text-brand' : 'text-brand-muted'}`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-bold">マイページ</span>
          </button>
          <button
            onClick={() => navigate('/courses')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isCoursesPage ? 'text-brand' : 'text-brand-muted'}`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] font-bold">学習する</span>
          </button>
          <button
            onClick={() => navigate('/ai-apps')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isAIApps ? 'text-brand' : 'text-brand-muted'}`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-bold">AIアプリ</span>
          </button>
          <button
            onClick={() => setChatOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors text-brand-muted"
          >
            <img src={`${process.env.PUBLIC_URL}/チャットアイコン.png`} alt="" className="w-5 h-5 object-contain" />
            <span className="text-[10px] font-bold">AIコーチ</span>
          </button>
          {user?.isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isAdmin ? 'text-brand' : 'text-brand-muted'}`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[10px] font-bold">管理</span>
            </button>
          )}
          {!user?.isAdmin && user?.isCoach && (
            <button
              onClick={() => navigate('/coach/students')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isStudentsPage ? 'text-brand' : 'text-brand-muted'}`}
            >
              <BookOpen className="w-5 h-5" />
              <span className="text-[10px] font-bold">受講生一覧</span>
            </button>
          )}
          {(user?.isCoach || user?.isAdmin) && (
            <button
              onClick={() => navigate('/coach/settings')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isCoachSettingsPage ? 'text-brand' : 'text-brand-muted'}`}
            >
              <Video className="w-5 h-5" />
              <span className="text-[10px] font-bold">連携設定</span>
            </button>
          )}
        </div>
      </nav>

      {/* AI Chat Drawer */}
      {chatOpen && (
        <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white z-50 flex flex-col shadow-xl">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-[#E86D78] to-[#FA9262] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={`${process.env.PUBLIC_URL}/teleoperation-icon.png`} alt="AIコーチ" className="w-5 h-5 object-contain" />
              <span className="font-bold text-lg">AIコーチに相談</span>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 hover:bg-white/20 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user' ? 'bg-blue-500' : 'bg-brand'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <img src={`${process.env.PUBLIC_URL}/teleoperation-icon.png`} alt="AIコーチ" className="w-4 h-4 object-contain" />
                  )}
                </div>
                <div className="max-w-[85%] sm:max-w-[75%] flex flex-col gap-1">
                  <div
                    className={`p-3 rounded-lg ${
                      message.role === 'user' ? 'bg-blue-100' : 'bg-white'
                    } shadow-sm`}
                  >
                    {message.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        children={message.content.replace(/^(✅[^\n-]*?) - (.+)$/gm, '$1\n$2')}
                        components={{
                          h1: ({ children }) => <p className="text-base font-bold text-brand-text mt-3 mb-2">{children}</p>,
                          h2: ({ children }) => <p className="text-sm font-bold text-brand-text mt-3 mb-2">{children}</p>,
                          h3: ({ children }) => <p className="text-sm font-semibold text-brand-text mt-2 mb-1">{children}</p>,
                          p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0" style={{ whiteSpace: 'pre-line' }}>{children}</p>,
                          strong: ({ children }) => <strong className="font-bold text-brand-text">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          ul: ({ children }) => <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', margin: '0.25rem 0' }} className="text-sm">{children}</ul>,
                          ol: ({ children }) => <ol style={{ listStyleType: 'decimal', paddingLeft: '1.25rem', margin: '0.25rem 0' }} className="text-sm">{children}</ol>,
                          li: ({ children }) => <li style={{ listStyleType: 'inherit' }} className="text-sm leading-relaxed mb-0.5">{children}</li>,
                          code: ({ children, className }) => className ? (
                            <code className="block bg-gray-100 rounded p-2 text-xs font-mono my-1 overflow-x-auto">{children}</code>
                          ) : (
                            <code className="bg-gray-100 rounded px-1 text-xs font-mono">{children}</code>
                          ),
                          hr: () => <hr className="my-2 border-gray-200" />,
                        }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {message.timestamp.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* 参照元情報 */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="pl-1">
                      <p className="text-xs text-gray-500 font-bold mb-1">参照元</p>
                      <div className="space-y-1">
                        {message.sources.map((source, index) => (
                          <div
                            key={index}
                            className="p-2 bg-gray-100 border border-gray-200 rounded text-xs"
                          >
                            <p className="font-bold">
                              {source.module_name}
                              {source.filename && ` - ${source.filename}`}
                            </p>
                            <p className="text-gray-500">
                              {source.section_name} | 類似度: {(source.similarity * 100).toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
                  <img src={`${process.env.PUBLIC_URL}/teleoperation-icon.png`} alt="AIコーチ" className="w-4 h-4 object-contain" />
                </div>
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-500">考え中...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="質問を入力してください..."
                disabled={loading}
                rows={1}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-100"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="p-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AppHeader;
