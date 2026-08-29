/**
 * ページ最下段の「これまでのふりかえり」。
 * デザイン『コーチング トップ 3案.dc.html』案1C。
 *
 * 1行1回。日付・一言要約・詳細への入口だけに絞る。
 * 直近3件を出し、残りは同じカードの中で開く（別ページは作らない）。
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatSessionDate } from '../../utils/coachingSchedule';
import { C, CARD } from './design1c';
import type { CoachingSessionSummary } from '../../types/coaching';

/** 折りたたまずに見せる件数 */
const VISIBLE_LIMIT = 3;

interface CoachingHistoryListProps {
  sessions: CoachingSessionSummary[];
  onOpen: (sessionId: number) => void;
}

export function CoachingHistoryList({ sessions, onOpen }: CoachingHistoryListProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = sessions.length > VISIBLE_LIMIT;
  const visible = hasMore && !expanded ? sessions.slice(0, VISIBLE_LIMIT) : sessions;

  return (
    <section style={{ ...CARD, padding: '16px 24px' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, paddingBottom: 4 }}>これまでのふりかえり</div>

      {sessions.length === 0 ? (
        <p style={{ margin: 0, padding: '10px 0 4px', fontSize: 13, color: C.muted, lineHeight: 1.9, borderTop: `1px solid ${C.line}` }}>
          まだ記録がありません。初回のコーチングが終わると、話した内容と決めたことがここに残り、
          回を重ねるほど自分の変化を辿れるようになります。
        </p>
      ) : (
        <>
          {visible.map((s) => (
            <button
              key={s.id}
              type="button"
              className="cg-row focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              onClick={() => onOpen(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                minHeight: 44,
                padding: '8px 0',
                borderTop: `1px solid ${C.line}`,
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                background: 'transparent',
                fontSize: 13,
                fontFamily: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {/* 日付と回数は幅を固定して縦に揃える。折り返させると
                  「何回目か」の並びが崩れて積み上がりが読めなくなる */}
              <span style={{ fontWeight: 700, width: 210, flex: 'none', color: C.ink, whiteSpace: 'nowrap' }}>
                {formatSessionDate(s.date)}
                <span style={{ fontWeight: 400, color: C.muted, marginLeft: 8 }}>{s.title}</span>
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: C.muted,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {s.summary}
              </span>
              <span className="cg-link" style={{ color: C.brand, fontWeight: 700, flex: 'none' }}>
                詳しく見る ›
              </span>
            </button>
          ))}

          {hasMore && (
            <button
              type="button"
              className="cg-row"
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                height: 42,
                borderTop: `1px solid ${C.line}`,
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                background: 'transparent',
                fontSize: 12.5,
                fontWeight: 700,
                color: C.brand,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {expanded ? '閉じる' : '全てのコーチング記録を見る'}
              {expanded ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export default CoachingHistoryList;
