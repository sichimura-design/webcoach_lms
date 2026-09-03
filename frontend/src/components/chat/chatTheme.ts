/**
 * AIチャットの見た目を1箇所に置く。
 *
 * ヘッダーのドロワーと教材ページのサイドバーは同じ chatStore の同じ会話を映すので、
 * 片方だけ手を入れると「同じ会話が別物に見える」状態になる。両方がここを読む。
 *
 * 値は theme/webcoachTheme.ts のトークンから作る。既存トークンの値は変えていない。
 * :hover などの疑似クラスは inline style で書けないので index.css の
 * .wc-ai-* クラスと組み合わせて使う。
 */
import { CSSProperties } from 'react';
import { color, font, radius } from '../../theme/webcoachTheme';

/** キーボード操作時のフォーカス表示。アプリ全体で使っているリングに合わせる */
export const CHAT_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]';

/**
 * 重なり順。
 * 左サイドバーと下部ナビが z-40、折りたたみ時のツールチップが z-50 なので、
 * ドロワーはそれより上、画像の拡大表示はさらに上に置く。
 */
export const CHAT_Z = { scrim: 60, drawer: 61, lightbox: 70 } as const;

/** チャットの表示面。狭いサイドバー(320px)と400pxのドロワーで文字サイズを変える */
export type ChatVariant = 'drawer' | 'panel';

export const chatFontSize = (variant: ChatVariant) => (variant === 'drawer' ? 13 : 12);

/** 吹き出し。ユーザーは淡いピンクの面、AIは白い面 */
export function bubbleStyle(role: 'user' | 'assistant', variant: ChatVariant): CSSProperties {
  const base: CSSProperties = {
    maxWidth: '88%',
    padding: variant === 'drawer' ? '10px 12px' : '9px 11px',
    borderRadius: 12,
    fontSize: chatFontSize(variant),
    lineHeight: 1.8,
    fontFamily: font.family,
    wordBreak: 'break-word',
  };
  return role === 'user'
    ? {
        ...base,
        background: color.primarySoft,
        border: `1px solid ${color.primaryBorder}`,
        color: color.textBody,
      }
    : {
        ...base,
        background: color.surface,
        border: `1px solid ${color.border}`,
        color: color.textBody,
      };
}

/** AIのアバター。27pxの角丸に「AI」の2文字 */
export function aiAvatarStyle(size = 27): CSSProperties {
  return {
    width: size,
    height: size,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 8,
    background: color.primary,
    color: color.textOnPrimary,
    fontSize: Math.round(size * 0.33),
    fontWeight: 900,
    flexShrink: 0,
    fontFamily: font.family,
  };
}

/** 添付・閉じる・拡大などのアイコンボタン。CSSリセットが無いので毎回明示する */
export function iconButtonStyle(size = 28): CSSProperties {
  return {
    width: size,
    height: size,
    display: 'grid',
    placeItems: 'center',
    border: `1px solid ${color.borderSoft}`,
    borderRadius: 8,
    background: color.surface,
    color: color.textMuted,
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    fontFamily: 'inherit',
  };
}

/** 送信ボタン */
export function sendButtonStyle(enabled: boolean, size = 30): CSSProperties {
  return {
    width: size,
    height: size,
    display: 'grid',
    placeItems: 'center',
    border: 'none',
    borderRadius: 9,
    background: enabled ? color.primary : color.borderNeutral,
    color: color.textOnPrimary,
    cursor: enabled ? 'pointer' : 'default',
    flexShrink: 0,
    padding: 0,
    fontFamily: 'inherit',
  };
}

/** 入力欄をまとめている枠。ドロップ受付中は破線にする */
export function composerShellStyle(dropActive: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 12,
    background: color.surface,
    border: dropActive ? `2px dashed ${color.primaryDashed}` : `1px solid ${color.border}`,
    // 破線が1px→2pxになるぶんのズレを吸収する
    margin: dropActive ? -1 : 0,
  };
}

/** 入力欄そのもの。fontFamily: inherit は必須（preflight が無いので等幅になる） */
export function chatTextareaStyle(variant: ChatVariant): CSSProperties {
  return {
    flex: 1,
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    resize: 'none',
    overflowY: 'auto',
    minHeight: 22,
    maxHeight: 120,
    padding: '2px 0',
    color: color.text,
    fontSize: chatFontSize(variant),
    lineHeight: 1.7,
    fontFamily: 'inherit',
  };
}

/** パネルの見出し行 */
export const chatHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 46,
  padding: '0 14px',
  background: color.surface,
  borderBottom: `1px solid ${color.border}`,
  flexShrink: 0,
};

/** メッセージ一覧の地 */
export const chatListStyle: CSSProperties = {
  background: color.pageBg,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  overflowY: 'auto',
};

export const chatCaptionStyle: CSSProperties = {
  ...font.caption,
  color: color.textFaint,
  fontFamily: font.family,
  lineHeight: 1.7,
};

export { color as chatColor, font as chatFont, radius as chatRadius };
