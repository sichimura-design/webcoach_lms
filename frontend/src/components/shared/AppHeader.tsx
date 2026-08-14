import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Home, BookOpen, Sparkles, Settings, ShieldCheck, BookMarked, HelpCircle, FileText, Mail, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, DoorOpen, MessagesSquare, Map } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationStore } from '../../store/notificationStore';
import { useNewContentNotification } from '../../hooks/useNewContentNotification';
import { AccountSettingsDropdown } from './AccountSettingsDropdown';
import GlobalAiCoachDrawer from '../aicoach/GlobalAiCoachDrawer';
import { withCfToken } from '../profile/AvatarPicker';
import { color } from '../../theme/webcoachTheme';

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

  /*
   * ナビパネルの開閉。
   * 🔴 初期値は「閉」で、localStorage にも保存しない。
   *    以前はサイドバーが本文を押し widen/narrow する作り（＝レイアウトの好み）だったので
   *    展開状態を復元するのが正しかった。いまはレールに重なる暗幕付きオーバーレイなので、
   *    復元すると毎回のページ読み込みで暗幕が出たまま始まってしまう。
   *    行き先を選ぶための一時的な面として、開くのは常に明示操作から。
   */
  const [expanded, setExpanded] = useState(false);

  // PC版レールぶんの余白を body に付与（このヘッダーを描画するページのみ）。
  // パネルは本文を押さないので、開閉に連動して変える余白は無い。
  useEffect(() => {
    document.body.classList.add('with-sidebar');
    return () => { document.body.classList.remove('with-sidebar'); };
  }, []);

  // ナビパネルはレールに重なるオーバーレイなので、Escでも閉じられるようにする
  // （背面クリックは overlay 側の onClick が受ける）
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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

  /*
   * サイドバーの配色。claude.ai/design『マイページ 3d.dc.html』準拠。
   * 🔴 サイドバーは全ページ共通なので、マイページ限定の CSS 変数（--dc-*）は使えない。
   * 🔴 ブランド赤は theme/webcoachTheme.ts の color.primary を参照する。
   *    この赤が全画面の基準になっているので、直書きして二重管理にしないこと
   *    （かつてサイドバーだけ別の値を持っていて、他ページと色が食い違っていた）。
   */
  const SB = {
    railBg: '#FDF7F3',
    railBorder: '#E2DBD0',
    railDivider: '#EFE9E0',
    brand: color.primary,
    softPink: '#FDF2F2',
    iconIdle: '#6B6B6B',
    panelBg: color.primary,
    panelInk: '#FDF7F3',
    /** 白い面に乗るアクティブ文字。primary そのままだと白地でやや浮くので一段暗く */
    panelActiveInk: color.primaryHover,
  };

  /*
   * サイドバーの寸法。
   * ============================================================
   * 🔴 デザイン（マイページ 3d.dc.html）の実寸より一段小さくしている。
   *    デザインは行高52px・ロゴ23pxで組まれているが、その値だと
   *    パネルの中身が約748px必要になり、実効ビューポート高が
   *    700px を下回る環境（表示スケール150%のノートPCなど）で
   *    最下部のアカウント行が見切れる。詰めた結果は約612px。
   * 🔴 それでも足りない画面はありうるので、ナビ帯には overflow-y:auto を
   *    持たせてある（下の scrollArea）。寸法だけで担保しないこと。
   * ============================================================
   */
  const SZ = {
    /** パネルのナビ行 */
    rowH: 44,
    rowFont: 14,
    rowIcon: 19,
    rowGap: 12,
    rowPadX: 15,
    /** レールの丸アイコン */
    railBtn: 40,
    railIcon: 18,
    railGap: 6,
    /** パネル下部の補助リンク */
    subH: 34,
    subFont: 13,
    subIcon: 16,
    /** アカウント行のアバター */
    avatarPanel: 36,
    avatarRail: 36,
  };

  const tooltipClass =
    'pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#262C35] px-2 py-1.5 text-[11px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none';

  /** 常時見えている72pxレールの丸アイコン1つ */
  const renderRailItem = (item: { label: string; icon: any; path: string; active: boolean }) => {
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        aria-label={item.label}
        aria-current={item.active ? 'page' : undefined}
        className={`group relative grid place-items-center rounded-full appearance-none border-0 cursor-pointer transition-colors duration-200 motion-reduce:transition-none ${focusRing} ${
          item.active ? '' : 'hover:bg-[#FDF2F2]'
        }`}
        style={{
          width: SZ.railBtn,
          height: SZ.railBtn,
          flex: 'none',
          background: item.active ? SB.brand : 'transparent',
          boxShadow: item.active ? '0 2px 10px -2px rgba(214,9,52,.4)' : undefined,
        }}
      >
        <Icon size={SZ.railIcon} strokeWidth={1.75} color={item.active ? SB.panelInk : SB.iconIdle} />
        {/* レールはアイコンのみなので、ホバー/フォーカスでラベルを添える（title属性はキーボードで読めない） */}
        <span role="tooltip" aria-hidden="true" className={tooltipClass}>
          {item.label}
        </span>
      </button>
    );
  };

  /** スライドオーバーパネル（224px・赤）の行1つ */
  const renderPanelItem = (item: { label: string; icon: any; path: string; active: boolean }) => {
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => { navigate(item.path); setExpanded(false); }}
        aria-current={item.active ? 'page' : undefined}
        className={`relative flex items-center w-full appearance-none border-0 cursor-pointer text-left rounded-full transition-colors duration-200 motion-reduce:transition-none ${focusRing} ${
          item.active ? '' : 'hover:bg-white/[0.12]'
        }`}
        style={{
          height: SZ.rowH,
          padding: `0 ${SZ.rowPadX}px`,
          gap: SZ.rowGap,
          fontSize: SZ.rowFont,
          background: item.active ? SB.panelInk : 'transparent',
          color: item.active ? SB.panelActiveInk : SB.panelInk,
          fontWeight: item.active ? 700 : 500,
          boxShadow: item.active ? '0 2px 10px -2px rgba(90,0,14,.35)' : undefined,
        }}
      >
        <Icon size={SZ.rowIcon} strokeWidth={1.75} color={item.active ? SB.brand : SB.panelInk} style={{ flex: 'none' }} />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  /** パネル下部の補助リンク（利用マニュアル・よくある質問） */
  const renderPanelSubLink = (label: string, Icon: any, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={`flex items-center w-full appearance-none border-0 bg-transparent cursor-pointer text-left rounded-lg transition-opacity hover:opacity-75 motion-reduce:transition-none ${focusRing}`}
      style={{ height: SZ.subH, gap: 12, fontSize: SZ.subFont, color: 'rgba(253,247,243,.95)' }}
    >
      <Icon size={SZ.subIcon} strokeWidth={1.75} style={{ flex: 'none' }} />
      <span className="truncate">{label}</span>
    </button>
  );


  return (
    <>
      {/* ──────────────────────────────────────────────────────────
          PC版 左ナビ（sm以上）。claude.ai/design『マイページ 3d.dc.html』準拠。
          2層構造:
            ① レール（72px・常時表示）… アイコンのみ。ここが本文のオフセット幅
            ② パネル（224px・赤）    … レールの上に重なるオーバーレイ

          🔴 パネルは本文を押さない。だから body の padding-left は常に 72px で、
             開閉で本文の幅が変わらない（以前は展開すると本文が 190px 削られていた）。
         ────────────────────────────────────────────────────────── */}
      <aside
        id="app-sidebar-rail"
        className="hidden sm:flex flex-col items-center fixed left-0 top-0 bottom-0 z-40"
        style={{
          width: 'var(--wc-sidebar-w)',
          padding: '18px 0 16px',
          background: SB.railBg,
          borderRight: `1px solid ${SB.railBorder}`,
          boxShadow: '3px 0 10px -4px rgba(60,48,32,.18)',
        }}
      >
        <span
          aria-hidden="true"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: 18, color: SB.brand, marginBottom: 12, flex: 'none' }}
        >
          W
        </span>

        <button
          onClick={() => setExpanded(true)}
          aria-expanded={expanded}
          aria-controls="app-sidebar-panel"
          aria-label="サイドバーをひらく"
          className={`group relative grid place-items-center appearance-none border-0 cursor-pointer transition-colors duration-200 hover:bg-[#FBE3E6] motion-reduce:transition-none ${focusRing}`}
          style={{ width: 34, height: 34, borderRadius: 10, background: SB.softPink, color: SB.brand, marginBottom: 18, flex: 'none' }}
        >
          <ChevronsRight size={16} strokeWidth={2.25} />
          <span role="tooltip" aria-hidden="true" className={tooltipClass}>サイドバーをひらく</span>
        </button>

        {/*
          🔴 ナビ帯だけを伸縮・スクロールさせる（minHeight:0 が無いと flex 内で縮まない）。
             下のお知らせ・アカウントは常に見えている必要があるので、
             画面が低いときに削られるのはここ。
        */}
        <div className="flex flex-col items-center" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', width: '100%' }}>
          <nav aria-label="メインナビゲーション" className="flex flex-col items-center" style={{ gap: SZ.railGap }}>
            {learnItems.map(renderRailItem)}
          </nav>

          {manageItems.length > 0 && (
            <>
              <div aria-hidden="true" style={{ width: 32, height: 1, background: SB.railDivider, margin: '12px 0', flex: 'none' }} />
              {manageItems.map(renderRailItem)}
            </>
          )}
        </div>

        {/* お知らせ（ベル + 件数バッジ + ドロップダウン） */}
        <div className="relative" ref={notifRef} style={{ flex: 'none' }}>
          <button
            onClick={() => setNotifOpen(v => !v)}
            aria-label="お知らせ"
            aria-expanded={notifOpen}
            className={`group relative grid place-items-center rounded-full appearance-none border-0 bg-transparent cursor-pointer transition-colors duration-200 hover:bg-[#FDF2F2] motion-reduce:transition-none ${focusRing}`}
            style={{ width: SZ.railBtn, height: SZ.railBtn }}
          >
            <Bell size={SZ.railIcon} strokeWidth={1.75} color={SB.iconIdle} />
            {notificationItems.length > 0 && (
              <span
                className="absolute flex items-center justify-center rounded-full font-extrabold text-white"
                style={{ top: 4, right: 4, minWidth: 16, height: 16, fontSize: 9, padding: '0 3px', background: SB.brand }}
              >
                {notificationItems.length > 9 ? '9+' : notificationItems.length}
              </span>
            )}
            <span role="tooltip" aria-hidden="true" className={tooltipClass}>お知らせ</span>
          </button>

          {notifOpen && (
            <div
              className="absolute left-full bottom-0 ml-2 bg-white overflow-hidden z-50"
              style={{ width: 300, borderRadius: 16, border: '1px solid #EBE7E5', boxShadow: '0 16px 38px rgba(96,70,65,0.14)' }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #EBE7E5' }}>
                <span className="font-bold text-sm text-dash-text">新着通知</span>
                {notificationItems.length > 0 && (
                  <button onClick={() => { markAllRead(); setNotifOpen(false); }} className="text-xs font-medium text-dash-primary hover:opacity-70">すべて既読</button>
                )}
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
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

        {/* アカウント */}
        <button
          onClick={() => navigate('/account-settings')}
          aria-label={`アカウント設定: ${resolvedUserName}`}
          className={`group relative grid place-items-center rounded-full overflow-hidden appearance-none cursor-pointer ${focusRing}`}
          style={{ width: SZ.avatarRail, height: SZ.avatarRail, marginTop: 8, flex: 'none', background: SB.softPink, border: '1px solid #F5D8DB', boxSizing: 'border-box' }}
        >
          <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          <span role="tooltip" aria-hidden="true" className={tooltipClass}>
            {`${resolvedUserName}（個人設定を開く）`}
          </span>
        </button>
      </aside>

      {/* パネルを開いているときの背面。クリックで閉じる（デザインの « 以外の逃げ道） */}
      <div
        aria-hidden="true"
        onClick={() => setExpanded(false)}
        className="hidden sm:block fixed inset-0 z-40 transition-opacity duration-[280ms] motion-reduce:transition-none"
        style={{
          background: 'rgba(20,20,20,.28)',
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? 'auto' : 'none',
        }}
      />

      <div
        id="app-sidebar-panel"
        aria-hidden={!expanded}
        className="hidden sm:flex flex-col fixed left-0 top-0 bottom-0 motion-reduce:transition-none"
        style={{
          width: 224,
          zIndex: 45,
          background: SB.panelBg,
          padding: '38px 12px 16px',
          boxSizing: 'border-box',
          transform: expanded ? 'translateX(0)' : 'translateX(-105%)',
          transition: 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          boxShadow: expanded ? '8px 0 32px -8px rgba(90,0,14,.45)' : 'none',
          pointerEvents: expanded ? 'auto' : 'none',
        }}
      >
        <button
          onClick={() => setExpanded(false)}
          aria-label="サイドバーを閉じる"
          className={`absolute appearance-none border-0 bg-transparent cursor-pointer transition-opacity hover:opacity-75 motion-reduce:transition-none ${focusRing}`}
          style={{ top: 14, right: 14, padding: '4px 8px', color: SB.panelInk }}
        >
          <ChevronsLeft size={18} strokeWidth={2.25} />
        </button>

        <div style={{ padding: '0 8px 22px', textAlign: 'center', flex: 'none' }}>
          <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: 19, color: SB.panelInk, letterSpacing: '.03em' }}>
            WEBCOACH
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'rgba(253,247,243,.9)', letterSpacing: '.12em', marginTop: 4 }}>
            学習システム
          </div>
        </div>

        {/*
          🔴 ナビ帯だけを伸縮・スクロールさせる（minHeight:0 が無いと flex 内で縮まない）。
             補助リンクとアカウント行は常に見えている必要があるので、
             画面が低いときに削られるのはここ。ユーザー報告の「下まで入りきってない」の対処。
        */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <nav aria-label="メインナビゲーション" className="flex flex-col" style={{ gap: 4 }}>
            {learnItems.map(renderPanelItem)}
          </nav>

          {manageItems.length > 0 && (
            <>
              <div aria-hidden="true" style={{ height: 1, background: 'rgba(253,247,243,.3)', margin: '14px 8px' }} />
              {manageItems.map(renderPanelItem)}
            </>
          )}
        </div>

        <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
          {renderPanelSubLink('利用マニュアル', FileText, () => { navigate('/help/manual'); setExpanded(false); })}
          {renderPanelSubLink('よくある質問', HelpCircle, () => { navigate('/help/faq'); setExpanded(false); })}
        </div>

        <button
          onClick={() => { navigate('/account-settings'); setExpanded(false); }}
          aria-label={`アカウント設定: ${resolvedUserName}`}
          className={`flex items-center w-full appearance-none border-0 bg-transparent cursor-pointer text-left transition-opacity hover:opacity-90 motion-reduce:transition-none ${focusRing}`}
          style={{ borderTop: '1px solid rgba(253,247,243,.3)', padding: '12px 8px 2px', gap: 10, flex: 'none' }}
        >
          <span
            className="grid place-items-center rounded-full overflow-hidden"
            style={{ width: SZ.avatarPanel, height: SZ.avatarPanel, flex: 'none', background: '#F2E8E1' }}
          >
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          </span>
          <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: SB.panelInk }}>
            {resolvedUserName}
          </span>
          <ChevronRight size={15} strokeWidth={2} color={SB.panelInk} style={{ flex: 'none' }} />
        </button>
      </div>

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
