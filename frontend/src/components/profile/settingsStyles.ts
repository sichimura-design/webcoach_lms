import React from 'react';

/**
 * アカウント設定（2a）・プロフィール設定（2b）で共有するスタイル。
 * 由来: claude.ai/design『学習画面デザイン案.dc.html』の 2a / 2b。
 *
 * 🔴 値は全て `--dc-*`（index.css の .wc-warm / .mypage-3d）を参照する。
 *    2a/2b は元から暖色クリーム系トークンで組まれているので、マイページ（5a）・
 *    学習記録（4a）と同じ変数に寄せれば配色が自動で揃う。
 * 🔴 theme/webcoachTheme.ts には足さない。あちらは #FDFCFC 系の別トークンで、
 *    混ぜると同じ役割の色が2系統になる（webcoachTheme.ts 冒頭のコメント参照）。
 * 🔴 このファイルは2画面だけの共有物。3画面目が来たら shared/ に上げることを検討する。
 */

/** ページ本文の最大幅。デザイン実測（キャンバス1240 − サイドバー240 − 左右padding） */
export const CONTENT_MAX_WIDTH = 1010;

/** 白いカード。2a のカード類と 2b の本体カードで共通 */
export const dcCard: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 16,
  boxSizing: 'border-box',
};

/** 行の見出し（「メールアドレス」「ニックネーム」など）。幅は各画面で上書きする */
export const dcRowLabel: React.CSSProperties = {
  fontSize: 14.5,
  fontWeight: 700,
  color: 'var(--dc-text)',
  flex: 'none',
};

/** 入力欄。h46 / radius 12 は 2b の実測値で、2a のインラインフォームにも同じものを使う */
export const dcInput: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 46,
  borderRadius: 12,
  border: '1px solid var(--dc-border-strong)',
  background: 'var(--dc-surface)',
  padding: '0 16px',
  fontSize: 14.5,
  fontFamily: 'inherit',
  color: 'var(--dc-text)',
  outline: 'none',
};

/** 入力欄の下のヒント文 */
export const dcHint: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--dc-text-subtle)',
  marginTop: 6,
  lineHeight: 1.7,
};

/** アウトラインボタン（「変更」「編集」「アイコンを選ぶ」）。白地・ブランド赤の文字 */
export const dcOutlineButton: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-soft-200)',
  borderRadius: 10,
  color: 'var(--dc-primary)',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  padding: '10px 26px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flex: 'none',
};

/** 塗りつぶしの主ボタン（「保存する」）。1画面に1つだけ（DESIGN.md §15-5） */
export const dcPrimaryButton: React.CSSProperties = {
  background: 'var(--dc-primary)',
  border: 'none',
  borderRadius: 12,
  color: '#fff',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  padding: '12px 34px',
  cursor: 'pointer',
};

/** 文字だけのボタン（「キャンセル」） */
export const dcGhostButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderRadius: 12,
  color: 'var(--dc-text-muted)',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  padding: '12px 26px',
  cursor: 'pointer',
};

/** 丸いアイコンバッジ（56px のピンク丸）。サイズは呼び出し側で上書き */
export const dcIconBadge: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 9999,
  background: 'var(--dc-badge-pink)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  color: 'var(--dc-primary)',
};

/** 行末の ›。設定画面の一覧行はこれで「まだ先がある」ことを示す */
export const dcChevron: React.CSSProperties = {
  color: 'var(--dc-chevron)',
  flexShrink: 0,
};

/** ページ見出し（h1 27px/800）。2a・2b で同一 */
export const dcPageTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 27,
  fontWeight: 800,
  letterSpacing: '-0.01em',
  lineHeight: 1.35,
  color: 'var(--dc-text)',
};

/** 見出しの下の説明文 */
export const dcPageLead: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: 14,
  color: 'var(--dc-text-muted)',
};

/** キーボードフォーカスの共通リング（AppHeader.tsx の focusRing と同じ値） */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD] focus-visible:ring-offset-0';
