import { StudyStatsSummary } from '../../types/studyActivity';
import { splitMinutesHM } from '../../utils/studyStats';

/**
 * 期間に依存しない累計の KPI 4枚（/study-log）。
 * ============================================================
 * 🔴 StudyRecordPanel から KPI を外に出した理由:
 *    4枚のうち「期間合計」だけが期間タブに連動していて、残り3枚は無関係なのに
 *    同じ枠にいた。タブに「月別」を足すと「期間合計＝直近13ヶ月」というKPIになり、
 *    隣の「今週の学習時間」と粒度が合わなくなる。
 *    期間に依存しない数字はここ、期間に連動する数字はグラフ側、と分けている。
 *
 * 🔴 「教材別の累計」（stats.byCourse を分数つきで並べる節）は削除した。
 *    教材ごとの学習時間を画面に出さない方針にしたため。時間の計上単位は
 *    「日ごとの合計」1つだけで、教材は名前と学習した内容だけを出す。
 *    集計自体（stats.byCourse）は残っていて、記録の編集モーダルの
 *    教材セレクト（StudyLogPage の courseOptions）が選択肢として使っている。
 *
 * 🔴 ページの先頭には置かない。先頭は「今月の目標 → カレンダー」で、
 *    累計はグラフの下に添える（開いた瞬間に数字を突きつけない）。
 * ============================================================
 */
interface StudySummaryStripProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
}

const loadingParts = [{ value: '…', unit: '' }];

function Kpi({
  label,
  parts,
  accent,
}: {
  label: string;
  parts: { value: string; unit: string }[];
  accent?: boolean;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-md)',
        padding: '16px 18px',
        minWidth: 0,
      }}
    >
      {/* 🔴 ラベルに nowrap を掛けない。溢れるくらいなら2行になったほうがよい
             （4枚は grid なので高さは自動で揃う）。値だけ nowrap を保つ。 */}
      <div
        style={{
          fontSize: 'var(--dc-fs-body)',
          color: 'var(--dc-text-body)',
          marginBottom: 6,
          lineHeight: 'var(--dc-lh-ui)',
        }}
      >
        {label}
      </div>
      <div
        className="dc-num"
        style={{
          fontSize: 'var(--dc-fs-display)',
          fontWeight: 700,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          color: accent ? 'var(--dc-primary)' : 'var(--dc-text)',
        }}
      >
        {parts.map((p, i) => (
          <span key={i}>
            {p.value}
            {p.unit && (
              <span style={{ fontSize: 'var(--dc-fs-body)', fontWeight: 600, marginLeft: 2, marginRight: 4 }}>
                {p.unit}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StudySummaryStrip({ stats, loading }: StudySummaryStripProps) {
  return (
    <section
      style={{
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: 'var(--dc-shadow-card)',
        padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
      }}
    >
      <div className="studylog-kpi-grid">
        <Kpi
          label="総学習時間"
          parts={loading ? loadingParts : splitMinutesHM(stats?.allTime.minutes ?? 0)}
        />
        <Kpi
          label="今月の学習日数"
          parts={loading ? loadingParts : [{ value: String(stats?.streak.monthStudyDays ?? 0), unit: '日' }]}
        />
        <Kpi
          label="今週の学習時間"
          parts={loading ? loadingParts : splitMinutesHM(stats?.week.minutes ?? 0)}
        />
        <Kpi
          label="現在の連続日数"
          parts={loading ? loadingParts : [{ value: String(stats?.streak.currentDays ?? 0), unit: '日' }]}
          accent
        />
      </div>
    </section>
  );
}

export default StudySummaryStrip;
