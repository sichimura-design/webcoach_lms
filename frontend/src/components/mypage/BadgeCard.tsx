import React from 'react';
import { Badge as BadgeType } from '../../types/mypage';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';

interface BadgeCardProps {
  badge: BadgeType;
  onClick?: () => void;
}

export function BadgeCard({ badge, onClick }: BadgeCardProps) {
  const isEarned = !!badge.earnedAt;

  // Rarity colors
  const rarityColors = {
    common: 'text-gray-600',
    rare: 'text-blue-600',
    epic: 'text-purple-600',
    legendary: 'text-yellow-600',
  };

  return (
    <Card
      onClick={onClick}
      className={`
        border-0 shadow-none cursor-pointer transition-all
        ${isEarned ? 'hover:shadow-lg' : 'opacity-50 grayscale'}
      `}
    >
      <CardContent className="p-3 sm:p-6 flex flex-col items-center text-center">
        {/* Badge Icon */}
        <div
          className={`
            w-16 h-16 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mb-3 sm:mb-4
            ${isEarned ? 'bg-gradient-to-br from-yellow-100 to-yellow-200' : 'bg-gray-100'}
          `}
        >
          {badge.iconUrl ? (
            <img src={badge.iconUrl} alt={badge.name} className="w-10 h-10 sm:w-16 sm:h-16" />
          ) : (
            <div className={`text-2xl sm:text-4xl ${isEarned ? rarityColors[badge.rarity] : 'text-gray-400'}`}>
              🏅
            </div>
          )}
        </div>

        {/* Badge Name */}
        <h3
          className="text-sm font-bold text-gray-900 mb-2"
        >
          {badge.name}
        </h3>

        {/* Earned Date or Progress */}
        {isEarned ? (
          <p className="text-xs text-gray-500">
            {new Date(badge.earnedAt!).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })}{' '}
            獲得
          </p>
        ) : badge.progress !== undefined ? (
          <div className="w-full">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>進捗</span>
              <span>{badge.progress}%</span>
            </div>
            <Progress value={badge.progress} className="h-1.5" />
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            未獲得
          </p>
        )}
      </CardContent>
    </Card>
  );
}
