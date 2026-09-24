import { useEffect, useRef, useState } from 'react';
import { Flag, Pencil, Plus } from 'lucide-react';
import { ACHIEVEMENT_LABEL, StudyDayTotal } from '../../types/studyActivity';
import {
  GOAL_DECLARATION_STATUS_LABEL,
  GoalDeclaration,
} from '../../types/goalDeclaration';
import { declarationPhase, daysLeft } from '../../utils/goalDeclaration';
import { toLocalDateKey } from '../../utils/studyStats';

/**
 * 「あなたの目標」（/study-log の下部）。「いまの目標」と「これまでの目標」の2段だけ。
 * ============================================================
 * 🔴 目標を書く・直す入口はここだけ。カレンダー上のバー（GoalDeclarationBar）と
 *    マイページは表示専用で、押すとここへスクロールして着地する。
 *    同じデータの編集入口を画面に散らさない。
 *
 * 🔴「期間が終わった目標」の段は置かない（いらない、という指摘で撤去）。
 *    振り返りがまだのものは「これまでの目標」の行に混ぜ、状態の語を
 *    「振り返り待ち」にする。押すと振り返りを書く画面が開く。
 *
 * 🔴 期間の経過をバーで出さない。「9/11〜9/24（あと12日）」の文字だけにする。
 *    経過バーを置くと達成度%に読めてしまい、学習効果を数値化した指標を
 *    表示しない規約に触れる。
 *
 * 🔴 期間中の学習時間は「事実」として添えるだけで、目標に対する達成率ではない
 *    （目標は目標分数を持たないので、そもそも割る相手がいない）。
 *
 * 🔴 「新しい目標を設定する」を進行中のときに消さない。utils/goalDeclaration.ts が
 *    併走（月の目標と週の目標を同時に持つ）を明示的に許しているので、消すと
 *    作る手段が画面から無くなる。進行中のときはテキストリンクに格下げして残す。
 * ============================================================
 */

/** ① のバーと /mypage から「どのブロックへ着地するか」を指す */
export type GoalJump = 'current' | 'pending' | 'new' | null;

interface GoalDeclarationCardProps {
  items: GoalDeclaration[];
  active: GoalDeclaration | null;
  /** 期間が終わったのに振り返りがまだのもの */
  pendingReflection: GoalDeclaration[];
  /** 以前は期間終了ブロックの「この期間の学習」に使っていた。いまは未使用（呼び出し側を変えないため残す） */
  daily?: StudyDayTotal[];
  loading: boolean;
  /** 着地の要求。受けたらスクロール＋フォーカス＋一瞬光らせて onJumpDone を呼ぶ */
  jump: GoalJump;
  onJumpDone: () => void;
  onCreate: () => void;
  onEditActive: () => void;
  onReview: (declaration: GoalDeclaration) => void;
  onView: (declaration: GoalDeclaration) => void;
}

const CARD: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
  // 🔴 着地したときフォーカスを受けるので、既定のアウトラインは出さない
  //    （光らせるのは FLASH 側の役目）
  outline: 'none',
};

/**
 * 着地したブロックを一瞬だけ縁取る。
 * 🔴 黄色で塗らない（LessonBlockView の flash とは別物）。金系はコーチング、
 *    目標は赤系という約束があるので、地を塗らずリングだけにする。
 *
 * 🔴 borderColor だけを重ねない。当てる先の style は border の一括指定なので、
 *    React が「shorthand と個別指定の混在」を警告し、flash が解けるときに
 *    borderColor だけ落ちて枠の色が消える。ここも一括指定で上書きすること
 *    （当てる先はどちらも 1px solid なので幅と線種は同じ）。
 */
const FLASH: React.CSSProperties = {
  border: '1px solid var(--dc-primary)',
  boxShadow: '0 0 0 3px var(--dc-soft-200)',
};

const BLOCK_HEADING: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: 'var(--dc-fs-caption)',
  fontWeight: 700,
  color: 'var(--dc-text-subtle)',
};

