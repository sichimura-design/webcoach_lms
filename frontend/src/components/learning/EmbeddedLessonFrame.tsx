import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { radius } from '../../theme/webcoachTheme';

/**
 * Moodle の URL リソース（mod/url）で登録した教材HTMLを埋め込む iframe。
 *
 * 🔴 教材側（materials/_assets/lms-embed.js）が自分の高さを postMessage で送ってくるので、
 *    iframe をその高さまで伸ばし、教材の中にスクロールを作らない。
 *    以前は 85vh 固定で、教材の中と LMS の画面の2か所にスクロールができ、
 *    教材の上端がタイトルの下で見切れたり、右下の常設ピルと本文が重なったりしていた。
 * 高さが届かない教材（lms-embed.js を読んでいない外部URL）は従来どおり 85vh で内側スクロール。
 *
 * 🔴 教材の中の LMS 内リンク（<a data-lms-route="/study-log?goal=new">）は、lms-embed.js が
 *    'wc-lesson:navigate' で遷移を頼んでくるので、この画面のまま router で移る。
 *    iframe の中から親の URL は分からない（/branches/<slug>/ の前置きも含め）ので、パスだけ受け取る。
 *    受けたら 'wc-lesson:navigate-ack' を返す。返さないと教材側は href を別タブで開く（古い LMS 向けの逃げ道）。
 */
interface EmbeddedLessonFrameProps {
  src: string;
  title: string;
}

const MESSAGE_TYPE = 'wc-lesson:height';
const NAVIGATE_TYPE = 'wc-lesson:navigate';

/** 教材から来たパスとして受け付けるか。SPA 内の絶対パスだけ（外部URL・プロトコル相対は不可） */
const isInternalPath = (path: unknown): path is string =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') && !/^\/*[a-z][a-z0-9+.-]*:/i.test(path);

const EmbeddedLessonFrame: React.FC<EmbeddedLessonFrameProps> = ({ src, title }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setHeight(null);
    const onMessage = (e: MessageEvent) => {
      // 自分の iframe から来たものだけ受ける（別の埋め込みや拡張機能の postMessage を無視）
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string; height?: unknown; path?: unknown } | null;
      if (data?.type === NAVIGATE_TYPE) {
        if (!isInternalPath(data.path)) return;
        (e.source as Window).postMessage({ type: `${NAVIGATE_TYPE}-ack` }, '*');
        navigate(data.path);
        return;
      }
      if (data?.type !== MESSAGE_TYPE || typeof data.height !== 'number' || !Number.isFinite(data.height)) return;
      setHeight(Math.ceil(data.height));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [src, navigate]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      // allow-popups: 教材内の外部リンク（target=_blank）を別タブで開けるようにする
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      title={title}
      scrolling={height ? 'no' : undefined}
      style={{
        width: '100%',
        border: 'none',
        borderRadius: radius.md,
        display: 'block',
        height: height ? `${height}px` : '85vh',
        minHeight: '400px',
      }}
    />
  );
};

export default EmbeddedLessonFrame;
