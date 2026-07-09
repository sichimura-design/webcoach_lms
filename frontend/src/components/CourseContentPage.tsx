import { useState, useEffect, useRef, useReducer } from 'react';
import DOMPurify from 'dompurify';
import { bffClient } from '../services/bffClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAiChat, ChatMessage } from '../hooks/useAiChat';
import {
  FileText,
  Send,
  ArrowLeft,
  AlignJustify,
  X,
  CheckCircle,
  RotateCcw,
  ExternalLink,
  Menu,
  Bot,
  User,
} from 'lucide-react';
import Encoding from 'encoding-japanese';
import MarkdownRenderer from './MarkdownRenderer';
import { AppHeader } from './shared';

interface CourseContentPageProps {
  courseId: number;
  initialModuleId?: number;
  onBack: () => void;
}

interface Section {
  id: number;
  name: string;
  visible?: boolean;
  summary: string;
  modules: Module[];
}

interface Module {
  id: number;
  name: string;
  modname: string;
  contents?: ModuleContent[];
  description?: string;
  descriptionformat?: number;
  content?: string;
  contentformat?: number;
  timemodified?: number;
  externalurl?: string;
}

interface ModuleContent {
  type: string;
  filename: string;
  fileurl: string;
  content?: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number; // 1〜4
}

// モジュールのコンテンツ種別（modname + ファイル種別）
type ContentType =
  | 'page'              // mod/page → description にHTML
  | 'label'             // mod/label → description にHTML（インライン表示）
  | 'url'               // mod/url → 外部リンク
  | 'resource-video'    // mod/resource（動画ファイル）
  | 'resource-markdown' // mod/resource（.md ファイル）
  | 'resource-html'     // mod/resource（.html ファイル）
  | 'resource-other'    // mod/resource（その他）
  | 'unknown';

// ─────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────

const isMarkdownFile = (filename: string) => /\.(md|markdown)$/i.test(filename);
const isVideoFile    = (filename: string) => /\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i.test(filename);
const isHtmlFile     = (filename: string) => /\.(html|htm|xhtml)$/i.test(filename);

/** modname とファイル拡張子からコンテンツ種別を決定 */
function getContentType(module: Module): ContentType {
  switch (module.modname) {
    case 'page':  return 'page';
    case 'label': return 'label';
    case 'url':   return 'url';
    case 'resource': {
      const contents = module.contents ?? [];
      if (contents.some(c => isVideoFile(c.filename)))    return 'resource-video';
      if (contents.some(c => isMarkdownFile(c.filename))) return 'resource-markdown';
      if (contents.some(c => isHtmlFile(c.filename)))     return 'resource-html';
      return 'resource-other';
    }
    default: return 'unknown';
  }
}

/**
 * iframe内でのテキスト選択を親に通知するスクリプト。
 * 親（AppHeader）が「AIに解説」ボタンを正しい画面位置に表示するため、
 * 選択テキストと iframe 内での矩形を postMessage する。
 */
const EXPLAIN_INJECT = `<script>(function(){
  function report(){
    var s=window.getSelection();var t=s&&s.toString().trim();
    if(t&&t.length>=2&&t.length<=400&&s.rangeCount>0){
      var r=s.getRangeAt(0).getBoundingClientRect();
      parent.postMessage({__lmsExplain:true,text:t,top:r.top,left:r.left},'*');
    }else{parent.postMessage({__lmsExplain:true,clear:true},'*');}
  }
  document.addEventListener('mouseup',function(){setTimeout(report,0);});
  document.addEventListener('mousedown',function(){parent.postMessage({__lmsExplain:true,clear:true},'*');});
})();<\/script>`;

/**
 * Moodle コンテンツ HTML から srcdoc 用の完全な HTML を生成する。
 * CSS の正規化は BFF の normalizeMoodleContent で実施済みのため、
 * ここでは <style> を <head> に移動し iframe 表示用の補正 CSS を注入するのみ。
 */
