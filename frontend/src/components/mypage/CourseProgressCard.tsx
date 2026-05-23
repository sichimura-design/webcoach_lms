import React from 'react';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Clock, Calendar, PlayCircle } from 'lucide-react';
import { CourseProgress } from '../../types/mypage';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface CourseProgressCardProps {
  course: CourseProgress;
  onClick?: (courseId: number) => void;
}

export function CourseProgressCard({
  course,
  onClick,
}: CourseProgressCardProps) {
  const formatLastAccessed = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: ja,
      });
    } catch {
      return '最近';
    }
  };

  const formatDueDate = (dateString: string) => {
    const dueDate = new Date(dateString);
    const now = new Date();
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue < 0) return '期限切れ';
    if (daysUntilDue === 0) return '今日まで';
    if (daysUntilDue === 1) return '明日まで';
    return `残り${daysUntilDue}日`;
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3
            className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors cursor-pointer"
            onClick={() => onClick?.(course.id)}
          >
            {course.title}
          </h3>
          <p className="text-sm text-gray-600 line-clamp-2">{course.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">進捗状況</span>
            <span className="text-sm font-bold text-blue-600">{course.progress}%</span>
          </div>
          <Progress value={course.progress} className="h-2" />
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <Badge
              style={{ backgroundColor: course.categoryColor }}
              className="text-white"
            >
              {course.categoryName}
            </Badge>
            <span className="text-gray-500">
              {course.completedActivities} / {course.totalActivities} 完了
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>最終アクセス: {formatLastAccessed(course.lastAccessedAt)}</span>
          </div>
          {course.dueDate && (
            <div className="flex items-center gap-1 text-orange-600 font-medium">
              <Calendar className="w-3 h-3" />
              <span>{formatDueDate(course.dueDate)}</span>
            </div>
          )}
        </div>

        {/* Continue Learning Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(course.id);
          }}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
        >
          <PlayCircle className="w-5 h-5" />
          <span>続きから学習</span>
        </Button>
      </div>
    </Card>
  );
};
