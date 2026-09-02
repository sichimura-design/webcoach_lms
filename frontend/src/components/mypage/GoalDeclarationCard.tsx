import { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { GoalDeclaration } from '../../types/goalDeclaration';
import { daysLeft } from '../../utils/goalDeclaration';
import { toLocalDateKey } from '../../utils/studyStats';

/**
 * トップページの目標宣言カード（表示専用）。
 * ============================================================
 * 「今やること（続きから学習）→ 何のために（この宣言）→ 積み上がり（ダッシュボード）」
 * の順で読めるよう、8a グリッドと学習状況ダッシュボードの間に全幅で置く。
 *
 * 🔴 Primary CTA を増やさない（DESIGN §15-5）。マイページで塗りボタンなのは
 *    ResumeStudyCard の「続きから学習する」だけ。ここはテキストリンクにする。
 *    未設定のときだけアウトラインの「宣言を書く ›」を出す（空カードを行き止まりに
 *    しないため。アウトラインなら唯一の Primary と競合しない）。
 *
 * 🔴 編集はここでしない。同じデータの編集入口を2箇所に置かない規約に従い、
 *    書くのも直すのも /study-log 側。ここは押すとそちらへ送るだけ。
 *
 * 🔴 期間の経過をバーで出さない。「あと12日」のテキストのみ。
 *    バーにすると達成度%に読める（学習効果の数値化はしない規約）。
 *
 * CoachingTaskCard（次回コーチングまでのタスク）との見分け:
 *   位置が別段／中身が1文の引用体（左4pxの縦罫＋20px）vs チェック付き複数行／
 *   脚注で編集先が違うことを明示（学習記録ページ vs コーチングページ）。
 * ============================================================
 */
interface MypageGoalDeclarationCardProps {
  declaration: GoalDeclaration | null;
  /** 期間が終わったのに振り返りがまだのもの（先頭1件だけ促す） */
  pendingReflection: GoalDeclaration | null;
  loading: boolean;
  /** モックOFF。カードごと出さない */
  unavailable: boolean;
}

const CARD_STYLE: CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
  marginBottom: 'var(--dc-sp-gap)',
};

const linkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  flex: 'none',
  fontFamily: 'inherit',
  fontSize: 'var(--dc-fs-body)',
  fontWeight: 700,
  color: 'var(--dc-primary)',
  cursor: 'pointer',
};

export function MypageGoalDeclarationCard({
  declaration,
  pendingReflection,
  loading,
  unavailable,
}: MypageGoalDeclarationCardProps) {
  const navigate = useNavigate();

  // 実BFFにこのAPIが無い環境では、赤いエラーを出さずカードごと畳む
  if (unavailable) return null;

  if (loading) {
    return (
      <section style={CARD_STYLE} aria-busy="true">
        <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)' }}>
          読み込み中…
        </p>
      </section>
    );
  }

  // 振り返り待ちがあるときは、進行中よりそちらを促す（放置されやすいので）
  const target = declaration ?? pendingReflection;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <span
        style={{
          width: 'var(--dc-sz-badge)', height: 'var(--dc-sz-badge)', flex: 'none',
          borderRadius: 9999, background: 'var(--dc-soft-100)', color: 'var(--dc-primary)',
          display: 'grid', placeItems: 'center',
        }}
      >
        <Flag size={16} strokeWidth={1.75} />
      </span>
      <h2 style={{ margin: 0, flex: 1, fontSize: 'var(--dc-fs-lead)', fontWeight: 700, color: 'var(--dc-text)' }}>
        いまの目標宣言
      </h2>
      {target && (
        <>
          {/* 状態と残りは色ではなく語と数で伝える */}
          <span className="dc-num" style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}>
            {declaration
              ? `${Number(declaration.periodTo.slice(5, 7))}月${Number(declaration.periodTo.slice(8, 10))}日まで（あと${daysLeft(declaration, toLocalDateKey(new Date()))}日）`
              : '期間終了・振り返り待ち'}
          </span>
          <button
            type="button"
            className="dc-link-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            onClick={() => navigate(declaration ? '/study-log?goal=edit' : '/study-log?goal=review')}
            style={linkStyle}
          >
            {declaration ? '編集する ›' : '振り返りを書く ›'}
          </button>
        </>
      )}
    </div>
  );

  if (!target) {
    return (
      <section style={CARD_STYLE}>
        {header}
        <p
          style={{
            margin: '0 0 14px',
            fontSize: 'var(--dc-fs-body)',
            color: 'var(--dc-text-muted)',
            lineHeight: 'var(--dc-lh-prose)',
          }}
        >
          いま取り組んでいる目標がありません。「この2週間で何をやり切るか」を1文で決めておくと、
          学習記録に振り返りとして積み上がります。
        </p>
        <button
          type="button"
          onClick={() => navigate('/study-log?goal=new')}
          className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 'var(--dc-sz-btn)',
            padding: '0 18px', borderRadius: 9999,
            border: '1px solid var(--dc-border-strong)', background: 'var(--dc-surface)',
            fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)', fontWeight: 700,
            color: 'var(--dc-text-body)', cursor: 'pointer',
          }}
        >
          宣言を書く ›
        </button>
      </section>
    );
  }

  return (
    <section style={CARD_STYLE}>
      {header}
      <p
        style={{
          margin: 0,
          paddingLeft: 12,
          borderLeft: '4px solid var(--dc-primary)',
          fontSize: 'var(--dc-fs-title)',
          fontWeight: 700,
          lineHeight: 'var(--dc-lh-heading)',
          color: 'var(--dc-text)',
          overflowWrap: 'anywhere',
        }}
      >
        {target.text}
      </p>
      <p style={{ margin: '12px 0 0', fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>
        目標宣言は学習記録ページで編集できます。
      </p>
    </section>
  );
}

export default MypageGoalDeclarationCard;