function buildSrcdoc(html: string): string {
  const headStyles: string[] = [];

  // <style> を抽出して <head> 用に収集し、<body> からは除去
  const bodyHtml = html.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_, open, css, close) => {
      headStyles.push(`${open}${css}${close}`);
      return '';
    }
  );

  const cleanedBody = bodyHtml;

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${headStyles.join('\n')}
<style>
  /* Moodleエディタがブロック要素間の改行を <br> に変換した余分な空白を除去 */
  div > br, nav > br, ul > br, ol > br, li > br { display: none !important; }
  /* コンテンツ内蔵のサイドバー・プログレスバーはiframe内では不要 */
  .toc-sidebar { display: none !important; }
  #progressBar { display: none !important; }
  /*
   * .quiz-options は display:flex。
   * Moodleが &nbsp; テキストノードをブロック要素間に挿入するため、
   * それらが flex アイテムとして扱われレイアウトが崩れる。
   * font-size:0 でテキストノードのサイズを潰し、子要素で元に戻す。
   */
  .quiz-options { font-size: 0 !important; }
  .quiz-options > * { font-size: revert !important; }
</style>
</head>
<body>${cleanedBody}${EXPLAIN_INJECT}</body></html>`;
}

function buildSrcdocShiftJis(html: string): string {
  const headStyles: string[] = [];
  const bodyHtml = html.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_, open, css, close) => {
      headStyles.push(`${open}${css}${close}`);
      return '';
    }
  );
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="shift-jis">
<meta name="viewport" content="width=device-width,initial-scale=1">
${headStyles.join('\n')}
<style>
  div > br, nav > br, ul > br, ol > br, li > br { display: none !important; }
  .toc-sidebar { display: none !important; }
  #progressBar { display: none !important; }
  .quiz-options { font-size: 0 !important; }
  .quiz-options > * { font-size: revert !important; }
</style>
</head>
<body>${bodyHtml}${EXPLAIN_INJECT}</body></html>`;
}

/** HTML文字列のh1〜h4に id を付与して返す */
function addHeadingIds(html: string): string {
  let counter = 0;
  return html.replace(/<(h[1-4])([^>]*)>/gi, (match, tag, attrs) => {
    if (/\bid\s*=/i.test(attrs)) return match; // 既存IDは保持
    return `<${tag}${attrs} id="toc-heading-${counter++}">`;
  });
}

/** HTML文字列からTOCアイテムを抽出（DOMParser使用） */
function extractTocFromHtml(html: string): TocItem[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const headings = doc.querySelectorAll('h1, h2, h3, h4');
  let counter = 0;
  return Array.from(headings)
    .map(el => ({
      id: el.id || `toc-heading-${counter++}`,
      text: el.textContent?.trim() ?? '',
      level: parseInt(el.tagName[1], 10),
    }))
    .filter(item => item.text.length > 0);
}

// ─────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────

interface ContentState {
  sections: Section[];
  loading: boolean;
  error: string | null;
  selectedModule: Module | null;
  expandedSections: number[];
  courseName: string;
  markdownContent: string;
  loadingMarkdown: boolean;
  pageToc: TocItem[];
  processedHtml: string;
}

type ContentAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; sections: Section[]; courseName: string; initialModule?: Module | null }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SELECT_MODULE'; module: Module }
  | { type: 'TOGGLE_SECTION'; sectionId: number }
  | { type: 'SET_PAGE_CONTENT'; html: string; toc: TocItem[] }
  | { type: 'SET_MARKDOWN'; content: string; loading: boolean }
  | { type: 'CLEAR_CONTENT' }
  | { type: 'SET_TOC'; toc: TocItem[] };

const initialContentState: ContentState = {
  sections: [],
  loading: true,
  error: null,
  selectedModule: null,
  expandedSections: [],
  courseName: '',
  markdownContent: '',
  loadingMarkdown: false,
  pageToc: [],
  processedHtml: '',
};

