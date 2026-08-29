import { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { ExternalLink, FileText } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { useAuth } from '../../contexts/AuthContext';
import {
  MoodleContentType,
  buildSrcdoc,
  extractSoleUrl,
  openMoodleContentInNewTab,
} from './moodleContent';

/**
 * モックOFF時の縮退モード。
 *
 * 構造化教材APIが無い環境では、実Moodleの mod/page HTML をそのまま iframe で描画する。
 * 従来（旧 CourseContentPage）と同じ見え方を保つのが目的なので、ロジックは移設のまま。
 * この経路では選択ツールバー・クリップ・ブロック参照は成立しない（iframe 越しに
 * Range を扱えないため）。以前はこれを AppHeader の postMessage 版「AIに解説」で
 * 補っていたが、全画面で選択のたびに割り込むため撤去した（moodleContent.ts の
 * EXPLAIN_INJECT を参照）。この経路では現在、選択に対するAI導線は無い。
 */
interface MoodleFallbackBlockProps {
  html: string;
  contentType: MoodleContentType | string | undefined;
  title: string;
  videoUrl: string | null;
  externalUrl?: string;
}

export function MoodleFallbackBlock({
  html,
  contentType,
  title,
  videoUrl,
  externalUrl,
}: MoodleFallbackBlockProps) {
  const { contentToken } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeError, setIframeError] = useState(false);

  const soleUrl = html ? extractSoleUrl(html) : undefined;

  useEffect(() => {
    setIframeError(false);
  }, [html]);

  // content が生URLのときは、表示前に到達可能かを確かめる（404を白紙で見せない）
  useEffect(() => {
    if (!soleUrl || contentToken === null) return;
    const srcUrl = contentToken
      ? `${soleUrl}${soleUrl.includes('?') ? '&' : '?'}cf_token=${encodeURIComponent(contentToken)}`
      : soleUrl;
    fetch(srcUrl, { method: 'HEAD', redirect: 'manual' })
      .then((res) => { if (!res.ok) setIframeError(true); })
      .catch(() => setIframeError(true));
  }, [soleUrl, contentToken]);

  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const h = iframe.contentDocument?.documentElement?.scrollHeight;
      if (h) iframe.style.height = `${h}px`;
    } catch { /* cross-origin の場合は何もしない */ }
  }, []);

  const empty = (
    <div className="flex flex-col items-center justify-center" style={{ padding: '64px 0', gap: 12, color: color.textSubtle }}>
      <FileText size={44} style={{ opacity: 0.2 }} />
      <p style={{ ...font.label, margin: 0 }}>コンテンツがありません</p>
    </div>
  );

  // ── mod/url：外部サイトをそのまま埋め込む
  if (contentType === 'url') {
    if (!externalUrl) return empty;
    return (
      <iframe
        src={externalUrl}
        sandbox="allow-scripts allow-same-origin allow-forms"
        title={title}
        style={{ width: '100%', border: 'none', borderRadius: radius.md, height: '78vh', minHeight: 400 }}
      />
    );
  }

  // ── mod/resource（動画）：動画本体＋補足テキスト
  if (contentType === 'resource-video' && videoUrl) {
    return (
      <>
        <div style={{ borderRadius: radius.card, overflow: 'hidden', background: '#3A1220', marginBottom: 18 }}>
          <video controls style={{ width: '100%', display: 'block', aspectRatio: '16/9' }}>
            <source src={videoUrl} type="video/mp4" />
            <source src={videoUrl} type="video/webm" />
            お使いのブラウザは動画タグをサポートしていません。
          </video>
        </div>
        {html && <div className="wc-lesson-prose" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />}
      </>
    );
  }

  if (!html) return empty;

  // ── 本文が生URLのみ：src で読み込む
  if (soleUrl) {
    if (contentToken === null) {
      return (
        <div className="flex justify-center" style={{ padding: 32 }}>
          <span className="animate-spin rounded-full" style={{ width: 32, height: 32, borderBottom: `2px solid ${color.primary}` }} />
        </div>
      );
    }
    if (iframeError) {
      return (
        <div className="flex flex-col items-center justify-center" style={{ padding: '64px 0', gap: 10, color: color.textSubtle }}>
          <FileText size={44} style={{ opacity: 0.25 }} />
          <p style={{ ...font.label, margin: 0 }}>コンテンツが見つかりませんでした</p>
          <p style={{ ...font.caption, margin: 0, opacity: 0.6 }}>
            このコンテンツは現在利用できないか、移動された可能性があります。
          </p>
        </div>
      );
    }
    const srcUrl = contentToken
      ? `${soleUrl}${soleUrl.includes('?') ? '&' : '?'}cf_token=${encodeURIComponent(contentToken)}`
      : soleUrl;
    return (
      <iframe
        ref={iframeRef}
        src={srcUrl}
        onLoad={handleIframeLoad}
        title={title}
        style={{ width: '100%', border: 'none', minHeight: 200, height: '82vh' }}
      />
    );
  }

  // ── mod/label ほか：インラインでサニタイズ描画
  if (contentType === 'label' || contentType === 'resource-other' || contentType === 'unknown') {
    return <div className="wc-lesson-prose" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
  }

  // ── mod/page：srcdoc の iframe（Moodle側CSSを本体へ漏らさないため）
  return (
    <>
      <div className="flex justify-end" style={{ marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => openMoodleContentInNewTab(html)}
          className="flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            gap: 6, padding: '6px 12px', borderRadius: 999,
            border: `1px solid ${color.borderStrong}`, background: color.surface,
            color: color.textMuted, ...font.caption, cursor: 'pointer',
          }}
        >
          <ExternalLink size={13} />
          新しいタブで開く
        </button>
      </div>
      <iframe
        ref={iframeRef}
        srcDoc={buildSrcdoc(html)}
        sandbox="allow-scripts allow-same-origin"
        onLoad={handleIframeLoad}
        title={title}
        style={{ width: '100%', border: 'none', minHeight: 200 }}
      />
    </>
  );
}

export default MoodleFallbackBlock;
