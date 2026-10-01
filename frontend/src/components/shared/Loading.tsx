import type { CSSProperties } from 'react';

/**
 * 読み込み中の表示。回転する輪と「読み込み中…」の文字の組み合わせに統一する（2026-10）。
 *
 * 🔴 以前は画面ごとに 回転する輪だけ／文字だけ（「読み込んでいます…」）／MUI の
 *    CircularProgress／lucide の Loader2 が混在していて、同じ「待ち」が画面ごとに違って見えた。
 *    ページやカードの読み込みはこれを使う。
 * 🔴 対象外にしているもの（形を変えない）:
 *    - ボタンの中の小さな回転表示（押した操作の結果待ちで、ボタンの形を崩さないため）
 *    - AI の「考え中」の点（AiThinkingBubble。読み込みではなく相手の応答待ち）
 *    - 枠だけ先に出すスケルトン（中身の位置が先に分かるほうが良い場所）
 * 🔴 色は --dc-* が使えない画面（.mypage-3d / .wc-warm の外）でも出るよう、フォールバックを持つ。
 *
 * variant:
 *   page  … ページ全体の読み込み。親の高さいっぱいに中央寄せ（最低 50vh）
 *   block … カードの中の読み込み。上下に少し余白を取って中央寄せ
 *   inline… 1行の中（一覧の末尾など）。輪と文字を横に並べる
 */
interface LoadingProps {
  variant?: 'page' | 'block' | 'inline';
  /** 文字。既定は「読み込み中…」。空文字なら輪だけ（読み上げ用の文言は残る） */
  label?: string;
  /** 輪の直径。既定は page 36 / block 28 / inline 16 */
  size?: number;
  style?: CSSProperties;
}

const DEFAULT_SIZE = { page: 36, block: 28, inline: 16 } as const;

export function Loading({ variant = 'block', label = '読み込み中…', size, style }: LoadingProps) {
  const ring = size ?? DEFAULT_SIZE[variant];
  const inline = variant === 'inline';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: inline ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: inline ? 'flex-start' : 'center',
        gap: inline ? 8 : 12,
        width: inline ? undefined : '100%',
        minHeight: variant === 'page' ? '50vh' : undefined,
        height: variant === 'page' ? '100%' : undefined,
        padding: variant === 'block' ? '24px 0' : variant === 'inline' ? '4px 0' : 0,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <span
        aria-hidden
        className="animate-spin"
        style={{
          width: ring,
          height: ring,
          flex: 'none',
          borderRadius: '50%',
          border: `${ring >= 24 ? 3 : 2}px solid var(--dc-soft-200, #F5D8DB)`,
          borderTopColor: 'var(--dc-primary, #D60934)',
          boxSizing: 'border-box',
        }}
      />
      {label ? (
        <span style={{ fontSize: inline ? 12.5 : 13, fontWeight: 600, color: 'var(--dc-text-subtle, #595959)' }}>{label}</span>
      ) : (
        <span className="sr-only">読み込み中</span>
      )}
    </div>
  );
}

export default Loading;
