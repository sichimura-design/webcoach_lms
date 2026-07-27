import type { CSSProperties } from 'react';

interface MascotSvgProps {
  size?: number;
  cheeks?: boolean;
  pulse?: boolean;
  flag?: boolean;
  style?: CSSProperties;
}

// design_handoff_lms_app / WebcoachApp.dc.html のマスコットSVGをそのまま移植したもの。
// 本番マスコットイラスト未支給のため、このプレースホルダのまま各画面で再利用する。
function MascotSvg({ size = 64, cheeks = false, pulse = false, flag = false, style }: MascotSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ flexShrink: 0, animation: pulse ? 'wcPulse 3s ease-in-out infinite' : undefined, ...style }}
    >
      <line x1="32" y1="10" x2="32" y2="16" stroke="#E0213A" strokeWidth="2" />
      <circle cx="32" cy="8" r="3.4" fill="#E0213A" />
      <rect x="14" y="16" width="36" height="28" rx="14" fill="#fff" stroke="#F3B8C1" />
      <circle cx="25" cy="29" r="2.6" fill="#20141A" />
      <circle cx="39" cy="29" r="2.6" fill="#20141A" />
      <path d="M28 35 q4 3.4 8 0" stroke="#E0213A" strokeWidth="2" fill="none" strokeLinecap="round" />
      {cheeks && (
        <>
          <circle cx="20" cy="33" r="2.4" fill="#F6A9B5" />
          <circle cx="44" cy="33" r="2.4" fill="#F6A9B5" />
        </>
      )}
      <rect x="20" y="46" width="24" height="12" rx="6" fill="#E0213A" />
      {flag && (
        <>
          <line x1="50" y1="30" x2="56" y2="18" stroke="#C97" strokeWidth="2" />
          <path d="M56 18 l8 3 -8 3 z" fill="#E0213A" />
        </>
      )}
    </svg>
  );
}

export default MascotSvg;