function contentReducer(state: ContentState, action: ContentAction): ContentState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        sections: action.sections,
        courseName: action.courseName,
        expandedSections: action.sections.length > 0 ? [action.sections[0].id] : [],
        selectedModule: action.initialModule ?? action.sections[0]?.modules?.[0] ?? null,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'SELECT_MODULE':
      return { ...state, selectedModule: action.module, processedHtml: '', pageToc: [], markdownContent: '' };
    case 'TOGGLE_SECTION':
      return {
        ...state,
        expandedSections: state.expandedSections.includes(action.sectionId)
          ? state.expandedSections.filter(id => id !== action.sectionId)
          : [...state.expandedSections, action.sectionId],
      };
    case 'SET_PAGE_CONTENT':
      return { ...state, processedHtml: action.html, pageToc: action.toc, markdownContent: '' };
    case 'SET_MARKDOWN':
      return { ...state, markdownContent: action.content, loadingMarkdown: action.loading, processedHtml: '', pageToc: [] };
    case 'CLEAR_CONTENT':
      return { ...state, processedHtml: '', pageToc: [], markdownContent: '' };
    case 'SET_TOC':
      return { ...state, pageToc: action.toc };
    default:
      return state;
  }
}

// ─────────────────────────────────────────
// コンポーネント
// ─────────────────────────────────────────

