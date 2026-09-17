import { ChevronDown, Flag } from 'lucide-react';
import { GoalDeclaration } from '../../types/goalDeclaration';
import { daysLeft } from '../../utils/goalDeclaration';
import { toLocalDateKey } from '../../utils/studyStats';
import { GoalJump } from './GoalDeclarationCard';

/**
 * いまの目標を、カレンダーの上に横1本で出すバー（/study-log の ①）。
 * ============================================================
 * 「今この期間に何をやると決めたか」がこの画面で一番読ませたいものなので、
 * カレンダーと日別記録より上に、独立した1枚として置く。
 *
 * 🔴 ここでは編集しない。ボタンはすべて下向きアイコン付きで、押すとページ下部の
 *    「あなたの目標」カード（GoalDeclarationCard）へスクロールして着地するだけ。
 *    書く・直すの入口をあちらの1枚に集約するため、ここからモーダルを開かない。
 *
 * 🔴 期間の経過バーを付けない。GoalDeclarationCard と同じ理由で、
 *    経過バーは達成度%に読まれてしまい「学習効果を数値化した指標を出さない」規約に触れる。
 *
 * 🔴 この期間の学習時間・学習日数をここに出さない。
 *    バーは目標の文を読ませるためのもので、数字を足すと本文が主役でなくなる。
 *    事実としての集計は下部のカードに残してある。
 *
 * 🔴 ラベルは常に「あなたの目標」。かつては期間が月を丸ごと覆うときだけ
 *    「今月の目標」と出し分けていたが、マイページ・下部カード・ここで呼び名が
 *    ばらけて「同じ目標の話か」が読み手に分からなくなっていた。
 * ============================================================
 */
interface GoalDeclarationBarProps {
  /** いま有効な目標。utils/goalDeclaration.ts の activeDeclaration() が決めた1件 */
  active: GoalDeclaration | null;
  /** 期間が終わったのに振り返りがまだのもの（新しい順） */
  pending: GoalDeclaration[];
  loading: boolean;
  /** 下部の「あなたの目標」カードへ送る。編集はあちらで行う */
  onJump: (target: Exclude<GoalJump, null>) => void;
}

const BAR: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  // 薄い赤地。白いカードが並ぶ中で「ここだけ目標」と分かる程度に留める
  background: 'var(--dc-soft-100)',
  border: '1px solid var(--dc-soft-200)',
  borderRadius: 'var(--dc-radius-lg)',
  padding: '18px var(--dc-sp-card-x)',
};

/** 'YYYY-MM-DD' → 'M/D' */
function md(key: string): string {
  return `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
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

const NOTE: React.CSSProperties = {
  flex: 1,
  minWidth: 200,
  fontSize: 'var(--dc-fs-body)',
  color: 'var(--dc-text-muted)',
  lineHeight: 'var(--dc-lh-ui)',
};

/**
 * 期間とボタンの並び。
 * 🔴 flex:'none' にしない。375px でボタンが2つ並ぶ状態（期間終了）だと、
 *    縮まないぶんバーの外へはみ出して横スクロールが出る。
 */
const ACTIONS: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flex: '1 1 auto',
  minWidth: 0,
  flexWrap: 'wrap',
};

const META: React.CSSProperties = {
  fontSize: 'var(--dc-fs-caption)',
  color: 'var(--dc-text-muted)',
  whiteSpace: 'nowrap',
};

/** 目標文。バーの中で一番大きく、一番濃い */
function goalText(text: string) {
  return (
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
      {text}
    </p>
  );
}

/**
 * 下部カードへ送るボタン。
 * 🔴 下向きアイコンを必ず付ける。「押すとその場で編集できる」と読ませないため。
 */
function jumpButton(label: string, onClick: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
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
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {label}
      <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

export function GoalDeclarationBar({ active, pending, loading, onJump }: GoalDeclarationBarProps) {
  /* 🔴 aria-label は下部カードの h2「あなたの目標」と同じにしない。
        同じページに同名の領域が2つあると、読み上げでどちらに来たか分からない。 */
  const frame = (children: React.ReactNode) => (
    <section style={BAR} aria-label="あなたの目標（概要）">
      {badge()}
      <span style={LABEL}>あなたの目標</span>
      {children}
    </section>
  );

  if (loading) {
    return frame(
      <span style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)' }}>読み込み中…</span>
    );
  }

  // 進行中がある。振り返り待ちが残っていれば件数だけ添える
  if (active) {
    const left = daysLeft(active, toLocalDateKey(new Date()));
    return frame(
      <>
        {goalText(active.text)}
        <span style={ACTIONS}>
          <span className="dc-num" style={META}>
            {md(active.periodFrom)}〜{md(active.periodTo)}
            {left > 0 ? `（あと${left}日）` : ''}
          </span>
          {/* 🔴 件数を言うだけ。どれを振り返るかの選択は下部カードが持つ */}
          {pending.length > 0 && jumpButton(`振り返り待ち ${pending.length}件`, () => onJump('pending'))}
          {jumpButton('編集', () => onJump('current'))}
        </span>
      </>
    );
  }

  // 進行中は無いが、振り返っていない目標が残っている
  if (pending.length > 0) {
    const d = pending[0];
    return frame(
      <>
        {goalText(d.text)}
        <span style={ACTIONS}>
          <span className="dc-num" style={META}>
            {md(d.periodFrom)}〜{md(d.periodTo)}（期間終了）
          </span>
          {jumpButton('振り返りを書く', () => onJump('pending'))}
          {jumpButton('新しい目標を設定する', () => onJump('new'))}
        </span>
      </>
    );
  }

  return frame(
    <>
      <span style={NOTE}>
        まだ目標がありません。「この期間で何をやり切るか」を1文で書いておくと、期間が終わったときに振り返りとして残ります。
      </span>
      {jumpButton('目標を設定する', () => onJump('new'))}
    </>
  );
}

export default GoalDeclarationBar;
