import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Send, X, User, Home, BookOpen, Sparkles, Settings, BookMarked, HelpCircle, FileText, Mail, ChevronDown, Calendar, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationStore } from '../../store/notificationStore';
import { useNewContentNotification } from '../../hooks/useNewContentNotification';
import { AccountSettingsDropdown } from './AccountSettingsDropdown';
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

  const resolvedUserName = userName ?? ctxNickName ?? user?.username ?? 'User';
  // avatarUrl は呼び出し元が既にcf_token付与済みの前提。ctxAvatarUrlはcontextの生URLなのでここで付与する
  const resolvedAvatarUrl = avatarUrl ?? (ctxAvatarUrl ? withCfToken(ctxAvatarUrl, contentToken) : undefined);

  const { chatOpen, setChatOpen } = useChatStore();
  const { messages, input, setInput, loading, messagesEndRef, sendMessage, handleKeyPress } = useAiChat();

  const { items: notificationItems, markAllRead } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  useNewContentNotification();

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const avatarSrc = resolvedAvatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedUserName)}&background=F0EAE6&color=CDC6C6`;

  const isMyPage = location.pathname === '/mypage' || location.pathname === '/';
  const isCoursesPage = location.pathname === '/courses' || location.pathname.startsWith('/courses/') || location.pathname === '/learning-courses';
  const isAIApps = location.pathname === '/ai-apps';
  const isAdmin = location.pathname.startsWith('/admin');

  // PC版サイドバーぶんの余白を body に付与（このヘッダーを描画するページのみ）
  useEffect(() => {
    document.body.classList.add('with-sidebar');
    return () => document.body.classList.remove('with-sidebar');
  }, []);

  // ナビ項目（サイドバー・下部ナビ共通の定義）
  const navItems = [
    { label: 'マイページ', icon: Home, path: '/mypage', active: isMyPage },
    { label: '学習する', icon: BookOpen, path: '/courses', active: isCoursesPage },
    { label: '学習計画', icon: Calendar, path: '/study-plan', active: location.pathname === '/study-plan' },
    { label: 'コーチング', icon: MessageCircle, path: '/coaching', active: location.pathname === '/coaching' },
    { label: 'AIアプリ', icon: Sparkles, path: '/ai-apps', active: isAIApps },
    ...(user?.isAdmin
      ? [{ label: '管理', icon: Settings, path: '/admin', active: isAdmin }]
      : user?.isCoach
      ? [{ label: '受講生一覧', icon: BookOpen, path: '/coach/students', active: isStudentsPage }]
      : []),
  ];


  return (
    <>
      {/* ── PC版 左サイドバー（lg以上） ───────────────────── */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-60 z-40 bg-white border-r border-[#F0EAE6] px-3 py-5">
        <div className="flex items-center cursor-pointer px-2 mb-6 flex-shrink-0" onClick={() => navigate('/mypage')}>
          <img src={`${process.env.PUBLIC_URL}/logo_WEBCOACH.png`} alt="WEBCOACH" className="h-[38px] w-auto object-contain" />
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
                  item.active ? 'text-white bg-brand-gradient' : 'text-brand-muted hover:bg-brand-bg'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* ヘルプ（下部） */}
        <div className="mt-auto pt-4 flex flex-col gap-0.5" style={{ borderTop: '1px solid #F0EAE6' }}>
          <a href="https://slime-gruyere-92d.notion.site/WEBCOACH-6-0-7a07e36455e848c4b4d262ef3a1c1cd4" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs text-brand-muted hover:bg-brand-bg transition-colors">
            <FileText className="w-4 h-4 flex-shrink-0" /> 利用マニュアル
          </a>
          <a href="https://slime-gruyere-92d.notion.site/1fddd266074f809e9f0cfdbdd8e60ffd" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs text-brand-muted hover:bg-brand-bg transition-colors">
            <HelpCircle className="w-4 h-4 flex-shrink-0" /> よくある質問
          </a>
          <a href="https://o4dqp.channel.io/workflows/783132" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs text-brand-muted hover:bg-brand-bg transition-colors">
            <Mail className="w-4 h-4 flex-shrink-0" /> 運営へのお問い合わせ
          </a>
        </div>
      </aside>

      <header
        className="sticky top-0 z-40 h-[60px] sm:h-[80px]"
        style={{
          backgroundColor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 1px 20px rgba(0,0,0,0.1)',
        }}
      >
        <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-3 sm:px-6 lg:px-8">
          {/* Left: Logo and Navigation（lg未満のみ。lg以上は左サイドバーに移動） */}
          <div className="flex items-center gap-4 sm:gap-6 lg:gap-10 lg:hidden">
            {/* Logo */}
            <div
              className="flex items-center cursor-pointer flex-shrink-0"
              onClick={() => navigate('/mypage')}
            >
              <img
                src={`${process.env.PUBLIC_URL}/logo_WEBCOACH.png`}
                alt="WEBCOACH"
                className="h-[35px] sm:h-[45px] w-auto max-w-[100px] sm:max-w-[140px] lg:max-w-[159px] object-contain"
              />
            </div>

            {/* Navigation Tabs — desktop only */}
            <nav className="hidden sm:flex items-center gap-1 sm:gap-2 lg:gap-4">
              {/* マイページ */}
              <button
                onClick={() => navigate('/mypage')}
                className={`flex items-center gap-1.5 rounded-full text-sm font-bold transition-all px-2.5 sm:px-5 border-0 ${
                  isMyPage
                    ? 'text-white bg-brand-gradient'
                    : 'text-brand-muted'
                }`}
                style={{
                  height: '36px',
                  fontSize: '14px',
                }}
              >
                <Home className="w-[18px] h-[18px]" />
                <span className="hidden sm:inline">マイページ</span>
              </button>

              {/* 学習する */}
              <button
                onClick={() => navigate('/courses')}
                className={`flex items-center gap-1.5 rounded-full text-sm font-bold transition-all px-2.5 sm:px-5 border-0 ${
                  isCoursesPage
                    ? 'text-white bg-brand-gradient'
                    : 'text-brand-muted'
                }`}
                style={{
                  height: '36px',
                  fontSize: '14px',
                }}
              >
                <BookOpen className="w-[18px] h-[18px]" />
                <span className="hidden sm:inline">学習する</span>
              </button>

              {/* AIアプリ */}
              <button
                onClick={() => navigate('/ai-apps')}
                className={`flex items-center gap-1.5 rounded-full text-sm font-bold transition-all px-2.5 sm:px-5 border-0 ${
                  isAIApps
                    ? 'text-white bg-brand-gradient'
                    : 'text-brand-muted'
                }`}
                style={{
                  height: '36px',
                  fontSize: '14px',
                }}
              >
                <Sparkles className="w-[18px] h-[18px]" />
                <span className="hidden sm:inline">AIアプリ</span>
              </button>

              {/* 管理（admin only） */}
              {user?.isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className={`flex items-center gap-1.5 rounded-full text-sm font-bold transition-all px-2.5 sm:px-5 border-0 ${
                    isAdmin
                      ? 'text-white bg-brand-gradient'
                      : 'text-brand-muted'
                  }`}
                  style={{
                    height: '36px',
                    fontSize: '14px',
                  }}
                >
                  <Settings className="w-[18px] h-[18px]" />
                  <span className="hidden sm:inline">管理</span>
                </button>
              )}

              {/* 受講生一覧（coach only） */}
              {!user?.isAdmin && user?.isCoach && (
                <button
                  onClick={() => navigate('/coach/students')}
                  className={`flex items-center gap-1.5 rounded-full text-sm font-bold transition-all px-2.5 sm:px-5 border-0 ${
                    isStudentsPage
                      ? 'text-white bg-brand-gradient'
                      : 'text-brand-muted'
                  }`}
                  style={{
                    height: '36px',
                    fontSize: '14px',
                  }}
                >
                  <BookOpen className="w-[18px] h-[18px]" />
                  <span className="hidden sm:inline">受講生一覧</span>
                </button>
              )}

              {/* ヘルプ ドロップダウン */}
              <div className="relative" ref={helpRef}>
                <button
                  onClick={() => setHelpOpen(v => !v)}
                  className="flex items-center gap-1.5 rounded-full text-sm font-bold transition-all px-2.5 sm:px-5 border-0 text-brand-muted"
                  style={{ height: '36px', fontSize: '14px' }}
                >
                  <HelpCircle className="w-[18px] h-[18px]" />
                  <span className="hidden sm:inline">ヘルプ</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform hidden sm:block ${helpOpen ? 'rotate-180' : ''}`} />
                </button>

                {helpOpen && (
                  <div
                    className="absolute left-0 mt-2 bg-white z-50 overflow-hidden"
                    style={{
                      top: '100%',
                      minWidth: '200px',
                      borderRadius: '12px',
                      border: '1px solid #E0D8D4',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                    }}
                  >
                    <a
                      href="https://slime-gruyere-92d.notion.site/WEBCOACH-6-0-7a07e36455e848c4b4d262ef3a1c1cd4"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-brand-muted hover:bg-brand-bg transition-colors"
                      onClick={() => setHelpOpen(false)}
                    >
                      <FileText className="w-4 h-4 text-brand-muted flex-shrink-0" />
                      利用マニュアル
                    </a>
                    <a
                      href="https://slime-gruyere-92d.notion.site/1fddd266074f809e9f0cfdbdd8e60ffd"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-brand-muted hover:bg-brand-bg transition-colors"
                      onClick={() => setHelpOpen(false)}
                    >
                      <HelpCircle className="w-4 h-4 text-brand-muted flex-shrink-0" />
                      よくある質問
                    </a>
                    <a
                      href="https://o4dqp.channel.io/workflows/783132"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 text-sm text-brand-muted hover:bg-brand-bg transition-colors"
                      onClick={() => setHelpOpen(false)}
                    >
                      <Mail className="w-4 h-4 text-brand-muted flex-shrink-0" />
                      運営へのお問い合わせ
                    </a>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Right: AI Chat, Divider, Notifications, Avatar */}
          <div className="flex items-center gap-2 sm:gap-5">
            {/* AI Coach Button */}
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-1.5 bg-brand-bg hover:bg-[#F0EAE6] rounded-full text-brand-muted border border-brand-subtle transition-colors"
              style={{ height: '34px', padding: '0 10px', fontSize: '12px' }}
            >
              <img src={`${process.env.PUBLIC_URL}/チャットアイコン.png`} alt="AIコーチ" className="w-[22px] h-[21px] object-contain" />
              <span className="hidden sm:inline">AIコーチに相談</span>
            </button>

            {/* Vertical Divider */}
            <div className="w-px bg-brand-subtle" style={{ height: '24px' }} />

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="relative flex items-center justify-center hover:bg-gray-50 rounded-full transition-colors border-0 bg-transparent"
                style={{ width: '36px', height: '36px' }}
              >
                <Bell className="w-5 h-5 text-brand-muted" />
                {notificationItems.length > 0 && (
                  <span
                    className="absolute flex items-center justify-center bg-[#EF4444] rounded-full text-white font-bold"
                    style={{ minWidth: '16px', height: '16px', top: '2px', right: '2px', fontSize: '10px', padding: '0 3px', border: '1.5px solid white' }}
                  >
                    {notificationItems.length > 9 ? '9+' : notificationItems.length}
                  </span>
                )}
              </button>

              {/* 通知ポップアップ */}
              {notifOpen && (
                <div
                  className="absolute right-0 mt-2 bg-white overflow-hidden z-50"
                  style={{
                    width: '320px',
                    maxWidth: 'calc(100vw - 1rem)',
                    top: '100%',
                    borderRadius: '12px',
                    border: '1px solid #C3BAB4',
                    boxShadow: '0 8px 10px -6px rgba(0,0,0,0.10), 0 20px 25px -5px rgba(0,0,0,0.10)',
                  }}
                >
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #F0EAE6' }}>
                    <span className="font-bold text-sm text-brand-text">新着通知</span>
                    {notificationItems.length > 0 && (
                      <button
                        onClick={() => { markAllRead(); setNotifOpen(false); }}
                        className="text-xs font-medium text-brand hover:opacity-70 transition-opacity"
                      >
                        すべて既読
                      </button>
                    )}
                  </div>
                  {/* リスト */}
                  <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
                    {notificationItems.length === 0 ? (
                      <p className="text-xs text-center py-8 text-brand-muted">新着はありません</p>
                    ) : (
                      notificationItems.map(item => (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-brand-bg transition-colors"
                          style={{ borderBottom: '1px solid #F5F0ED' }}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-gradient"
                          >
                            <BookMarked className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate text-brand-text">{item.name}</p>
                            <p className="text-xs mt-0.5 text-brand-muted">
                              新しいコースが追加されました・{new Date(item.timemodified).toLocaleDateString('ja-JP')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar with account settings dropdown */}
            <AccountSettingsDropdown userName={resolvedUserName} avatarSrc={avatarSrc} />
          </div>
        </div>
      </header>

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
          {user?.isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isAdmin ? 'text-brand' : 'text-brand-muted'}`}
            >
              <Settings className="w-5 h-5" />
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
        </div>
      </nav>

      {/* AI Chat Drawer */}
      {chatOpen && (
        <>
          {/* Drawer */}
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
        </>
      )}
    </>
  );
}

export default AppHeader;
