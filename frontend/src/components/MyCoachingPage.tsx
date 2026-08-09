import React, { useState, useEffect } from 'react';
import { Calendar, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { AppHeader } from './shared';
import { useAuth } from '../contexts/AuthContext';
import bffClient from '../services/bffClient';
import { CoachingSchedule } from '../types/api';

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
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" style={{ zIndex: 0 }}>
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px', filter: 'blur(40px)' }} />
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(253,234,226,0.5) 0%, transparent 70%)', top: '-100px', right: '-400px', filter: 'blur(40px)' }} />
      </div>

      <div className="relative flex-1 max-w-[860px] w-full mx-auto px-4 sm:px-6 py-8 pb-24 sm:pb-8" style={{ zIndex: 1 }}>
        <h1 className="text-xl sm:text-2xl font-bold mb-6" style={{ color: '#4B3A33' }}>これまでのコーチング</h1>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#FDEAE6', color: '#E86D78' }}>
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: '#7E6E68' }}>読み込み中...</div>
          ) : schedules.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: '#7E6E68' }}>
              まだ記録がありません
            </div>
          ) : (
            schedules.map(schedule => {
              const isOpen = openId === schedule.id;
              return (
                <div
                  key={schedule.id}
                  className="bg-white rounded-2xl p-5"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F0EAE6' }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : schedule.id)}
                    className="text-left w-full flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-bold text-sm" style={{ color: '#4B3A33' }}>
                          第{schedule.coaching_no}回
                        </span>
                        <span className="text-xs flex items-center gap-1" style={{ color: '#7E6E68' }}>
                          <Calendar className="w-3.5 h-3.5" />
                          {schedule.coaching_date}
                        </span>
                        {schedule.todo && (
                          <span
                            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                            style={{ background: '#FFF6E5', color: '#B26A00' }}
                          >
                            TODOあり
                          </span>
                        )}
                      </div>
                      {!isOpen && schedule.coaching_summary && (
                        <p className="text-sm line-clamp-2" style={{ color: '#7E6E68' }}>
                          {schedule.coaching_summary}
                        </p>
                      )}
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: '#C3BAB4' }} />
                    ) : (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: '#C3BAB4' }} />
                    )}
                  </button>

                  {isOpen && (
                    <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid #F5F0ED' }}>
                      {schedule.meeting_url && (
                        <a
                          href={schedule.meeting_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 hover:underline"
                          style={{ color: '#3A5C8F' }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {schedule.meeting_url}
                        </a>
                      )}
                      <div>
                        <p className="text-xs font-bold mb-1" style={{ color: '#7E6E68' }}>コーチング内容の要約</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: '#4B3A33' }}>
                          {schedule.coaching_summary || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold mb-1" style={{ color: '#7E6E68' }}>次回までのTODO</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: '#4B3A33' }}>
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
      </div>
    </div>
  );
}
