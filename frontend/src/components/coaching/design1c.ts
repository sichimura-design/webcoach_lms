/**
 * デザイン『コーチング トップ 3案.dc.html』案1C のリテラル値。
 * ============================================================
 * 🔴 theme/webcoachTheme.ts ではなくここを使う。1C はサイドバー（AppHeader の
 *    #FDF7F3 / #E2DBD0）と同系の暖色クリームで組まれていて、既存テーマの
 *    #FDFCFC / #F3EDED とは地の温度が違う。「1Cのリテラル値をそのまま使う」と
 *    決めたので、混ぜずにこの1ファイルを唯一の出どころにする。
 * 🔴 このトークンを使ってよいのは /coaching 配下の 1C 準拠コンポーネントだけ。
 *    他画面に持ち出すと、また画面ごとに赤と地色が食い違う状態に戻る。
 * ============================================================
 */
import type React from 'react';

export const C = {
  /** ページの地 */
  bg: '#FBF8F4',
  surface: '#FFFFFF',
  /** カード枠 */
  border: '#EFE9E0',
  /** 入力・小ボタンの枠 */
  borderInput: '#E2DBD0',
  /** リスト行の区切り */
  line: '#F7F3ED',
  /** タイムラインの縦線・未完了チェックの枠 */
  rail: '#E3DED8',
  checkIdle: '#D6CFC4',

  brand: '#DC0C31',
  brandHover: '#B80A29',
  /** 赤の淡い地（アイコン丸・カウントダウンピル） */
  brandSoft: '#FBE9EC',
  /** AIサマリーの地 */
  brandFaint: '#FDF7F7',
  brandInk: '#9E1128',

  ink: '#141414',
  body: '#3D3D3D',
  muted: '#6B6B6B',
  faint: '#9E9E9E',
  pencil: '#C9C2B8',

  ok: '#0E9F6E',
  okSoft: '#E8F8F1',
  okBorder: '#A8DFC9',

  warn: '#B7791F',
  warnBg: '#FEF6E7',
} as const;

/** 1C の白カード共通（枠・角丸・二段の影） */
export const CARD: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: '0 1px 2px rgba(60,48,32,.05),0 12px 24px -16px rgba(60,48,32,.14)',
};

/** 赤ベタのCTA。hover は index.css の .cg-btn-primary が受け持つ */
export const PRIMARY_BUTTON: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  background: C.brand,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '13px 18px',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  boxShadow: '0 4px 12px -6px rgba(220,12,49,.5)',
};

/** 白地のセカンダリ。hover は .cg-btn-ghost */
export const GHOST_BUTTON: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.borderInput}`,
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'inherit',
  color: C.ink,
  cursor: 'pointer',
};

/** 「未登録」の琥珀ピル */
export const WARN_PILL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 400,
  color: C.warn,
  background: C.warnBg,
  borderRadius: 9999,
  padding: '3px 9px',
};

/** インライン編集の入力欄 */
export const INPUT: React.CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: `1px solid ${C.borderInput}`,
  padding: '0 10px',
  fontSize: 12.5,
  fontFamily: 'inherit',
  outlineColor: C.brand,
  minWidth: 0,
  background: C.surface,
  color: C.ink,
};

/** 「変更」のような、文字だけの弱いリンクボタン */
export const TEXT_LINK_BUTTON: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 11.5,
  fontWeight: 400,
  color: C.muted,
  fontFamily: 'inherit',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
  flex: 'none',
};