/** 'YYYY-MM-DD' → 'M/D' */
function md(key: string): string {
  return `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
}

function linkButton(label: string, onClick: () => void, ref?: React.Ref<HTMLButtonElement>) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      className="dc-link-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        flex: 'none',
        fontFamily: 'inherit',
        fontSize: 'var(--dc-fs-body)',
        fontWeight: 700,
        color: 'var(--dc-primary)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export function GoalDeclarationCard({
  items,
  active,
  pendingReflection,
  loading,
  jump,
  onJumpDone,
  onCreate,
  onEditActive,
  onReview,
  onView,
}: GoalDeclarationCardProps) {
  const todayKey = toLocalDateKey(new Date());
  // 「いまの目標」以外はすべて過去分として並べる。振り返り待ちもここに入れて語で示す
  const pendingIds = new Set(pendingReflection.map((d) => d.id));
  const past = items.filter((d) => d.id !== active?.id);
  const firstPendingId = past.find((d) => pendingIds.has(d.id))?.id ?? null;

  const sectionRef = useRef<HTMLElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  /** 振り返り待ちの先頭行。「振り返り待ち」への着地先（ブロックとフォーカスを兼ねる） */
  const reviewRef = useRef<HTMLButtonElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);

  const [flash, setFlash] = useState<GoalJump>(null);
  const flashTimer = useRef<number | null>(null);

  /**
   * バー・マイページからの着地。
   * 🔴 スクロールだけだとフォーカスは押したボタン（画面上部）に残るので、
   *    キーボードの人はここへ来られない。対応するボタンに focus を移す。
   */
  useEffect(() => {
    if (!jump) return;

    const block =
      jump === 'current' && currentRef.current
        ? currentRef.current
        : jump === 'pending' && reviewRef.current
          ? reviewRef.current
          : sectionRef.current;
    const button =
      jump === 'current'
        ? (editRef.current ?? createRef.current)
        : jump === 'pending'
          ? (reviewRef.current ?? createRef.current)
          : createRef.current;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    block?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    (button ?? sectionRef.current)?.focus({ preventScroll: true });

    setFlash(jump);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1400);
    onJumpDone();
  }, [jump, onJumpDone]);

  // アンマウントで止める（残すと setState が宙に浮く）
  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  /**
   * 新しい目標を作る入口。
   * 🔴 進行中があるときも消さない（併走の宣言が作れなくなる）。ただし主役では
   *    ないのでテキストリンクに格下げする。
   */
  const createButton = active ? (
    linkButton('新しい目標を設定する ›', onCreate, createRef)
  ) : (
    <button
      type="button"
      ref={createRef}
      onClick={onCreate}
      className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        minHeight: 34, padding: '0 14px', borderRadius: 9999,
        border: '1px solid var(--dc-border-strong)', background: 'var(--dc-surface)',
        fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)', fontWeight: 700,
        color: 'var(--dc-text-body)', cursor: 'pointer',
      }}
    >
      <Plus size={14} strokeWidth={2} aria-hidden="true" />
      新しい目標を設定する
    </button>
  );

  /** ① いまの目標。編集の入口はここ1つだけ */
  const currentBlock = active && (
    <div
      ref={currentRef}
      style={{
        marginBottom: 14,
        padding: '12px 14px',
        borderRadius: 'var(--dc-radius-md)',
        background: 'var(--dc-soft-100)',
        border: '1px solid var(--dc-soft-200)',
        ...(flash === 'current' ? FLASH : null),
      }}
    >
      <h3 style={BLOCK_HEADING}>いまの目標</h3>
      {/* 🔴 lead(16px)。バーが title(20px) で出しているので、こちらを主役にしない */}
      <p
        style={{
          margin: 0,
          paddingLeft: 12,
          borderLeft: '4px solid var(--dc-primary)',
          fontSize: 'var(--dc-fs-lead)',
          fontWeight: 700,
          lineHeight: 'var(--dc-lh-heading)',
          color: 'var(--dc-text)',
          overflowWrap: 'anywhere',
        }}
      >
        {active.text}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {/* 🔴 期間の書式を増やさない。バーと同じ M/D〜M/D に揃える */}
        <span
          className="dc-num"
          style={{ flex: 1, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}
        >
          {md(active.periodFrom)}〜{md(active.periodTo)}
          {daysLeft(active, todayKey) > 0 ? `（あと${daysLeft(active, todayKey)}日）` : ''}
        </span>
        <button
          type="button"
          ref={editRef}
          onClick={onEditActive}
          className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, flex: 'none',
            minHeight: 34, padding: '0 14px', borderRadius: 9999,
            border: '1px solid var(--dc-border-strong)', background: 'var(--dc-surface)',
            fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)', fontWeight: 700,
            color: 'var(--dc-text-body)', cursor: 'pointer',
          }}
        >
          <Pencil size={13} strokeWidth={2} aria-hidden="true" />
          編集する
        </button>
      </div>
    </div>
  );

  /** ③ これまでの目標 */
  const pastBlock = past.length > 0 && (
    <div style={{ marginTop: 4, borderTop: '1px solid var(--dc-border)', paddingTop: 12 }}>
      <h3 style={BLOCK_HEADING}>これまでの目標</h3>
      {past.map((d) => {
        const phase = declarationPhase(d, todayKey);
        const pending = pendingIds.has(d.id);
        const isFirstPending = d.id === firstPendingId;
        return (
          <button
            key={d.id}
            ref={isFirstPending ? reviewRef : undefined}
            type="button"
            className="studylog-goal-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            // 振り返り待ちは押したら振り返りを書く画面へ。それ以外は中身を見るだけ
            onClick={() => (pending ? onReview(d) : onView(d))}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', minHeight: 44, padding: '10px 8px',
              border: 'none', borderTop: '1px solid var(--dc-border)',
              background: 'transparent', borderRadius: 8,
              fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)',
              textAlign: 'left', cursor: 'pointer',
              ...(flash === 'pending' && isFirstPending ? FLASH : null),
            }}
          >
            <span className="dc-num" style={{ flex: 'none', width: 92, color: 'var(--dc-text-muted)', fontSize: 'var(--dc-fs-caption)' }}>
              {md(d.periodFrom)}〜{md(d.periodTo)}
            </span>
            <span
              style={{
                flex: 1, minWidth: 0, color: 'var(--dc-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {d.text}
            </span>
            {/* 状態は色ではなく語で出す。
                🔴 振り返り待ちは status が既定の値のままなので、それを出すと
                   書いてもいない「達成した」に読める。語ごと差し替える */}
            <span
              style={{
                flex: 'none', fontSize: 'var(--dc-fs-caption)', whiteSpace: 'nowrap',
                color: pending ? 'var(--dc-gold-text)' : 'var(--dc-text-muted)',
                fontWeight: pending ? 700 : undefined,
              }}
            >
              {pending
                ? '振り返り待ち'
                : phase === 'upcoming'
                  ? 'これから'
                  : GOAL_DECLARATION_STATUS_LABEL[d.status]}
              {!pending && d.reflectionAchievement ? ` ・ ${ACHIEVEMENT_LABEL[d.reflectionAchievement]}` : ''}
            </span>
            <span aria-hidden="true" style={{ flex: 'none', color: 'var(--dc-chevron)' }}>›</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <section
      ref={sectionRef}
      // 着地先。id にはしない（ブラウザ標準の fragment スクロールと二重に走る）
      data-goal-section=""
      tabIndex={-1}
      aria-labelledby="goal-card-title"
      style={CARD}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 'var(--dc-sz-badge)', height: 'var(--dc-sz-badge)', flex: 'none',
            borderRadius: 9999, background: 'var(--dc-soft-100)', color: 'var(--dc-primary)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <Flag size={16} strokeWidth={1.75} />
        </span>
        <h2
          id="goal-card-title"
          style={{ margin: 0, flex: 1, fontSize: 'var(--dc-fs-lead)', fontWeight: 700, color: 'var(--dc-text)' }}
        >
          あなたの目標
        </h2>
        {createButton}
      </div>

      {loading ? (
        <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)' }}>読み込み中…</p>
      ) : items.length === 0 ? (
        // 🔴 空のときの一次の案内はここ。カレンダー上のバーは短い1行に留める
        <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
          「この期間で何をやり切るか」を1文で決めておくと、期間が終わったときに振り返りとして積み上がります。
        </p>
      ) : active ? (
        <>
          {currentBlock}
          {pastBlock}
        </>
      ) : (
        pastBlock
      )}
    </section>
  );
}

export default GoalDeclarationCard;
