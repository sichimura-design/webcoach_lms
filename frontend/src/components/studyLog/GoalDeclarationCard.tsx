import { useState } from 'react';
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
  formatPeriod,
} from '../../utils/goalDeclaration';
import { formatMinutesHM, toLocalDateKey } from '../../utils/studyStats';
import Loading from '../shared/Loading';

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
 *
 * 並びは上から「進行中（1件）／振り返り待ち／ほかの進行中・これから／これまで」。
 * 🔴 「これまでの宣言」には終わったもの（期間終了 or 状態が決まったもの）だけを入れる。
 *    これから始まる目標や並行中の目標を混ぜると見出しと中身が食い違う。
 * 🔴 件数で縦に伸び続けないよう、振り返り待ちとこれまでの宣言は先頭だけ出して畳む。
 *    取得は全件のまま（進行中の判定に全件が要る）。畳むのは表示だけ。
 * 🔴 期間は formatPeriod で出す。M/D だけだと前年の同じ月の目標と見分けが付かない。
 * 🔴 id="goal" はマイページの「編集する ›」(/study-log#goal) の飛び先。消さないこと。
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
  /** 目標を開く。振り返り待ちなら振り返り、それ以外は編集のモーダルになる（決めるのは呼び出し側） */
  onOpen: (declaration: GoalDeclaration) => void;
}

/** 振り返り待ちとこれまでの宣言を、畳んだ状態で何件まで出すか */
const PENDING_VISIBLE = 3;
const PAST_VISIBLE = 5;

const CARD: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
};

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
  onOpen,
}: GoalDeclarationCardProps) {
  const todayKey = toLocalDateKey(new Date());
  const [showAllPending, setShowAllPending] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);

  // 「いま出しているもの」以外を、まだ動いているもの／終わったものに分ける
  const shownIds = new Set([active?.id, ...pendingReflection.map((d) => d.id)].filter(Boolean));
  const rest = items.filter((d) => !shownIds.has(d.id));
  const others = rest.filter((d) => d.status === 'active' && declarationPhase(d, todayKey) !== 'past');
  const past = rest.filter((d) => !others.includes(d));

  const pendingShown = showAllPending ? pendingReflection : pendingReflection.slice(0, PENDING_VISIBLE);
  const pastShown = showAllPast ? past : past.slice(0, PAST_VISIBLE);

  const rowLabel = (d: GoalDeclaration): string => {
    const phase = declarationPhase(d, todayKey);
    if (phase === 'upcoming') return 'これから';
    // 振り返りは書いたが状態は進行中のまま、の目標。「進行中」と出すと期間中に見える
    if (d.status === 'active' && phase === 'past') return '期間終了';
    return GOAL_DECLARATION_STATUS_LABEL[d.status];
  };

  const row = (d: GoalDeclaration) => (
    <button
      key={d.id}
      type="button"
      className="studylog-goal-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      onClick={() => onOpen(d)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', minHeight: 44, padding: '10px 8px',
        border: 'none', borderTop: '1px solid var(--dc-border)',
        background: 'transparent', borderRadius: 8,
        fontFamily: 'inherit', fontSize: 'var(--dc-fs-body)',
        textAlign: 'left', cursor: 'pointer',
      }}
    >
      <span className="studylog-goal-row__period dc-num" style={{ flex: 'none', minWidth: 92, color: 'var(--dc-text-muted)', fontSize: 'var(--dc-fs-caption)', whiteSpace: 'nowrap' }}>
        {formatPeriod(d.periodFrom, d.periodTo, todayKey)}
      </span>
      <span
        className="studylog-goal-row__text"
        style={{
          flex: 1, minWidth: 0, color: 'var(--dc-text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {d.text}
      </span>
      {/* 状態は色ではなく語で出す */}
      <span className="studylog-goal-row__status" style={{ flex: 'none', fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}>
        {rowLabel(d)}
        {d.reflectionAchievement ? ` ・ ${ACHIEVEMENT_LABEL[d.reflectionAchievement]}` : ''}
      </span>
      <span className="studylog-goal-row__chevron" aria-hidden="true" style={{ flex: 'none', color: 'var(--dc-chevron)' }}>›</span>
    </button>
  );

  const subHeading = (label: string) => (
    <h3 style={{ margin: '0 0 4px', fontSize: 'var(--dc-fs-caption)', fontWeight: 700, color: 'var(--dc-text-subtle)' }}>
      {label}
    </h3>
  );

  const toggle = (expanded: boolean, hiddenCount: number, onClick: () => void) => (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onClick}
      className="dc-link-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        display: 'block', margin: '8px auto 0', background: 'none', border: 'none', padding: '4px 8px',
        fontFamily: 'inherit', fontSize: 'var(--dc-fs-caption)', fontWeight: 700,
        color: 'var(--dc-primary)', cursor: 'pointer',
      }}
    >
      {expanded ? '閉じる' : `ほか${hiddenCount}件を表示`}
    </button>
  );

  return (
    <section id="goal" style={{ ...CARD, scrollMarginTop: 16 }}>
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
          data-goal-create
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
        <Loading />
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
          目標が設定されていません
        </p>
      ) : (
        <>
          {/* 進行中 */}
          {active && (
            <div style={{ marginBottom: rest.length || pendingReflection.length ? 18 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: 700, color: 'var(--dc-primary)' }}>
                  {GOAL_DECLARATION_STATUS_LABEL.active}
                </span>
                <span className="dc-num" style={{ flex: 1, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}>
                  {formatPeriod(active.periodFrom, active.periodTo, todayKey)}
                  {`（あと${daysLeft(active, todayKey)}日）`}
                </span>
                {linkButton('編集する ›', () => onOpen(active))}
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
          {pendingShown.map((d) => (
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
                  {formatPeriod(d.periodFrom, d.periodTo, todayKey)}
                </span>
                {linkButton('振り返りを書く ›', () => onOpen(d))}
              </div>
              <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text)', overflowWrap: 'anywhere' }}>
                {d.text}
              </p>
            </div>
          ))}

          {pendingReflection.length > PENDING_VISIBLE &&
            toggle(showAllPending, pendingReflection.length - PENDING_VISIBLE, () => setShowAllPending((v) => !v))}

          {/* 並行中・これから始まる目標。進行中に出している1件以外 */}
          {others.length > 0 && (
            <div style={{ marginTop: 4, borderTop: '1px solid var(--dc-border)', paddingTop: 12 }}>
              {subHeading('ほかの進行中・これからの目標')}
              {others.map(row)}
            </div>
          )}

          {/* これまでの宣言 */}
          {past.length > 0 && (
            <div style={{ marginTop: others.length ? 12 : 4, borderTop: '1px solid var(--dc-border)', paddingTop: 12 }}>
              {subHeading('これまでの宣言')}
              {pastShown.map(row)}
              {past.length > PAST_VISIBLE && toggle(showAllPast, past.length - PAST_VISIBLE, () => setShowAllPast((v) => !v))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default GoalDeclarationCard;
