import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { radius } from '../../theme/webcoachTheme';
import type { SelectionContext } from '../../utils/lessonSelectionContext';

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
 *
 * 🔴 iframe は別オリジン（uat.webcoach.jp など）なので、親から本文も選択も読めない。
 *    そのため「AIに聞く」にレッスン名しか届かず、文章を選んでの引用もできなかった（2026-10）。
 *    lms-embed.js が本文テキスト（'wc-lesson:text'）と選択（'wc-lesson:selection'）を送ってくるので、
 *    それを onLessonText / onSelection で呼び出し元（CourseContentPage）へ渡す。
 *    読み込み時に 'wc-lesson:text-request' も送る（親が受け始める前に教材が送り終えていた場合の取りこぼし対策）。
 *    古い lms-embed.js はどちらも送らないので、呼び出し元は「来なければ使えない」扱いにする。
 */
interface EmbeddedLessonFrameProps {
  src: string;
  title: string;
  /** 教材本文のテキスト（lms-embed.js が送ってきたとき） */
  onLessonText?: (text: string) => void;
  /** 文章の選択。位置は画面（親のビューポート）座標に直してある。外れたら null */
  onSelection?: (selection: (SelectionContext & { rect: DOMRect }) | null) => void;
}

/** 呼び出し元から教材側の選択を消すため */
export interface EmbeddedLessonFrameHandle {
  clearSelection: () => void;
}

const MESSAGE_TYPE = 'wc-lesson:height';
const NAVIGATE_TYPE = 'wc-lesson:navigate';
const TEXT_TYPE = 'wc-lesson:text';
const SELECTION_TYPE = 'wc-lesson:selection';
/** 受け取る本文の上限（AI へ送るのはさらに LESSON_TEXT_MAX_CHARS まで） */
const TEXT_MAX = 8000;
const SELECTION_MAX = 400;
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** 教材から来たパスとして受け付けるか。SPA 内の絶対パスだけ（外部URL・プロトコル相対は不可） */
const isInternalPath = (path: unknown): path is string =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') && !/^\/*[a-z][a-z0-9+.-]*:/i.test(path);

const EmbeddedLessonFrame = forwardRef<EmbeddedLessonFrameHandle, EmbeddedLessonFrameProps>(({ src, title, onLessonText, onSelection }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const navigate = useNavigate();
  // コールバックが描画ごとに変わっても、message の購読を張り直さない
  const textRef = useRef(onLessonText);
  const selRef = useRef(onSelection);
  textRef.current = onLessonText;
  selRef.current = onSelection;

  useImperativeHandle(ref, () => ({
    clearSelection: () => iframeRef.current?.contentWindow?.postMessage({ type: 'wc-lesson:clear-selection' }, '*'),
  }), []);

  useEffect(() => {
    setHeight(null);
    const onMessage = (e: MessageEvent) => {
      // 自分の iframe から来たものだけ受ける（別の埋め込みや拡張機能の postMessage を無視）
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as Record<string, unknown> | null;
      if (data?.type === TEXT_TYPE) {
        textRef.current?.(str(data.text, TEXT_MAX));
        return;
      }
      if (data?.type === SELECTION_TYPE) {
        const text = str(data.text, SELECTION_MAX).trim();
        const frame = iframeRef.current?.getBoundingClientRect();
        if (!text || !frame) { selRef.current?.(null); return; }
        const r = (data.rect ?? {}) as Record<string, unknown>;
        selRef.current?.({
          text,
          heading: str(data.heading, 300) || null,
          before: str(data.before, 300),
          after: str(data.after, 300),
          rect: new DOMRect(frame.left + num(r.left), frame.top + num(r.top), num(r.width), num(r.height)),
        });
        return;
      }
      if (data?.type === NAVIGATE_TYPE) {
        if (!isInternalPath(data.path)) return;
        (e.source as Window).postMessage({ type: `${NAVIGATE_TYPE}-ack` }, '*');
        navigate(data.path);
        return;
      }
      if (data?.type !== MESSAGE_TYPE || typeof data.height !== 'number' || !Number.isFinite(data.height)) return;
      setHeight(Math.ceil(data.height as number));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [src, navigate]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: 'wc-lesson:text-request' }, '*')}
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
});
EmbeddedLessonFrame.displayName = 'EmbeddedLessonFrame';

export default EmbeddedLessonFrame;
