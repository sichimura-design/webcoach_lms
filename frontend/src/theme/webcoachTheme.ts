/**
 * frontend/src/theme/webcoachTheme.ts
 * WEBCOACH LMS — ホーム画面リデザイン用 デザイントークン（唯一の情報源 / single source of truth）
 * 由来: design comp "WebCoach Home.dc.html"（全てリテラル値。目視推定なし）
 *
 * 使い方: 新規/改修コンポーネントの style オブジェクトは必ずここを参照する。
 *   import { t } from '../theme/webcoachTheme';
 *   <div style={{ ...t.card, padding: t.space.cardPad }} />
 * 既存の theme/colors.ts（#C62828 系）は旧デザイン用。新画面では使わない。
 */

export const color = {
  // brand
  primary: '#E0213A',
  primaryHover: '#C4102A',
  primaryPressed: '#A80B21',
  primarySoft: '#FFECEE',      // チップ・「いまここ」ピル背景
  primarySoftAlt: '#FFE9EB',   // 画像上のボタン背景
  primarySoftHover: '#FFDCE0',
  primaryTint: '#FFF1F2',      // サイドバー選択中の背景
  primaryBorder: '#F3C3C9',    // アウトラインボタンの枠
  primaryBorderSoft: '#F6D9DD',// hover 時のカード枠
  primaryDashed: '#F0A8B1',    // 未着手チェックの破線
  streakOff: '#F9D9DD',

  // surface
  pageBg: '#FDFCFC',
  surface: '#FFFFFF',
  sidebarBg: '#FFFFFF',
  border: '#F3EDED',           // カード枠
  borderStrong: '#F1ECEC',     // サイドバー境界・小カード枠
  borderNeutral: '#E6DFDF',    // 未到達ステップの丸枠
  borderSoft: '#F1E4E4',       // セカンダリボタン枠
  divider: '#F3EFEF',          // 統計バーの縦罫
  trackBg: '#EFE9E9',          // ロードマップの未通過ライン
  hoverBg: '#FAF7F7',
  hoverBgTint: '#FFF6F7',
  progressTrack: '#FBE2E6',    // 進捗バーの下地。trackBg(#EFE9E9)は暖色グレーで別用途
  borderPink: 'rgba(224,33,58,.12)',       // 淡いピンク枠（マイページのダッシュボードカード）
  borderPinkStrong: 'rgba(224,33,58,.16)', // 区切り線・アウトラインCTA枠

  // ロードマップのノード（マイページ下部の帯）
  goalBg: '#FEF6E7',           // ゴールノードの地。ここだけブランド外のアンバーを使う
  goalBorder: '#F0C97A',
  goalText: '#C9860F',
  stepFutureBg: '#F7F5F5',     // 未到達ノードの地
  stepFutureIcon: '#B9B2B4',

  // text
  text: '#1F1D1E',
  textStrong: '#2B2629',
  textBody: '#4A4245',
  textSecondary: '#5C5559',
  textMuted: '#6B6467',
  textSubtle: '#8B8386',
  textFaint: '#9A9295',
  textOnPrimary: '#FFFFFF',
  iconMuted: '#7A7276',

  // status
  online: '#34C759',

  /**
   * マイノート（自由帳）。
   * 「自分のノートを作っていく楽しさ」を出すために、他の画面の白いカードとは
   * 別の“紙”の質感を与える。以前は MyNotesPage / MemoPane が種別バッジの色を
   * 直書きしていたので、ここに集約した。
   */
  notePaper: '#FFFDFA',        // ノート面の地。白より少し温かい
  noteRule: '#EFE4E4',         // 左端の綴じ代（点線）
  noteHighlight: '#FFD9E0',    // 手書き風のマーカー・下線
  noteClipBg: '#FFF4F5',       // クリップブロックの地
  noteClipAccent: '#E0213A',   // クリップの左罫（教材＝ブランド色）
  noteAnswerBg: '#F3FAF6',     // AI回答ブロックの地
  noteAnswerAccent: '#3E9E70', // AI回答の左罫（AI＝緑。教材と出どころを区別する）
} as const;

