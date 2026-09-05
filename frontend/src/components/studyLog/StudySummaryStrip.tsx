import { useState } from 'react';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM, splitMinutesHM } from '../../utils/studyStats';

/**
 * ページ先頭の総まとめ（/study-log の①）。
 * ============================================================
 * KPI 4枚 ＋ 教材別の累計。
 *
 * 🔴 StudyRecordPanel から KPI を外に出した理由:
 *    4枚のうち「期間合計」だけが期間タブに連動していて、残り3枚は無関係なのに
 *    同じ枠にいた。タブに「月別」を足すと「期間合計＝直近13ヶ月」というKPIになり、
 *    隣の「今週の学習時間」と粒度が合わなくなる。
 *    期間に依存しない数字はここ、期間に連動する数字はグラフ側、と分けている。
 *
 * 🔴 教材別（stats.byCourse）は集計済みなのにこれまでどの画面にも出ていなかった。
 *    「今までに何をどれだけ学習したか」に直接答えるので、ここに行リストで出す。
 *    円グラフにはしない（1画面のグラフが増えすぎる）。
 * ============================================================
 */
interface StudySummaryStripProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
}

/** 教材別に出す件数。これを超えたぶんは「ほかN件」で畳む */
const COURSE_LIMIT = 5;

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
  const [expanded, setExpanded] = useState(false);

  const byCourse = stats?.byCourse ?? [];
  const visible = expanded ? byCourse : byCourse.slice(0, COURSE_LIMIT);
  // バーの基準は最大値。合計に対する比率にすると、教材が多い人ほど全部の棒が短くなる
  const peak = byCourse.reduce((max, c) => Math.max(max, c.minutes), 0);

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

      {!loading && byCourse.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--dc-border)' }}>
          <h3
            style={{
              margin: '0 0 10px',
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 700,
              color: 'var(--dc-text)',
            }}
          >
            教材別の累計
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visible.map((c) => (
              <div
                key={String(c.courseId)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}
              >
                <span
                  style={{
                    flex: '0 1 40%',
                    minWidth: 0,
                    fontSize: 'var(--dc-fs-body)',
                    color: c.courseId === null ? 'var(--dc-text-muted)' : 'var(--dc-text-body)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={c.courseTitle}
                >
                  {c.courseTitle}
                </span>

                {/* 棒は補助。分数を必ず併記するので、棒が読めなくても情報は落ちない */}
                <span
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: 6,
                    borderRadius: 9999,
                    background: 'var(--dc-progress-track)',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      borderRadius: 9999,
                      width: `${peak > 0 ? Math.max(3, Math.round((c.minutes / peak) * 100)) : 0}%`,
                      background: c.courseId === null ? 'var(--dc-border-strong)' : 'var(--dc-bar-past)',
                    }}
                  />
                </span>

                <span
                  className="dc-num"
                  style={{
                    flex: 'none',
                    minWidth: 68,
                    textAlign: 'right',
                    fontSize: 'var(--dc-fs-body)',
                    fontWeight: 600,
                    color: 'var(--dc-text-body)',
                  }}
                >
                  {formatMinutesHM(c.minutes)}
                </span>
              </div>
            ))}
          </div>

          {byCourse.length > COURSE_LIMIT && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="dc-link-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                marginTop: 10,
                background: 'none',
                border: 'none',
                padding: 0,
                fontFamily: 'inherit',
                fontSize: 'var(--dc-fs-caption)',
                fontWeight: 700,
                color: 'var(--dc-primary)',
                cursor: 'pointer',
              }}
            >
              {expanded ? '畳む ⌃' : `ほか${byCourse.length - COURSE_LIMIT}件を見る ⌄`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default StudySummaryStrip;
