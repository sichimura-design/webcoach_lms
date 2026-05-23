import React from 'react';
import { Clock, Target, Flame, CheckCircle } from 'lucide-react';
import { Quest } from '../../types/mypage';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';

interface QuestCardProps {
  quest: Quest;
}

function QuestCard({ quest }: QuestCardProps) {
  const getQuestIcon = (iconName?: string) => {
    switch (iconName) {
      case 'clock':
        return <Clock className="w-5 h-5" />;
      case 'target':
        return <Target className="w-5 h-5" />;
      case 'flame':
        return <Flame className="w-5 h-5" />;
      default:
        return <Target className="w-5 h-5" />;
    }
  };

  const getTypeLabel = (type: Quest['type']) => {
    switch (type) {
      case 'daily':
        return 'デイリー';
      case 'weekly':
        return 'ウィークリー';
      case 'special':
        return 'スペシャル';
      case 'achievement':
        return 'アチーブメント';
    }
  };

  const isCompleted = quest.progress >= 100;

  return (
    <Card
      className="relative transition-all hover:shadow-md"
      style={{
        borderColor: quest.color || '#e5e7eb',
        backgroundColor: isCompleted ? '#f0fdf4' : 'white',
      }}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="p-2 rounded-lg"
              style={{
                backgroundColor: quest.color ? `${quest.color}15` : '#f3f4f6',
                color: quest.color || '#6b7280',
              }}
            >
              {getQuestIcon(quest.iconName)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-gray-900">{quest.title}</h4>
                {isCompleted && <CheckCircle className="w-4 h-4 text-green-600" />}
              </div>
              <Badge
                className="text-xs font-medium"
                style={{
                  backgroundColor: quest.color ? `${quest.color}20` : '#f3f4f6',
                  color: quest.color || '#6b7280',
                }}
              >
                {getTypeLabel(quest.type)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-600 mb-3">{quest.description}</p>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-700">
              進捗: {quest.currentValue} / {quest.targetValue} {quest.unit}
            </span>
            <span className="text-xs font-bold" style={{ color: quest.color || '#6b7280' }}>
              {quest.progress}%
            </span>
          </div>
          <Progress
            value={Math.min(quest.progress, 100)}
            className="h-2"
            style={{ ['--progress-color' as string]: quest.color || '#3b82f6' }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="text-xs">
            <span className="text-gray-500">報酬:</span>
            <span className="ml-1 font-semibold text-yellow-600">{quest.reward}</span>
          </div>
          {quest.expiresAt && !isCompleted && (
            <div className="text-xs text-gray-500">
              期限: {new Date(quest.expiresAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>

        {isCompleted && (
          <Badge className="absolute top-2 right-2 bg-green-600 text-white font-bold">
            完了！
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};

export default QuestCard;
