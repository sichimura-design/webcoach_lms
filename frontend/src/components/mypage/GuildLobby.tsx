import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CommunityPulse } from '../../types/mypage';
import { totalTodayMessage, activityRoomMessage } from '../../utils/socialProofMessages';

interface GuildLobbyProps {
  pulse: CommunityPulse;
}

// 生成した背景イラスト（public/guild-lobby-bg.png）内の部屋ゾーンの位置（画像に対する%座標）。
// 実データの部屋数がこれより少ない/多い場合も破綻しないよう、先頭から順にマッピングする
const ROOM_ZONES = [
  { x: 20, y: 55 }, // 左: 集中デスク（個人・PC）
  { x: 40, y: 78 }, // 中央: グループコワーキングテーブル
  { x: 48, y: 42 }, // 奥中央: ソファラウンジ
  { x: 67, y: 74 }, // 右手前: きつねのいるくつろぎスペース
  { x: 85, y: 55 }, // 右: 受付カウンター
];

function GuildLobby({ pulse }: GuildLobbyProps) {
  const navigate = useNavigate();
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const rooms = pulse.rooms.slice(0, ROOM_ZONES.length);

  return (
    <div className="relative overflow-hidden" style={{ borderRadius: 20, boxShadow: '0 8px 26px rgba(190,60,70,.08)' }}>
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        <motion.img
          src={`${process.env.PUBLIC_URL}/guild-lobby-bg.png`}
          alt="ギルドロビー"
          className="w-full h-full object-cover"
          style={{ display: 'block' }}
          animate={{ scale: [1, 1.015, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 62%, rgba(255,255,255,.85) 100%)' }}
        />

        {rooms.map((room, i) => {
          const zone = ROOM_ZONES[i];
          const isActive = activeRoom === room.id;
          return (
            <button
              key={room.id}
              onClick={() => setActiveRoom(isActive ? null : room.id)}
              onMouseEnter={() => setActiveRoom(room.id)}
              onMouseLeave={() => setActiveRoom((cur) => (cur === room.id ? null : cur))}
              className="glw-float absolute flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                transform: 'translate(-50%, -50%)',
                animationDelay: `${i * 0.4}s`,
                gap: 6,
                background: 'rgba(255,255,255,.94)',
                borderRadius: 999,
                padding: '6px 12px 6px 6px',
                boxShadow: isActive ? '0 8px 20px rgba(190,60,70,.28)' : '0 6px 16px rgba(190,60,70,.16)',
                border: 'none',
                zIndex: isActive ? 3 : 2,
              }}
            >
              <span className="flex" style={{ marginRight: 2 }}>
                {room.recentInitials.slice(0, 3).map((initial, idx) => (
                  <span
                    key={idx}
                    className="flex items-center justify-center rounded-full flex-shrink-0"
                    style={{
                      width: 22,
                      height: 22,
                      background: '#F6D2D2',
                      color: '#D6435C',
                      fontSize: 10,
                      fontWeight: 700,
                      border: '2px solid #fff',
                      marginLeft: idx === 0 ? 0 : -8,
                    }}
                  >
                    {initial}
                  </span>
                ))}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2A2230', whiteSpace: 'nowrap' }}>{room.count}人</span>

              <AnimatePresence>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 8px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#2A2230',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '6px 12px',
                      borderRadius: 10,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {activityRoomMessage(room.activityLabel, room.count)}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}

        <div className="absolute flex items-center justify-between" style={{ left: 20, right: 20, top: 16 }}>
          <div
            className="font-display"
            style={{ background: 'rgba(255,255,255,.92)', borderRadius: 999, padding: '8px 16px', fontWeight: 700, color: '#2A2230', fontSize: 14 }}
          >
            ギルドロビー
          </div>
          <div style={{ background: 'rgba(255,255,255,.92)', borderRadius: 999, padding: '8px 16px', fontWeight: 700, color: '#D60934', fontSize: 13 }}>
            {totalTodayMessage(pulse.totalToday)}
          </div>
        </div>

        <div className="absolute flex justify-center" style={{ left: 0, right: 0, bottom: 18 }}>
          <button
            onClick={() => navigate('/focus-booth')}
            className="inline-flex items-center gap-2 text-white font-bold appearance-none outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ background: '#D60934', borderRadius: 999, padding: '11px 24px', fontSize: 14, border: 'none' }}
          >
            集中ブースに入室する
          </button>
        </div>
      </div>
    </div>
  );
}

export default GuildLobby;
