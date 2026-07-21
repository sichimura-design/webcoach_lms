import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Send, X, User, Home, BookOpen, Sparkles, Settings, ShieldCheck, BookMarked, HelpCircle, FileText, Mail, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, MessageCircle, Lightbulb, ImagePlus } from 'lucide-react';
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
  const { messages, input, setInput, loading, messagesEndRef, sendMessage, handleKeyPress, attachedImage, setAttachedImage } = useAiChat();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

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

  // サイドバーの開閉（初期状態は展開。クリックで折りたたみ、その状態を保持する）
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem('webcoach-sidebar-expanded');
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });

  // PC版サイドバーぶんの余白を body に付与（このヘッダーを描画するページのみ）
  useEffect(() => {
    document.body.classList.add('with-sidebar');
    return () => { document.body.classList.remove('with-sidebar'); document.body.classList.remove('sidebar-expanded'); };
  }, []);
  useEffect(() => {
    document.body.classList.toggle('sidebar-expanded', expanded);
    try { localStorage.setItem('webcoach-sidebar-expanded', expanded ? '1' : '0'); } catch { /* noop */ }
  }, [expanded]);

  // なぞって解説：テキスト選択時に「AIに解説」ボタンを出す
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const onUp = (e: MouseEvent) => {
      // 「AIに解説」ボタン上での mouseup では消さない（クリックを成立させる）
      if ((e.target as HTMLElement)?.closest?.('[data-explain-btn]')) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) { setSel(null); return; }
      const s = window.getSelection();
      const text = s?.toString().trim() || '';
      if (s && s.rangeCount > 0 && text.length >= 2 && text.length <= 400) {
        const r = s.getRangeAt(0).getBoundingClientRect();
        if (r && r.width > 0) {
          setSel({ text, x: Math.min(Math.max(r.left, 8), window.innerWidth - 160), y: Math.max(r.top - 8, 40) });
          return;
        }
      }
      setSel(null);
    };
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest?.('[data-explain-btn]')) return;
      setSel(null);
    };
    document.addEventListener('mouseup', onUp);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('mouseup', onUp); document.removeEventListener('mousedown', onDown); };
  }, []);

  // 教材はiframe内に描画されるため、iframeからの選択通知を受けてボタンを出す
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data;
      if (!d || d.__lmsExplain !== true) return;
      if (d.clear) { setSel(null); return; }
      const frame = Array.from(document.querySelectorAll('iframe')).find(f => f.contentWindow === e.source);
      if (!frame) return;
      const fb = frame.getBoundingClientRect();
      setSel({
        text: String(d.text || ''),
        x: Math.min(Math.max(fb.left + (d.left || 0), 8), window.innerWidth - 160),
        y: Math.max(fb.top + (d.top || 0) - 8, 40),
      });
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // ナビ項目（サイドバー・下部ナビ共通の定義。既存ルートのみを使用）
  const navItems = [
    { label: 'マイページ', icon: Home, path: '/mypage', active: isMyPage },
    { label: '学習コンテンツ', icon: BookOpen, path: '/courses', active: isCoursesPage },
    { label: 'AIサポート', icon: Sparkles, path: '/ai-apps', active: isAIApps },
  ];
  const learnItems = navItems;
  const manageItems = user?.isAdmin
    ? [{ label: '管理', icon: ShieldCheck, path: '/admin', active: isAdmin }]
    : user?.isCoach
    ? [{ label: '受講生一覧', icon: BookOpen, path: '/coach/students', active: isStudentsPage }]
    : [];

  // キーボードフォーカス時の共通フィードバック（色だけに依存しないよう ring + 背景色の両方を使う）
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD] focus-visible:ring-offset-0';

  // アイコンチップ（白〜オフホワイトの立体的な面。アクティブ時のみ赤グラデーション）
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
      {/* ── PC版 左サイドバー（ライト・開閉式・sm以上） ───────── */}
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
        {/* 極薄の斜めハッチングテクスチャ（真っ白にしない質感） */}
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

        {/* ブランド + 開閉トグル（一体化。ホバー/フォーカスでロゴがトグル矢印に切り替わる） */}
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

        {/* ナビ（グループ） */}
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

        {/* 下部：ヘルプ・通知・アカウント */}
        <div
          className="relative z-[1] pt-3.5 flex flex-col gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(210,201,197,0.58)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }}
        >
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

          {/* 通知（アカウントの上） */}
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

          {/* アカウント（行全体をクリック可能にするため AccountSettingsDropdown の遷移先へ直接ナビゲート） */}
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

      <header
        className="hidden"
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

            {/* Notifications（非表示ヘッダー内・refはサイドバー側に付与） */}
            <div className="relative">
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

      {/* なぞって解説ボタン（テキスト選択時） */}
      {!chatOpen && sel && (
        <button
          data-explain-btn
          onClick={() => {
            setInput(`「${sel.text}」について、初心者にもわかるように解説してください`);
            setChatOpen(true);
            setSel(null);
          }}
          className="fixed z-50 inline-flex items-center gap-1 text-xs font-bold text-white rounded-full px-3 py-1.5 shadow-lg"
          style={{ top: sel.y, left: sel.x, transform: 'translateY(-100%)', background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}
        >
          <Lightbulb className="w-3.5 h-3.5" /> AIに解説
        </button>
      )}

      {/* 右下常駐のAIコーチ FAB */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          aria-label="AIコーチに相談"
          className="fixed z-40 right-6 bottom-20 sm:bottom-6 w-16 h-16 rounded-full flex items-center justify-center text-white hover:opacity-90 transition-opacity"
          style={{
            background: 'linear-gradient(145deg, #f0444b, #D30F1A)',
            border: '4px solid rgba(255,255,255,0.7)',
            boxShadow: '0 14px 28px rgba(216,15,26,0.24)',
          }}
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

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
                        <>
                          {message.image && (
                            <img src={message.image} alt="添付画像" className="rounded-lg mb-2 max-h-48 w-auto object-contain border border-gray-200" />
                          )}
                          {message.content && <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
                        </>
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
              {/* 添付画像プレビュー */}
              {attachedImage && (
                <div className="relative inline-block mb-2">
                  <img src={attachedImage} alt="添付プレビュー" className="h-20 w-auto rounded-lg border border-gray-200 object-contain" />
                  <button
                    onClick={() => setAttachedImage(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-text text-white flex items-center justify-center shadow"
                    aria-label="添付を削除"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
              <div className="flex gap-2 items-end">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="p-2 rounded-lg border border-gray-300 text-brand-muted hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0"
                  aria-label="画像を添付"
                  title="画像を添付"
                >
                  <ImagePlus className="w-5 h-5" />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={attachedImage ? '画像について質問する…（任意）' : '質問を入力してください...'}
                  disabled={loading}
                  rows={1}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-gray-100"
                />
                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && !attachedImage) || loading}
                  className="p-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
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
