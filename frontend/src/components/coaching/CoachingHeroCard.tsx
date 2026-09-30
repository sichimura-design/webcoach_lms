/**
 * /coaching 先頭の「次回コーチング」カード。
 * デザイン『コーチング トップ 3案.dc.html』案1C を踏襲。
 *
 * dev/miyabe版と異なり、会議リンクは常に既に存在する（Organizer中心モデルで
 * 予約作成時にGoogle Meet URLが自動発行されるため）。そのため dev/miyabe にあった
 * 「会議リンク未登録／登録フォーム」「記録中／生成中／確認待ち／失敗」の各状態は
 * 存在しない — 参加ボタンを押せば常にそのまま会議に入れる。
 */
import React from 'react';
import { CalendarDays, Video } from 'lucide-react';
import { untilLabel } from '../../utils/coachingSchedule';
import { C, CARD, PRIMARY_BUTTON } from './design1c';

interface CoachingHeroCardProps {
  coachName: string;
  /** 表示用の日付文字列（例: '2026-09-10'） */
  dateLabel: string;
  /** 「次回まであと何日」を出すためのISO8601。取れない場合はnull */
  startsAt: string | null;
  meetingUrl: string;
}

export function CoachingHeroCard({ coachName, dateLabel, startsAt, meetingUrl }: CoachingHeroCardProps) {
  const until = untilLabel(startsAt);

  return (
    <section style={{ ...CARD, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: 9999,
              background: C.brandSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <CalendarDays size={24} color={C.brand} strokeWidth={1.75} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
              次回コーチング
              <span style={{ fontWeight: 400, color: C.muted, marginLeft: 8 }}>{coachName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>{dateLabel}</span>
              {until && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.brand,
                    background: C.brandSoft,
                    borderRadius: 9999,
                    padding: '4px 10px',
                  }}
                >
                  {until}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 300, flex: 'none', maxWidth: '100%' }}>
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...PRIMARY_BUTTON, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Video size={17} fill="#fff" strokeWidth={1.5} />
            コーチングに参加する
          </a>
        </div>
      </div>
    </section>
  );
}

export default CoachingHeroCard;
