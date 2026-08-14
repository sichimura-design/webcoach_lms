import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, Home, LayoutGrid, Sparkles, X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useMypageData } from '../../hooks/useMypageData';
import { useAiCoachStore } from '../../store/aiCoachStore';
import { AiSkillId, ConcreteAiSkillId, isSpecialistSkill } from '../../types/aiSkill';
import { buildRecommendations } from '../../utils/aiSkillRecommend';
import AiCoachHome from './AiCoachHome';
import AiCoachSessionView from './AiCoachSessionView';
import AiSkillCatalogView from './AiSkillCatalogView';
import ConversationList from './ConversationList';

/**
 * AI専用ページ（/ai-coach）。**1つのAIワークスペースの中でモードが切り替わる**画面。
 *
 * 状態は3つ（要件§「画面は3つの状態に分ける」）で、URLがそのまま状態になる:
 *   /ai-coach                  … ホーム状態。大きな入力欄＋AI機能一覧＋おすすめ
 *   /ai-coach?session=page:1   … メインチャット状態（モードは「おまかせ」）
 *   /ai-coach?session=page:2   … 専門モード状態（そのセッションのモードが専門スキル）
 *
 * 会話の実体は store/aiCoachStore.ts にあるので、?session= で開くだけで
 * 会話・添付画像・教材・専門モードがそのまま引き継がれる。
 * だから教材ページからの「広い画面で続ける」も、ここでは特別扱いが要らない。
 *
 * 旧実装との違い:
 *   ・以前は開いた瞬間に必ず会話（空のセッション）を作っていた。
 *     「アプリがどこにあるか分からない」「どれを使えばよいか分からない」の入口が
 *     無かったので、まずホーム状態を見せるようにした。
 *   ・機能を選んでも別ページ・別タブへは飛ばさない。同じページのチャットが
 *     その機能に適した状態へ切り替わる。
 */
const DESKTOP_MIN_WIDTH = 1024;
const LIST_WIDTH = 268;

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MIN_WIDTH
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= DESKTOP_MIN_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isDesktop;
}

