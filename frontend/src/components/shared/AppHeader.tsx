import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Home, BookOpen, Sparkles, Settings, ShieldCheck, BookMarked, HelpCircle, FileText, Mail, ChevronDown, ChevronRight, ChevronsLeft, PanelLeftOpen, MessagesSquare, NotebookPen, UserRound } from 'lucide-react';
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

/** ナビの開閉をタブ内で持ち回すキー（ページ遷移で AppHeader が再マウントされるため） */
const SIDEBAR_KEY = 'wc-sidebar-expanded';

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

  /*
   * アカウントのポップオーバー。
   * 🔴 レールの丸アバターは、行き先が見えないまま画面が変わるのが唐突なので
   *    クリックでもポップオーバーの開閉に留める（直行させない）。
   * 🔴 一方、パネル（開いた224px）のアカウント行は名前と › が見えているので、
   *    クリックで /account-settings へ直行する。行き先の一覧はホバー／フォーカスで
   *    出るポップオーバーが引き続き担う。
   * 🔴 ログアウトはここには置かない。アカウント設定画面が持っている
   *    （SCREEN-013 でそう決めた）。ホバーで開く面に破壊的操作を混ぜない。
   */
  const [accountOpen, setAccountOpen] = useState(false);
  // レール用とパネル用で別々。どちらも常時マウント（クロスフェード中に
  // アカウント行だけ消えるのを避けるため）なので、外側クリック判定は両方見る。
  const accountRailRef = useRef<HTMLDivElement>(null);
  const accountPanelRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
      const inAccount =
        accountRailRef.current?.contains(e.target as Node) ||
        accountPanelRef.current?.contains(e.target as Node);
      if (!inAccount) setAccountOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ポップオーバーは Esc でも閉じる（ホバーから外すのが唯一の手段だと詰む）
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAccountOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [accountOpen]);

  const avatarSrc = resolvedAvatarUrl ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedUserName)}&background=F0EAE6&color=CDC6C6`;

  /*
   * ナビのアクティブ判定。
   * ============================================================
   * 🔴 メインナビは「ユーザーが自分からやりに行く行動」5本柱だけにする。
   *    トップ / 学習する / AIコーチ / コーチング / マイノート。
   *    重要だが自分から見に行かない情報（学習記録・ランキング・ロードマップ）は
   *    ナビに項目を作らず、トップや各体験の中で露出させる。
   * 🔴 ナビに無いページも、必ずどれか1本の配下として点灯させる。
   *    「今どの柱にいるか」が消えると現在地を見失うため。
   * ============================================================
   */
  // トップ。学習記録（/study-log）はトップの「詳しく見る」の先なのでここに属する。
  const isTop = location.pathname === '/mypage'
    || location.pathname === '/'
    || location.pathname === '/study-log';
  // 学習する。教材ページは /course/:id（単数形）なので両方見る。
  const isCoursesPage = location.pathname === '/courses' || location.pathname.startsWith('/courses/')
    || location.pathname.startsWith('/course/') || location.pathname === '/learning-courses';
  // マイノート。?note=<id> はクエリなので pathname だけで判定できる。
  const isNotes = location.pathname.startsWith('/notes');
  // コーチング。学習ロードマップ（/learning-plan）は「コーチと決める長期の計画」なのでここに属する。
  const isLearningPlan = location.pathname.startsWith('/learning-plan');
  const isCoaching = location.pathname === '/coaching' || isLearningPlan;
  const isAiCoach = location.pathname === '/ai-coach';
  const isAdmin = location.pathname.startsWith('/admin');
  /*
   * 常駐のAIコーチ（ドロワーとFAB）を出さない画面。
   * 🔴 教材学習ワークスペースとAI専用ページには、それぞれ専用のAIコーチUIがある。
   *    ここで常駐ドロワーとFABも出すと入口が二重になり、要件が避けたい「競合」になる。
   * 🔴 アカウント設定・プロフィール設定は、学習ではなく「設定を変える」画面。
   *    メールやパスワードを入れている最中にAIに相談する用事は無く、FABが
   *    フォームの右下に重なるだけなので出さない。
   */
  const isSettingsPage = location.pathname === '/account-settings' || location.pathname === '/profile';
  const hasOwnAiSurface = location.pathname.startsWith('/course/') || isAiCoach || isSettingsPage;

  /*
   * ナビパネルの開閉。
   * ============================================================
   * 🔴 sessionStorage に保存する。AppHeader はレイアウトルートではなく
   *    各ページが個別に描画しているので（16画面）、ページ遷移のたびに
   *    再マウントされて state が落ちる。push 型の要件「開いたまま
   *    コンテンツを操作できる」（DESIGN-3d.md §3-2）を満たすには、
   *    遷移をまたいで開閉が保たれている必要がある。
   * 🔴 localStorage ではなくタブ単位の sessionStorage にしているのは、
   *    「開いたまま始まる」状態を次回の訪問まで持ち越さないため。
   *    暗幕付きオーバーレイだった頃は復元すると毎回暗幕から始まる問題が
   *    あったが、push 型では暗幕が無いのでタブ内の復元は害にならない。
   * ============================================================
   */
  const [expanded, setExpanded] = useState(() => {
    try { return sessionStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(SIDEBAR_KEY, expanded ? '1' : '0'); } catch { /* private mode 等 */ }
  }, [expanded]);

  /*
   * PC版ナビぶんの余白を body に付与（このヘッダーを描画するページのみ）。
   * 🔴 push 型なので、開閉に連動して本文の余白も 72px ⇄ 224px で動く
   *    （実際の値は index.css の --wc-sidebar-w / --wc-sidebar-w-expanded）。
   * 🔴 useEffect ではなく useLayoutEffect。復元で開いた状態から始まるとき、
   *    ペイント後にクラスが付くと本文が一度 72px 幅で描かれてから跳ねる。
   */
  useLayoutEffect(() => {
    document.body.classList.add('with-sidebar');
    document.body.classList.toggle('sidebar-expanded', expanded);
    return () => { document.body.classList.remove('with-sidebar', 'sidebar-expanded'); };
  }, [expanded]);

  // 暗幕が無い（＝背面クリックで閉じる逃げ道が無い）ので、Escは閉じ手段として残す。
  // 閉じるボタンとロゴクリックが主な導線。
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

  /*
   * ナビ項目（PCサイドバー・SP下部ナビ共通の定義。ここが唯一の定義）。
   * ============================================================
   * 🔴 5本柱。並び順は「毎日開く → 相談する → 蓄積を見る」。
   *    勝手に増やさないこと。増やしたくなったら、それが本当に
   *   「ユーザーが自分からやりに行く行動」なのかを先に問う。
   *    そうでないものはトップか、対応する体験の中に置く。
   * 🔴 項目数はサイドバーの高さ予算にも効く（下の SZ のコメント参照）。
   * ============================================================
   */
  const navItems = [
    { label: 'トップ', icon: Home, path: '/mypage', active: isTop },
    { label: '学習する', icon: BookOpen, path: '/courses', active: isCoursesPage },
    { label: 'AIコーチ', icon: Sparkles, path: '/ai-coach', active: isAiCoach },
    { label: 'コーチング', icon: MessagesSquare, path: '/coaching', active: isCoaching },
    { label: 'マイノート', icon: NotebookPen, path: '/notes', active: isNotes },
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
    /** ツールチップのダークピル（デザインの .rail-tip） */
    tipBg: '#3A3532',
  };

  /*
   * サイドバーの寸法。
   * ============================================================
   * 🔴 デザイン（マイページ 3d.dc.html）の実寸より一段小さい。デザインは
   *    行高52px・ロゴ23px・パネル上余白44pxで組まれているが、その値だと
   *    パネルの中身に約814px必要で、ノートPCの実効ビューポート高に収まらず
   *    スクロールしないと下まで見えない。レビューでも「でかすぎる」判断。
   *    この寸法での合計は約 671px で、700px の画面に収まる。
   * 🔴 上端の詰め方が要点。閉じるボタン（絶対配置）とロゴを上に寄せ、
   *    パネル上余白 44→12px・ロゴ上余白 24→30px（＝ボタンぶんの逃げだけ）に
   *    したことで、ヘッダー部だけで約57px削れている。ここを戻すと
   *    再び下が入りきらなくなる。
   * 🔴 値を足すとき（ナビ項目や補助リンクを増やすとき）は合計を再計算すること。
   *    行を1つ足しただけで700pxに収まらなくなり、管理の行が半分だけ見える
   *    状態になる。ナビ帯の overflow-y:auto は最後の保険で、寸法で担保する。
   * ============================================================
   */
  const SZ = {
    /** パネルのナビ行 */
    rowH: 46,
    rowFont: 13,
    rowIcon: 18,
    rowGap: 12,
    rowPadX: 16,
    /** ナビ行どうしの隙間 */
    rowSpacing: 4,
    /** レールの丸アイコン */
    railBtn: 40,
    railIcon: 18,
    railGap: 6,
    /** パネル下部の補助リンク */
    subH: 32,
    subFont: 12,
    subIcon: 15,
    /** アカウント行のアバター */
    avatarPanel: 36,
    avatarRail: 36,
    /** 外周 */
    panelPad: '12px 12px 16px',
    railPad: '16px 0 16px',
    /** ロゴ。上余白は閉じるボタン（top:8・34px角）を避けるぶんだけ */
    logoPad: '30px 8px 14px',
    logoFont: 18,
    logoSubFont: 11,
    /** 学習項目と管理の間の区切り線 */
    panelDividerMargin: '14px 8px',
  };

  /** デザインの .rail-tip / .panel-tip（ダークピル・アイコン右にフェードイン） */
  const tooltipClass =
    'pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 whitespace-nowrap rounded-[7px] px-2.5 py-[5px] text-[12px] font-medium opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none';
  const tooltipStyle = { background: SB.tipBg, color: SB.panelInk };

  /** 常時見えている72pxレールの丸アイコン1つ */
  const renderRailItem = (item: { label: string; icon: any; path: string; active: boolean }) => {
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        aria-label={item.label}
        aria-current={item.active ? 'page' : undefined}
        tabIndex={expanded ? -1 : undefined}
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
        <span role="tooltip" aria-hidden="true" className={tooltipClass} style={tooltipStyle}>
          {item.label}
        </span>
      </button>
    );
  };

  /*
   * 展開パネル（224px・赤）の行1つ。
   * 🔴 遷移しても閉じない。push 型は「開いたままコンテンツを操作できる」のが
   *    要件（DESIGN-3d.md §3-2）なので、行き先を選んだら畳む挙動にしないこと。
   */
  const renderPanelItem = (item: { label: string; icon: any; path: string; active: boolean }) => {
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => navigate(item.path)}
        aria-current={item.active ? 'page' : undefined}
        tabIndex={expanded ? undefined : -1}
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

  /*
   * アカウントのポップオーバー本体。レール（閉）とパネル（開）で共用する。
   * どちらも画面左下が起点なので、右上に向かって開く（left-full / bottom-0）。
   * 🔴 常時マウントして opacity で出し入れする。条件レンダリングだと
   *    マウスがトリガーからポップへ移る一瞬で消えて選べないことがある。
   */
  const accountItems = [
    { label: 'アカウント設定', icon: Settings, path: '/account-settings' },
    { label: 'プロフィール', icon: UserRound, path: '/profile' },
  ];

  const renderAccountPopover = () => (
    <div
      role="menu"
      aria-label="アカウント"
      aria-hidden={!accountOpen}
      className="absolute left-full bottom-0 ml-2.5 bg-white overflow-hidden z-50 transition-opacity duration-150 motion-reduce:transition-none"
      style={{
        width: 232,
        borderRadius: 14,
        border: '1px solid #EBE7E5',
        boxShadow: '0 16px 38px rgba(96,70,65,.16)',
        opacity: accountOpen ? 1 : 0,
        pointerEvents: accountOpen ? 'auto' : 'none',
      }}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ borderBottom: '1px solid #F3EFEE' }}>
        <span className="grid place-items-center rounded-full overflow-hidden" style={{ width: 36, height: 36, flex: 'none', background: SB.softPink }}>
          <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
        </span>
        <span className="min-w-0">
          <span className="block truncate" style={{ fontSize: 13, fontWeight: 700, color: '#2B2629' }}>{resolvedUserName}</span>
          {user?.username && (
            <span className="block truncate" style={{ fontSize: 11, color: '#8B8386', marginTop: 1 }}>{user.username}</span>
          )}
        </span>
      </div>

      {accountItems.map(({ label, icon: Icon, path }) => (
        <button
          key={path}
          role="menuitem"
          tabIndex={accountOpen ? undefined : -1}
          onClick={() => { navigate(path); setAccountOpen(false); }}
          className={`flex items-center w-full appearance-none border-0 bg-transparent cursor-pointer text-left transition-colors hover:bg-[#FAF7F7] motion-reduce:transition-none ${focusRing}`}
          style={{ gap: 10, padding: '10px 14px', fontSize: 13, color: '#3D3D3D' }}
        >
          <Icon size={16} strokeWidth={1.75} color={SB.iconIdle} style={{ flex: 'none' }} />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  );

  /** パネル下部の補助リンク（利用マニュアル・よくある質問） */
  const renderPanelSubLink = (label: string, Icon: any, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      tabIndex={expanded ? undefined : -1}
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
          2層構造（どちらも left:0 に常時マウントし、クロスフェードで入れ替わる）:
            ① レール（72px・既定）… アイコンのみ
            ② パネル（224px・赤） … 展開時

          🔴 push 型。展開すると body の padding-left が 72px → 224px に伸び、
             本文が右に縮んでリフローする（index.css の body.sidebar-expanded）。
             暗幕は張らない ＝ 開いたまま本文を操作できる。
             オーバーレイ＋暗幕に戻すと DESIGN-3d.md §3-2/§8 の決着に反する。
         ────────────────────────────────────────────────────────── */}
      <aside
        id="app-sidebar-rail"
        aria-hidden={expanded}
        className="hidden sm:flex flex-col items-center fixed left-0 top-0 bottom-0 z-40 motion-reduce:transition-none"
        style={{
          width: 'var(--wc-sidebar-w)',
          padding: SZ.railPad,
          background: SB.railBg,
          borderRight: `1px solid ${SB.railBorder}`,
          boxShadow: '3px 0 10px -4px rgba(60,48,32,.18)',
          opacity: expanded ? 0 : 1,
          pointerEvents: expanded ? 'none' : 'auto',
          transition: 'opacity 180ms ease',
        }}
      >
        {/* レール最上部は開くボタン1つだけ（デザインにワードマークは無い） */}
        <button
          onClick={() => setExpanded(true)}
          aria-expanded={expanded}
          aria-controls="app-sidebar-panel"
          aria-label="サイドバーをひらく"
          tabIndex={expanded ? -1 : undefined}
          className={`group relative grid place-items-center appearance-none border-0 bg-transparent cursor-pointer transition-colors duration-200 hover:bg-[#FDF2F2] motion-reduce:transition-none ${focusRing}`}
          style={{ width: SZ.railBtn, height: SZ.railBtn, borderRadius: 10, marginBottom: 14, flex: 'none' }}
        >
          <PanelLeftOpen size={19} strokeWidth={1.75} color={SB.brand} />
          <span role="tooltip" aria-hidden="true" className={tooltipClass} style={tooltipStyle}>サイドバーをひらく</span>
        </button>

        {/*
          ナビ帯を伸縮させてアカウントを下端に置く（minHeight:0 が無いと flex 内で縮まない）。
          🔴 ここに overflow を付けてはいけない。付けるとホバー時のツールチップが
             レールの内側（72px幅）で切られて読めなくなる。overflow:hidden/auto は
             どちらもクリップ領域を作るので、x だけ hidden にしても同じこと。
             レールの中身は合計 約470px で、実用的な画面高には収まる。
        */}
        <div className="flex flex-col items-center" style={{ flex: 1, minHeight: 0, width: '100%' }}>
          <nav aria-label="メインナビゲーション" className="flex flex-col items-center" style={{ gap: SZ.railGap }}>
            {learnItems.map(renderRailItem)}
          </nav>

          {manageItems.length > 0 && (
            <>
              <div aria-hidden="true" style={{ width: 32, height: 1, background: SB.railDivider, margin: '14px 0', flex: 'none' }} />
              {manageItems.map(renderRailItem)}
            </>
          )}
        </div>

        {/* 🔴 お知らせ（ベル）はレールにもパネルにも置かない（レビューで不要と判断）。
               通知そのものは useNewContentNotification が拾い続けているので、
               入口が要るようになったらここにベルを戻すのではなく、
               どの面に置くかを決めてから追加すること。 */}

        {/* アカウント。ホバー（＋クリック／フォーカス）でポップオーバーを出す。
            🔴 円形の切り抜きは button ではなく内側の span に持たせる。button 側に
               overflow:hidden があるとポップオーバーやツールチップが切られる。 */}
        <div
          ref={accountRailRef}
          className="relative"
          style={{ marginTop: 10, flex: 'none' }}
          onMouseEnter={() => setAccountOpen(true)}
          onMouseLeave={() => setAccountOpen(false)}
        >
          <button
            onClick={() => setAccountOpen(v => !v)}
            onFocus={() => setAccountOpen(true)}
            aria-label={`アカウント: ${resolvedUserName}`}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            tabIndex={expanded ? -1 : undefined}
            className={`grid place-items-center rounded-full appearance-none cursor-pointer ${focusRing}`}
            style={{ width: SZ.avatarRail, height: SZ.avatarRail, background: SB.softPink, border: '1px solid #F5D8DB', boxSizing: 'border-box' }}
          >
            <span className="grid place-items-center rounded-full overflow-hidden w-full h-full">
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            </span>
          </button>
          {!expanded && renderAccountPopover()}
        </div>
      </aside>

      {/* 展開パネル。レールと同じ位置に常時マウントし、クロスフェードで入れ替わる。
          🔴 暗幕は張らない（DESIGN-3d.md §8 で不要と決着）。本文は body の
             padding-left が伸びることで押し出される。 */}
      <div
        id="app-sidebar-panel"
        aria-hidden={!expanded}
        className="hidden sm:flex flex-col fixed left-0 top-0 bottom-0 motion-reduce:transition-none"
        style={{
          width: 'var(--wc-sidebar-w-expanded)',
          zIndex: 45,
          background: SB.panelBg,
          padding: SZ.panelPad,
          boxSizing: 'border-box',
          boxShadow: '3px 0 10px -4px rgba(90,0,14,.25)',
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? 'auto' : 'none',
          transition: 'opacity 220ms ease',
        }}
      >
        <button
          onClick={() => setExpanded(false)}
          aria-expanded={expanded}
          aria-controls="app-sidebar-panel"
          aria-label="サイドバーを閉じる"
          tabIndex={expanded ? undefined : -1}
          className={`group absolute grid place-items-center appearance-none border-0 bg-transparent cursor-pointer transition-colors duration-200 hover:bg-white/[0.15] motion-reduce:transition-none ${focusRing}`}
          style={{ top: 8, right: 8, width: 34, height: 34, borderRadius: 10, color: SB.panelInk }}
        >
          <ChevronsLeft size={18} strokeWidth={2} />
          <span role="tooltip" aria-hidden="true" className={tooltipClass} style={tooltipStyle}>サイドバーを閉じる</span>
        </button>

        {/* ロゴもクリックで閉じられる（DESIGN-3d.md §3-2）。
            hover の見た目変化は付けない指定なので付けないこと。 */}
        <div
          role="button"
          tabIndex={expanded ? 0 : -1}
          aria-label="サイドバーを閉じる"
          onClick={() => setExpanded(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(false); } }}
          className={`cursor-pointer rounded-lg ${focusRing}`}
          style={{ padding: SZ.logoPad, textAlign: 'center', flex: 'none' }}
        >
          <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 800, fontSize: SZ.logoFont, color: SB.panelInk, letterSpacing: '.03em' }}>
            WEBCOACH
          </div>
          <div style={{ fontSize: SZ.logoSubFont, fontWeight: 500, color: 'rgba(253,247,243,.9)', letterSpacing: '.12em', marginTop: 6 }}>
            学習システム
          </div>
        </div>

        {/*
          🔴 ナビ帯だけを伸縮・スクロールさせる（minHeight:0 が無いと flex 内で縮まない）。
             補助リンクとアカウント行は常に見えている必要があるので、
             画面が低いときに削られるのはここ。ユーザー報告の「下まで入りきってない」の対処。
        */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <nav aria-label="メインナビゲーション" className="flex flex-col" style={{ gap: SZ.rowSpacing }}>
            {learnItems.map(renderPanelItem)}
          </nav>

          {manageItems.length > 0 && (
            <>
              <div aria-hidden="true" style={{ height: 1, background: 'rgba(253,247,243,.3)', margin: SZ.panelDividerMargin }} />
              {manageItems.map(renderPanelItem)}
            </>
          )}
        </div>

        {/* 補助リンク。
            🔴 遷移してもパネルを畳まない。ナビ項目と同じで、push 型は
               「開いたままコンテンツを操作できる」のが要件（DESIGN-3d.md §3-2）。
               ここだけ勝手に閉じると、開閉が自分の操作でなく画面の都合で変わる。
            🔴 「お知らせ」はここには置かない（レビューで不要と判断）。 */}
        <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
          {renderPanelSubLink('利用マニュアル', FileText, () => navigate('/help/manual'))}
          {renderPanelSubLink('よくある質問', HelpCircle, () => navigate('/help/faq'))}
        </div>

        {/*
          アカウント。ホバー／フォーカスではレール側と同じポップオーバーを出すが、
          クリックはアカウント設定へ直行する（› は「まだ先がある」の意）。
          🔴 レール（閉じた72px）の方はクリックでもポップオーバーの開閉のままにしている。
             あちらは丸アイコンだけで名前も › も無いので、押した瞬間に画面が変わると
             どこへ飛んだのか分からない。名前と › が見えているこのパネル側だけ直行させる。
        */}
        <div
          ref={accountPanelRef}
          className="relative"
          style={{ flex: 'none' }}
          onMouseEnter={() => setAccountOpen(true)}
          onMouseLeave={() => setAccountOpen(false)}
        >
          <button
            onClick={() => { setAccountOpen(false); navigate('/account-settings'); }}
            onFocus={() => setAccountOpen(true)}
            aria-label={`アカウント設定: ${resolvedUserName}`}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            tabIndex={expanded ? undefined : -1}
            className={`flex items-center w-full appearance-none border-0 bg-transparent cursor-pointer text-left transition-opacity hover:opacity-90 motion-reduce:transition-none ${focusRing}`}
            style={{ borderTop: '1px solid rgba(253,247,243,.3)', padding: '16px 8px 2px', gap: 12 }}
          >
            <span
              className="grid place-items-center rounded-full overflow-hidden"
              style={{ width: SZ.avatarPanel, height: SZ.avatarPanel, flex: 'none', background: '#F2E8E1' }}
            >
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            </span>
            <span className="truncate" style={{ flex: 1, minWidth: 0, fontSize: SZ.rowFont, fontWeight: 700, color: SB.panelInk }}>
              {resolvedUserName}
            </span>
            <ChevronRight size={16} strokeWidth={2} color={SB.panelInk} style={{ flex: 'none' }} />
          </button>
          {expanded && renderAccountPopover()}
        </div>
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
                  isTop
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

      {/* ──────────────────────────────────────────────────────────
          SP版 下部ナビ（sm未満）。
          🔴 項目は navItems / manageItems を共有する。以前はここに同じ内容を
             手で並べていて、PC6項目に対しSP3項目という食い違いが起きていた
             （コーチング・マイノートへSPから到達できなかった）。定義を1本にする。
          🔴 管理・受講生一覧はロール保持者だけに出る6枚目。375pxで1枚62.5pxと
             詰まるが、管理者がSPから到達できなくなる回帰よりはましと判断した。
         ────────────────────────────────────────────────────────── */}
      <nav
        aria-label="メインナビゲーション"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#F0EAE6]"
        style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.06)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch h-16">
          {[...navItems, ...manageItems].map(({ label, icon: Icon, path, active }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 transition-colors ${focusRing} ${
                active ? 'text-brand' : 'text-brand-muted'
              }`}
            >
              <Icon className="w-5 h-5 flex-none" />
              <span className="text-[10px] font-bold whitespace-nowrap truncate max-w-full">{label}</span>
            </button>
          ))}
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
