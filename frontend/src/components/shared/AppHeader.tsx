import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Home, BookOpen, Sparkles, Settings, ShieldCheck, BookMarked, HelpCircle, FileText, Mail, CalendarDays, ChevronDown, ChevronRight, ChevronsLeft, PanelLeftOpen, MessagesSquare, NotebookPen, UserRound, Send, X, User, Paperclip, ImageOff, MoreHorizontal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationStore } from '../../store/notificationStore';
import { useNewContentNotification } from '../../hooks/useNewContentNotification';
import { useAiChat } from '../../hooks/useAiChat';
import { useChatStore } from '../../store/chatStore';
import { AccountSettingsDropdown } from './AccountSettingsDropdown';
import GlobalAiCoachDrawer from '../aicoach/GlobalAiCoachDrawer';
import SidebarStudyTimer from './SidebarStudyTimer';
import { withCfToken } from '../profile/AvatarPicker';
import { color, radius } from '../../theme/webcoachTheme';
import { parseDifyMessage } from '../../utils/difyButtons';

interface AppHeaderProps {
  userName?: string;
  avatarUrl?: string;
}

/** ナビの開閉をタブ内で持ち回すキー（ページ遷移で AppHeader が再マウントされるため） */
const SIDEBAR_KEY = 'wc-sidebar-expanded';
/** アカウントのポップオーバーを、ホバーが外れてから閉じるまでの猶予。トリガー→ポップへ移る途中で消さないため */
const ACCOUNT_CLOSE_DELAY_MS = 250;

