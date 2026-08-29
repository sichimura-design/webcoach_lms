import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '../shared';
import { useAuth } from '../../contexts/AuthContext';
import { useAiCoachStore } from '../../store/aiCoachStore';
import { AiSkillId, ConcreteAiSkillId, isSpecialistSkill } from '../../types/aiSkill';
import AiCoachHome from './AiCoachHome';
import AiCoachHowTo from './AiCoachHowTo';
import AiCoachSessionView from './AiCoachSessionView';
import AiSkillCatalogView from './AiSkillCatalogView';
import ConversationList from './ConversationList';

/**
 * AI専用ページ（/ai-coach）。**1つのAIワークスペースの中でモードが切り替わる**画面。
 *
 * 状態は3つ（要件§「画面は3つの状態に分ける」）で、URLがそのまま状態になる:
 *   /ai-coach                  … ホーム状態。大きな入力欄＋AIアプリ6枚（デザイン 1a）
 *   /ai-coach?view=catalog     … AIサポート機能一覧（検索・カテゴリで探す）
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
 *   ・以前は全状態の上に52pxの共通バー（ロゴ／一覧切替／履歴）を敷いていた。
 *     デザイン 1a のホームは問いかけだけを主役にする作りなので、バーを外し、
 *     行き先はそれぞれの状態が自分で持つようにした:
 *       ホーム       … 右上の「ヘルプ・使い方」「履歴」＋「全てのAIアプリを見る」
 *       機能一覧     … 先頭の「AIコーチにもどる」
 *       チャット     … ヘッダーの「AIコーチ」（親会話があればそこへ）
 */
const DESKTOP_MIN_WIDTH = 1024;

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
  const [howToOpen, setHowToOpen] = useState(false);
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

  // 履歴ドロワーは Esc でも閉じる（暗幕クリックと「×」だけに頼らない）
  useEffect(() => {
    if (!historyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHistoryOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [historyOpen]);

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

  return (
    <div className="wc-warm" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username || 'User'} />

      {/* ── 本体 ──
          上部バーを外し、履歴も右からのドロワーにしたので、ここは1面だけになった。 */}
      <div
        className="wc-learning-shell"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', minHeight: 0 }}
      >
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
            <AiSkillCatalogView onSelectSkill={handleSelectSkill} onAskFreely={goHome} onBack={goHome} />
          ) : (
            <AiCoachHome
              onSubmit={handleSubmit}
              onSelectSkill={handleSelectSkill}
              onOpenCatalog={() => setView('catalog')}
              onOpenHowTo={() => setHowToOpen(true)}
              onToggleHistory={() => setHistoryOpen((v) => !v)}
            />
          )}
        </div>
      </div>

      {howToOpen && <AiCoachHowTo onClose={() => setHowToOpen(false)} />}

      {/* ── 会話履歴 ──
          右から出てくるドロワー。以前はデスクトップだけ左の常設カラムに出していたが、
          「押したら右から出てくる」形に統一した。画面幅で出方が変わらないので、
          押した先がどこかを覚えなくてよくなる。
          見出しと「新規」「×」は ConversationList が自分のヘッダーに持つので、
          ここでは器（暗幕・幅・影）だけを用意する。 */}
      {historyOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="会話履歴"
          className="wc-drawer-scrim fixed inset-0 flex justify-end"
          style={{ zIndex: 70, background: 'rgba(60,48,32,.32)' }}
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="wc-drawer-right flex flex-col"
            style={{
              width: 'min(360px, 92vw)',
              background: 'var(--dc-surface)',
              boxShadow: 'var(--dc-shadow-float)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ConversationList
              sessions={sessionList}
              activeId={activeId ?? ''}
              onSelect={openSession}
              onCreate={handleCreate}
              onDelete={handleDelete}
              onClose={() => setHistoryOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AiCoachPage;
