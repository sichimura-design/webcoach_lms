import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Home, BookOpen, Sparkles, Settings, ShieldCheck, BookMarked, HelpCircle, FileText, Mail, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, DoorOpen, MessagesSquare, Map } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationStore } from '../../store/notificationStore';
import { useNewContentNotification } from '../../hooks/useNewContentNotification';
import { AccountSettingsDropdown } from './AccountSettingsDropdown';
import GlobalAiCoachDrawer from '../aicoach/GlobalAiCoachDrawer';
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

  // AIコーチ本体とその開閉は GlobalAiCoachDrawer が持つ。
  // （なぞって解説の撤去に伴い、AppHeader からドロワーを開く経路は無くなった）

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
  // 教材ページは /course/:id（単数形）。ここを含めないと学習中にナビがどこも点灯しない。
  const isCoursesPage = location.pathname === '/courses' || location.pathname.startsWith('/courses/')
    || location.pathname.startsWith('/course/') || location.pathname === '/learning-courses';
  // 自習室 = 集中ブース（/focus-booth）＋学習記録（/study-log）＋ノート（/notes）。
  // 3面ともページ内の共通タブ（StudyRoomHeader）で行き来するので、ナビ項目は1つにまとめ、
  // どの面にいてもここを点灯させる（isCoursesPage が /course/* を含めているのと同じ考え方）。
  const isStudyRoom = location.pathname === '/focus-booth'
    || location.pathname === '/study-log'
    || location.pathname.startsWith('/notes');
  const isCoaching = location.pathname === '/coaching';
  const isLearningPlan = location.pathname.startsWith('/learning-plan');
  const isAiCoach = location.pathname === '/ai-coach';
  const isAdmin = location.pathname.startsWith('/admin');
  // 教材学習ワークスペースとAI専用ページには、それぞれ専用のAIコーチUIがある。
  // ここで常駐ドロワーとFABも出すと入口が二重になり、要件が避けたい「競合」になる。
  const hasOwnAiSurface = location.pathname.startsWith('/course/') || isAiCoach;

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

  // 【一旦停止】全画面共通の「なぞって解説」（テキスト選択で「AIに解説」ボタンを出す機能）は撤去した。
  // AppHeader は全ページに出るため、文章をなぞる・コピーするなどの通常操作のたびに
  // ポップアップが割り込んでしまうのが理由。
  // 教材ページ本文の選択ツールバー（解説／AIに質問／クリップ）は別実装なので残っている:
  //   components/learning/SelectionToolbar.tsx + hooks/useTextSelection.ts
  // 復活させるときは、出す画面を絞ってから戻すこと（全画面で出すと同じ問題が再発する）。

  // ナビ項目（サイドバー・下部ナビ共通の定義。既存ルートのみを使用）
  // 並び順は「毎日開くもの → 相談するもの → たまに見る長期のもの」。
  // 🔴 順序はレビューで指定されたもの。勝手に入れ替えないこと。
  const navItems = [
    { label: 'マイページ', icon: Home, path: '/mypage', active: isMyPage },
    { label: '学習コンテンツ', icon: BookOpen, path: '/courses', active: isCoursesPage },
    { label: '自習室', icon: DoorOpen, path: '/focus-booth', active: isStudyRoom },
    { label: 'AIコーチ', icon: Sparkles, path: '/ai-coach', active: isAiCoach },
    { label: 'コーチング', icon: MessagesSquare, path: '/coaching', active: isCoaching },
    { label: '学習ロードマップ', icon: Map, path: '/learning-plan', active: isLearningPlan },
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
          {/* 🔴 「学習」の見出しは出さない。上の6項目は全部が学習の導線で、
                 グループ名が付いていても選ぶ助けにならないためレビューで削除された。 */}
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
          {/*
            🔴 以前は外部Notionを別タブで開いていたが、学習中にLMSの外へ出てしまうため
               LMS内の /help に置き換えた（レビュー指摘）。本文は components/help/HelpPage.tsx。
          */}
          <button
            onClick={() => navigate('/help/manual')}
            className={`group relative flex items-center gap-2 w-full appearance-none border-0 bg-transparent cursor-pointer rounded-lg text-[10px] font-bold no-underline text-[#303845] hover:text-[#E0242B] hover:bg-white/[0.76] transition-colors ${focusRing} ${
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
          </button>
          <button
            onClick={() => navigate('/help/faq')}
            className={`group relative flex items-center gap-2 w-full appearance-none border-0 bg-transparent cursor-pointer rounded-lg text-[10px] font-bold no-underline text-[#303845] hover:text-[#E0242B] hover:bg-white/[0.76] transition-colors ${focusRing} ${
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
          </button>

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
            {/*
              🔴 展開時も含めて常に「個人設定を開く」を出す。
                 名前とアイコンだけでは押した先が分からない、というレビュー指摘への対応。
                 折りたたみ時は誰のアカウントかも分からないので名前を添える。
            */}
            <span
              role="tooltip"
              aria-hidden="true"
              className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#262C35] px-2 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
            >
              {expanded ? '個人設定を開く' : `${resolvedUserName}（個人設定を開く）`}
            </span>
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

              {/* AIコーチ */}
              <button
                onClick={() => navigate('/ai-coach')}
                className={`flex items-center gap-1.5 rounded-full text-sm font-bold transition-all px-2.5 sm:px-5 border-0 ${
                  isAiCoach
                    ? 'text-white bg-brand-gradient'
                    : 'text-brand-muted'
                }`}
                style={{
                  height: '36px',
                  fontSize: '14px',
                }}
              >
                <Sparkles className="w-[18px] h-[18px]" />
                <span className="hidden sm:inline">AIコーチ</span>
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
              onClick={() => navigate('/ai-coach')}
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
            onClick={() => navigate('/ai-coach')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isAiCoach ? 'text-brand' : 'text-brand-muted'}`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-bold">AIコーチ</span>
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

      {/* 常駐AIコーチ（FAB＋ドロワー）。
          教材ページとAI専用ページには専用のAIコーチ面があるので出さない。
          両方出すと入口が二重になり、どちらで話したか分からなくなる。 */}
      {!hasOwnAiSurface && <GlobalAiCoachDrawer />}
    </>
  );
}

export default AppHeader;
