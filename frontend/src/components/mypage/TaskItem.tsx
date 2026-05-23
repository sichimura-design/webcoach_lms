import React from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { UpcomingTask } from '../../types/mypage';

interface TaskItemProps {
  task: UpcomingTask;
  onClick?: (taskId: number) => void;
}

const priorityColors = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};

const priorityLabels = {
  high: '高',
  medium: '中',
  low: '低',
};

export function TaskItem({ task, onClick }: TaskItemProps) {
  const formatDueDate = (dateString: string) => {
    const dueDate = new Date(dateString);
    const now = new Date();
    const hoursUntilDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    if (hoursUntilDue < 0) return '期限切れ';
    if (hoursUntilDue < 24) return `残り${hoursUntilDue}時間`;

    const daysUntilDue = Math.ceil(hoursUntilDue / 24);
    if (daysUntilDue === 1) return '明日まで';
    return `残り${daysUntilDue}日`;
  };

  const isUrgent = () => {
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilDue < 48;
  };

  return (
    <Card
      className="border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
      onClick={() => onClick?.(task.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 flex-1">{task.title}</h4>
          <Badge className={priorityColors[task.priority]}>
            {priorityLabels[task.priority]}
          </Badge>
        </div>

        <p className="text-xs text-gray-600 mb-3">{task.courseName}</p>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span className={isUrgent() ? 'text-red-600 font-medium' : ''}>
                {formatDueDate(task.dueDate)}
              </span>
            </div>
            {task.estimatedTime && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{task.estimatedTime}分</span>
              </div>
            )}
          </div>
          {isUrgent() && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs font-medium">至急</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
