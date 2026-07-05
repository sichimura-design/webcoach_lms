import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AppHeader } from '../shared/AppHeader';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import { getBlockedSlots, blockSlot, unblockSlot } from '../../services/coachScheduleApi';
import { BlockedSlot } from '../../types/coachSchedule';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let minutes = 9 * 60; minutes <= 20 * 60 + 30; minutes += 30) {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
})();

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

export function CoachScheduleBlockPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(today));
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    getBlockedSlots()
      .then(setBlockedSlots)
      .catch(() => setError('日程情報の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const blockedTimesForSelectedDate = useMemo(
    () => new Set(blockedSlots.filter(s => s.date === selectedDate).map(s => s.time)),
    [blockedSlots, selectedDate]
  );

  const blockedForSelectedDate = useMemo(
    () => blockedSlots.filter(s => s.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)),
    [blockedSlots, selectedDate]
  );

  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${y}年${m}月${d}日(${WEEKDAY_LABELS[date.getDay()]})`;
  }, [selectedDate]);

  async function handleToggleSlot(time: string) {
    const key = `${selectedDate}_${time}`;
    if (pendingKey) return;

    setPendingKey(key);
    setError(null);
    const isBlocked = blockedTimesForSelectedDate.has(time);

    try {
      if (isBlocked) {
        await unblockSlot(selectedDate, time);
        setBlockedSlots(prev => prev.filter(s => !(s.date === selectedDate && s.time === time)));
      } else {
        const slot = await blockSlot(selectedDate, time);
        setBlockedSlots(prev => [...prev, slot]);
      }
    } catch {
      setError('更新に失敗しました。もう一度お試しください');
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username} />

      {/* Background decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" style={{ zIndex: 0 }}>
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px', filter: 'blur(40px)' }} />
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(253,234,226,0.5) 0%, transparent 70%)', top: '-100px', right: '-400px', filter: 'blur(40px)' }} />
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(242,147,103,0.3) 0%, transparent 70%)', bottom: '-300px', left: '30%', filter: 'blur(40px)' }} />
      </div>

      <div className="relative flex-1 max-w-[860px] w-full mx-auto px-4 sm:px-6 py-8 pb-24 sm:pb-8" style={{ zIndex: 1 }}>
        <h1 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: '#4B3A33' }}>コーチの日程を抑える</h1>
        <p className="text-sm mb-6" style={{ color: '#7E6E68' }}>抑えた時間帯は受講生から予約できなくなります</p>

        {/* Week navigation */}
        <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <Button variant="brand-ghost" size="icon" onClick={() => setWeekStart(prev => addDays(prev, -7))} aria-label="前の週">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-bold" style={{ color: '#4B3A33' }}>{selectedDateLabel}</span>
            <Button variant="brand-ghost" size="icon" onClick={() => setWeekStart(prev => addDays(prev, 7))} aria-label="次の週">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map(day => {
              const key = toDateKey(day);
              const isSelected = key === selectedDate;
              const isToday = key === toDateKey(today);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className="flex flex-col items-center py-2 rounded-xl transition-colors"
                  style={{
                    background: isSelected ? 'linear-gradient(135deg, #E86D78, #FA9262)' : '#FAF8F4',
                    border: isToday && !isSelected ? '1px solid #E86D78' : '1px solid transparent',
                  }}
                >
                  <span className="text-[11px]" style={{ color: isSelected ? 'rgba(255,255,255,0.85)' : '#7E6E68' }}>
                    {WEEKDAY_LABELS[day.getDay()]}
                  </span>
                  <span className="text-sm font-bold" style={{ color: isSelected ? '#fff' : '#4B3A33' }}>
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time slot grid */}
        <div className="bg-white rounded-2xl p-4 mb-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#7E6E68' }}>
              <span className="w-3 h-3 rounded-full" style={{ background: '#FAF8F4', border: '1px solid #EDE8E3' }} />
              予約可
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#7E6E68' }}>
              <span className="w-3 h-3 rounded-full" style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }} />
              抑え中
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: '#7E6E68' }}>読み込み中...</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {TIME_SLOTS.map(time => {
                const isBlocked = blockedTimesForSelectedDate.has(time);
                const key = `${selectedDate}_${time}`;
                const isPending = pendingKey === key;
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleSlot(time)}
                    className="py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50"
                    style={
                      isBlocked
                        ? { background: 'linear-gradient(135deg, #E86D78, #FA9262)', color: '#fff' }
                        : { background: '#FAF8F4', color: '#4B3A33', border: '1px solid #EDE8E3' }
                    }
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          )}

          {error && (
            <p className="text-xs mt-3" style={{ color: '#E86D78' }}>{error}</p>
          )}
        </div>

        {/* Selected day summary */}
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: '#4B3A33' }}>
            {selectedDateLabel} に抑えている時間
          </h2>
          {blockedForSelectedDate.length === 0 ? (
            <p className="text-sm py-2" style={{ color: '#7E6E68' }}>抑えている時間帯はありません</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blockedForSelectedDate.map(slot => (
                <span
                  key={slot.time}
                  className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm"
                  style={{ background: '#FAF8F4', color: '#4B3A33', border: '1px solid #EDE8E3' }}
                >
                  {slot.time}
                  <button
                    type="button"
                    onClick={() => handleToggleSlot(slot.time)}
                    className="p-0.5 rounded-full bg-transparent border-0 cursor-pointer flex items-center"
                    style={{ color: '#7E6E68' }}
                    aria-label={`${slot.time} の抑えを解除`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs mt-8" style={{ color: '#C3BAB4' }}>2026 © WEBCOACH</p>
      </div>
    </div>
  );
}
