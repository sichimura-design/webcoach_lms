import React, { useState, useEffect } from 'react';
import { Calendar, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';
import bffClient from '../services/bffClient';
import { CoachingSchedule } from '../types/api';
import { color, font, t } from '../theme/webcoachTheme';

export function MyCoachingPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<CoachingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    bffClient.getCoachingSchedules(user.userid)
      .then(setSchedules)
      .catch(() => setError('コーチング記録の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div style={{ minHeight: '100vh', background: color.pageBg, display: 'flex', flexDirection: 'column' }}>
      <AppHeader userName={user?.username} />

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 860,
          margin: '0 auto',
          padding: '32px 20px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          fontFamily: font.family,
        }}
      >
        <h1 style={{ ...font.pageTitle, color: color.text, margin: 0 }}>これまでのコーチング</h1>

        {error && (
          <div style={{ ...t.chip, background: '#FDEAE6', color: color.primary, padding: '10px 14px', borderRadius: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <p style={{ ...font.meta, color: color.textMuted, textAlign: 'center', padding: '48px 0' }}>読み込み中…</p>
          ) : schedules.length === 0 ? (
            <p style={{ ...font.meta, color: color.textSubtle, textAlign: 'center', padding: '48px 0' }}>
              まだ記録がありません。
            </p>
          ) : (
            schedules.map(schedule => {
              const isOpen = openId === schedule.id;
              return (
                <div key={schedule.id} style={{ ...t.card, padding: '16px 18px' }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : schedule.id)}
                    style={{
                      textAlign: 'left', width: '100%', background: 'none', border: 'none', padding: 0,
                      cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
                      alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ ...font.rowTitle, color: color.text }}>第{schedule.coaching_no}回</span>
                        <span style={{ ...font.caption, color: color.textSubtle, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar className="w-3.5 h-3.5" />
                          {schedule.coaching_date}
                        </span>
                        {schedule.todo && (
                          <span style={{ ...t.chip, background: '#FFF6E5', color: '#B26A00' }}>TODOあり</span>
                        )}
                      </span>
                      {!isOpen && schedule.coaching_summary && (
                        <span
                          style={{
                            ...font.meta, color: color.textMuted,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            overflow: 'hidden', lineHeight: 1.8,
                          }}
                        >
                          {schedule.coaching_summary}
                        </span>
                      )}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: color.textFaint }} />
                    ) : (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: color.textFaint }} />
                    )}
                  </button>

                  {isOpen && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color.divider}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {schedule.meeting_url && (
                        <a
                          href={schedule.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ ...font.link, color: '#3A5C8F', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {schedule.meeting_url}
                        </a>
                      )}
                      <div>
                        <p style={{ ...font.label, color: color.textSubtle, margin: '0 0 4px' }}>コーチング内容の要約</p>
                        <p style={{ ...font.meta, color: color.textBody, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                          {schedule.coaching_summary || '—'}
                        </p>
                      </div>
                      <div>
                        <p style={{ ...font.label, color: color.textSubtle, margin: '0 0 4px' }}>次回までのTODO</p>
                        <p style={{ ...font.meta, color: color.textBody, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                          {schedule.todo || '—'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
