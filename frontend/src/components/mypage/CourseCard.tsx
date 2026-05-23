import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Course } from '../../types/mypage';
import { Card, CardContent } from '../ui/card';
import { Progress } from '../ui/progress';
import { CourseImage } from '../shared/CourseImage';

interface CourseCardProps {
  course: Course;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  const navigate = useNavigate();

  return (
    <Card
      className="border-0 shadow-none cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate(`/courses/${course.id}`)}
    >
      <CardContent className="p-4 sm:p-6">
        <CourseImage
          imageUrl={course.thumbnailUrl}
          alt={course.title}
          fallbackText={course.title}
          fallbackColor={course.categoryColor || '#9CA3AF'}
          className="rounded-lg w-full h-20 sm:h-24 mb-3"
          fallbackTextSize="md"
        />
        <h4 className="text-xs sm:text-sm font-bold text-gray-700 mb-1">
          {course.description || course.title}
        </h4>
        <p className="text-xs text-gray-500 mb-3">{course.categoryName || 'コース'}</p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">進捗</span>
          <span className="text-xs text-gray-700 font-medium">{course.progress || 0}%</span>
        </div>
        <Progress
          value={course.progress || 0}
          className="h-1.5"
          style={{
            ['--progress-color' as string]: course.categoryColor || '#9CA3AF'
          }}
        />
      </CardContent>
    </Card>
  );
};
