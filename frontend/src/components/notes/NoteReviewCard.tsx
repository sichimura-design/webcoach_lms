import { FileSearch, Sparkles } from 'lucide-react';
import { useAiCoachStore } from '../../store/aiCoachStore';

/**
 * ヘッダー右の「ふりかえりカード」（CONTENTS §10-2）。
 *
 * 押すと常駐のAIコーチドロワーが開き、composer に相談文が入った状態で始まる。
 * 専用ページ（/ai-coach）へ飛ばさないのは、一覧を見ながら聞ける状態のまま
 * 相談に入れたほうが「見返す」流れが切れないため。
 * /notes では AppHeader が GlobalAiCoachDrawer を常駐させている。
 *
 * 🔴 デザイン 1a にあった「もっと見る」の開閉は入れない。開くたびに
 *    下の検索欄とカードが押し下がるため。説明は短い1行に置き換えて常に出す。
 * 🔴 主役は一覧なので、このカードは見出しより小さい文字に抑える。
 *    ここが目立つと「AIに聞く画面」に見えてしまう。
 */
const SEED_PROMPT =
  'マイノートに残したメモやコーチングの記録を振り返りたいです。要点を整理して、次にやることを教えてください。';

export function NoteReviewCard() {
  const openDrawer = useAiCoachStore((s) => s.openDrawer);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flex: 'none',
        padding: '10px 14px',
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-md)',
        boxShadow: 'var(--dc-shadow-card)',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
          width: 32,
          height: 32,
          borderRadius: 9999,
          background: 'var(--dc-soft-100)',
        }}
      >
        <FileSearch size={16} style={{ color: 'var(--dc-primary)' }} />
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--dc-text)' }}>
          メモやコーチングをAIで振り返る
        </div>
        <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--dc-text-muted)' }}>
          保存した記録から要点を整理します
        </div>
      </div>

      <button
        type="button"
        onClick={() => openDrawer(SEED_PROMPT)}
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          flex: 'none',
          marginLeft: 4,
          padding: '8px 16px',
          border: '1px solid var(--dc-soft-200)',
          borderRadius: 9999,
          background: 'var(--dc-soft-100)',
          color: 'var(--dc-primary)',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <Sparkles size={14} /> AIで振り返る
      </button>
    </div>
  );
}

export default NoteReviewCard;
