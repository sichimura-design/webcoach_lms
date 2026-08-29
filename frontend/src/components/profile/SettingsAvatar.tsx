import React from 'react';

/**
 * 設定画面のアバター。淡いピンクの丸の中に、一段小さいアバターを置く。
 * 由来: claude.ai/design『学習画面デザイン案.dc.html』2a / 2b。
 *
 * 🔴 画像を丸いっぱいに敷かないのが要点。デザインはピンクの縁が見える作りで、
 *    アバターが白背景に直置きされていない＝「編集できる自分の絵」だと分かる。
 *    ここを cover で全面にすると、ただの丸い写真になってピンクが消える。
 * 🔴 未設定のときは ui-avatars のイニシャル画像（「モッ」のような頭2文字）ではなく、
 *    デザインと同じ紺色の顔を出す。イニシャルは「まだ何も設定していない」ようには
 *    見えず、かつ外部サービスへの画像リクエストが1本増える。
 */
interface SettingsAvatarProps {
  /** アバター画像のURL。未設定（空 / null）ならデザインの顔にフォールバックする */
  src?: string | null;
  alt?: string;
  /** 外側のピンク円の直径。内側のアバターは自動で 14px 小さくなる */
  size: number;
}

/** デザイン 2a / 2b のアバタープレースホルダ（紺色の丸に白い目と口） */
function PlaceholderFace({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="18" cy="18" r="17" fill="#2E4A62" />
      <path
        d="m11 15 3 1.5-3 1.5M25 15l-3 1.5 3 1.5"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M13.5 21.5c1.5 1.8 7.5 1.8 9 0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function SettingsAvatar({ src, alt = '', size }: SettingsAvatarProps) {
  const inner = size - 14;
  return (
    <span
      aria-hidden={alt === '' ? true : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: 'var(--dc-badge-pink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <span
        style={{
          width: inner,
          height: inner,
          borderRadius: 9999,
          overflow: 'hidden',
          display: 'block',
          flex: 'none',
        }}
      >
        {src ? (
          <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <PlaceholderFace size={inner} />
        )}
      </span>
    </span>
  );
}

export default SettingsAvatar;
