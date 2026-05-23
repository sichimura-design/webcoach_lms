import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Badge as BadgeType } from '../../types/mypage';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

interface RecommendBadgeCardProps {
  badge: BadgeType;
}

export const RecommendBadgeCard: React.FC<RecommendBadgeCardProps> = ({ badge }) => {
  const navigate = useNavigate();

  return (
    <Card className="bg-yellow-50 border-2 border-yellow-400">
      <CardContent className="p-4 sm:p-6">
        <p className="text-xs sm:text-sm text-gray-700 text-center mb-3 sm:mb-4 font-medium">
          次に狙うバッジはこれ！
        </p>
        <div className="flex justify-center mb-3 sm:mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-400 rounded-full flex items-center justify-center">
            <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-600" />
          </div>
        </div>
        <h4 className="text-center text-sm sm:text-base font-bold text-gray-700 mb-2">
          {badge.name}
        </h4>
        <p className="text-xs sm:text-sm text-gray-600 text-center mb-3 sm:mb-4">
          {badge.description}
        </p>
        {badge.progress !== undefined && (
          <div className="mb-3 sm:mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">進捗</span>
              <span className="text-xs text-gray-700 font-medium">{badge.progress}%</span>
            </div>
            <Progress value={badge.progress} className="h-2 bg-yellow-200 [&>div]:bg-yellow-400" />
          </div>
        )}
        <Button
          onClick={() => navigate('/badges')}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-bold rounded-full py-2 h-auto text-xs sm:text-sm"
        >
          <Sparkles className="w-4 h-4" />
          <span className="whitespace-nowrap">このバッジを獲得しに行く</span>
        </Button>
      </CardContent>
    </Card>
  );
};
