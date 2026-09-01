import type { CSSProperties } from 'react';

/**
 * 全ページ共通のフッター。
 * ============================================================
 * 🔴 背景を塗らない。ページの地色（--dc-bg のクリーム #FBF8F4）を透かす。
 *    以前はページごとに4種類のフッターが混在していた:
 *      濃紫 #2B2440 ＋白字（コーストップ・コース一覧・パスワード再設定）
 *      濃灰 #2B2629 ＋白字（ヘルプ・マイノート）
 *      地色＋薄い文字（マイページ・学習ログ・プロフィール・アカウント設定）
 *      独自（カテゴリ詳細 48px／ログイン absolute）
 *    同じアプリの中でページを移るたびに下端の色が変わるので、
 *    「別のサイトに来たのか」と読めてしまう。ここに1本化する。
 *
 * 🔴 色・字を各ページで上書きしないこと。位置の都合（ログイン画面の
 *    absolute 配置など）だけ style で足す。
 * ============================================================
 */
interface AppFooterProps {
  /**
   * 位置指定の上書き。既定（`marginTop:'auto'` で下端に貼る）で足りない
   * ページだけ渡す。色・フォントを変える用途では使わない。
   */
  style?: CSSProperties;
}

const BASE: CSSProperties = {
  textAlign: 'center',
  fontSize: 'var(--dc-fs-caption)',
  color: 'var(--dc-text-subtle)',
  padding: '32px 0 0',
  // 短いページでも下端に貼り付く（親が flex-col のとき）
  marginTop: 'auto',
};

export function AppFooter({ style }: AppFooterProps) {
  return <footer style={{ ...BASE, ...style }}>2026 &copy; WEBCOACH</footer>;
}

export default AppFooter;
