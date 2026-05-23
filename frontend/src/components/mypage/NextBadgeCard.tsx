import React from 'react';
import { Award, TrendingUp } from 'lucide-react';
import { NextBadge } from '../../types/mypage';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';

interface NextBadgeCardProps {
  badge: NextBadge;
}

function NextBadgeCard({ badge }: NextBadgeCardProps) {
  const getRarityColor = (rarity: NextBadge['rarity']) => {
    switch (rarity) {
      case 'common':
        return { bg: '#e5e7eb', text: '#6b7280', border: '#d1d5db' };
      case 'rare':
        return { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' };
      case 'epic':
        return { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' };
      case 'legendary':
        return { bg: '#fef3c7', text: '#f59e0b', border: '#fcd34d' };
      default:
        return { bg: '#e5e7eb', text: '#6b7280', border: '#d1d5db' };
    }
  };

  const getRarityLabel = (rarity: NextBadge['rarity']) => {
    switch (rarity) {
      case 'common':
        return 'コモン';
      case 'rare':
        return 'レア';
      case 'epic':
        return 'エピック';
      case 'legendary':
        return 'レジェンダリー';
      default:
        return 'コモン';
    }
  };

  const colors = getRarityColor(badge.rarity);

  return (
    <Card
      className="relative border-2 transition-all hover:shadow-lg hover:scale-105 cursor-pointer"
      style={{ borderColor: colors.border }}
    >
      <CardContent className="p-4">
        {/* Badge Icon */}
        <div className="flex justify-center mb-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: colors.bg }}
          >
            <Award className="w-8 h-8" style={{ color: colors.text }} />
          </div>
        </div>

        {/* Badge Info */}
        <div className="text-center mb-3">
          <h4 className="text-sm font-bold text-gray-900 mb-1">{badge.name}</h4>
          <Badge
            className="text-xs font-medium"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {getRarityLabel(badge.rarity)}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-600 text-center mb-3">{badge.description}</p>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700">進捗</span>
            <span className="text-xs font-bold" style={{ color: colors.text }}>
              {badge.progress}%
            </span>
          </div>
          <Progress
            value={badge.progress}
            className="h-2"
            style={{ ['--progress-color' as string]: colors.text }}
          />
        </div>

        {/* Completion Estimate */}
        <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
          <TrendingUp className="w-3 h-3" />
          <span>{badge.estimatedCompletion}</span>
        </div>

        {/* Corner Label */}
        <div
          className="absolute top-0 right-0 text-xs px-2 py-1 rounded-bl-lg rounded-tr-lg font-bold"
          style={{ backgroundColor: colors.text, color: 'white' }}
        >
          次の目標
        </div>
      </CardContent>
    </Card>
  );
};

export default NextBadgeCard;
