import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Lambda@Edge で保護されているパスプレフィックス
const PROTECTED_PATHS = ['/course-images/', '/html-content/'];

function addCfToken(url: string, token: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cf_token=${encodeURIComponent(token)}`;
}

// メモリキャッシュ（セッション中は保持）
const imageCache = new Map<string, string>();

interface UseCourseImageResult {
  imageSrc: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Moodleコース画像をBase64で取得するカスタムフック
 * @param imageUrl - Moodleの画像URL（courseimage または overviewfiles[0].fileurl）
 * @param fallbackColor - 画像がない場合のフォールバック背景色
 */
export function useCourseImage(
  imageUrl: string | undefined | null,
  fallbackColor?: string
): UseCourseImageResult {
  const { contentToken } = useAuth();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setImageSrc(null);
      setLoading(false);
      return;
    }

    // pluginfile.php を含むURLはアクセスしない（認証が必要なため）
    if (imageUrl.includes('/pluginfile.php') || imageUrl.includes('/webservice/')) {
      setImageSrc(null);
      setLoading(false);
      return;
    }

    // Lambda@Edge 保護パスには cf_token を付与
    const isProtected = PROTECTED_PATHS.some(p => imageUrl.includes(p));
    if (isProtected && contentToken) {
      setImageSrc(addCfToken(imageUrl, contentToken));
      setLoading(false);
      return;
    }

    // その他の https URL はブラウザが直接取得（cookie が送られる）
    if (imageCache.has(imageUrl)) {
      setImageSrc(imageCache.get(imageUrl)!);
      setLoading(false);
      return;
    }
    imageCache.set(imageUrl, imageUrl);
    setImageSrc(imageUrl);
    setLoading(false);
  }, [imageUrl, contentToken]);

  return { imageSrc, loading, error };
}

/**
 * 画像キャッシュをクリア
 */
export function clearImageCache(): void {
  imageCache.clear();
}

export default useCourseImage;
