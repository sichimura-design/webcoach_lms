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
  ArrowRight,
  AlignJustify,
  ChevronDown,
  X,
  Check,
  ExternalLink,
  Bot,
  User,
  Paperclip,
  ImageOff,
  NotebookPen,
  Sparkles,
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { parseDifyMessage } from '../utils/difyButtons';
import { getUserMessage } from '../utils/errorMessage';
import { color, font, radius, shadow } from '../theme/webcoachTheme';
import LessonTopBar from './learning/LessonTopBar';
import LessonFloatingActions from './learning/LessonFloatingActions';
import SupportPanel, { SupportTab } from './learning/SupportPanel';
import {
  getContentType as getModuleContentType,
  isVideoFile,
  buildSrcdoc,
  openMoodleContentInNewTab,
  resolveExternalUrl,
} from './learning/moodleContent';
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

// ─────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────

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

  // 教材画面はLMSのシェル（サイドバー・SP下部ナビ）を描かない没入モード。
  // dev/miyabe の LearningWorkspacePage と同じ body クラスで、その余白の
  // 打ち消しとページスクロールの停止を index.css 側に任せる。
  useEffect(() => {
    document.body.classList.add('learning-workspace', 'learning-immersive');
    return () => document.body.classList.remove('learning-workspace', 'learning-immersive');
  }, []);

  // AI／メモのサポートパネル（右ドッキング／ドロワー／ボトムシート）
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportTab, setSupportTab] = useState<SupportTab>('ai');
  const [supportWidth, setSupportWidth] = useState(400);
  const openSupport = (tab: SupportTab) => { setSupportTab(tab); setSupportOpen(true); };

  // 教材内目次（この教材の見出し一覧）の開閉
  const [tocOpen, setTocOpen] = useState(false);

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

  // ─── URL コンテンツの事前チェック ─────────
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    setIframeError(false);
    setZoomTarget(null);
    setQuoteSelection(null);
    setTocOpen(false);
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
        console.error('Failed to load course content:', err);
        dispatch({ type: 'FETCH_ERROR', error: getUserMessage(err, 'コースコンテンツの読み込みに失敗しました。') });
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
    if (getModuleContentType(selectedModule) !== 'page') return;

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
    const type = selectedModule ? getModuleContentType(selectedModule) : null;
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

    const contentType = getModuleContentType(selectedModule);

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

  // AIコーチの回答をマイノートへ保存する。直前のユーザー発言を質問として添える。
  const handleSaveAiAnswerToNote = (index: number) => {
    const message = aiMessages[index];
    if (!message || message.role !== 'assistant') return;
    const question = [...aiMessages.slice(0, index)].reverse().find((m) => m.role === 'user')?.content ?? '';
    const source: NoteSourceRef | null = selectedModule
      ? {
          courseId,
          courseName,
          lessonId: selectedModule.id,
          lessonTitle: selectedModule.name,
          heading: null,
          blockId: null,
          offset: null,
        }
      : null;

    noteCapture.capture({
      block: {
        kind: 'answer',
        question,
        answer: message.content,
        selectedText: null,
        image: message.imageDataUrl ?? null,
        source,
      },
      suggestedTitle: selectedModule?.name || 'AIコーチとの相談',
      source,
      lessonId: selectedModule?.id ?? null,
    });
  };

  // ─── コンテンツ描画 ───────────────────────
  const renderContent = () => {
    if (!selectedModule) return <EmptyPlaceholder />;

    const contentType = getModuleContentType(selectedModule);

    switch (contentType) {
      // ── mod/page ────────────────────────────
      case 'page': {
        const rawFallback = selectedModule.content ?? selectedModule.description ?? '';
        const html = processedHtml || rawFallback;
        if (!html) {
          return <p style={{ color: color.textSubtle }}>コンテンツがありません。</p>;
        }
        // content が生URL、または <p>URL</p> などURLのみのHTML の場合は src で読み込む
        const urlMatch = html.trim().match(/^(?:<[^>]+>\s*)*?(https?:\/\/[^\s<"']+?)(?:\s*<\/[^>]+>)*\s*$/i);
        const extractedUrl = urlMatch?.[1];
        if (extractedUrl) {
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
                <p style={{ ...font.caption, margin: 0, opacity: 0.6 }}>このコンテンツは現在利用できないか、移動された可能性があります。</p>
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
              style={{ width: '100%', border: 'none', minHeight: '200px', height: '85vh' }}
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
            style={{ width: '100%', border: 'none', minHeight: '200px' }}
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
        const externalUrl = resolveExternalUrl(selectedModule);
        if (!externalUrl) {
          return <EmptyPlaceholder />;
        }
        return (
          <iframe
            src={externalUrl}
            sandbox="allow-scripts allow-same-origin allow-forms"
            title={selectedModule.name}
            style={{ width: '100%', border: 'none', borderRadius: radius.md, height: '85vh', minHeight: '400px' }}
          />
        );
      }

      // ── mod/resource（動画）─────────────────
      case 'resource-video': {
        const videoFile = selectedModule.contents?.find(c => isVideoFile(c.filename));
        if (!videoFile) return <EmptyPlaceholder />;
        return (
          <video controls style={{ width: '100%', borderRadius: radius.md }}>
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
            <div className="flex justify-center" style={{ padding: 32 }}>
              <span className="animate-spin rounded-full" style={{ width: 32, height: 32, borderBottom: `2px solid ${color.primary}` }} />
            </div>
          );
        }
        return markdownContent
          ? <div className="prose max-w-none"><MarkdownRenderer content={markdownContent} /></div>
          : <p style={{ color: color.textSubtle }}>Markdownファイルの読み込みに失敗しました。</p>;

      // ── mod/resource（HTML）─────────────────
      case 'resource-html':
        return (
          <div className="flex flex-col items-center" style={{ gap: 16, padding: '40px 0' }}>
            <FileText size={48} style={{ color: color.primary, opacity: 0.6 }} />
            <p style={{ ...font.label, color: color.textSubtle }}>HTMLファイルのリソースです。（取得機能は準備中）</p>
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

  // ─── Chapter ナビゲーション用 ───────────────
  const allModules = sections.flatMap(s => s.modules);
  const currentIdx = allModules.findIndex(m => m.id === selectedModule?.id);
  const prevModule  = currentIdx > 0                    ? allModules[currentIdx - 1] : null;
  const nextModule  = currentIdx < allModules.length - 1 ? allModules[currentIdx + 1] : null;
  const isCompleted = !!selectedModule && completedIds.has(selectedModule.id);

  // 選択テキストのマイノート引用が使える種別（iframe内は同一オリジンのsrcdocのみ）
  const selectionCapableType = selectedModule
    ? ['page', 'label', 'resource-other', 'unknown'].includes(getModuleContentType(selectedModule))
    : false;

  const aiPane = (
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
      onSaveAnswer={handleSaveAiAnswerToNote}
    />
  );

  const memoPane = (
    <MemoPanel
      content={memoContent}
      status={memoStatus}
      onChange={handleMemoChange}
      lessonTitle={selectedModule?.name}
    />
  );

  // ─── メインレンダリング ───────────────────
  return (
    <div style={{ background: color.pageBg }}>
      <div className="wc-learning-shell" data-support-open={supportOpen ? 'true' : 'false'}>
        <div className="wc-lesson-main">
          <LessonTopBar
            courseName={courseName}
            lessonTitle={selectedModule?.name}
            lessonIndex={currentIdx >= 0 ? currentIdx + 1 : null}
            lessonTotal={allModules.length}
            courseId={courseId}
            lessonId={selectedModule?.id ?? null}
            onBackToCourse={onBack}
          />

          <main style={{ flex: 1, overflowY: 'auto', minWidth: 0, padding: '0 clamp(16px, 3vw, 32px)', scrollBehavior: 'smooth' }}>
            {loading && (
              <div className="flex items-center justify-center" style={{ height: '100%' }}>
                <span className="animate-spin rounded-full" style={{ width: 34, height: 34, borderBottom: `2px solid ${color.primary}` }} />
              </div>
            )}

            {!loading && error && (
              <div className="flex flex-col items-center justify-center" style={{ height: '100%', gap: 14 }}>
                <p style={{ ...font.label, color: color.primary, margin: 0 }}>{error}</p>
                <button
                  type="button"
                  onClick={onBack}
                  style={{
                    padding: '10px 22px', borderRadius: 999, border: 'none',
                    background: color.primary, color: '#fff', ...font.buttonSm, cursor: 'pointer',
                  }}
                >
                  コースに戻る
                </button>
              </div>
            )}

            {!loading && !error && (
              <article style={{ width: 'min(100%, var(--wc-reading-max, 900px))', margin: '32px auto 100px' }}>
                <div
                  style={{
                    background: color.surface,
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.card,
                    boxShadow: shadow.card,
                    padding: 'clamp(20px, 4vw, 40px)',
                  }}
                >
                  {/* ── タイトル ── */}
                  <h1 style={{ margin: '0 0 18px', fontSize: 'clamp(20px, 2.4vw, 26px)', fontWeight: 900, lineHeight: 1.4, letterSpacing: '-.01em', color: color.text }}>
                    {selectedModule ? selectedModule.name : courseName}
                  </h1>

                  {/* ── 目次トグル／新しいタブで開く ── */}
                  {(pageToc.length > 0 || (processedHtml && selectedModule && getModuleContentType(selectedModule) === 'page')) && (
                    <div className="flex items-center flex-wrap" style={{ gap: 8, marginBottom: 16 }}>
                      {pageToc.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTocOpen(v => !v)}
                          className="inline-flex items-center"
                          style={{
                            gap: 6, padding: '6px 12px', borderRadius: 999,
                            border: `1px solid ${color.borderStrong}`, background: tocOpen ? color.hoverBgTint : color.surface,
                            color: color.textMuted, ...font.caption, cursor: 'pointer',
                          }}
                        >
                          <AlignJustify size={13} />
                          目次（{pageToc.length}）
                          <ChevronDown size={13} style={{ transform: tocOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }} />
                        </button>
                      )}
                      {processedHtml && selectedModule && getModuleContentType(selectedModule) === 'page' && (
                        <button
                          type="button"
                          onClick={() => openMoodleContentInNewTab(processedHtml)}
                          className="inline-flex items-center"
                          style={{
                            gap: 6, padding: '6px 12px', borderRadius: 999,
                            border: `1px solid ${color.borderStrong}`, background: color.surface,
                            color: color.textMuted, ...font.caption, cursor: 'pointer',
                          }}
                        >
                          <ExternalLink size={13} />
                          新しいタブで開く
                        </button>
                      )}
                    </div>
                  )}

                  {tocOpen && pageToc.length > 0 && (
                    <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.md, background: color.hoverBgTint, padding: '8px 6px', marginBottom: 20 }}>
                      <TocList pageToc={pageToc} onItemClick={handleTocItemClick} />
                    </div>
                  )}

                  {/* ── 選択のヒント（文章選択→マイノート引用に対応する種別のみ）── */}
                  {selectionCapableType && (
                    <div
                      className="flex items-center"
                      style={{
                        gap: 8, marginBottom: 20, padding: '9px 14px', borderRadius: radius.nav,
                        background: color.hoverBgTint, border: `1px solid ${color.primaryBorderSoft}`,
                        ...font.caption, color: color.textMuted,
                      }}
                    >
                      <Sparkles size={13} style={{ color: color.primary, flexShrink: 0 }} />
                      文章を選択すると、マイノートに引用できます。右下からAIコーチ・マイノートも開けます
                    </div>
                  )}

                  {/* ── コンテンツ本体 ── */}
                  <div>{renderContent()}</div>

                  {/* ── レッスンの終点 ── */}
                  <footer style={{ marginTop: 40 }}>
                    {!isCompleted ? (
                      <div
                        style={{
                          background: color.goalBg, border: `1px solid ${color.goalBorder}`, borderRadius: radius.lg,
                          padding: 'clamp(22px, 3vw, 30px)', textAlign: 'center', marginBottom: 20,
                        }}
                      >
                        <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, lineHeight: 1.5, color: color.text }}>
                          ここまでで「{selectedModule?.name ?? courseName}」は終了です
                        </h3>
                        <p style={{ margin: '0 0 18px', ...font.label, lineHeight: 1.9, color: color.textMuted }}>
                          内容を確認できたら、このモジュールを完了しましょう。
                          <br />
                          完了すると学習進捗に反映されます。
                        </p>
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(true)}
                          disabled={completing}
                          className="inline-flex items-center disabled:opacity-60"
                          style={{
                            gap: 8, minHeight: 44, padding: '0 26px', border: 'none', borderRadius: radius.nav,
                            background: color.primary, color: color.textOnPrimary, fontFamily: 'inherit',
                            ...font.bodyLarge, boxShadow: shadow.primaryButton, cursor: completing ? 'default' : 'pointer',
                          }}
                        >
                          <Check size={16} strokeWidth={2.5} />
                          {completing ? '送信中…' : 'このモジュールを完了する'}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            background: color.successSurface, border: `1px solid ${color.success}`, borderRadius: radius.lg,
                            padding: 'clamp(22px, 3vw, 30px)', textAlign: 'center', marginBottom: 10,
                          }}
                        >
                          <div className="inline-flex items-center" style={{ gap: 10, marginBottom: 4 }}>
                            <span className="grid place-items-center" style={{ width: 28, height: 28, borderRadius: '50%', background: color.success, flexShrink: 0 }}>
                              <Check size={16} strokeWidth={2.5} color={color.textOnPrimary} />
                            </span>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, lineHeight: 1.4, color: color.text }}>
                              「{selectedModule?.name ?? courseName}」を完了しました
                            </h3>
                          </div>
                        </div>
                        <div className="flex justify-center" style={{ marginBottom: 20 }}>
                          <button
                            type="button"
                            onClick={() => handleToggleComplete(false)}
                            disabled={completing}
                            style={{
                              background: 'none', border: 'none', padding: '4px 8px', ...font.caption,
                              color: color.textSubtle, textDecoration: 'underline', cursor: 'pointer',
                            }}
                          >
                            完了を取り消す
                          </button>
                        </div>
                      </>
                    )}

                    {/* ── 前後モジュール ナビゲーション ── */}
                    <div className="flex items-center flex-wrap justify-between" style={{ gap: 12, paddingTop: 20, borderTop: `1px solid ${color.border}` }}>
                      {prevModule ? (
                        <button
                          type="button"
                          onClick={() => handleModuleSelect(prevModule)}
                          className="inline-flex items-center"
                          style={{
                            gap: 8, minHeight: 40, padding: '0 16px', border: `1px solid ${color.borderNeutral}`,
                            borderRadius: radius.nav, background: color.surface, color: color.textStrong,
                            fontFamily: 'inherit', ...font.buttonSm, cursor: 'pointer',
                          }}
                        >
                          <ArrowLeft size={14} />
                          前のモジュールへ
                        </button>
                      ) : <span />}
                      {nextModule ? (
                        <button
                          type="button"
                          onClick={() => handleModuleSelect(nextModule)}
                          className="inline-flex items-center"
                          style={{
                            gap: 8, minHeight: 40, padding: '0 20px', border: 'none',
                            borderRadius: radius.nav, background: color.primary, color: color.textOnPrimary,
                            fontFamily: 'inherit', ...font.buttonSm, cursor: 'pointer',
                          }}
                        >
                          次のモジュールへ
                          <ArrowRight size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onBack}
                          className="inline-flex items-center"
                          style={{
                            gap: 8, minHeight: 40, padding: '0 20px', border: 'none',
                            borderRadius: radius.nav, background: color.primary, color: color.textOnPrimary,
                            fontFamily: 'inherit', ...font.buttonSm, cursor: 'pointer',
                          }}
                        >
                          コースの目次へ
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </footer>
                </div>
              </article>
            )}
          </main>
        </div>

        {supportOpen && (
          <SupportPanel
            tab={supportTab}
            onTabChange={setSupportTab}
            onClose={() => setSupportOpen(false)}
            width={supportWidth}
            onWidthChange={setSupportWidth}
            aiPane={aiPane}
            memoPane={memoPane}
          />
        )}
      </div>

      {/* 常設アクション（右下）。教材を読みながらAI・メモへ入る唯一の入口 */}
      {!loading && !error && (
        <LessonFloatingActions
          hidden={!!quoteSelection}
          onOpenAi={() => openSupport('ai')}
          onOpenMemo={() => openSupport('notes')}
        />
      )}

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
    <div className="flex flex-col items-center justify-center text-center" style={{ padding: '64px 0', color: color.textSubtle }}>
      <FileText size={56} style={{ marginBottom: 16, opacity: 0.2 }} />
      <p style={{ ...font.label, margin: 0 }}>コンテンツがありません</p>
    </div>
  );
}

