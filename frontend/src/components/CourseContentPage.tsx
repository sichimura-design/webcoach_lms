import { useState, useEffect, useRef, useReducer, useMemo, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import DOMPurify from 'dompurify';
import { bffClient } from '../services/bffClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAiChat, ChatMessage, PendingImage } from '../hooks/useAiChat';
import { useNoteCapture } from '../hooks/useNoteCapture';
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
  Paperclip,
  ImageOff,
  StickyNote,
  NotebookPen,
} from 'lucide-react';
import Encoding from 'encoding-japanese';
import MarkdownRenderer from './MarkdownRenderer';
import { AppHeader } from './shared';
import { parseDifyMessage } from '../utils/difyButtons';
import { color as themeColor } from '../theme/webcoachTheme';
import LessonFloatingActions from './learning/LessonFloatingActions';
import NoteTargetPicker from './notes/NoteTargetPicker';
import type { NoteSourceRef } from '../types/notes';

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
<body>${cleanedBody}</body></html>`;
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
<body>${bodyHtml}</body></html>`;
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
  // label/resource-other 等、メインDOMへ直接描画するコンテンツのコンテナ
  // （画像拡大クリック検知・テキスト選択検知のスコープに使う）
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // 画像タップ拡大
  const [zoomTarget, setZoomTarget] = useState<{ src: string; alt: string } | null>(null);

  // 選択テキストのマイノート引用
  const [quoteSelection, setQuoteSelection] = useState<{ text: string; rect: DOMRect } | null>(null);
  const noteCapture = useNoteCapture();

  // レッスン完了コンフェッティ
  const [showConfetti, setShowConfetti] = useState(false);

  // AI コーチ
  const {
    messages: aiMessages, input: aiQuestion, setInput: setAiQuestion, loading: aiLoading,
    messagesEndRef: chatEndRef, sendMessage: sendAiMessage, handleKeyPress: handleAiKeyPress,
    pendingImage: aiPendingImage, imageError: aiImageError, handleImageSelect: handleAiImageSelect,
    clearPendingImage: clearAiPendingImage,
  } = useAiChat();

  // 教材(page/url/resource)を開いたら、courseid/cmidをネイティブ列として記録する自前イベント
  // (course_material_viewed)を発火させる。SPAはMoodleの実ページコントローラを経由しないため、
  // この呼び出しをしない限りMoodle側には一切アクセス記録が残らない。
  const moduleViewLoggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.userid || !selectedModule) return;
    const moduleType = selectedModule.modname;
    if (moduleType !== 'page' && moduleType !== 'url' && moduleType !== 'resource') return;

    const key = `${user.userid}:${selectedModule.id}`;
    if (moduleViewLoggedRef.current === key) return;
    moduleViewLoggedRef.current = key;

    bffClient.logModuleView(user.userid, courseId, selectedModule.id).catch(() => {
      // 閲覧ログの送信失敗は学習体験をブロックしない
    });
  }, [user?.userid, courseId, selectedModule?.id, selectedModule?.modname]);

  // モバイルサイドバー
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 右サイドバー タブ（AIコーチ／メモ）
  const [sidebarTab, setSidebarTab] = useState<'ai' | 'memo'>('ai');

  // 学習メモ
  const [memoContent, setMemoContent] = useState('');
  const [memoStatus, setMemoStatus] = useState<'idle' | 'loading' | 'saving' | 'saved'>('idle');
  const memoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoLoadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedModule || !user) return;
    const key = `${courseId}:${selectedModule.id}`;
    memoLoadedKeyRef.current = key;
    setMemoStatus('loading');
    bffClient.getStudyNote(user.userid, courseId, selectedModule.id)
      .then(note => {
        if (memoLoadedKeyRef.current === key) {
          setMemoContent(note.content);
          setMemoStatus('idle');
        }
      })
      .catch(() => {
        if (memoLoadedKeyRef.current === key) {
          setMemoStatus('idle');
        }
      });
  }, [selectedModule?.id, courseId, user]);

  const handleMemoChange = (value: string) => {
    setMemoContent(value);
    if (!selectedModule || !user) return;
    const targetCourseId = courseId;
    const targetCmid = selectedModule.id;
    if (memoSaveTimer.current) clearTimeout(memoSaveTimer.current);
    memoSaveTimer.current = setTimeout(() => {
      setMemoStatus('saving');
      bffClient.updateStudyNote(user.userid, targetCourseId, targetCmid, { content: value })
        .then(() => setMemoStatus('saved'))
        .catch(() => setMemoStatus('idle'));
    }, 500);
  };

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
      if (markAsComplete) setShowConfetti(true);

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
    setZoomTarget(null);
    setQuoteSelection(null);
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

  // ─── メインDOM直描画コンテンツ（label等）の選択テキスト検知 ──
  useEffect(() => {
    const type = selectedModule ? getContentType(selectedModule) : null;
    if (type !== 'label' && type !== 'resource-other' && type !== 'unknown') return;

    const onMouseUp = () => {
      window.setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? '';
        const container = contentAreaRef.current;
        if (!sel || sel.rangeCount === 0 || !container || text.length < 2 || text.length > 400) {
          setQuoteSelection(null);
          return;
        }
        const range = sel.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) {
          setQuoteSelection(null);
          return;
        }
        setQuoteSelection({ text, rect: range.getBoundingClientRect() });
      }, 0);
    };

    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [selectedModule]);

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

      // ─ 画像タップ拡大／選択テキストのマイノート引用 ─
      // srcdoc（allow-same-origin）は親と同一オリジン扱いになるため、
      // TOC抽出と同様に contentDocument へ直接リスナーを張れる。
      // cross-origin（実URLをそのまま src にする分岐）はこの try 自体が例外で止まるため、
      // 自動的に対象外になる（Moodleフォールバックと同じ制約）。
      doc.addEventListener('click', (e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const node = e.target as HTMLElement | null;
        if (!node) return;
        const anchor = node.closest('a');
        if (anchor && !anchor.classList.contains('lightbox')) return;
        const img = node.closest('img');
        if (!img || img.hasAttribute('data-no-zoom')) return;
        if (anchor) e.preventDefault();
        const src = img.currentSrc || img.getAttribute('src') || '';
        if (!src) return;
        setZoomTarget({ src, alt: img.getAttribute('alt') || '' });
      });

      doc.addEventListener('mouseup', () => {
        window.setTimeout(() => {
          const sel = iframe.contentWindow?.getSelection();
          const text = sel?.toString().trim() ?? '';
          if (!sel || sel.rangeCount === 0 || text.length < 2 || text.length > 400) {
            setQuoteSelection(null);
            return;
          }
          const localRect = sel.getRangeAt(0).getBoundingClientRect();
          const frameRect = iframe.getBoundingClientRect();
          setQuoteSelection({
            text,
            rect: new DOMRect(
              localRect.left + frameRect.left,
              localRect.top + frameRect.top,
              localRect.width,
              localRect.height,
            ),
          });
        }, 0);
      });
    } catch { /* cross-origin の場合は何もしない */ }
  };

  const handleAiQuestion = (overrideMessage?: string) => sendAiMessage(overrideMessage);

  /** label / resource-other 等、メインDOMに直接描画されるコンテンツ内の画像クリックを拾う */
  const handleContentClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const node = e.target as HTMLElement | null;
    if (!node) return;
    const anchor = node.closest('a');
    if (anchor && !anchor.classList.contains('lightbox')) return;
    const img = node.closest('img');
    if (!img || img.hasAttribute('data-no-zoom')) return;
    if (anchor) e.preventDefault();
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (!src) return;
    setZoomTarget({ src, alt: img.getAttribute('alt') || '' });
  };

  const handleQuoteToNote = (text: string) => {
    if (!selectedModule) return;
    const source: NoteSourceRef = {
      courseId,
      courseName,
      lessonId: selectedModule.id,
      lessonTitle: selectedModule.name,
      heading: null,
      blockId: null,
      offset: null,
    };
    noteCapture.capture({
      block: { kind: 'clip', text, source },
      suggestedTitle: selectedModule.name,
      source,
      lessonId: selectedModule.id,
    });
    setQuoteSelection(null);
  };

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
            ref={contentAreaRef}
            className="moodle-content"
            onClickCapture={handleContentClickCapture}
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
              ref={contentAreaRef}
              className="moodle-content"
              onClickCapture={handleContentClickCapture}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedModule.description) }}
            />
          );
        }
        return <EmptyPlaceholder />;
    }
  };

  // ─── 右サイドバー（AIコーチ／メモ タブ） ─────
  const renderSupportPanel = (mobile: boolean) => (
    <div className={mobile ? 'bg-white rounded-2xl shadow-sm overflow-hidden' : ''}>
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 bg-brand-bg">
        <button
          onClick={() => setSidebarTab('ai')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            sidebarTab === 'ai' ? 'bg-brand-gradient text-white' : 'text-brand-muted hover:bg-white'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          AIコーチ
        </button>
        <button
          onClick={() => setSidebarTab('memo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            sidebarTab === 'memo' ? 'bg-brand-gradient text-white' : 'text-brand-muted hover:bg-white'
          }`}
        >
          <StickyNote className="w-3.5 h-3.5" />
          メモ
        </button>
      </div>
      {sidebarTab === 'ai' ? (
        <AiCoachPanel
          aiMessages={aiMessages}
          aiLoading={aiLoading}
          aiQuestion={aiQuestion}
          setAiQuestion={setAiQuestion}
          handleAiKeyPress={handleAiKeyPress}
          onSend={handleAiQuestion}
          chatEndRef={chatEndRef}
          pendingImage={aiPendingImage}
          imageError={aiImageError}
          onImageSelect={handleAiImageSelect}
          onClearImage={clearAiPendingImage}
          mobile={mobile}
        />
      ) : (
        <MemoPanel
          content={memoContent}
          status={memoStatus}
          onChange={handleMemoChange}
          lessonTitle={selectedModule?.name}
          mobile={mobile}
        />
      )}
    </div>
  );

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
            {renderSupportPanel(false)}
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
            {renderSupportPanel(true)}
          </div>
        </div>
      )}

      {/* モバイル用フローティングボタン（デスクトップは右サイドバーが常時表示のため不要） */}
      <div className="lg:hidden">
        <LessonFloatingActions
          hidden={!!quoteSelection}
          onOpenAi={() => { setSidebarTab('ai'); setSidebarOpen(true); }}
          onOpenMemo={() => { setSidebarTab('memo'); setSidebarOpen(true); }}
        />
      </div>

      {/* 画像タップ拡大 */}
      <ImageZoomOverlay target={zoomTarget} onClose={() => setZoomTarget(null)} />

      {/* 選択テキストのマイノート引用ツールバー */}
      {quoteSelection && (
        <QuoteToNoteToolbar
          selection={quoteSelection}
          onQuote={() => handleQuoteToNote(quoteSelection.text)}
        />
      )}

      {/* マイノート引用先ピッカー */}
      {noteCapture.pending && (
        <NoteTargetPicker
          pending={noteCapture.pending}
          busy={noteCapture.saving}
          onPickNote={(noteId) => { void noteCapture.resolvePendingWithNote(noteId); }}
          onCreateNew={() => { void noteCapture.resolvePendingWithNewNote(); }}
          onCancel={noteCapture.cancelPending}
        />
      )}

      {/* レッスン完了コンフェッティ */}
      {showConfetti && <LessonCompletionConfetti onDone={() => setShowConfetti(false)} />}
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
  onSend: (overrideMessage?: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  pendingImage: PendingImage | null;
  imageError: string | null;
  onImageSelect: (file: File) => void;
  onClearImage: () => void;
  mobile?: boolean;
}

function AiCoachPanel({
  aiMessages, aiLoading, aiQuestion, setAiQuestion, handleAiKeyPress, onSend, chatEndRef,
  pendingImage, imageError, onImageSelect, onClearImage, mobile = false,
}: AiCoachPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
              {msg.imageDataUrl && (
                <img src={msg.imageDataUrl} alt="添付画像" className="max-w-full max-h-40 rounded-lg mb-2 object-contain" />
              )}
              {msg.role === 'assistant' ? (
                (() => {
                  const { text, buttons } = parseDifyMessage(msg.content);
                  return (
                    <>
                      <MarkdownRenderer content={text} compact />
                      {buttons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {buttons.map((btn, i) => (
                            <button
                              key={`${btn.value}-${i}`}
                              type="button"
                              disabled={aiLoading}
                              onClick={() => onSend(btn.value)}
                              className="text-xs font-bold rounded-lg px-3 py-2 border border-brand-border bg-brand-bg text-brand hover:bg-brand-bg/80 disabled:opacity-50"
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()
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
        {pendingImage && (
          <div className="mb-2 flex items-center gap-2">
            <img src={pendingImage.dataUrl} alt="添付予定の画像" className="w-12 h-12 rounded-lg object-cover border border-brand-border" />
            <button onClick={onClearImage} className="p-1 text-brand-muted hover:text-brand-text" title="画像を取り消す">
              <ImageOff className="w-4 h-4" />
            </button>
          </div>
        )}
        {imageError && <p className="text-xs text-red-500 mb-2">{imageError}</p>}
        <div className="flex items-end gap-2 px-4 py-2 rounded-2xl bg-brand-bg">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onImageSelect(file);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={aiLoading}
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-brand-muted hover:text-brand disabled:opacity-50 transition-colors"
            title="画像を添付"
          >
            <Paperclip className="w-4 h-4" />
          </button>
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
            onPaste={e => {
              const items = e.clipboardData?.items;
              if (!items) return;
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                  const file = items[i].getAsFile();
                  if (file) {
                    e.preventDefault();
                    onImageSelect(file);
                  }
                  break;
                }
              }
            }}
            className="flex-1 bg-transparent outline-none text-sm text-brand-text resize-none overflow-hidden leading-5 py-1"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            onClick={() => onSend()}
            disabled={(!aiQuestion.trim() && !pendingImage) || aiLoading}
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 transition-colors ${(aiQuestion.trim() || pendingImage) && !aiLoading ? 'bg-brand' : 'bg-[#d0cac6]'}`}
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface MemoPanelProps {
  content: string;
  status: 'idle' | 'loading' | 'saving' | 'saved';
  onChange: (value: string) => void;
  lessonTitle?: string;
  mobile?: boolean;
}

function MemoPanel({ content, status, onChange, lessonTitle, mobile = false }: MemoPanelProps) {
  const statusLabel =
    status === 'saving' ? '保存中…' : status === 'saved' ? '自動保存済み' : '自動保存';

  return (
    <div className={`bg-white ${mobile ? 'rounded-2xl shadow-sm' : ''} overflow-hidden`}>
      <div className="flex items-center justify-between px-6 py-4 bg-brand-bg border-b border-brand-border">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-brand" />
          <span className="font-bold text-brand-muted" style={{ fontSize: '15px' }}>メモ</span>
        </div>
        <span className="text-xs text-brand-subtle">{statusLabel}</span>
      </div>
      <div className="px-6 py-5" style={{ background: '#fafafa' }}>
        <textarea
          value={content}
          onChange={e => onChange(e.target.value)}
          placeholder="教材を見ながら、気づいたこと・試したいことを書く…"
          className="w-full bg-white rounded-2xl px-4 py-3 text-sm text-brand-text outline-none border border-brand-border resize-none"
          style={{ minHeight: '220px' }}
        />
        {lessonTitle && (
          <p className="mt-2 text-xs text-brand-subtle">「{lessonTitle}」に保存</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 画像タップ拡大（iframe内 / メインDOM直描画コンテンツの両方から呼ばれる）
// ─────────────────────────────────────────

interface ImageZoomOverlayProps {
  target: { src: string; alt: string } | null;
  onClose: () => void;
}

function ImageZoomOverlay({ target, onClose }: ImageZoomOverlayProps) {
  useEffect(() => {
    if (!target) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [target, onClose]);

  if (!target) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={target.alt || '画像の拡大表示'}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(20,10,10,.88)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        cursor: 'zoom-out',
        animation: 'wcFadeIn .16s ease-out',
      }}
    >
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 44,
          height: 44,
          borderRadius: 9999,
          border: 'none',
          background: 'rgba(255,255,255,.14)',
          color: '#FFFFFF',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <X size={22} />
      </button>

      <img
        src={target.src}
        alt={target.alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'min(96vw, 1400px)',
          maxHeight: '92vh',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain',
          borderRadius: 8,
          cursor: 'default',
        }}
      />

      {target.alt && (
        <p style={{ margin: 0, maxWidth: 'min(96vw, 1400px)', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.82)' }}>
          {target.alt}
        </p>
      )}
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────
// 選択テキストのマイノート引用ツールバー
// ─────────────────────────────────────────

interface QuoteToNoteToolbarProps {
  selection: { text: string; rect: DOMRect };
  onQuote: () => void;
}

const QUOTE_TOOLBAR_WIDTH = 150;
const QUOTE_TOOLBAR_HEIGHT = 40;

function QuoteToNoteToolbar({ selection, onQuote }: QuoteToNoteToolbarProps) {
  const { rect } = selection;
  const left = Math.max(
    10,
    Math.min(window.innerWidth - QUOTE_TOOLBAR_WIDTH - 10, rect.left + rect.width / 2 - QUOTE_TOOLBAR_WIDTH / 2),
  );
  // ヘッダーが画面上部に固定されているため、選択位置が上端に近ければ下へ回り込ませる
  const above = rect.top - QUOTE_TOOLBAR_HEIGHT - 8;
  const top = above > 90 ? above : rect.bottom + 8;

  return (
    <div
      data-selection-ui
      role="toolbar"
      aria-label="選択した文章への操作"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 80,
        borderRadius: 10,
        background: '#222A37',
        boxShadow: '0 16px 48px rgba(33,42,57,.24)',
      }}
    >
      <button
        type="button"
        onClick={onQuote}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: QUOTE_TOOLBAR_HEIGHT,
          padding: '0 14px',
          border: 0,
          borderRadius: 10,
          background: 'transparent',
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <NotebookPen size={14} style={{ color: themeColor.primarySoft }} />
        メモに引用
      </button>
    </div>
  );
}

// ─────────────────────────────────────────
// レッスン完了コンフェッティ
// ─────────────────────────────────────────

const CONFETTI_COLORS = [
  themeColor.primary,
  themeColor.primarySoft,
  themeColor.goalBorder,
  themeColor.goalBg,
  '#FFFFFF',
];

interface LessonCompletionConfettiProps {
  onDone: () => void;
}

function LessonCompletionConfetti({ onDone }: LessonCompletionConfettiProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.25,
        duration: 1.1 + Math.random() * 0.6,
        width: 6 + Math.random() * 5,
        height: 8 + Math.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );

  useEffect(() => {
    const timer = setTimeout(onDone, 1800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return createPortal(
    <div aria-hidden className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 130 }}>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            top: -20,
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            background: p.color,
            borderRadius: 2,
            animation: `wcConfettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}

export default CourseContentPage;
