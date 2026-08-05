/**
 * コーチング中（記録中）の画面。
 *
 * 会議は別タブで開いているので、LMS側は「記録が続いていること」を示すだけでよい。
 * このページを閉じても記録は止まらない — そこを明示しないと、受講生が
 * タブを閉じられずに不安を抱えたままになる。
 *
 * モック段階では実際の録画状態とは連動しない（見た目のみ）。
 */
import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { MOCKS_ENABLED } from '../../mocks/config';
import { displayMeetingUrl } from '../../utils/parseMeetingLink';
import type { CoachingSessionDetail } from '../../types/coaching';

interface RecordingStatusProps {
  session: CoachingSessionDetail;
  /** モック限定: コーチング終了 → AI生成の開始 */
  onFinish: () => void;
  finishing: boolean;
}

export function RecordingStatus({ session, onFinish, finishing }: RecordingStatusProps) {
  const link = session.meetingLink;

  return (
    <section style={{ ...t.card, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: color.primary,
            animation: 'coaching-blink 1.4s ease-in-out infinite',
          }}
        />
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>
          AIコーチングノート記録中
        </h2>
      </div>

      <p style={{ ...font.meta, color: color.textBody, margin: '0 0 6px', lineHeight: 1.9 }}>
        コーチング終了後、内容を自動で整理します。
      </p>
      <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 20px', lineHeight: 1.9 }}>
        このページを閉じても、{link ? (link.provider === 'zoom' ? 'Zoom' : 'Google Meet') : '会議ツール'}側で記録は継続します。
      </p>

      {link && (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...t.outlineButton, display: 'inline-flex', textDecoration: 'none' }}
        >
          <ExternalLink className="w-4 h-4" />
          会議画面を開く
        </a>
      )}

      {link && (
        <p style={{ ...font.caption, color: color.textSubtle, margin: '12px 0 0', wordBreak: 'break-all' }}>
          {displayMeetingUrl(link)}
          {link.passcode && ` ・ パスコード ${link.passcode}`}
        </p>
      )}

      {MOCKS_ENABLED && (
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px dashed ${color.border}` }}>
          <p style={{ ...font.caption, color: color.textFaint, margin: '0 0 10px' }}>
            実運用では会議ツールからの通知で自動的に次へ進みます
          </p>
          <button
            type="button"
            onClick={onFinish}
            disabled={finishing}
            style={{
              ...font.link,
              color: color.textSubtle,
              background: 'none',
              border: `1px solid ${color.border}`,
              borderRadius: radius.pill,
              padding: '8px 16px',
              cursor: finishing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: finishing ? 0.6 : 1,
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {finishing ? '処理を開始しています…' : '（モック）コーチングを終了する'}
          </button>
        </div>
      )}

      <style>{'@keyframes coaching-blink{0%,100%{opacity:1}50%{opacity:.25}}'}</style>
    </section>
  );
}

export default RecordingStatus;
