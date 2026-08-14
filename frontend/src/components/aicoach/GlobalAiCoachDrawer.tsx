import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { color } from '../../theme/webcoachTheme';
import { useLessonAi, LessonAiMessage } from '../../hooks/useLessonAi';
import { useNoteCapture } from '../../hooks/useNoteCapture';
import { DRAWER_SESSION_ID, useAiCoachStore } from '../../store/aiCoachStore';
import AiCoachPane from '../learning/AiCoachPane';
import NoteTargetPicker from '../notes/NoteTargetPicker';

/**
 * 教材ページ以外の全画面に常駐するAIコーチ（右下FAB＋右ドロワー）。
 *
 * 中身は教材ページの右パネルと同じ AiCoachPane。別のチャットUIを持たせないのは、
 * 「どこから開いても同じAIコーチ」に見せるため。以前はここだけ独自の吹き出し実装で、
 * モードも参照中の表示も持てなかった。
 *
 * このコンポーネントは AppHeader が「専用のAI面を持たないページ」でのみ描画する。
 * 教材ページやAI専用ページで出すと入口が二重になる（要件が避けたい「競合」）。
 *
 * 会話は DRAWER_SESSION_ID の1本。集中ブースのミニチャットも同じ会話を共有する。
 */
export function GlobalAiCoachDrawer() {
  const navigate = useNavigate();
  const drawerOpen = useAiCoachStore((s) => s.drawerOpen);
  const setDrawerOpen = useAiCoachStore((s) => s.setDrawerOpen);
  const ai = useLessonAi(null, DRAWER_SESSION_ID);

  const handleExpand = useCallback(() => {
    setDrawerOpen(false);
    navigate(`/ai-coach?session=${encodeURIComponent(DRAWER_SESSION_ID)}`);
  }, [navigate, setDrawerOpen]);

  /**
   * 提案カードの「広い画面で開く」。ここでは実行せず、モードだけ切り替えて
   * AI専用ページへ渡す（会話は同じセッションなのでそのまま引き継がれる）。
   */
  const handleOpenWide = useCallback(
    (skillId: Parameters<typeof ai.selectSkill>[0]) => {
      ai.selectSkill(skillId);
      handleExpand();
    },
    [ai, handleExpand]
  );

  /**
   * AI回答をノートへ。
   * 以前は「教材の文脈が無いので保存できない」として拡大ページへ促していたが、
   * ノートが器になり、出どころが無くても入れ物があるので実際に保存できる。
   */
  const capture = useNoteCapture();
  const handleSaveAnswer = useCallback(
    async (message: LessonAiMessage) => {
      const index = ai.messages.findIndex((m) => m.id === message.id);
      let question = '';
      for (let i = index - 1; i >= 0; i -= 1) {
        if (ai.messages[i].role === 'user') {
          question = ai.messages[i].content;
          break;
        }
      }
      const a = message.answer;
      const s = message.skillResult;
      const answer = a
        ? [a.conclusion, a.basis, a.apply, a.next].filter(Boolean).join('\n')
        : s
          ? [s.summary, ...s.findings.map((f) => `【${f.label}】${f.comment}`), s.next].filter(Boolean).join('\n')
          : '';
      if (!answer) return;

      await capture.capture({
        block: { kind: 'answer', question, answer, selectedText: null, image: null, source: null },
        suggestedTitle: 'AIコーチとの相談',
        source: null,
        lessonId: null,
      });
    },
    [ai.messages, capture]
  );

  // メモ下書きとブロックジャンプは教材の文脈がないと意味をなさないので、
  // ここでは拡大ページへ促す（無言で失敗させない）。
  const notSupported = useCallback(() => handleExpand(), [handleExpand]);

  if (!drawerOpen) {
    return (
      /*
       * 常駐FAB。claude.ai/design『マイページ 3d.dc.html』準拠のピル。
       * 🔴 赤ベタの円にしない。DESIGN.md §2-6 の「赤ベタの面は1画面に2〜3箇所まで」に対して、
       *    この FAB は全ページに出るので、どの画面でも赤の枠を1つ食い潰してしまう。
       *    白地 + コーラルピンク（AI Accent）のアイコンにして、
       *    学習アクションの Primary と役割を色で描き分ける（DESIGN.md §15-8）。
       * 🔴 SPはボトムナビ（h-16）を避けて bottom を上げる。
       */
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="AIコーチに相談"
        className="group fixed z-40 right-6 bottom-20 sm:bottom-6 inline-flex items-center rounded-full transition-all duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          height: 52,
          gap: 8,
          padding: '0 20px',
          background: '#FFFFFF',
          border: '1px solid #EFE9E0',
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 700,
          color: '#141414',
          cursor: 'pointer',
          boxShadow: '0 8px 24px -8px rgba(60,48,32,.14)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 8px 32px -12px rgba(236,112,138,.45)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 24px -8px rgba(60,48,32,.14)';
        }}
      >
        <Sparkles size={20} strokeWidth={1.75} color="#EC708A" />
        AIコーチに相談
      </button>
    );
  }

  return (
    <div
      className="fixed right-0 top-0 h-full w-full sm:w-[420px] z-50 flex flex-col"
      style={{ background: color.surface, boxShadow: '-8px 0 32px rgba(33,42,57,.16)' }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 8,
          minHeight: 48,
          padding: '0 14px',
          borderBottom: `1px solid ${color.border}`,
          flexShrink: 0,
        }}
      >
        <strong style={{ fontSize: 13, fontWeight: 800, color: color.text }}>AIコーチに相談</strong>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="閉じる"
          style={{
            marginLeft: 'auto',
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            border: `1px solid ${color.borderStrong}`,
            borderRadius: 8,
            background: color.surface,
            color: color.iconMuted,
            cursor: 'pointer',
          }}
        >
          <X size={15} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <AiCoachPane
          ai={ai}
          variant="panel"
          onExpand={handleExpand}
          onOpenWide={handleOpenWide}
          onSaveAnswer={(message) => void handleSaveAnswer(message)}
          onAppendToMemo={notSupported}
          onJumpToBlock={notSupported}
          // disabled は「教材はあるがブロック単位の根拠が取れない」縮退モードの意味。
          // ドロワーには教材の文脈そのものが無いので、ここでは false が正しい。
          disabled={false}
        />
      </div>

      {capture.pending && (
        <NoteTargetPicker
          suggestedTitle={capture.pending.suggestedTitle}
          onPickNote={(noteId) => void capture.resolvePendingWithNote(noteId)}
          onCreateNew={() => void capture.resolvePendingWithNewNote()}
          onCancel={capture.cancelPending}
        />
      )}
    </div>
  );
}

export default GlobalAiCoachDrawer;
