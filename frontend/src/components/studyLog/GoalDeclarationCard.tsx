import { Flag, Plus } from 'lucide-react';
import { ACHIEVEMENT_LABEL, StudyDayTotal } from '../../types/studyActivity';
import {
  GOAL_DECLARATION_STATUS_LABEL,
  GoalDeclaration,
} from '../../types/goalDeclaration';
import {
  daysLeft,
  declarationMinutes,
  declarationPhase,
  declarationStudyDays,
} from '../../utils/goalDeclaration';
import { formatMinutesHM, toLocalDateKey } from '../../utils/studyStats';

/**
 * 目標宣言と振り返りの積み上がり（/study-log）。
 * ============================================================
 * 編集の主戦場はここ。マイページ側は表示だけで、押すとここへ来る
 * （同じデータの編集入口を2箇所に置かない）。
 *
 * 🔴 期間の経過をバーで出さない。「9月30日まで（あと12日）」の文字だけにする。
 *    経過バーを置くと達成度%に読めてしまい、学習効果を数値化した指標を
 *    表示しない規約に触れる。
 *
 * 🔴 期間中の学習時間は「事実」として添えるだけで、宣言に対する達成率ではない
 *    （宣言は目標分数を持たないので、そもそも割る相手がいない）。
 * ============================================================
 */
interface GoalDeclarationCardProps {
  items: GoalDeclaration[];
  active: GoalDeclaration | null;
  /** 期間が終わったのに振り返りがまだのもの */
  pendingReflection: GoalDeclaration[];
  /** 期間中の学習時間を出すために使う。stats.dailyTotals をそのまま渡す */
  daily: StudyDayTotal[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (declaration: GoalDeclaration) => void;
  onReview: (declaration: GoalDeclaration) => void;
  onView: (declaration: GoalDeclaration) => void;
}

const CARD: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
};

/** 'YYYY-MM-DD' → 'M/D' */
function md(key: string): string {
  return `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
}

function linkButton(label: string, onClick: () => void) {
  return (
    <button
      type="button"
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
  daily,
  loading,
  onCreate,
  onEdit,
  onReview,
  onView,
}: GoalDeclarationCardProps) {
  const todayKey = toLocalDateKey(new Date());
  // 「いま出しているもの」以外を過去分として並べる
  const shownIds = new Set([active?.id, ...pendingReflection.map((d) => d.id)].filter(Boolean));
  const past = items.filter((d) => !shownIds.has(d.id));

  return (
    <section style={CARD}>
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
        <h2 style={{ margin: 0, flex: 1, fontSize: 'var(--dc-fs-lead)', fontWeight: 700, color: 'var(--dc-text)' }}>
          目標宣言と振り返り
        </h2>
        <button
          type="button"
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
          宣言を書く
        </button>
      </div>

      {loading ? (
        <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)' }}>読み込み中…</p>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
          まだ宣言がありません。「この2週間で何をやり切るか」を1文で書いておくと、
          期間が終わったときに振り返りとして積み上がります。
        </p>
      ) : (
        <>
          {/* 進行中 */}
          {active && (
            <div style={{ marginBottom: past.length || pendingReflection.length ? 18 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: 700, color: 'var(--dc-primary)' }}>
                  {GOAL_DECLARATION_STATUS_LABEL.active}
                </span>
                <span className="dc-num" style={{ flex: 1, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}>
                  {md(active.periodFrom)}〜{md(active.periodTo)}
                  {`（あと${daysLeft(active, todayKey)}日）`}
                </span>
                {linkButton('編集する ›', () => onEdit(active))}
              </div>

              {/* 宣言文は左の縦罫つきの引用体。コーチが決めたタスク一覧と見た目で区別する */}
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
                {active.text}
              </p>

              <p className="dc-num" style={{ margin: '10px 0 0', fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}>
                この期間の学習 {formatMinutesHM(declarationMinutes(active, daily))} ・
                {` ${declarationStudyDays(active, daily)}日`}
              </p>
            </div>
          )}

          {/* 期間が終わったのに振り返りがまだのもの。放置を拾えるように上に出す */}
          {pendingReflection.map((d) => (
            <div
              key={d.id}
              style={{
                marginBottom: 12,
                padding: '12px 14px',
                borderRadius: 'var(--dc-radius-md)',
                background: 'var(--dc-gold-surface)',
                border: '1px solid var(--dc-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: 700, color: 'var(--dc-gold-text)' }}>
                  期間終了・振り返り待ち
                </span>
                <span className="dc-num" style={{ flex: 1, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}>
                  {md(d.periodFrom)}〜{md(d.periodTo)}
                </span>
                {linkButton('振り返りを書く ›', () => onReview(d))}
              </div>
              <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text)', overflowWrap: 'anywhere' }}>
                {d.text}
              </p>
            </div>
          ))}

          {/* これまでの宣言 */}
          {past.length > 0 && (
            <div style={{ marginTop: 4, borderTop: '1px solid var(--dc-border)', paddingTop: 12 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 'var(--dc-fs-caption)', fontWeight: 700, color: 'var(--dc-text-subtle)' }}>
                これまでの宣言
              </h3>
              {past.map((d) => {
                const phase = declarationPhase(d, todayKey);
                return (
                  <button
                    key={d.id}
                    type="button"
                    className="studylog-goal-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    onClick={() => onView(d)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', minHeight: 44, padding: '10px 8px',
                      border: 'none', borderTop: '1px solid var(--dc-border)',
                      background: 'transparent', borderRadius: 8,
                      fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)',
                      textAlign: 'left', cursor: 'pointer',
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
                    {/* 状態は色ではなく語で出す */}
                    <span style={{ flex: 'none', fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}>
                      {phase === 'upcoming' ? 'これから' : GOAL_DECLARATION_STATUS_LABEL[d.status]}
                      {d.reflectionAchievement ? ` ・ ${ACHIEVEMENT_LABEL[d.reflectionAchievement]}` : ''}
                    </span>
                    <span aria-hidden="true" style={{ flex: 'none', color: 'var(--dc-chevron)' }}>›</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default GoalDeclarationCard;
