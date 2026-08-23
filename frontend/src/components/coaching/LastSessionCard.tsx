/**
 * タイムライン「前回」の振り返りカード。
 * デザイン『コーチング トップ 3案.dc.html』案1C。
 *
 * 左＝AIサマリー（何を話したか）、右＝キーポイント（何が決まったか）。
 * 一覧の要約文字列だけでは「決まったこと」が出せないので、
 * 呼び出し側で直近セッションの詳細を1件だけ取ってきて渡す。
 */
import React from 'react';
import { Check } from 'lucide-react';
import { formatSessionDate } from '../../utils/coachingSchedule';
import { C, CARD } from './design1c';
import type { CoachingSessionDetail, CoachingSessionSummary } from '../../types/coaching';

interface LastSessionCardProps {
  session: CoachingSessionSummary;
  /** 直近セッションの詳細。取得前・取得失敗時は null */
  detail: CoachingSessionDetail | null;
  onOpen: (sessionId: number) => void;
}

/** キーポイント。決まったこと → コーチからの指摘 → 進んだこと の順に拾って3件まで */
function keyPoints(detail: CoachingSessionDetail | null): string[] {
  const s = detail?.summary;
  if (!s) return [];
  const source = s.decisions.length > 0 ? s.decisions : s.coachFeedback.length > 0 ? s.coachFeedback : s.progressSinceLast;
  return source.slice(0, 3).map((e) => e.title);
}

export function LastSessionCard({ session, detail, onOpen }: LastSessionCardProps) {
  const points = keyPoints(detail);
  const summaryText = detail?.summary?.sessionSummary || session.summary;

  return (
    <section style={{ ...CARD, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.ink, flex: 1, minWidth: 0 }}>
          前回の振り返り
          <span style={{ fontSize: 13, fontWeight: 400, color: C.muted, marginLeft: 8 }}>
            {session.title}・{formatSessionDate(session.date)}
          </span>
        </h3>
        <button
          type="button"
          className="cg-link focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          onClick={() => onOpen(session.id)}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.brand,
            background: 'none',
            border: 'none',
            padding: 0,
            fontFamily: 'inherit',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          詳細を見る ›
        </button>
      </div>

      <div className="cg-last-2col" style={{ display: 'grid', gridTemplateColumns: points.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
        <div style={{ background: C.brandFaint, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 6 }}>AIサマリー</div>
          <p style={{ margin: 0, fontSize: 13, color: C.body, lineHeight: 1.8 }}>{summaryText}</p>
        </div>

        {points.length > 0 && (
          <div style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 6 }}>キーポイント</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: C.body }}>
              {points.map((p) => (
                <div key={p} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.7 }}>
                  <Check size={14} color={C.ok} strokeWidth={2.5} style={{ marginTop: 3, flex: 'none' }} />
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default LastSessionCard;
