import { Flag, Pencil, Plus } from 'lucide-react';
import { GoalDeclaration } from '../../types/goalDeclaration';
import { daysLeft } from '../../utils/goalDeclaration';
import { toLocalDateKey } from '../../utils/studyStats';

/**
 * いま進行中の目標宣言を、カレンダーの上に横1本で出すバー（/study-log）。
 * ============================================================
 * 「今この期間に何をやると決めたか」がこの画面で一番読ませたいものなので、
 * カレンダーと日別記録より上に、独立した1枚として置く。
 *
 * 🔴 進行中の1件だけを持つ。振り返り待ち・過去の宣言は GoalDeclarationCard
 *    （ページ下部の履歴）が持つ。編集の入口をこの2つに散らさないため、
 *    進行中の編集はここ、振り返りと過去分の閲覧はあちら、と分けている。
 *
 * 🔴 期間の経過バーを付けない。GoalDeclarationCard と同じ理由で、
 *    経過バーは達成度%に読まれてしまい「学習効果を数値化した指標を出さない」規約に触れる。
 *
 * 🔴 この期間の学習時間・学習日数をここに出さない。
 *    バーは宣言文を読ませるためのもので、数字を足すと本文が主役でなくなる。
 *    事実としての集計は履歴カード側に残してある。
 * ============================================================
 */
interface GoalDeclarationBarProps {
  /** いま有効な宣言。utils/goalDeclaration.ts の activeDeclaration() が決めた1件 */
  active: GoalDeclaration | null;
  loading: boolean;
  onCreate: () => void;
  onEdit: (declaration: GoalDeclaration) => void;
}

const BAR: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  // 薄い赤地。白いカードが並ぶ中で「ここだけ宣言」と分かる程度に留める
  background: 'var(--dc-soft-100)',
  border: '1px solid var(--dc-soft-200)',
  borderRadius: 'var(--dc-radius-lg)',
  padding: '18px var(--dc-sp-card-x)',
};

/** 'YYYY-MM-DD' → 'M/D' */
function md(key: string): string {
  return `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
}

/** その月の日数 */
function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

/**
 * バーのラベル。
 * 🔴 「今月の目標」で固定しない。GoalDeclaration の期間は本人が決めるもので、
 *    2週間の宣言もある（types/goalDeclaration.ts は「数週間〜1ヶ月」と書いている）。
 *    9/6〜9/12 の宣言に「今月の目標」と付けると、期間の表示と食い違う。
 *    ひと月ぶんを丸ごと覆っているときだけ「今月の目標」と言う。
 */
function barLabel(periodFrom: string, periodTo: string): string {
  const year = Number(periodFrom.slice(0, 4));
  const month = Number(periodFrom.slice(5, 7));
  const sameMonth = periodFrom.slice(0, 7) === periodTo.slice(0, 7);
  const coversMonth =
    sameMonth &&
    Number(periodFrom.slice(8, 10)) === 1 &&
    Number(periodTo.slice(8, 10)) === daysInMonth(year, month);
  return coversMonth ? '今月の目標' : 'いまの目標';
}

function badge() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 'var(--dc-sz-badge)',
        height: 'var(--dc-sz-badge)',
        flex: 'none',
        borderRadius: 9999,
        // 地が --dc-soft-100 なので、バッジは白で抜く
        background: 'var(--dc-surface)',
        color: 'var(--dc-primary)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Flag size={15} strokeWidth={1.75} />
    </span>
  );
}

const LABEL: React.CSSProperties = {
  flex: 'none',
  fontSize: 'var(--dc-fs-body)',
  color: 'var(--dc-text-muted)',
  whiteSpace: 'nowrap',
};

export function GoalDeclarationBar({ active, loading, onCreate, onEdit }: GoalDeclarationBarProps) {
  if (loading) {
    return (
      <section style={BAR} aria-label="いまの目標">
        {badge()}
        <span style={LABEL}>いまの目標</span>
        <span style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)' }}>読み込み中…</span>
      </section>
    );
  }

  if (!active) {
    return (
      <section style={BAR} aria-label="いまの目標">
        {badge()}
        <span style={LABEL}>いまの目標</span>
        <span
          style={{
            flex: 1,
            minWidth: 200,
            fontSize: 'var(--dc-fs-body)',
            color: 'var(--dc-text-muted)',
            lineHeight: 'var(--dc-lh-ui)',
          }}
        >
          まだ宣言がありません。「この期間で何をやり切るか」を1文で書いておくと、期間が終わったときに振り返りとして残ります。
        </span>
        <button
          type="button"
          onClick={onCreate}
          className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            flex: 'none',
            minHeight: 34,
            padding: '0 14px',
            borderRadius: 9999,
            border: '1px solid var(--dc-border-strong)',
            background: 'var(--dc-surface)',
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-body)',
            fontWeight: 700,
            color: 'var(--dc-text-body)',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          宣言を書く
        </button>
      </section>
    );
  }

  const left = daysLeft(active, toLocalDateKey(new Date()));
  const label = barLabel(active.periodFrom, active.periodTo);

  return (
    <section style={BAR} aria-label={label}>
      {badge()}
      <span style={LABEL}>{label}</span>

      {/* 宣言文が主役。バーの中で一番大きく、一番濃い */}
      <p
        style={{
          margin: 0,
          flex: 1,
          minWidth: 240,
          fontSize: 'var(--dc-fs-title)',
          fontWeight: 700,
          lineHeight: 'var(--dc-lh-heading)',
          color: 'var(--dc-text)',
          overflowWrap: 'anywhere',
        }}
      >
        {active.text}
      </p>

      <span style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
        <span
          className="dc-num"
          style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}
        >
          {md(active.periodFrom)}〜{md(active.periodTo)}
          {left > 0 ? `（あと${left}日）` : ''}
        </span>
        <button
          type="button"
          onClick={() => onEdit(active)}
          className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            minHeight: 34,
            padding: '0 14px',
            borderRadius: 9999,
            border: '1px solid var(--dc-border-strong)',
            background: 'var(--dc-surface)',
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-body)',
            fontWeight: 700,
            color: 'var(--dc-text-body)',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          <Pencil size={13} strokeWidth={2} aria-hidden="true" />
          編集
        </button>
      </span>
    </section>
  );
}

export default GoalDeclarationBar;