export function AiCoachPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useIsDesktop();

  const sessions = useAiCoachStore((s) => s.sessions);
  const order = useAiCoachStore((s) => s.order);
  const createPageSession = useAiCoachStore((s) => s.createPageSession);
  const createSkillSession = useAiCoachStore((s) => s.createSkillSession);
  const deleteSession = useAiCoachStore((s) => s.deleteSession);
  const setInput = useAiCoachStore((s) => s.setInput);
  const setImage = useAiCoachStore((s) => s.setImage);

  const [historyOpen, setHistoryOpen] = useState(false);
  /** 自由入力から始めた直後だけ立てる。開いたセッションで1回送信する */
  const [autoSendFor, setAutoSendFor] = useState<string | null>(null);

  // URLが状態。?session= が無ければホーム状態。
  // 存在しないIDを渡されたらホームに落とす（履歴を消した後のリロードなど）。
  const requestedSession = searchParams.get('session');
  const activeId = requestedSession && sessions[requestedSession] ? requestedSession : null;

  // ?view=catalog で「AIサポート機能一覧」。
  // 以前は一覧がホームの下半分に常設されていて、相談を書きに来た人にも
  // カードの壁が押し付けられていた（「ただアプリが並んでいるだけ」）。
  // URLに状態を持たせるのはセッションと同じ流儀で、戻るボタンでも行き来できる。
  const catalogOpen = !activeId && searchParams.get('view') === 'catalog';

  const setView = useCallback(
    (view: 'home' | 'catalog') => {
      const next = new URLSearchParams(searchParams);
      next.delete('session');
      if (view === 'catalog') next.set('view', 'catalog');
      else next.delete('view');
      setSearchParams(next, { replace: false });
      setHistoryOpen(false);
    },
    [searchParams, setSearchParams]
  );

  // この画面もビューポート高に固定するのでページスクロールを止める
  // （.wc-learning-shell の高さ指定は body.learning-workspace と対で効く）
  useEffect(() => {
    document.body.classList.add('learning-workspace');
    return () => document.body.classList.remove('learning-workspace');
  }, []);

  const openSession = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('session', id);
      setSearchParams(next, { replace: false });
      setHistoryOpen(false);
    },
    [searchParams, setSearchParams]
  );

  const goHome = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    next.delete('view');
    setSearchParams(next, { replace: false });
    setHistoryOpen(false);
  }, [searchParams, setSearchParams]);

  /** ホームの入力欄からの送信（AIコーチ兼ルーター） */
  const handleSubmit = useCallback(
    (text: string, image: string | null, skillId: AiSkillId) => {
      // モードを明示して送った場合はそのモードのセッション、
      // 「おまかせ」なら普通の相談として始める（意図判定は useLessonAi 側が行う）。
      const id = isSpecialistSkill(skillId)
        ? createSkillSession({ skillId, input: text, image })
        : createPageSession();
      if (!isSpecialistSkill(skillId)) {
        setInput(id, text);
        if (image) setImage(id, image);
      }
      setAutoSendFor(id);
      openSession(id);
    },
    [createPageSession, createSkillSession, openSession, setImage, setInput]
  );

  /** 機能を直接選んだ（一覧・おすすめ経由）。実行はユーザーの操作を待つ */
  const handleSelectSkill = useCallback(
    (skillId: ConcreteAiSkillId, seedInput?: string) => {
      const id = createSkillSession({ skillId, input: seedInput });
      openSession(id);
    },
    [createSkillSession, openSession]
  );

  const handleCreate = useCallback(() => {
    openSession(createPageSession());
  }, [createPageSession, openSession]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteSession(id);
      if (id === activeId) goHome();
    },
    [activeId, deleteSession, goHome]
  );

  const sessionList = useMemo(
    () => order.map((id) => sessions[id]).filter(Boolean),
    [order, sessions]
  );

  /** ホームの「続きから」に出す直近の相談（親会話のみ、3件まで） */
  const recentSessions = useMemo(
    () => sessionList.filter((s) => !s.parentId && s.messages.length > 0).slice(0, 3),
    [sessionList]
  );

  /** 最近使った機能。一覧の並びと「この会話から使える機能」の順に効かせる */
  const recentSkills = useMemo(
    () =>
      Array.from(
        new Set(
          sessionList
            .map((s) => s.skillId)
            .filter((id): id is ConcreteAiSkillId => isSpecialistSkill(id))
        )
      ),
    [sessionList]
  );

  // おすすめは、マイページが既に取得している学習状況だけを根拠にする
  // （そのための新しいAPIは作らない。根拠に使えないことは理由に書かない）。
  const { resumableCourse } = useMypageData(user?.userid);
  const recommendations = useMemo(
    () =>
      buildRecommendations({
        courseTitle: resumableCourse?.title,
        categoryName: resumableCourse?.categoryName,
        currentLesson: resumableCourse?.currentLesson,
        progress: resumableCourse?.progress,
        usedSkills: recentSkills,
      }),
    [recentSkills, resumableCourse]
  );

  const showHistory = historyOpen && isDesktop;

  return (
    <div style={{ background: color.pageBg }}>
      <AppHeader userName={user?.username || 'User'} />

      <div className="wc-learning-shell" style={{ display: 'grid', gridTemplateRows: '52px minmax(0, 1fr)' }}>
        {/* ── 上部バー。どの状態でも「AI機能一覧」と「履歴」に戻れる ── */}
        <div
          className="flex items-center"
          style={{
            gap: 10,
            // 帯は全幅のまま、中の要素だけ本文と同じガターに乗せる。
            // 16px 固定だと本文が中央で細く見えるのに対して上部バーだけ両端に張り付き、
            // それが「詰まっている」印象の主因になっていた。
            padding: '0 var(--wc-page-x)',
            borderBottom: `1px solid ${color.border}`,
            background: color.surface,
          }}
        >
          <button
            type="button"
            onClick={goHome}
            className="inline-flex items-center"
            style={{
              gap: 6,
              border: 0,
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Sparkles size={15} style={{ color: color.primary }} />
            <span style={{ ...font.rowTitle, color: color.text }}>AIコーチ</span>
          </button>

          <div style={{ flex: 1 }} />

          {/* ホームからは一覧へ、それ以外からはホームへ。行き先が常に1つに決まる */}
          {catalogOpen || activeId ? (
            <button
              type="button"
              onClick={goHome}
              className="inline-flex items-center"
              style={topBarButtonStyle(false)}
            >
              <Home size={13} /> ホーム
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setView('catalog')}
              className="inline-flex items-center"
              style={topBarButtonStyle(false)}
            >
              <LayoutGrid size={13} /> AIサポート機能一覧
            </button>
          )}
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-pressed={historyOpen}
            className="inline-flex items-center"
            style={topBarButtonStyle(historyOpen)}
          >
            <History size={13} /> 履歴
          </button>
        </div>

        {/* ── 履歴 ＋ 本体 ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: showHistory ? `${LIST_WIDTH}px minmax(0, 1fr)` : 'minmax(0, 1fr)',
            minHeight: 0,
            transition: 'grid-template-columns .24s ease',
          }}
        >
          {showHistory && (
            <div style={{ overflow: 'hidden', minWidth: 0 }}>
              <ConversationList
                sessions={sessionList}
                activeId={activeId ?? ''}
                onSelect={openSession}
                onCreate={handleCreate}
                onDelete={handleDelete}
              />
            </div>
          )}

          <div style={{ minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
            {activeId ? (
              <AiCoachSessionView
                key={activeId}
                sessionId={activeId}
                onGoHome={goHome}
                onOpenSession={openSession}
                autoSend={autoSendFor === activeId}
                onAutoSendDone={() => setAutoSendFor(null)}
                isDesktop={isDesktop}
              />
            ) : catalogOpen ? (
              <AiSkillCatalogView onSelectSkill={handleSelectSkill} onAskFreely={goHome} />
            ) : (
              <AiCoachHome
                onSubmit={handleSubmit}
                onSelectSkill={handleSelectSkill}
                recommendations={recommendations}
                recentSkills={recentSkills}
                recentSessions={recentSessions}
                onOpenSession={openSession}
              />
            )}
          </div>
        </div>
      </div>

      {/* 履歴（モバイル）。デスクトップは左カラムに出すのでオーバーレイにしない */}
      {historyOpen && !isDesktop && (
        <div
          role="dialog"
          aria-label="会話履歴"
          className="fixed inset-0 z-50 flex"
          style={{ background: 'rgba(31,29,30,.32)' }}
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="flex flex-col"
            style={{ width: 'min(320px, 86vw)', background: color.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center"
              style={{ minHeight: 48, padding: '0 12px', borderBottom: `1px solid ${color.border}` }}
            >
              <strong style={{ ...font.rowTitle, color: color.text }}>会話履歴</strong>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="閉じる"
                className="grid place-items-center"
                style={{
                  marginLeft: 'auto',
                  width: 28,
                  height: 28,
                  border: 0,
                  borderRadius: 8,
                  background: 'transparent',
                  color: color.iconMuted,
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ConversationList
                sessions={sessionList}
                activeId={activeId ?? ''}
                onSelect={openSession}
                onCreate={handleCreate}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const topBarButtonStyle = (active: boolean): React.CSSProperties => ({
  gap: 5,
  height: 30,
  padding: '0 11px',
  border: `1px solid ${active ? color.primaryBorder : color.borderStrong}`,
  borderRadius: 8,
  background: active ? color.primarySoft : color.surface,
  color: active ? color.primary : color.textMuted,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  flexShrink: 0,
});

export default AiCoachPage;
