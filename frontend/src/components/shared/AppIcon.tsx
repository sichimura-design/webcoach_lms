import React from 'react';

function getFaviconUrl(url: string): string {
  try {
    const { origin } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=64`;
  } catch {
    return '';
  }
}

interface AppIconProps {
  iconUrl?: string;
  url?: string;
  icon?: string;
  alt?: string;
  size?: number;
  fallback?: string;
}

/**
 * icon_url → urlのファビコン → emoji の順でアイコンを表示する共通コンポーネント
 */
export function AppIcon({ iconUrl, url, icon, alt = '', size = 48, fallback = '✨' }: AppIconProps) {
  const sources = [
    iconUrl,
    url ? getFaviconUrl(url) : '',
  ].filter(Boolean) as string[];

  const [srcIndex, setSrcIndex] = React.useState(0);
  const currentSrc = sources[srcIndex];

  if (currentSrc) {
    return (
      <img
        src={currentSrc}
        alt={alt}
        width={size}
        height={size}
        style={{ imageRendering: 'auto' }}
        onError={() => setSrcIndex((i) => i + 1)}
      />
    );
  }

  return <span style={{ fontSize: `${size * 0.625}px`, lineHeight: 1 }}>{icon || fallback}</span>;
}
