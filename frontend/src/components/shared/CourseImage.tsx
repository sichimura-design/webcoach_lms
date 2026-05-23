import React, { useState, useEffect } from 'react';
import { useCourseImage } from '../../hooks/useCourseImage';

interface CourseImageProps {
  /** Moodleの画像URL */
  imageUrl?: string | null;
  /** 代替テキスト */
  alt: string;
  /** 画像がない場合に表示するテキスト */
  fallbackText?: string;
  /** 画像がない場合の背景色 */
  fallbackColor?: string;
  /** 追加のCSSクラス */
  className?: string;
  /** インラインスタイル */
  style?: React.CSSProperties;
  /** フォールバックテキストのサイズ */
  fallbackTextSize?: 'sm' | 'md' | 'lg';
  /** フォールバック時にテキストを非表示（背景色のみ表示） */
  hideFallbackText?: boolean;
}

// 背景色に対してコントラストのあるテキスト色を決定
const getContrastColor = (hexColor: string): string => {
  // デフォルトは白
  if (!hexColor || !hexColor.startsWith('#')) return '#FFFFFF';

  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // 輝度を計算
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // 明るい背景には暗いテキスト、暗い背景には明るいテキスト
  return luminance > 0.5 ? '#374151' : '#FFFFFF';
};

/**
 * Moodleコース画像を表示するコンポーネント
 * BFFプロキシ経由でBase64画像を取得して表示
 */
export const CourseImage: React.FC<CourseImageProps> = ({
  imageUrl,
  alt,
  fallbackText,
  fallbackColor = '#9CA3AF',
  className = '',
  style = {},
  fallbackTextSize = 'md',
  hideFallbackText = false,
}) => {
  // 空文字列もnull/undefinedと同様に扱う
  const normalizedImageUrl = imageUrl && imageUrl.trim() !== '' ? imageUrl : null;
  const { imageSrc, loading, error } = useCourseImage(normalizedImageUrl);

  // ブラウザ側での画像読み込みエラーを追跡
  const [imgLoadError, setImgLoadError] = useState(false);

  // imageUrlが変わったらエラー状態をリセット
  useEffect(() => {
    setImgLoadError(false);
  }, [normalizedImageUrl]);

  // テキストサイズのクラス
  const textSizeClass = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[fallbackTextSize];

  // 画像URLがない、または画像が取得できなかった場合はフォールバック表示
  const showFallback = !normalizedImageUrl || !imageSrc || error || imgLoadError;

  // フォールバック表示用のレンダリング関数
  const renderFallback = (isLoading: boolean = false) => {
    const displayText = fallbackText || alt || '';
    const textColor = getContrastColor(fallbackColor);

    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{
          backgroundColor: fallbackColor,
          ...style,
        }}
      >
        {isLoading ? (
          <div
            className="animate-pulse rounded-full"
            style={{
              width: '40%',
              height: '40%',
              maxWidth: '48px',
              maxHeight: '48px',
              minWidth: '24px',
              minHeight: '24px',
              backgroundColor: 'rgba(255,255,255,0.3)'
            }}
          />
        ) : !hideFallbackText ? (
          <span
            className={`font-bold text-center select-none px-2 line-clamp-2 ${textSizeClass}`}
            style={{
              fontFamily: 'Noto Sans JP, sans-serif',
              textShadow: textColor === '#FFFFFF'
                ? '0 1px 3px rgba(0,0,0,0.3)'
                : '0 1px 2px rgba(255,255,255,0.3)',
              color: textColor,
            }}
          >
            {displayText}
          </span>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return renderFallback(true);
  }

  if (showFallback) {
    return renderFallback(false);
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`object-cover ${className}`}
      style={style}
      onError={() => setImgLoadError(true)}
    />
  );
};

export default CourseImage;
