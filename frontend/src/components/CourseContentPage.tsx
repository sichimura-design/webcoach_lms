import { useState, useEffect, useRef, useReducer } from 'react';
import DOMPurify from 'dompurify';
import { bffClient } from '../services/bffClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAiChat, ChatMessage } from '../hooks/useAiChat';
import { FileText, ExternalLink, Menu, X, User } from 'lucide-react';
import Encoding from 'encoding-japanese';
import MarkdownRenderer from './MarkdownRenderer';
import { AppHeader, CharacterAvatar } from './shared';
import { useProgressionStore } from '../store/progressionStore';
import { EXP_RULES } from '../utils/progression';

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
  processedHtml: string;
}

type ContentAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; sections: Section[]; courseName: string; initialModule?: Module | null }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'SELECT_MODULE'; module: Module }
  | { type: 'TOGGLE_SECTION'; sectionId: number }
  | { type: 'SET_PAGE_CONTENT'; html: string }
  | { type: 'SET_MARKDOWN'; content: string; loading: boolean }
  | { type: 'CLEAR_CONTENT' };

const initialContentState: ContentState = {
  sections: [],
  loading: true,
  error: null,
  selectedModule: null,
  expandedSections: [],
  courseName: '',
  markdownContent: '',
  loadingMarkdown: false,
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
      return { ...state, selectedModule: action.module, processedHtml: '', markdownContent: '' };
    case 'TOGGLE_SECTION':
      return {
        ...state,
        expandedSections: state.expandedSections.includes(action.sectionId)
          ? state.expandedSections.filter(id => id !== action.sectionId)
          : [...state.expandedSections, action.sectionId],
      };
    case 'SET_PAGE_CONTENT':
      return { ...state, processedHtml: action.html, markdownContent: '' };
    case 'SET_MARKDOWN':
      return { ...state, markdownContent: action.content, loadingMarkdown: action.loading, processedHtml: '' };
    case 'CLEAR_CONTENT':
      return { ...state, processedHtml: '', markdownContent: '' };
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
    markdownContent, loadingMarkdown, processedHtml,
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
  const awardExp = useProgressionStore((s) => s.awardExp);

  // 動画／テキスト表示モード（design_handoffのレッスン画面トグルに対応）
  const contentType = selectedModule ? getContentType(selectedModule) : null;
  const hasVideo = contentType === 'resource-video';
  const videoFile = selectedModule?.contents?.find(c => isVideoFile(c.filename));
  const [lessonMode, setLessonMode] = useState<'video' | 'text'>('video');
  useEffect(() => {
    setLessonMode(hasVideo ? 'video' : 'text');
  }, [selectedModule?.id, hasVideo]);
  const isTextMode = !hasVideo || lessonMode === 'text';

  // 記事本文をドラッグ選択して「AIに質問」できるようにするフローティングボタン
  const articleRef = useRef<HTMLDivElement>(null);
  const aiPanelAnchorRef = useRef<HTMLDivElement>(null);
  const [quoteBtn, setQuoteBtn] = useState<{ top: number; left: number; text: string } | null>(null);

  const handleArticleMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (text.length >= 2 && text.length <= 300 && sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setQuoteBtn({ top: rect.top - 42, left: rect.left, text });
    } else {
      setQuoteBtn(null);
    }
  };

  useEffect(() => {
    if (!quoteBtn) return;
    const clear = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('[data-quote-btn]')) return;
      setQuoteBtn(null);
    };
    window.addEventListener('mousedown', clear);
    return () => window.removeEventListener('mousedown', clear);
  }, [quoteBtn]);

  const handleQuoteAsk = () => {
    if (!quoteBtn) return;
    setAiQuestion(`「${quoteBtn.text}」について教えてください`);
    setQuoteBtn(null);
    if (window.innerWidth < 1024) {
      setSidebarOpen(true);
    } else {
      requestAnimationFrame(() => aiPanelAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
  };

  const handleToggleComplete = async (markAsComplete: boolean) => {
    if (!selectedModule || completing) return;
    setCompleting(true);
    try {
      await bffClient.markActivityComplete(selectedModule.id, markAsComplete);
      const newCompletedIds = new Set(completedIds);
      if (markAsComplete) {
        newCompletedIds.add(selectedModule.id);
        awardExp(`lesson:${selectedModule.id}`, EXP_RULES.LESSON_COMPLETE);
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
      const html = selectedModule.content ?? selectedModule.description ?? '';
      dispatch({ type: 'SET_PAGE_CONTENT', html });
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

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const h = doc.documentElement?.scrollHeight;
      if (h) iframe.style.height = h + 'px';
    } catch { /* cross-origin の場合は何もしない */ }
  };

  const handleAiQuestion = () => sendAiMessage();

  // ─── 記事本文の描画（動画ブロックは呼び出し側で別途描画） ──
  const renderArticleContent = () => {
    if (!selectedModule) return <EmptyPlaceholder />;

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

      // ── mod/resource（動画）─── 補足テキストのみ（動画本体は上のブロックで描画）
      case 'resource-video':
        return selectedModule.description
          ? (
            <div
              className="moodle-content"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedModule.description) }}
            />
          )
          : null;

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
  const chapterLabel = currentIdx >= 0 ? `Lesson ${currentIdx + 1}` : '';
  const prevModule  = currentIdx > 0                    ? allModules[currentIdx - 1] : null;
  const nextModule  = currentIdx < allModules.length - 1 ? allModules[currentIdx + 1] : null;
  const isCompleted = !!selectedModule && completedIds.has(selectedModule.id);
  const ctaLabel = hasVideo && lessonMode === 'video' ? 'このレッスンを完了' : '読み終えて次へ';

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

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 py-8">

        {/* ─── ブレッドクラム＋タイトル＋モード切替 ─ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#B78F98' }}>
              <span onClick={onBack} style={{ color: '#E0213A', fontWeight: 700, cursor: 'pointer' }}>{courseName}</span>
              {chapterLabel && <> ／ {chapterLabel}</>}
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 23, fontWeight: 900, color: '#20141A' }}>
              {chapterLabel ? `${chapterLabel}：` : ''}{selectedModule ? selectedModule.name : courseName}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            {hasVideo && (
              <span
                onClick={() => setLessonMode(m => (m === 'video' ? 'text' : 'video'))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff', border: '1px solid #EDD8DB', borderRadius: 999, padding: '9px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(200,90,110,.08)' }}
              >
                {lessonMode === 'video' ? '🎥 動画＋テキスト' : '🗎 テキスト教材'} ⇄
              </span>
            )}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
              style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid #EDD8DB', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Menu className="w-5 h-5" style={{ color: '#20141A' }} />
            </button>
            <button
              onClick={onBack}
              style={{ background: '#fff', color: '#E0213A', border: '1.5px solid #EEC0C4', borderRadius: 999, padding: '9px 18px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              コースに戻る
            </button>
          </div>
        </div>

        {/* ─── ボディ ───────────────────────── */}
        <div className="grid" style={{ gridTemplateColumns: '1fr 330px', gap: 22, alignItems: 'start', marginTop: 18 }}>

          {/* メインコンテンツ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>

            {hasVideo && lessonMode === 'video' && videoFile && (
              <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%,#6E2536,#3A1220 75%)', boxShadow: '0 16px 40px rgba(90,20,35,.3)' }}>
                <video controls style={{ width: '100%', display: 'block', aspectRatio: '16/9' }}>
                  <source src={videoFile.fileurl} type="video/mp4" />
                  <source src={videoFile.fileurl} type="video/webm" />
                  お使いのブラウザは動画タグをサポートしていません。
                </video>
              </div>
            )}

            {isTextMode && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: '#FDF0F2', borderRadius: 14, padding: '12px 18px', fontSize: 12 }}>
                <span style={{ color: '#C24358', fontWeight: 700 }}>
                  🗎 {hasVideo ? 'このレッスンには動画があります（🎥動画＋テキストに切り替えるとご覧いただけます）' : 'このレッスンはテキスト教材です（動画がある場合はここに表示されます）'}
                </span>
                <span style={{ color: '#B78F98' }}>動画：{hasVideo ? 'あり' : 'なし'}</span>
              </div>
            )}

            <div
              ref={articleRef}
              onMouseUp={handleArticleMouseUp}
              className="px-5 py-6 sm:px-[34px] sm:py-[28px]"
              style={{ background: '#fff', borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FBF4F5', borderRadius: 10, padding: '8px 13px', fontSize: 11, color: '#A05A6B', marginBottom: 16 }}>
                ✦ 分からない文があったら、<b>ドラッグで選択</b>して「AIに質問」を押してね
              </div>
              {contentType === 'page' && processedHtml && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={openInNewTab}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: '#F0EAE6', color: '#7A7392', border: '1px solid #D8CEC8' }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    新しいタブで開く
                  </button>
                </div>
              )}
              {hasVideo && lessonMode === 'video' && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#E0213A', marginBottom: 14 }}>🗎 動画の補足テキスト</div>
              )}
              {renderArticleContent()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => (prevModule ? handleModuleSelect(prevModule) : onBack())}
                style={{ background: '#fff', color: '#E0213A', border: '1.5px solid #EEC0C4', borderRadius: 999, padding: '12px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                ← 前のレッスン
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {isCompleted ? (
                  <>
                    <button
                      onClick={() => (nextModule ? handleModuleSelect(nextModule) : onBack())}
                      style={{ background: '#F0EAE6', color: '#7A7392', border: '1px solid #D8CEC8', borderRadius: 999, padding: '13px 26px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                    >
                      ✓ 完了済み・{nextModule ? '次のレッスンへ' : 'コースに戻る'}
                    </button>
                    <span onClick={() => handleToggleComplete(false)} style={{ fontSize: 11, color: '#B78F98', cursor: 'pointer', textDecoration: 'underline' }}>
                      完了を取り消す
                    </span>
                  </>
                ) : (
                  <button
                    onClick={() => handleToggleComplete(true)}
                    disabled={completing}
                    className="disabled:opacity-60 disabled:cursor-default"
                    style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', color: '#fff', border: 'none', borderRadius: 999, padding: '13px 26px', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 10px 26px rgba(224,33,58,.4)' }}
                  >
                    {completing ? '送信中...' : ctaLabel} →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 右サイドバー（デスクトップ） */}
          <div ref={aiPanelAnchorRef} className="hidden lg:flex flex-col" style={{ gap: 16 }}>
            {isTextMode && (
              <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 900 }}>
                  <span>このレッスンの進捗</span><span style={{ color: '#E0213A' }}>{isCompleted ? 100 : 0}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#F5E4E6', overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ width: `${isCompleted ? 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#F0546A,#E0213A)', borderRadius: 999 }} />
                </div>
              </div>
            )}
            <ChaptersPanel modules={allModules} currentId={selectedModule?.id} completedIds={completedIds} onSelect={handleModuleSelect} />
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
            {isTextMode && (
              <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 4px 14px rgba(0,0,0,.06)', padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 900 }}>
                  <span>このレッスンの進捗</span><span style={{ color: '#E0213A' }}>{isCompleted ? 100 : 0}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#F5E4E6', overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ width: `${isCompleted ? 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#F0546A,#E0213A)', borderRadius: 999 }} />
                </div>
              </div>
            )}
            <ChaptersPanel modules={allModules} currentId={selectedModule?.id} completedIds={completedIds} onSelect={handleModuleSelect} mobile />
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

      {/* 選択テキストから直接AIに質問できるフローティングボタン */}
      {quoteBtn && (
        <button
          data-quote-btn
          onClick={handleQuoteAsk}
          style={{ position: 'fixed', top: quoteBtn.top, left: quoteBtn.left, zIndex: 60, background: '#E0213A', color: '#fff', border: 'none', borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 20px rgba(224,33,58,.35)' }}
        >
          ✦ AIに質問
        </button>
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

interface ChaptersPanelProps {
  modules: Module[];
  currentId?: number;
  completedIds: Set<number>;
  onSelect: (m: Module) => void;
  mobile?: boolean;
}

function ChaptersPanel({ modules, currentId, completedIds, onSelect, mobile = false }: ChaptersPanelProps) {
  const completedCount = modules.filter(m => completedIds.has(m.id)).length;
  return (
    <div className={mobile ? 'rounded-2xl' : ''} style={{ background: '#fff', borderRadius: 18, boxShadow: mobile ? '0 4px 14px rgba(0,0,0,.06)' : '0 10px 30px rgba(190,60,70,.08)', padding: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 900 }}>チャプター</span>
        <span style={{ fontSize: 11, color: '#B78F98' }}>{completedCount}/{modules.length} 完了</span>
      </div>
      {modules.map((m, i) => {
        const isDone = completedIds.has(m.id);
        const isActive = m.id === currentId;
        return (
          <div
            key={m.id}
            onClick={() => onSelect(m)}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
              background: isActive ? '#FDF0F2' : undefined,
            }}
          >
            <span
              style={{
                width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: isDone ? '#E0213A' : '#F3E7EA',
                color: isDone ? '#fff' : isActive ? '#E0213A' : '#B7A0A7',
                border: isActive && !isDone ? '2px solid #E0213A' : undefined,
              }}
            >
              {isDone ? '✓' : i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#20141A' }}>{m.name}</div>
              <div style={{ fontSize: 10, color: '#B7A0A7', marginTop: 2 }}>{isDone ? '完了' : isActive ? '学習中' : ''}</div>
            </div>
            <span style={{ fontSize: 12 }}>{isDone ? '✅' : isActive ? '▶' : ''}</span>
          </div>
        );
      })}
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

  const canSend = !!aiQuestion.trim() && !aiLoading;

  return (
    <div className={mobile ? 'rounded-2xl' : ''} style={{ background: '#fff', borderRadius: 18, boxShadow: mobile ? '0 4px 14px rgba(0,0,0,.06)' : '0 10px 30px rgba(190,60,70,.08)', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 900 }}><span style={{ color: '#E0213A' }}>✦</span> つまずいたらAIに質問</div>
      {aiMessages.length > 0 && (
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 240 }}>
          {aiMessages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'user' ? (
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white" style={{ background: '#1976d2' }}>
                  <User className="w-3.5 h-3.5" />
                </div>
              ) : (
                <CharacterAvatar state="idle" size={28} />
              )}
              <div className="rounded-2xl px-3 py-2 text-xs max-w-[200px]" style={{ background: msg.role === 'user' ? '#E0213A' : '#FBF2F4', color: msg.role === 'user' ? '#fff' : '#4A3B42' }}>
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
              <CharacterAvatar state="thinking" size={28} />
              <div className="rounded-2xl px-3 py-2 text-xs" style={{ background: '#FBF2F4', color: '#A05A6B' }}>考え中...</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FBF2F4', borderRadius: 999, padding: '6px 6px 6px 16px' }}>
        <textarea
          ref={textareaRef}
          placeholder="このレッスンについて質問…"
          value={aiQuestion}
          rows={1}
          onChange={e => {
            setAiQuestion(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={handleAiKeyPress}
          className="flex-1 bg-transparent outline-none resize-none overflow-hidden"
          style={{ fontSize: 12, color: '#20141A', lineHeight: '1.5', maxHeight: 120, overflowY: 'auto' }}
        />
        <span
          onClick={canSend ? onSend : undefined}
          style={{ width: 30, height: 30, borderRadius: '50%', background: canSend ? '#E0213A' : '#d0cac6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, cursor: canSend ? 'pointer' : 'default' }}
        >
          ➤
        </span>
      </div>
    </div>
  );
}

export default CourseContentPage;
