import React from 'react';
import {
  CheckCircle2,
  FileText,
  Award,
  BookOpen,
  Trophy,
} from 'lucide-react';
import { RecentActivity } from '../../types/mypage';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ActivityItemProps {
  activity: RecentActivity;
}

const activityIcons = {
  course_start: BookOpen,
  activity_complete: CheckCircle2,
  quiz_submit: FileText,
  certificate_earned: Award,
  badge_earned: Trophy,
};

const activityColors = {
  course_start: 'bg-blue-100 text-blue-600',
  activity_complete: 'bg-green-100 text-green-600',
  quiz_submit: 'bg-purple-100 text-purple-600',
  certificate_earned: 'bg-yellow-100 text-yellow-600',
  badge_earned: 'bg-pink-100 text-pink-600',
};

export function ActivityItem({ activity }: ActivityItemProps) {
  const Icon = activityIcons[activity.type] || CheckCircle2;
  const colorClass = activityColors[activity.type] || 'bg-gray-100 text-gray-600';

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: ja,
      });
    } catch {
      return '最近';
    }
  };

  return (
    <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
      <div className={`${colorClass} p-2 rounded-lg flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-gray-900 truncate">
          {activity.title}
        </h4>
        <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
        {activity.relatedCourseName && (
          <p className="text-xs text-gray-500 mt-1">
            {activity.relatedCourseName}
          </p>
        )}
      </div>
      <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
        {formatTime(activity.timestamp)}
      </div>
    </div>
  );
};