interface TocListProps {
  pageToc: TocItem[];
  onItemClick: (id: string) => void;
}

function TocList({ pageToc, onItemClick }: TocListProps) {
  return (
    <div>
      {pageToc.map(item => (
        <div
          key={item.id}
          onClick={() => onItemClick(item.id)}
          className="flex items-center cursor-pointer select-none"
          style={{
            gap: 8,
            padding: '7px 10px',
            paddingLeft: (item.level - 1) * 14 + 10,
            borderRadius: radius.nav,
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: 999, flexShrink: 0,
              background: item.level === 1 ? color.primary : item.level === 2 ? color.primaryBorder : color.borderNeutral,
            }}
          />
          <span style={{ fontSize: item.level <= 2 ? 13 : 12.5, fontWeight: item.level <= 2 ? 700 : 500, color: color.textBody }}>
            {item.text}
          </span>
        </div>
      ))}
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
  onSaveAnswer: (index: number) => void;
}

function AiCoachPanel({
  aiMessages, aiLoading, aiQuestion, setAiQuestion, handleAiKeyPress, onSend, chatEndRef,
  pendingImage, imageError, onImageSelect, onClearImage, onSaveAnswer,
}: AiCoachPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aiQuestion && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [aiQuestion]);

  return (
    <section className="flex flex-col" style={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <div className="flex-1" style={{ minHeight: 0, overflowY: 'auto', padding: 14, background: color.pageBg }}>
        {aiMessages.length === 0 && !aiLoading && (
          <p style={{ ...font.label, color: color.textSubtle, textAlign: 'center', marginTop: 24 }}>
            教材について気になることを聞いてみましょう
          </p>
        )}
        <div className="space-y-3">
          {aiMessages.map((msg, index) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'flex-row-reverse' : ''}`} style={{ gap: 8 }}>
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 28, height: 28, borderRadius: '50%', color: '#fff', background: msg.role === 'user' ? '#1976d2' : color.primary }}
              >
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div style={{ maxWidth: '82%' }}>
                <div
                  style={{
                    borderRadius: radius.md,
                    borderTopLeftRadius: msg.role === 'assistant' ? 4 : radius.md,
                    borderTopRightRadius: msg.role === 'user' ? 4 : radius.md,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    background: msg.role === 'user' ? color.primary : color.surface,
                    color: msg.role === 'user' ? '#fff' : color.textBody,
                    border: msg.role === 'assistant' ? `1px solid ${color.border}` : 'none',
                  }}
                >
                  {msg.imageDataUrl && (
                    <img src={msg.imageDataUrl} alt="添付画像" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, marginBottom: 8, objectFit: 'contain' }} />
                  )}
                  {msg.role === 'assistant' ? (
                    (() => {
                      const { text, buttons } = parseDifyMessage(msg.content);
                      return (
                        <>
                          <MarkdownRenderer content={text} compact />
                          {buttons.length > 0 && (
                            <div className="flex flex-wrap" style={{ gap: 6, marginTop: 4 }}>
                              {buttons.map((btn, i) => (
                                <button
                                  key={`${btn.value}-${i}`}
                                  type="button"
                                  disabled={aiLoading}
                                  onClick={() => onSend(btn.value)}
                                  style={{
                                    fontSize: 11.5, fontWeight: 700, borderRadius: radius.md,
                                    padding: '7px 11px', border: `1px solid ${color.border}`,
                                    background: color.pageBg, color: color.primary,
                                    cursor: 'pointer', opacity: aiLoading ? 0.5 : 1,
                                  }}
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
                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                  )}
                </div>
                {msg.role === 'assistant' && (
                  <button
                    type="button"
                    onClick={() => onSaveAnswer(index)}
                    className="inline-flex items-center"
                    style={{ gap: 4, marginTop: 4, fontSize: 10.5, fontWeight: 700, color: color.textMuted, background: 'none', border: 0, cursor: 'pointer' }}
                  >
                    <NotebookPen size={11} />
                    ノートに保存
                  </button>
                )}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div className="flex" style={{ gap: 8 }}>
              <div className="flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: '50%', color: '#fff', background: color.primary }}>
                <Bot size={14} />
              </div>
              <div style={{ borderRadius: radius.md, border: `1px solid ${color.border}`, background: color.surface, padding: '10px 12px' }}>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <span className="animate-spin rounded-full" style={{ width: 12, height: 12, border: `2px solid ${color.primary}`, borderTopColor: 'transparent' }} />
                  <span style={{ fontSize: 11.5, color: color.textMuted }}>考え中...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>
      <div style={{ padding: 12, background: color.surface, borderTop: `1px solid ${color.border}` }}>
        {pendingImage && (
          <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
            <img src={pendingImage.dataUrl} alt="添付予定の画像" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: `1px solid ${color.border}` }} />
            <button onClick={onClearImage} style={{ padding: 4, background: 'none', border: 0, color: color.textMuted, cursor: 'pointer' }} title="画像を取り消す">
              <ImageOff size={14} />
            </button>
          </div>
        )}
        {imageError && <p style={{ fontSize: 11, color: '#DC2626', marginBottom: 8 }}>{imageError}</p>}
        <div className="flex items-end" style={{ gap: 8, padding: '8px 10px', borderRadius: radius.md, background: color.pageBg }}>
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
            style={{ width: 26, height: 26, borderRadius: '50%', border: 0, background: 'none', color: color.textMuted, cursor: 'pointer', flexShrink: 0, opacity: aiLoading ? 0.5 : 1 }}
            title="画像を添付"
          >
            <Paperclip size={15} />
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
            style={{
              flex: 1, background: 'transparent', outline: 'none', border: 0, resize: 'none', overflow: 'hidden',
              fontSize: 12.5, color: color.text, lineHeight: 1.5, padding: '4px 0', maxHeight: 120, overflowY: 'auto',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => onSend()}
            disabled={(!aiQuestion.trim() && !pendingImage) || aiLoading}
            style={{
              width: 26, height: 26, borderRadius: '50%', border: 0, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: (aiQuestion.trim() || pendingImage) && !aiLoading ? color.primary : color.borderNeutral,
              cursor: 'pointer',
            }}
          >
            <Send size={12} color="#fff" />
          </button>
        </div>
      </div>
    </section>
  );
}

interface MemoPanelProps {
  content: string;
  status: 'idle' | 'loading' | 'saving' | 'saved';
  onChange: (value: string) => void;
  lessonTitle?: string;
}

function MemoPanel({ content, status, onChange, lessonTitle }: MemoPanelProps) {
  const statusLabel =
    status === 'saving' ? '保存中…' : status === 'saved' ? '自動保存済み' : '自動保存';

  return (
    <section className="flex flex-col" style={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <div className="flex items-center" style={{ gap: 8, minHeight: 45, padding: '0 14px', borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}>
        <strong style={{ ...font.label, fontWeight: 800, color: color.text }}>メモ</strong>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: color.textFaint }}>{statusLabel}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, background: color.pageBg }}>
        <textarea
          value={content}
          onChange={e => onChange(e.target.value)}
          placeholder="教材を見ながら、気づいたこと・試したいことを書く…"
          style={{
            width: '100%', minHeight: 220, background: color.surface, borderRadius: radius.md,
            padding: '12px 14px', fontSize: 12.5, color: color.text, outline: 'none',
            border: `1px solid ${color.border}`, resize: 'none', fontFamily: 'inherit', lineHeight: 1.7,
          }}
        />
        {lessonTitle && (
          <p style={{ marginTop: 8, fontSize: 10.5, color: color.textFaint }}>「{lessonTitle}」に保存</p>
        )}
      </div>
    </section>
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
        <NotebookPen size={14} style={{ color: color.primarySoft }} />
        メモに引用
      </button>
    </div>
  );
}

// ─────────────────────────────────────────
// レッスン完了コンフェッティ
// ─────────────────────────────────────────

const CONFETTI_COLORS = [
  color.primary,
  color.primarySoft,
  color.goalBorder,
  color.goalBg,
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