export const gradient = {
  heroThumb: 'linear-gradient(135deg,#FF5A4E 0%,#E0213A 55%,#C90D22 100%)',
  /** 「続きからはじめる」カードの地。ごく淡いピンクの斜めグラデ（強いグラデにしない） */
  continueCard: 'linear-gradient(135deg,#FFFFFF 0%,#FFF8F9 46%,#FFF0F2 100%)',
  /** 線形の進捗バーの塗り。バーを増やすときは必ずこれを使う */
  progressFill: 'linear-gradient(90deg,#F0546A 0%,#E0213A 100%)',
} as const;

export const radius = {
  hero: 22,
  card: 20,
  sm: 12,        // プライマリボタン
  md: 14,        // リストアイテム・画像・セカンダリボタン
  lg: 16,        // サイドバー下部の紹介カード
  nav: 12,
  pill: 999,
} as const;

export const shadow = {
  hero: '0 10px 30px rgba(190,60,70,.08)',
  card: '0 8px 26px rgba(190,60,70,.06)',
  soft: '0 4px 14px rgba(190,60,70,.05)',
  primaryButton: '0 8px 20px rgba(224,33,58,.28)',
  overlayButton: '0 6px 18px rgba(190,60,70,.18)',
  currentStep: '0 0 0 5px #FFFFFF,0 4px 12px rgba(224,33,58,.22)',
  stepRing: '0 0 0 5px #FFFFFF',
  cardWide: '0 14px 40px rgba(190,60,70,.07)',  // マイページ 2×2 グリッドのカード
  continue: '0 18px 46px rgba(224,33,58,.08)',  // 続きからカード（最も広く柔らかい）
} as const;

export const space = {
  sidebarWidth: 220,
  sidebarPad: '26px 16px 20px',
  mainPad: '28px 60px 40px',
  sectionGap: 20,   // 縦セクション間
  columnGap: 18,    // 3カラム間
  cardPad: '22px 24px 18px',
  cardPadWide: '20px 28px',
  roadmapPad: '24px 28px 30px',
  listGap: 10,
  goalGap: 22,
  // マイページのダッシュボード
  dashGap: 20,
  summaryPad: '24px 32px',
  dashCardPad: '26px 30px',
  roadmapPadWide: '40px 46px 44px',
} as const;

/** 3カラム行（合計 1326px 幅の本文領域内） */
export const grid = {
  contentWidth: 1326,
  columns: '384px 554px 1fr',
  gap: 18,
  /** マイページ 2×2 ダッシュボード。1440 - 60*2 = 1320 = 860 + 20 + 440 */
  dashColumns: '860px 440px',
  dashRows: 'minmax(396px, auto) minmax(284px, auto)',
} as const;