function CourseContentPage({ courseId, initialModuleId, onBack }: CourseContentPageProps) {
  const { user, contentToken } = useAuth();
  const [state, dispatch] = useReducer(contentReducer, initialContentState);
  const {
    sections, loading, error, selectedModule, courseName,
    markdownContent, loadingMarkdown, pageToc, processedHtml,
  } = state;
  const { showToast } = useToast();

  // page iframe
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // AI コーチ
  const { messages: aiMessages, input: aiQuestion, setInput: setAiQuestion, loading: aiLoading, messagesEndRef: chatEndRef, sendMessage: sendAiMessage, handleKeyPress: handleAiKeyPress } = useAiChat();

  // モバイルサイドバー
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // アクティビティ完了
  const [completing, setCompleting] = useState(false);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());

  const handleToggleComplete = async (markAsComplete: boolean) => {
    if (!selectedModule || completing) return;
    setCompleting(true);
    try {
      await bffClient.markActivityComplete(selectedModule.id, markAsComplete);
      const newCompletedIds = new Set(completedIds);
      if (markAsComplete) {
        newCompletedIds.add(selectedModule.id);
      } else {
        newCompletedIds.delete(selectedModule.id);
      }
      setCompletedIds(newCompletedIds);

      // resumeCourse を更新
      if (user?.userid) {
        const allModules = sections.flatMap(s => s.modules);
        const progress_percent = allModules.length > 0
          ? Math.round((newCompletedIds.size / allModules.length) * 100)
          : 0;
        bffClient.updateResumeCourse(user.userid, {
          courseid: courseId,
          progress_percent,
        }).catch(e => console.error('[ResumeCourse] Update failed:', e?.response?.data?.message ?? e));

        // 完了時のみ次のモジュールへ遷移
        if (markAsComplete) {
          const nextModule = allModules[allModules.findIndex(m => m.id === selectedModule.id) + 1];
          if (nextModule) {
            dispatch({ type: 'SELECT_MODULE', module: nextModule });
          }
        }
      }
    } catch (e: any) {
      console.error('[Complete] Failed:', e?.response?.data?.message ?? e);
      showToast(markAsComplete ? '完了の記録に失敗しました。再度お試しください。' : '完了の取り消しに失敗しました。再度お試しください。', 'error');
    } finally {
      setCompleting(false);
    }
  };

  const openInNewTab = () => {
    if (!selectedModule) return;
    const html = processedHtml;
    if (!html) return;
    const fullHtml = buildSrcdocShiftJis(html);
    const unicodeArray = Encoding.stringToCode(fullHtml);
    const sjisArray = Encoding.convert(unicodeArray, { to: 'SJIS', from: 'UNICODE' });
    const blob = new Blob([new Uint8Array(sjisArray)], { type: 'text/html; charset=shift-jis' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  };

  // ─── URL コンテンツの事前チェック ─────────
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    setIframeError(false);
  }, [selectedModule?.id]);

  // ─── データ読み込み ───────────────────────
  useEffect(() => {
    dispatch({ type: 'FETCH_START' });
    Promise.all([bffClient.getCourseContent(courseId), bffClient.getCourses()])
      .then(([content, courses]) => {
        const sections = Array.isArray(content) ? content : [];
        const course = courses.find((c: any) => c.id === courseId);
        const allModules = sections.flatMap((s: any) => s.modules ?? []);
        const initialModule = initialModuleId
          ? (allModules.find((m: any) => m.id === initialModuleId) ?? allModules[0])
          : allModules[0];
        dispatch({ type: 'FETCH_SUCCESS', sections, courseName: course?.fullname ?? '', initialModule });
      })
      .catch((err: any) => {
        dispatch({ type: 'FETCH_ERROR', error: err.message || 'コースコンテンツの読み込みに失敗しました。' });
      });
  }, [courseId]);

  // ─── モジュール選択時の完了状態取得 ──────
  useEffect(() => {
    if (!selectedModule) return;
    if (completedIds.has(selectedModule.id)) return; // 既に完了済みならスキップ
    bffClient.getActivityCompletion(selectedModule.id, courseId)
      .then((data) => {
        if (data.state === 1 || data.state === 2) {
          setCompletedIds(prev => new Set(prev).add(selectedModule.id));
        }
      })
      .catch(() => {}); // エラーは無視（完了未取得のまま継続）
  }, [selectedModule?.id]);

  // processedHtml と contentToken が揃ったら URL の存在確認
  useEffect(() => {
    if (!processedHtml || contentToken === null || !selectedModule) return;
    if (getContentType(selectedModule) !== 'page') return;

    const urlMatch = processedHtml.trim().match(/^(?:<[^>]+>\s*)*?(https?:\/\/[^\s<"']+?)(?:\s*<\/[^>]+>)*\s*$/i);
    const extractedUrl = urlMatch?.[1];
    if (!extractedUrl) return;

    const srcUrl = contentToken
      ? `${extractedUrl}${extractedUrl.includes('?') ? '&' : '?'}cf_token=${encodeURIComponent(contentToken)}`
      : extractedUrl;

    fetch(srcUrl, { method: 'HEAD', redirect: 'manual' })
      .then(res => { if (!res.ok) setIframeError(true); })
      .catch(() => setIframeError(true));
  }, [processedHtml, contentToken]);

  // ─── モジュール選択時の処理 ──────────────
  useEffect(() => {
    if (!selectedModule) {
      dispatch({ type: 'CLEAR_CONTENT' });
      return;
    }

    const contentType = getContentType(selectedModule);

    if (contentType === 'page') {
      const rawHtml = selectedModule.content ?? selectedModule.description ?? '';
      const html = addHeadingIds(rawHtml);
      dispatch({ type: 'SET_PAGE_CONTENT', html, toc: extractTocFromHtml(html) });
      return;
    }

    if (contentType === 'resource-markdown') {
      dispatch({ type: 'SET_MARKDOWN', content: 'Markdownファイルの表示は現在準備中です。', loading: false });
      return;
    }

    dispatch({ type: 'CLEAR_CONTENT' });
  }, [selectedModule]);

  // ─── ハンドラ ─────────────────────────────
  const handleModuleSelect = (module: Module) => {
    dispatch({ type: 'SELECT_MODULE', module });
    setSidebarOpen(false);
  };

  const handleTocItemClick = (id: string) => {
    // page は iframe 内の DOM を参照
    const el = iframeRef.current?.contentDocument?.getElementById(id)
      ?? document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const h = doc.documentElement?.scrollHeight;
      if (h) iframe.style.height = h + 'px';
      // same-origin iframeからTOCを抽出（cross-originは catch で無視）
      const headings = doc.querySelectorAll('h1, h2, h3, h4');
      let counter = 0;
      const toc: TocItem[] = Array.from(headings)
        .map(el => {
          if (!el.id) el.id = `toc-heading-${counter++}`;
          return {
            id: el.id,
            text: el.textContent?.trim() ?? '',
            level: parseInt(el.tagName[1], 10),
          };
        })
        .filter(item => item.text.length > 0);
      if (toc.length > 0) dispatch({ type: 'SET_TOC', toc });
    } catch { /* cross-origin の場合は何もしない */ }
  };

  const handleAiQuestion = () => sendAiMessage();

  // ─── コンテンツ描画 ───────────────────────
  const renderContent = () => {
    if (!selectedModule) return <EmptyPlaceholder />;

    const contentType = getContentType(selectedModule);

    switch (contentType) {
      // ── mod/page ────────────────────────────
      case 'page': {
        const rawFallback = selectedModule.content ?? selectedModule.description ?? '';
        const html = processedHtml || rawFallback;
        if (!html) {
          return <p className="text-brand-muted">コンテンツがありません。</p>;
        }
        // content が生URL、または <p>URL</p> などURLのみのHTML の場合は src で読み込む
        const urlMatch = html.trim().match(/^(?:<[^>]+>\s*)*?(https?:\/\/[^\s<"']+?)(?:\s*<\/[^>]+>)*\s*$/i);
        const extractedUrl = urlMatch?.[1];
        if (extractedUrl) {
          if (contentToken === null) {
            return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" /></div>;
          }
          if (iframeError) {
            return (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-brand-muted">
                <FileText className="w-12 h-12 opacity-25" />
                <p className="text-sm font-medium">コンテンツが見つかりませんでした</p>
                <p className="text-xs opacity-50">このコンテンツは現在利用できないか、移動された可能性があります。</p>
              </div>
            );
          }
          const srcUrl = contentToken
            ? `${extractedUrl}${extractedUrl.includes('?') ? '&' : '?'}cf_token=${encodeURIComponent(contentToken)}`
            : extractedUrl;
          return (
            <iframe
              ref={iframeRef}
              src={srcUrl}
              onLoad={handleIframeLoad}
              title={selectedModule.name}
              className="w-full border-none"
              style={{ minHeight: '200px', height: '85vh' }}
            />
          );
        }
        const srcdoc = buildSrcdoc(html);
        return (
          <iframe
            ref={iframeRef}
            srcDoc={srcdoc}
            sandbox="allow-scripts allow-same-origin"
            onLoad={handleIframeLoad}
            title={selectedModule.name}
            className="w-full border-none"
            style={{ minHeight: '200px' }}
          />
        );
      }

      // ── mod/label ───────────────────────────
      case 'label':
        return (
          <div
            className="moodle-content"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedModule.description || '') }}
          />
        );

      // ── mod/url ─────────────────────────────
      case 'url': {
        const externalUrl = (() => {
          if (selectedModule.externalurl) return selectedModule.externalurl;
          const fromContents =
            selectedModule.contents?.find(c => c.type === 'url')?.fileurl ||
            selectedModule.contents?.[0]?.fileurl;
          if (fromContents) return fromContents;
          // content / description が生URL（https://...）の場合はそのまま使用
          for (const raw of [selectedModule.content, selectedModule.description]) {
            const text = raw?.trim();
            if (!text) continue;
            if (/^https?:\/\//i.test(text)) return text;
            // HTML の <a href> からURLを抽出
            const doc = new DOMParser().parseFromString(text, 'text/html');
            const href = doc.querySelector('a[href]')?.getAttribute('href');
            if (href) return href;
          }
          return undefined;
        })();
        if (!externalUrl) {
          return <EmptyPlaceholder />;
        }
        return (
          <iframe
            src={externalUrl}
            sandbox="allow-scripts allow-same-origin allow-forms"
            title={selectedModule.name}
            className="w-full border-none rounded-xl"
            style={{ height: '85vh', minHeight: '400px' }}
          />
        );
      }

      // ── mod/resource（動画）─────────────────
      case 'resource-video': {
        const videoFile = selectedModule.contents?.find(c => isVideoFile(c.filename));
        if (!videoFile) return <EmptyPlaceholder />;
        return (
          <video controls className="w-full rounded-2xl">
            <source src={videoFile.fileurl} type="video/mp4" />
            <source src={videoFile.fileurl} type="video/webm" />
            お使いのブラウザは動画タグをサポートしていません。
          </video>
        );
      }

      // ── mod/resource（Markdown）─────────────
      case 'resource-markdown':
        if (loadingMarkdown) {
          return (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
            </div>
          );
        }
        return markdownContent
          ? <div className="prose max-w-none"><MarkdownRenderer content={markdownContent} /></div>
          : <p className="text-brand-muted">Markdownファイルの読み込みに失敗しました。</p>;

      // ── mod/resource（HTML）─────────────────
      case 'resource-html':
        return (
          <div className="flex flex-col items-center gap-4 py-10">
            <FileText className="w-12 h-12 text-brand opacity-60" />
            <p className="text-sm text-brand-muted">
              HTMLファイルのリソースです。（取得機能は準備中）
            </p>
          </div>
        );

      // ── その他（説明文を表示）───────────────
      case 'resource-other':
      case 'unknown':
      default:
        if (selectedModule.description) {
          return (
            <div
              className="moodle-content"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedModule.description) }}
            />
          );
        }
        return <EmptyPlaceholder />;
    }
  };

  // ─── ローディング / エラー ────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto" />
          <p className="mt-4 text-brand-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-center">
          <p className="text-brand">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 px-6 py-2 rounded-full text-white font-medium bg-brand"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }


  
  // ─── Chapter ナビゲーション用 ───────────────
  const allModules = sections.flatMap(s => s.modules);
  const currentIdx = allModules.findIndex(m => m.id === selectedModule?.id);
  const chapterLabel = currentIdx >= 0 ? `Chapter ${currentIdx + 1}` : '';
  const prevModule  = currentIdx > 0                    ? allModules[currentIdx - 1] : null;
  const nextModule  = currentIdx < allModules.length - 1 ? allModules[currentIdx + 1] : null;

  // ─── メインレンダリング ───────────────────
  return (
    <div className="relative min-h-screen bg-brand-bg">

      {/* ─── 背景装飾（グラデーション円） ──── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute rounded-full opacity-10" style={{ width: 900, height: 900, background: 'radial-gradient(circle, #e17079 0%, transparent 70%)', top: -300, left: -350, filter: 'blur(40px)' }} />
        <div className="absolute rounded-full opacity-10" style={{ width: 900, height: 900, background: 'radial-gradient(circle, #fdeae2 0%, transparent 70%)', top: -200, right: -400, filter: 'blur(40px)' }} />
        <div className="absolute rounded-full opacity-10" style={{ width: 900, height: 900, background: 'radial-gradient(circle, #f29367 0%, transparent 70%)', bottom: -200, left: '35%', filter: 'blur(40px)' }} />
      </div>

      {/* ─── WebCoach グローバルヘッダー ──── */}
      <AppHeader userName={user?.username || 'User'} />

      {/* ─── ヘッダー ─────────────────────── */}
      <header
        className="sticky top-[60px] sm:top-[80px] z-30 h-20 bg-white border-b border-brand-border"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <div className="max-w-[1400px] mx-auto h-full flex items-center justify-between px-4 sm:px-6">
          {/* 左: 戻るボタン + 赤区切り + チャプター情報 */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#e0d8d4' }}
            >
              <ArrowLeft className="w-5 h-5 text-brand-text" />
            </button>
            <div className="w-0.5 h-10 rounded-full flex-shrink-0 bg-brand" />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate text-brand">
                {chapterLabel || courseName}
              </p>
              <p className="text-base font-bold truncate text-brand-text">
                {selectedModule ? selectedModule.name : courseName}
              </p>
            </div>
          </div>

          {/* 右: モバイルメニュー + 完了ボタン */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#e0d8d4' }}
            >
              <Menu className="w-5 h-5 text-brand-text" />
            </button>
            {selectedModule && completedIds.has(selectedModule.id) ? (
              <button
                onClick={() => handleToggleComplete(false)}
                disabled={completing}
                className="flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-opacity hover:opacity-80 disabled:opacity-60 disabled:cursor-default"
                style={{ background: '#F0EAE6', color: '#7E6E68', border: '1px solid #D8CEC8' }}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {completing ? '処理中...' : '完了を取り消す'}
                </span>
              </button>
            ) : (
              <button
                onClick={() => handleToggleComplete(true)}
                disabled={completing}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-white font-bold text-sm transition-opacity hover:opacity-90 bg-brand-gradient disabled:opacity-60 disabled:cursor-default"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {completing ? '送信中...' : '完了にする'}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── ボディ ───────────────────────── */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-8 flex gap-6 items-start">

        {/* メインコンテンツ */}
        <div className="flex-1 min-w-0">
          <div
            className="bg-white rounded-3xl flex flex-col overflow-hidden"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #F0EAE6' }}
          >
            {/* ─ コンテンツエリア ─ */}
            <div className="p-4 sm:p-6">
              {processedHtml && selectedModule && getContentType(selectedModule) === 'page' && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={openInNewTab}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: '#F0EAE6', color: '#7E6E68', border: '1px solid #D8CEC8' }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    新しいタブで開く
                  </button>
                </div>
              )}
              <div
                className="rounded-2xl p-4 sm:p-6"
                style={{ background: '#fafafa', minHeight: '360px' }}
              >
                {renderContent()}
              </div>
            </div>

            {/* ─ 完了ボタン ─ */}
            <div className="flex justify-center pb-6 px-8">
              {selectedModule && completedIds.has(selectedModule.id) ? (
                <button
                  onClick={() => handleToggleComplete(false)}
                  disabled={completing}
                  className="flex items-center gap-2 px-12 py-3 rounded-full font-bold text-base transition-opacity hover:opacity-80 disabled:opacity-60 disabled:cursor-default"
                  style={{ background: '#F0EAE6', color: '#7E6E68', border: '1px solid #D8CEC8' }}
                >
                  <RotateCcw className="w-5 h-5" />
                  {completing ? '処理中...' : '完了を取り消す'}
                </button>
              ) : (
                <button
                  onClick={() => handleToggleComplete(true)}
                  disabled={completing}
                  className="flex items-center gap-2 px-12 py-3 rounded-full text-white font-bold text-base transition-opacity hover:opacity-90 bg-brand-gradient disabled:opacity-60 disabled:cursor-default"
                >
                  <CheckCircle className="w-5 h-5" />
                  {completing ? '送信中...' : '学習を完了する'}
                </button>
              )}
            </div>

            {/* ─ 前後チャプター ナビゲーション ─ */}
            <div className="flex items-center justify-between border-t border-brand-border px-8 py-5">
              {prevModule ? (
                <span
                  onClick={() => handleModuleSelect(prevModule)}
                  className="text-sm text-brand-muted hover:text-brand-text cursor-pointer transition-colors"
                >
                  ← 前のチャプターに戻る
                </span>
              ) : (
                <span />
              )}
              {nextModule ? (
                <span
                  onClick={() => handleModuleSelect(nextModule)}
                  className="text-sm text-brand-muted hover:text-brand-text cursor-pointer transition-colors"
                >
                  次のチャプターに進む →
                </span>
              ) : (
                <span />
              )}
            </div>
          </div>
        </div>

        {/* 右サイドバー（デスクトップ） */}
        <div className="hidden lg:flex flex-col gap-0 w-80 flex-shrink-0 sticky top-[160px] rounded-3xl overflow-y-auto" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #F0EAE6', maxHeight: 'calc(100vh - 170px)' }}>
          <TocPanel pageToc={pageToc} onTocItemClick={handleTocItemClick} />
          <div className="border-t border-brand-border">
            <AiCoachPanel
              aiMessages={aiMessages}
              aiLoading={aiLoading}
              aiQuestion={aiQuestion}
              setAiQuestion={setAiQuestion}
              handleAiKeyPress={handleAiKeyPress}
              onSend={handleAiQuestion}
              chatEndRef={chatEndRef}
            />
          </div>
        </div>
      </div>

      {/* モバイルサイドバー */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-40"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="absolute right-0 top-0 h-full w-80 overflow-y-auto p-4 flex flex-col gap-4 bg-brand-bg"
          >
            <div className="flex items-center justify-between py-2">
              <span className="font-bold text-brand-text">メニュー</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-9 h-9 rounded-full border border-[#e0d8d4] flex items-center justify-center"
              >
                <X className="w-4 h-4 text-brand-text" />
              </button>
            </div>
            <TocPanel pageToc={pageToc} onTocItemClick={handleTocItemClick} mobile />
            <AiCoachPanel
              aiMessages={aiMessages}
              aiLoading={aiLoading}
              aiQuestion={aiQuestion}
              setAiQuestion={setAiQuestion}
              handleAiKeyPress={handleAiKeyPress}
              onSend={handleAiQuestion}
              chatEndRef={chatEndRef}
              mobile
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 補助コンポーネント ────────────────────

function EmptyPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16 text-brand-muted">
      <FileText className="w-14 h-14 mb-4 opacity-20" />
      <p className="text-sm">コンテンツがありません</p>
    </div>
  );
}

interface TocPanelProps {
  pageToc: TocItem[];
  onTocItemClick: (id: string) => void;
  mobile?: boolean;
}

function TocPanel({ pageToc, onTocItemClick, mobile = false }: TocPanelProps) {
  return (
    <div className={`bg-white ${mobile ? 'rounded-2xl shadow-sm' : ''} overflow-hidden`}>
      <div className="flex items-center gap-2 px-6 py-4 bg-brand-bg border-b border-brand-border">
        <AlignJustify className="w-4 h-4 text-brand" />
        <span className="font-bold text-brand-muted" style={{ fontSize: '15px' }}>目次</span>
      </div>
      <div className="overflow-y-auto p-3" style={{ maxHeight: '320px' }}>
        {pageToc.length > 0 ? (
          <div className="space-y-0.5">
            {pageToc.map(item => (
              <div
                key={item.id}
                onClick={() => onTocItemClick(item.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-left hover:bg-orange-50 transition-colors cursor-pointer select-none"
                style={{ paddingLeft: `${(item.level - 1) * 14 + 12}px` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: item.level === 1 ? '#e86d78' : item.level === 2 ? '#fa9262' : '#d0cac6' }}
                />
                <span
                  className="text-xs truncate text-brand-text"
                  style={{ fontWeight: item.level <= 2 ? 600 : 400 }}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <AlignJustify className="w-8 h-8 opacity-20 text-brand-muted" />
            <p className="text-xs text-center text-brand-subtle">
              このコンテンツに<br />目次はありません
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface AiCoachPanelProps {
  aiMessages: ChatMessage[];
  aiLoading: boolean;
  aiQuestion: string;
  setAiQuestion: (v: string) => void;
  handleAiKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  mobile?: boolean;
}

function AiCoachPanel({ aiMessages, aiLoading, aiQuestion, setAiQuestion, handleAiKeyPress, onSend, chatEndRef, mobile = false }: AiCoachPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!aiQuestion && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [aiQuestion]);

  return (
    <div className={`bg-white ${mobile ? 'rounded-2xl shadow-sm' : ''} overflow-hidden`}>
      <div className="flex items-center justify-between px-6 py-4 bg-brand-bg border-b border-brand-border">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-brand" />
          <span className="font-bold text-brand-muted" style={{ fontSize: '15px' }}>AIコーチ</span>
        </div>
      </div>
      <div className="px-6 py-5 space-y-3 overflow-y-auto" style={{ background: '#fafafa', maxHeight: '280px' }}>
        {aiMessages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white ${msg.role === 'user' ? 'bg-[#1976d2]' : 'bg-brand'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`rounded-2xl px-4 py-3 shadow-sm max-w-xs text-sm ${msg.role === 'user' ? 'bg-brand text-white' : 'bg-white text-brand-muted'}`}>
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} compact />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        {aiLoading && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white bg-brand"><Bot className="w-4 h-4" /></div>
            <div className="rounded-2xl px-4 py-3 shadow-sm bg-white">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-brand-muted">考え中...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="px-6 py-4 bg-white border-t border-brand-border">
        <div className="flex items-end gap-2 px-4 py-2 rounded-2xl bg-brand-bg">
          <textarea
            ref={textareaRef}
            placeholder="質問を入力..."
            value={aiQuestion}
            rows={1}
            onChange={e => {
              setAiQuestion(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleAiKeyPress}
            className="flex-1 bg-transparent outline-none text-sm text-brand-text resize-none overflow-hidden leading-5 py-1"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            onClick={onSend}
            disabled={!aiQuestion.trim() || aiLoading}
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 transition-colors ${aiQuestion.trim() && !aiLoading ? 'bg-brand' : 'bg-[#d0cac6]'}`}
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CourseContentPage;