export function AppHeader({ userName, avatarUrl }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, avatarUrl: ctxAvatarUrl, nickName: ctxNickName, contentToken } = useAuth();
  const isStudentsPage = location.pathname.startsWith('/coach/students') || location.pathname.startsWith('/coach/schedule');
  const isCoachSettings = location.pathname.startsWith('/coach/settings');

  const resolvedUserName = userName ?? ctxNickName ?? user?.username ?? 'User';
  // avatarUrl は呼び出し元が既にcf_token付与済みの前提。ctxAvatarUrlはcontextの生URLなのでここで付与する
  const resolvedAvatarUrl = avatarUrl ?? (ctxAvatarUrl ? withCfToken(ctxAvatarUrl, contentToken) : undefined);

  // 常駐の「AIコーチに相談」ボタン(右上)が開く、dev/kanegae由来の実チャットドロワー。
  // GlobalAiCoachDrawer / /ai-coach (AiCoachPage) は miyabe 由来の教材ブロック連携AIで、
  // 裏の構造化教材API(LessonDoc)がモックのままのため今は非稼働(TODO)。
  // こちらは実際にDify動的ツール連携のバックエンド(ai_langgraph.py)へ繋がっている、
  // 現状唯一の実働AIチャットなので、統合時に消さず残した。
  // TODO(backend未実装): /ai-coach 側のAIコーチ機能を実バックエンドに繋ぎ、
  //   このドロワーとの重複を解消する（教材表示アーキテクチャの決定待ち）。
  const { chatOpen, setChatOpen } = useChatStore();
  const {
    messages, input, setInput, loading, messagesEndRef, sendMessage, handleKeyPress,
    pendingImage, imageError, handleImageSelect, clearPendingImage,
  } = useAiChat();
  const chatImageInputRef = useRef<HTMLInputElement>(null);

  const { items: notificationItems, markAllRead } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  useNewContentNotification();

  /*
   * アカウントのポップオーバー。
   * 🔴 レールの丸アバターもパネルのアカウント行も、クリック（Enter／タップ）で
   *    /account-settings へ直行する（B-013）。以前レール側はクリックでも開閉だけに
   *    していたが、ホバーのポップオーバーが選びにくく、1回で設定に行けないと指摘された。
   *    行き先の一覧（アカウント設定／プロフィール）はホバー／フォーカスで出る
   *    ポップオーバーが引き続き担う。
   * 🔴 ポップオーバーは離れてすぐには閉じない（ACCOUNT_CLOSE_DELAY_MS）。トリガーと
   *    ポップの間には隙間があり、斜めに移動する途中で一瞬外れただけで消えていた。
   * 🔴 ログアウトはここには置かない。アカウント設定画面が持っている
   *    （SCREEN-013 でそう決めた）。ホバーで開く面に破壊的操作を混ぜない。
   */
  const [accountOpen, setAccountOpen] = useState(false);
  // レール用とパネル用で別々。どちらも常時マウント（クロスフェード中に
  // アカウント行だけ消えるのを避けるため）なので、外側クリック判定は両方見る。
  const accountRailRef = useRef<HTMLDivElement>(null);
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const accountCloseTimer = useRef<number | null>(null);
  const cancelAccountClose = () => {
    if (accountCloseTimer.current !== null) {
      window.clearTimeout(accountCloseTimer.current);
      accountCloseTimer.current = null;
    }
  };
  const openAccount = () => { cancelAccountClose(); setAccountOpen(true); };
  const closeAccountSoon = () => {
    cancelAccountClose();
    accountCloseTimer.current = window.setTimeout(() => setAccountOpen(false), ACCOUNT_CLOSE_DELAY_MS);
  };
  const goAccountSettings = () => { cancelAccountClose(); setAccountOpen(false); navigate('/account-settings'); };
  useEffect(() => cancelAccountClose, []);

  /*
   * SP下部バーの「その他」シート。
   * 🔴 PCには存在しない面。sm未満でしか出さない（描画側が sm:hidden）。
   */
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  const bottomNavRef = useRef<HTMLElement>(null);

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
   * 🔴 メインナビは「ユーザーが自分からやりに行く行動」6本柱だけにする。
   *    トップ / 学習する / AIコーチ / コーチング / マイノート / 記録。
   *    ロードマップのように自分から見に行かない情報は、ナビに項目を作らず
   *    トップや各体験の中で露出させる。
   * 🔴 ナビに無いページも、必ずどれか1本の配下として点灯させる。
   *    「今どの柱にいるか」が消えると現在地を見失うため。
   * ============================================================
   */
  const isTop = location.pathname === '/mypage' || location.pathname === '/';
  // 記録。かつては「トップの詳しく見るの先」としてトップ配下で点灯させていたが、
  // ナビに項目を持ったので独立させる（両方点灯すると現在地が2つに見える）。
  const isStudyLog = location.pathname === '/study-log';
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

  /*
   * SP下部ナビの「実際に占有している高さ」を --wc-bottomnav-total に書き出す。
   * ============================================================
   * 🔴 バーの高さは固定ではない。学習タイマーが記録中のときは、ナビ本体（64px）の
   *    上に帯（36px）が積まれて実効 101px になる。固定値 64px を前提にしていると、
   *    記録中はページ最下部の内容が帯に隠れ、常駐AIコーチのFABも帯に重なる。
   * 🔴 セーフエリアぶん（nav の padding-bottom）も込みで測れるので、
   *    読む側は env() を足さなくてよい。
   * 🔴 sm以上では nav が display:none になり高さ0。そのときは変数を外して
   *    index.css の既定値（--wc-bottomnav-h ＋ セーフエリア）に戻す。
   * ============================================================
   */
  useLayoutEffect(() => {
    const el = bottomNavRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const apply = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) root.style.setProperty('--wc-bottomnav-total', `${Math.round(h)}px`);
      else root.style.removeProperty('--wc-bottomnav-total');
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--wc-bottomnav-total');
    };
  }, []);

  /*
   * 「その他」シートを開いている間は背面を動かさない。
   * 🔴 body のクラスではなく style を退避して戻す（QuoteFromLessonModal と同じ作法）。
   *    クラスだと、誰が外すのかが曖昧になる。
   */
  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [moreOpen]);

  /*
   * Esc で閉じる／Tab をシートの中に閉じ込める。
   * 🔴 シートはコンテンツ全面を覆うので、フォーカスが背面のリンクへ抜けると
   *    見えない要素を操作できてしまう。
   */
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setMoreOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !morePanelRef.current) return;
      const focusables = morePanelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [moreOpen]);

  /*
   * sm以上になったらシートを閉じる。
   * 🔴 表示は sm:hidden で消えるが、それだけでは body のスクロールロックが
   *    掛かったまま残る（＝PC幅に広げたのに本文が動かない）。端末を横向きに
   *    しただけで 640px を跨ぐことがあるので、幅の監視は必須。
   */
  useEffect(() => {
    if (!moreOpen) return;
    const mq = window.matchMedia('(min-width: 640px)');
    if (mq.matches) { setMoreOpen(false); return; }
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) setMoreOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [moreOpen]);

  /*
   * 開いたらシート本体に、閉じたら「その他」ボタンにフォーカスを戻す。
   * 🔴 hasOpenedMore で「一度でも開いたか」を見る。これが無いと初回マウント時の
   *    false でも else 側が走り、ページを開いただけでフォーカスが下部バーに飛ぶ。
   * 🔴 開いたとき先頭の行にいきなり当てない。押し間違いを誘発するので、
   *    パネル自身（tabIndex=-1）に当てて Tab で降りてもらう。
   */
  const hasOpenedMore = useRef(false);
  useEffect(() => {
    if (moreOpen) {
      hasOpenedMore.current = true;
      morePanelRef.current?.focus();
    } else if (hasOpenedMore.current) {
      moreBtnRef.current?.focus();
    }
  }, [moreOpen]);

  // 【一旦停止】全画面共通の「なぞって解説」（テキスト選択で「AIに解説」ボタンを出す機能）は撤去した。
  // AppHeader は全ページに出るため、文章をなぞる・コピーするなどの通常操作のたびに
  // ポップアップが割り込んでしまうのが理由。
  // 教材ページ本文の選択ツールバー（解説／AIに質問／クリップ）は別実装なので残っている:
  //   components/learning/SelectionToolbar.tsx + hooks/useTextSelection.ts
  // 復活させるときは、出す画面を絞ってから戻すこと（全画面で出すと同じ問題が再発する）。

  /*
   * ナビ項目（PCサイドバー・SP下部ナビ共通の定義。ここが唯一の定義）。
   * ============================================================
   * 🔴 6本柱。並び順は「毎日開く → 相談する → 蓄積を見る」。
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
    // 「蓄積を見る」の末尾。アイコンはページの主役がカレンダーなので CalendarDays
    { label: '記録', icon: CalendarDays, path: '/study-log', active: isStudyLog },
  ];
  const learnItems = navItems;
  /*
   * 管理・コーチ項目。
   * 🔴 admin と coach を排他にしない。以前は isAdmin を先に見て早期に返していたため、
   *    admin かつ coach の人（運営がコーチも持つ運用、モックの擬似ユーザーもこれ）には
   *    コーチ画面への導線が1本も出なかった。両方持っているなら両方出す。
   * 🔴 dev/kanegae統合: 「連携設定」(Zoom連携, CoachSettingsPage.tsx)はbffClient側の
   *    getMeetingIntegrationStatus/getMeetingIntegrationAuthorizeUrlが実装済み
   *    (api-server/routers/integrations.py)のため、ナビへ復元してある。
   */
  const manageItems = [
    ...(user?.isAdmin ? [{ label: '管理', icon: ShieldCheck, path: '/admin', active: isAdmin }] : []),
    ...(user?.isCoach
      ? [
          { label: '受講生一覧', icon: UserRound, path: '/coach/students', active: isStudentsPage },
          { label: '連携設定', icon: Settings, path: '/coach/settings', active: isCoachSettings },
        ]
      : []),
  ];

  /*
   * SP下部バーの枠割り。
   * ============================================================
   * 🔴 navItems / manageItems 自体には触らない。PC（レール・パネル）は今までどおり
   *    全項目を出す。ここは「SPのバーに何を常設するか」だけを決める派生。
   * 🔴 バーは常に 5項目＋「その他」の6枠。ロールで枠数が変わらないのが要点で、
   *    以前は管理ロールだと最大9枠＝375pxで1枠41pxまで潰れていた（CL-A12）。
   * 🔴 find ではなく filter で引く。navItems 側の path を変えたとき、find だと
   *    undefined が混ざって落ちるが、filter なら「バーから消えてシートに出る」
   *    だけで済む（安全側に倒れる）。
   * 🔴 バーから外した項目は必ず sheetNavItems に落ちる。どちらにも出ない項目が
   *    できると、SPからその画面へ到達できなくなる。
   * ============================================================
   */
  const BOTTOM_BAR_PATHS = ['/mypage', '/courses', '/ai-coach', '/coaching', '/study-log'];
  const bottomBarItems = navItems.filter((i) => BOTTOM_BAR_PATHS.includes(i.path));
  const sheetNavItems = [...navItems.filter((i) => !BOTTOM_BAR_PATHS.includes(i.path)), ...manageItems];
  /*
   * 「その他」の点灯。
   * 🔴 バーに枠が無いページ（マイノート・管理・設定・ヘルプ）でも、必ずどれか1枠が
   *    点灯している状態を保つ。「ナビに無いページも必ずどれか1本の配下として
   *    点灯させる」（アクティブ判定のコメント）を SP でも破らないため。
   */
  const isOtherActive =
    moreOpen ||
    sheetNavItems.some((i) => i.active) ||
    isSettingsPage ||
    location.pathname.startsWith('/help');

  /*
   * パネル下部の補助リンク。
   * 🔴 配列にしてあるのは、PCパネルとSPの「その他」シートが同じものを map するため。
   *    2箇所に手で書くと、かつての「PC6項目 vs SP3項目」（下部ナビのコメント参照）を
   *    別の場所で再演することになる。増やすときはここに1行足すだけ。
   */
  const subLinks = [
    { label: '利用マニュアル', icon: FileText, path: '/help/manual' },
    { label: 'よくある質問', icon: HelpCircle, path: '/help/faq' },
  ];

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
    /*
     * アクティブな丸ピルの影。
     * 🔴 レール（PC）と下部バー（SP）が同じ値を読む。以前は下部バーだけ別に
     *    書かれていて、旧パレット（#FF5A7A の文字色だけ）のまま取り残されていた。
     */
    activePillShadow: '0 2px 10px -2px rgba(214,9,52,.4)',
    /** 下部バーの上向きの影。レールの右向き影 '3px 0 10px -4px …' の向きだけ変えたもの */
    barShadowUp: '0 -3px 10px -4px rgba(60,48,32,.18)',
  };

  /*
   * サイドバーの寸法。
   * ============================================================
   * 🔴 デザイン（マイページ 3d.dc.html）の実寸より一段小さい。デザインは
   *    行高52px・ロゴ23px・パネル上余白44pxで組まれているが、その値だと
   *    パネルの中身に約814px必要で、ノートPCの実効ビューポート高に収まらず
   *    スクロールしないと下まで見えない。レビューでも「でかすぎる」判断。
   *    この寸法での合計は 5項目のとき約 671px。「記録」を足して6項目になり
   *    約 721px なので、700px 前後の画面ではナビ帯（overflow-y:auto）が
   *    数十px ぶんスクロールする。補助リンクとアカウント行は帯の外なので
   *    削られない。7項目（管理ロール）はさらに +50px。
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
    /*
     * レールの丸アイコン。
     * 🔴 レールはアイコンの下にラベルを出す（72px幅・10px）ので、1項目が
     *    「丸36 + 2px + 文字12px」= 50px になる。丸を 40→36・隙間を 6→4 に
     *    詰めたのはラベルぶんの高さを吸収するため。実測（1440x768）で
     *    ナビ帯の下端は 6項目 386px・管理ロールの9項目 565px。アカウント行は
     *    下端に寄るので、必要な高さは 565+14+36+16 ≒ 631px。640px くらいの
     *    ビューポートまでは重ならない（700・768 で実測ずみ）。
     *    ここを大きく戻すと下端のアカウント行が短いノートPCで画面外に出る
     *    （レールに overflow は付けられない ＝ ツールチップが切れる、の制約）。
     */
    railBtn: 36,
    railIcon: 17,
    railGap: 4,
    /** レールのラベル（アイコン下） */
    railLabelFont: 10,
    railLabelGap: 2,
    /*
     * SP下部バーのラベル。丸ピル本体はレールと同寸（railBtn/railIcon）を使い回す。
     * 🔴 レールの10pxより1px大きい。レールは幅72pxの中に全角5文字を収める都合で
     *    10pxだが、下部バーは1枠62.5px（375px÷6枠）あるので11pxが収まる。
     *    ui-review CL-A12 が「ラベル11px・枠を固定」を指しているのに合わせた値で、
     *    typography.md の「12px未満を作らない」に対するこの枠限定の例外。
     *    36 + 2 + 13 = 51px なので、バーの高さ64pxには収まる。
     */
    bottomLabelFont: 11,
    bottomLabelGap: 2,
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

  /*
   * 常時見えている72pxレールの1項目（丸アイコン＋その下のラベル）。
   * 🔴 ラベルを出しているので、ここにツールチップは付けない。同じ語が
   *    ホバーで二重に出て読みにくくなる（ツールチップは開くボタンと
   *    タイマーだけに残っている）。
   * 🔴 ラベルは展開パネルと同じ語をそのまま使う。レールだけ「学習」
   *    「ノート」と短くすると、開閉で呼び名が変わって別物に見える。
   *    72px幅・10pxなら全角5文字（コーチング／マイノート／受講生一覧）
   *    まで折り返さずに収まる。
   */
  /*
   * 丸ピル＋その下のラベル、という「見た目」だけを組む。
   * ============================================================
   * 🔴 ここがナビの見た目の唯一の基準。PCレール・SP下部バー・SPの「その他」の
   *    3箇所がこれを読む。以前は SP 下部バーだけ別に書かれていて、アクティブが
   *    旧パレット（#FF5A7A の文字色だけ）のまま取り残され、PCと別物に見えていた。
   *    片方だけ直さないこと。
   * 🔴 変わってよいのは labelFont だけ。色・影・丸の寸法・strokeWidth は共通。
   * ============================================================
   */
  const renderNavPillFace = (Icon: any, label: string, active: boolean, labelFont: number) => (
    <>
      <span
        className={`grid place-items-center rounded-full transition-colors duration-200 motion-reduce:transition-none ${
          active ? '' : 'hover:bg-[#FDF2F2]'
        }`}
        style={{
          width: SZ.railBtn,
          height: SZ.railBtn,
          flex: 'none',
          background: active ? SB.brand : 'transparent',
          boxShadow: active ? SB.activePillShadow : undefined,
        }}
      >
        <Icon size={SZ.railIcon} strokeWidth={1.75} color={active ? SB.panelInk : SB.iconIdle} />
      </span>
      <span
        className="whitespace-nowrap"
        style={{
          fontSize: labelFont,
          lineHeight: `${labelFont + 2}px`,
          fontWeight: active ? 700 : 500,
          color: active ? SB.panelActiveInk : SB.iconIdle,
          letterSpacing: '-0.02em',
        }}
      >
        {label}
      </span>
    </>
  );

  const renderRailItem = (item: { label: string; icon: any; path: string; active: boolean }) => (
    <button
      key={item.path}
      onClick={() => navigate(item.path)}
      aria-current={item.active ? 'page' : undefined}
      tabIndex={expanded ? -1 : undefined}
      className={`flex flex-col items-center appearance-none border-0 bg-transparent cursor-pointer ${focusRing}`}
      style={{ width: 68, padding: 0, gap: SZ.railLabelGap, flex: 'none' }}
    >
      {renderNavPillFace(item.icon, item.label, item.active, SZ.railLabelFont)}
    </button>
  );

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
   * 🔴 トリガーとの 10px の隙間は margin ではなく外枠の透明な padding で取る。
   *    margin だとその隙間がどちらの要素でもなく、通過中に mouseleave が起きる。
   */
  const accountItems = [
    { label: 'アカウント設定', icon: Settings, path: '/account-settings' },
    { label: 'プロフィール', icon: UserRound, path: '/profile' },
  ];

  const renderAccountPopover = () => (
    <div
      aria-hidden={!accountOpen}
      className="absolute left-full bottom-0 pl-2.5 z-50 transition-opacity duration-150 motion-reduce:transition-none"
      style={{
        opacity: accountOpen ? 1 : 0,
        pointerEvents: accountOpen ? 'auto' : 'none',
      }}
    >
    <div
      role="menu"
      aria-label="アカウント"
      className="bg-white overflow-hidden"
      style={{
        width: 232,
        borderRadius: 14,
        border: '1px solid #EBE7E5',
        boxShadow: '0 16px 38px rgba(96,70,65,.16)',
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
          onClick={() => { cancelAccountClose(); setAccountOpen(false); navigate(path); }}
          className={`flex items-center w-full appearance-none border-0 bg-transparent cursor-pointer text-left transition-colors hover:bg-[#FAF7F7] motion-reduce:transition-none ${focusRing}`}
          style={{ gap: 10, padding: '10px 14px', fontSize: 13, color: '#3D3D3D' }}
        >
          <Icon size={16} strokeWidth={1.75} color={SB.iconIdle} style={{ flex: 'none' }} />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
    </div>
  );

  /*
   * 「その他」シートの1行。
   * 🔴 遷移したら必ず閉じる。PCの展開パネルは「遷移しても畳まない」（push 型で
   *    開いたまま本文を操作できるのが要件）だが、シートは本文を覆うオーバーレイなので
   *    逆。ここをパネルに揃えて閉じないようにすると、行き先に着いても幕が残る。
   * 🔴 ラベルは14px。バーのラベル（11px）と違い、こちらは一覧行なので
   *    typography.md の「UIの下限は14px」をそのまま守れる。
   */
  const renderSheetRow = (label: string, Icon: any, path: string, active: boolean) => (
    <button
      key={path}
      onClick={() => { setMoreOpen(false); navigate(path); }}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center w-full appearance-none border-0 cursor-pointer text-left transition-colors hover:bg-[#FAF7F7] motion-reduce:transition-none ${focusRing}`}
      style={{
        height: 52,
        gap: 12,
        padding: '0 20px',
        fontFamily: 'inherit',
        fontSize: 14,
        fontWeight: active ? 700 : 500,
        background: active ? color.primaryTint : 'transparent',
        color: active ? SB.panelActiveInk : color.textBody,
      }}
    >
      <Icon size={18} strokeWidth={1.75} color={active ? SB.brand : SB.iconIdle} style={{ flex: 'none' }} />
      <span className="truncate">{label}</span>
    </button>
  );

  /** シート内のセクション見出し。行の由来（管理 / アカウント / ヘルプ）を分ける */
  const renderSheetHeading = (text: string) => (
    <div
      style={{
        padding: '12px 20px 4px',
        borderTop: `1px solid ${color.border}`,
        marginTop: 4,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '.04em',
        color: color.textSubtle,
      }}
    >
      {text}
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
            ① レール（72px・既定）… アイコン＋下にラベル（10px）
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
             レールの中身は合計 約630px（管理ロール・ラベル付き）で、
             実用的な画面高には収まる。内訳は上の SZ のコメント参照。
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

          {/* 学習タイマー。記録中・一時停止中だけ出る（SidebarStudyTimer が自分で判断する）。
              🔴 ナビの下に置く。以前は画面に浮かぶドラッグ可能なピルで、既定の右上が
                 ページごとに他のUIと重なっていた。定位置に移したのがこれ。 */}
          <div style={{ marginTop: 14, flex: 'none' }}>
            <SidebarStudyTimer variant="rail" tabIndex={expanded ? -1 : undefined} />
          </div>
        </div>

        {/* 🔴 お知らせ（ベル）はレールにもパネルにも置かない（レビューで不要と判断）。
               通知そのものは useNewContentNotification が拾い続けているので、
               入口が要るようになったらここにベルを戻すのではなく、
               どの面に置くかを決めてから追加すること。 */}

        {/* アカウント。ホバー／フォーカスでポップオーバーを出し、クリックはアカウント設定へ直行する。
            🔴 円形の切り抜きは button ではなく内側の span に持たせる。button 側に
               overflow:hidden があるとポップオーバーやツールチップが切られる。 */}
        <div
          ref={accountRailRef}
          className="relative"
          style={{ marginTop: 10, flex: 'none' }}
          onMouseEnter={openAccount}
          onMouseLeave={closeAccountSoon}
        >
          <button
            onClick={goAccountSettings}
            onFocus={openAccount}
            aria-label={`アカウント設定: ${resolvedUserName}`}
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
        {/* 学習タイマー。レール側と同じものをパネル幅で出す（同時に見えることは無い） */}
        <div style={{ padding: '8px 8px 0', flex: 'none' }}>
          <SidebarStudyTimer variant="panel" tabIndex={expanded ? undefined : -1} />
        </div>

        <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
          {subLinks.map(({ label, icon, path }) => renderPanelSubLink(label, icon, () => navigate(path)))}
        </div>

        {/*
          アカウント。ホバー／フォーカスではレール側と同じポップオーバーを出し、
          クリックはアカウント設定へ直行する（› は「まだ先がある」の意）。レール側も同じ。
        */}
        <div
          ref={accountPanelRef}
          className="relative"
          style={{ flex: 'none' }}
          onMouseEnter={openAccount}
          onMouseLeave={closeAccountSoon}
        >
          <button
            onClick={goAccountSettings}
            onFocus={openAccount}
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
            {/* AI Coach Button: dev/kanegaeの実チャットドロワーを開く（上のコメント参照） */}
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

      {/* ──────────────────────────────────────────────────────────
          SP版 下部ナビ（sm未満）。
          🔴 項目は navItems / manageItems を共有する。以前はここに同じ内容を
             手で並べていて、PC6項目に対しSP3項目という食い違いが起きていた
             （コーチング・マイノートへSPから到達できなかった）。定義を1本にする。
          🔴 見た目はPCレールと同じ言語（暖色の地＋アクティブは赤い丸ピル）。
             renderNavPillFace が唯一の基準で、色も影も丸の寸法もレールと共有する。
             ここだけ別に書くと、かつてのように旧パレット（#FF5A7A）のまま
             取り残されてPCと別物に見える。
          🔴 枠はロールに関係なく常に6つ（5項目＋その他）。以前は管理ロールだと
             最大9枠＝375pxで1枚41pxまで潰れていた（CL-A12）。あふれた項目は
             「その他」シートに落ちるので、到達できなくなる項目は無い。
         ────────────────────────────────────────────────────────── */}
      <nav
        ref={bottomNavRef}
        aria-label="メインナビゲーション"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: SB.railBg,
          borderTop: `1px solid ${SB.railBorder}`,
          boxShadow: SB.barShadowUp,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* 学習タイマー。SPはサイドバーが無いので、ナビの上に細い帯として出す */}
        <SidebarStudyTimer variant="mobile" />
        <div className="flex items-stretch" style={{ height: 'var(--wc-bottomnav-h)' }}>
          {bottomBarItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-current={item.active ? 'page' : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center appearance-none border-0 bg-transparent cursor-pointer ${focusRing}`}
              style={{ padding: 0, gap: SZ.bottomLabelGap }}
            >
              {renderNavPillFace(item.icon, item.label, item.active, SZ.bottomLabelFont)}
            </button>
          ))}
          {/* 6枠目。ページではないので aria-current は付けない（点灯はするが「現在地」ではない） */}
          <button
            ref={moreBtnRef}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center appearance-none border-0 bg-transparent cursor-pointer ${focusRing}`}
            style={{ padding: 0, gap: SZ.bottomLabelGap }}
          >
            {renderNavPillFace(MoreHorizontal, 'その他', isOtherActive, SZ.bottomLabelFont)}
          </button>
        </div>
      </nav>

      {/* 常駐AIコーチ（FAB＋ドロワー）。
          教材ページとAI専用ページには専用のAIコーチ面があるので出さない。
          両方出すと入口が二重になり、どちらで話したか分からなくなる。 */}
      {!hasOwnAiSurface && <GlobalAiCoachDrawer />}

      {/* AI Chat Drawer: dev/kanegaeの実チャット（右上「AIコーチに相談」ボタンから開く） */}
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
                    {message.imageDataUrl && (
                      <img
                        src={message.imageDataUrl}
                        alt="添付画像"
                        className="max-w-full max-h-48 rounded-lg mb-2 object-contain"
                      />
                    )}
                    {message.role === 'assistant' ? (
                      (() => {
                        const { text, buttons } = parseDifyMessage(message.content);
                        return (
                          <>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              children={text.replace(/^(✅[^\n-]*?) - (.+)$/gm, '$1\n$2')}
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
                            {buttons.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {buttons.map((btn, i) => (
                                  <button
                                    key={`${btn.value}-${i}`}
                                    type="button"
                                    disabled={loading}
                                    onClick={() => void sendMessage(btn.value)}
                                    className="text-xs font-bold rounded-lg px-3 py-2"
                                    style={{
                                      border: `1px solid ${color.primaryBorder}`,
                                      background: color.hoverBgTint,
                                      color: color.primary,
                                      cursor: loading ? 'default' : 'pointer',
                                      opacity: loading ? 0.6 : 1,
                                    }}
                                  >
                                    {btn.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()
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
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2">
                <img src={pendingImage.dataUrl} alt="添付予定の画像" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                <button
                  onClick={clearPendingImage}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="画像を取り消す"
                >
                  <ImageOff className="w-4 h-4" />
                </button>
              </div>
            )}
            {imageError && (
              <p className="text-xs text-red-500 mb-2">{imageError}</p>
            )}
            <div className="flex gap-2">
              <input
                ref={chatImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => chatImageInputRef.current?.click()}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-brand hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                title="画像を添付"
              >
                <Paperclip className="w-5 h-5" />
              </button>
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
                onClick={() => void sendMessage()}
                disabled={(!input.trim() && !pendingImage) || loading}
                className="p-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ──────────────────────────────────────────────────────────
          SP版「その他」シート（sm未満）。
          🔴 下部バーの <nav> の外に置く。nav は z-40 の positioned 要素なので
             独自の重なり文脈を作り、中に入れると常駐AIコーチのFAB（同じ z-40 で
             DOM上あと）が幕の上に浮いてしまう。
          🔴 ポータルは使わず sm:hidden の素の div で包む。display:none なら
             中の position:fixed ごと消えるので、PC幅に漏れない。
          🔴 ここは SP から唯一到達できる「設定・ヘルプ」の入口でもある。
             PC版 <header> は className="hidden" で死んでいて、レール／パネルは
             sm以上にしか出ない。ここを消すと SP からアカウント設定・プロフィール・
             利用マニュアル・よくある質問へ行く手段が1本も無くなる（CL-A11）。
          🔴 ログアウトは置かない。アカウント設定画面が持っている（SCREEN-013）。
         ────────────────────────────────────────────────────────── */}
      <div className="sm:hidden">
        {moreOpen && (
          <div
            role="presentation"
            onClick={(e) => { if (e.target === e.currentTarget) setMoreOpen(false); }}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,14,8,.42)' }}
          >
            <div
              ref={morePanelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wc-more-sheet-title"
              tabIndex={-1}
              className="wc-more-sheet focus:outline-none"
              style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                maxWidth: 520,
                margin: '0 auto',
                maxHeight: 'min(78dvh, 620px)',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                background: color.surface,
                borderTopLeftRadius: radius.card,
                borderTopRightRadius: radius.card,
                paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
              }}
            >
              {/* 掴んで下ろせそうに見えるが実際のドラッグは持たせていないので、細い線1本に留める */}
              <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 999, background: color.borderNeutral, margin: '8px auto 2px' }} />
              <h2 id="wc-more-sheet-title" style={{ margin: 0, padding: '6px 20px 8px', fontSize: 16, fontWeight: 700, color: color.textStrong }}>
                その他
              </h2>

              {/* アカウント行。パネルのアカウント行と同じくタップでアカウント設定へ直行する */}
              <button
                onClick={() => { setMoreOpen(false); navigate('/account-settings'); }}
                aria-label={`アカウント設定: ${resolvedUserName}`}
                className={`flex items-center w-full appearance-none border-0 bg-transparent cursor-pointer text-left transition-colors hover:bg-[#FAF7F7] motion-reduce:transition-none ${focusRing}`}
                style={{ gap: 12, padding: '10px 20px 14px' }}
              >
                <span className="grid place-items-center rounded-full overflow-hidden" style={{ width: 40, height: 40, flex: 'none', background: SB.softPink }}>
                  <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 14, fontWeight: 700, color: color.textStrong }}>{resolvedUserName}</span>
                  {user?.username && (
                    <span className="block truncate" style={{ fontSize: 12, color: color.textSubtle, marginTop: 1 }}>{user.username}</span>
                  )}
                </span>
                <ChevronRight size={18} strokeWidth={2} color={SB.iconIdle} style={{ flex: 'none' }} />
              </button>

              {/* バーの6枠に入らなかったナビ項目（マイノート）と、ロール項目 */}
              {sheetNavItems.map((i) => renderSheetRow(i.label, i.icon, i.path, i.active))}

              {renderSheetHeading('アカウント')}
              {accountItems.map(({ label, icon, path }) => renderSheetRow(label, icon, path, location.pathname === path))}

              {renderSheetHeading('ヘルプ')}
              {subLinks.map(({ label, icon, path }) => renderSheetRow(label, icon, path, location.pathname === path))}

              <button
                onClick={() => setMoreOpen(false)}
                className={`w-full appearance-none border-0 bg-transparent cursor-pointer transition-colors hover:bg-[#FAF7F7] motion-reduce:transition-none ${focusRing}`}
                style={{
                  height: 52,
                  marginTop: 4,
                  borderTop: `1px solid ${color.border}`,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 700,
                  color: color.textSecondary,
                }}
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default AppHeader;