export const font = {
  family: "'Noto Sans JP', system-ui, sans-serif",
  // size / weight / (lineHeight は指定なし=既定)
  pageTitle:     { fontSize: 28,   fontWeight: 900, letterSpacing: '.2px' },
  heroTitle:     { fontSize: 25,   fontWeight: 900, letterSpacing: '.2px' },
  statValue:     { fontSize: 22,   fontWeight: 900, letterSpacing: '.2px' },
  // ---- マイページ（ダッシュボード）----
  displayTitle:  { fontSize: 30,   fontWeight: 900, letterSpacing: '.2px' }, // 続きから: コース名
  statValueLg:   { fontSize: 30,   fontWeight: 900, letterSpacing: '.2px' }, // サマリー帯: 数字部
  statUnit:      { fontSize: 20,   fontWeight: 900 },                        // サマリー帯: 時間/分
  userName:      { fontSize: 22,   fontWeight: 900 },
  streakBig:     { fontSize: 56,   fontWeight: 900, letterSpacing: '-.02em' },
  cardTitleLg:   { fontSize: 19,   fontWeight: 900 }, // Lesson N / 次回コーチング日付 / ロードマップのステップ名
  cardHeading:   { fontSize: 15,   fontWeight: 900 }, // 続きからはじめる / 学習ストリーク
  encourage:     { fontSize: 13.5, fontWeight: 500 },
  statLabel:     { fontSize: 13,   fontWeight: 500 },
  sectionTitle:  { fontSize: 17.5, fontWeight: 900 },
  cardTitle:     { fontSize: 16.5, fontWeight: 900 },
  logo:          { fontSize: 16,   fontWeight: 900, letterSpacing: '1.2px' },
  streakNumber:  { fontSize: 17,   fontWeight: 900 },
  bodyLarge:     { fontSize: 15,   fontWeight: 700 }, // プライマリボタン
  listItem:      { fontSize: 14.5, fontWeight: 500 },
  navItem:       { fontSize: 14,   fontWeight: 500 },
  navItemActive: { fontSize: 14,   fontWeight: 700 },
  rowTitle:      { fontSize: 13.5, fontWeight: 700 },
  buttonSm:      { fontSize: 13.5, fontWeight: 700 },
  link:          { fontSize: 12.5, fontWeight: 700 },
  meta:          { fontSize: 12.5, fontWeight: 500 },
  label:         { fontSize: 12,   fontWeight: 500 },
  caption:       { fontSize: 11.5, fontWeight: 500 },
  chip:          { fontSize: 11.5, fontWeight: 700 },
  eyebrow:       { fontSize: 11.5, fontWeight: 900, letterSpacing: '1.6px' },
} as const;

/** よく使う複合スタイル（そのまま style={} に展開する） */
export const t = {
  card: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.card,
    boxShadow: shadow.card,
  },
  heroCard: {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.hero,
    boxShadow: shadow.hero,
    overflow: 'hidden',
  },
  /**
   * マイページ 2×2 グリッドのカード共通。
   * 🔴 height:100% と flex column が要点。グリッドアイテムは箱が伸びても
   *    中身は伸びないので、これが無いと行内でカードの丈が揃わない。
   */
  softCard: {
    background: color.surface,
    border: `1px solid ${color.borderPink}`,
    borderRadius: radius.hero,
    boxShadow: shadow.cardWide,
    boxSizing: 'border-box' as const,
    height: '100%',
    display: 'flex' as const,
    flexDirection: 'column' as const,
  },
  primaryButton: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: color.primary,
    color: color.textOnPrimary,
    border: 'none',
    borderRadius: radius.sm,
    padding: '18px 30px',
    fontFamily: 'inherit',
    fontSize: 15, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
    boxShadow: shadow.primaryButton,
  },
  outlineButton: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: color.surface,
    border: `1px solid ${color.primaryBorder}`,
    borderRadius: radius.pill,
    padding: '13px 22px',
    fontFamily: 'inherit',
    fontSize: 13.5, fontWeight: 700,
    color: color.primary,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
  ghostButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%',
    background: color.surface,
    border: `1px solid ${color.borderSoft}`,
    borderRadius: radius.md,
    padding: '14px 16px',
    fontFamily: 'inherit',
    fontSize: 13.5, fontWeight: 700,
    color: color.textStrong,
    cursor: 'pointer',
  },
  chip: {
    fontSize: 11.5, fontWeight: 700,
    color: color.primary,
    background: color.primarySoft,
    borderRadius: radius.pill,
    padding: '4px 10px',
  },
  listRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 14px',
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    background: color.surface,
  },
  avatar34: { width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' as const, display: 'block' },
  onlineDot: { width: 7, height: 7, borderRadius: '50%', background: color.online },
} as const;

const webcoachTheme = { color, gradient, radius, shadow, space, grid, font, t };
export default webcoachTheme;
