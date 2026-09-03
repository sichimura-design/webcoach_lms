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
   * 保存・完了（Success）。
   * 🔴 上の online（#34C759）とは役割が別。あちらは「在席中」を示すドットの色で、
   *    こちらは「保存できた・完了した」を示す色。混ぜないこと。
   * 🔴 白地に対するコントラストは約3.4:1で、小さい文字には足りない。
   *    アイコンの色としてだけ使い、文言は textMuted のままにする。
   */
  success: '#0E9F6E',
  successSurface: '#E8F8F1',
} as const;

export const gradient = {
  heroThumb: 'linear-gradient(135deg,#FF5A4E 0%,#E0213A 55%,#C90D22 100%)',
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
} as const;

/** 3カラム行（合計 1326px 幅の本文領域内） */
export const grid = {
  contentWidth: 1326,
  columns: '384px 554px 1fr',
  gap: 18,
} as const;

export const font = {
  family: "'Noto Sans JP', system-ui, sans-serif",
  // size / weight / (lineHeight は指定なし=既定)
  pageTitle:     { fontSize: 28,   fontWeight: 900, letterSpacing: '.2px' },
  heroTitle:     { fontSize: 25,   fontWeight: 900, letterSpacing: '.2px' },
  statValue:     { fontSize: 22,   fontWeight: 900, letterSpacing: '.2px' },
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
