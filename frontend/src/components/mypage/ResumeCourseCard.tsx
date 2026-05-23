import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Course } from '../../types/mypage';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { CourseImage } from '../shared/CourseImage';

interface ResumeCourseCardProps {
  course: Course;
}

export const ResumeCourseCard: React.FC<ResumeCourseCardProps> = ({ course }) => {
  const navigate = useNavigate();

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-pink-400"></div>
          <h3 className="text-sm sm:text-base font-bold text-gray-700">
            学習を開始する
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,400px)_1fr] gap-4 sm:gap-6">
          {/* Course Thumbnail Card */}
          <div
            className="relative rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity min-h-[140px] sm:min-h-[160px]"
            onClick={() => navigate(`/courses/${course.id}`)}
          >
            <CourseImage
              imageUrl={course.thumbnailUrl}
              alt={course.title}
              fallbackText={course.title}
              fallbackColor="#F9A8D4"
              className="w-full h-full absolute inset-0"
              fallbackTextSize="lg"
              hideFallbackText
            />
            <div className="absolute inset-0 bg-gradient-to-br from-pink-200/60 to-pink-300/60" />
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 text-xs text-pink-600 font-medium bg-white/80 px-2 py-1 rounded">
              受講中のコース
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-center p-3">
              <h4 className="text-lg sm:text-xl lg:text-2xl font-bold text-white drop-shadow-lg">
                {course.title}
              </h4>
            </div>
          </div>

          {/* Course Details */}
          <div className="space-y-3 sm:space-y-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-2">
                {course.description || '続きから学習を再開しましょう'}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">進捗 {course.progress || 0}%</span>
                <span className="text-sm text-[#F3A7A7] font-medium">
                  {course.progress && course.progress >= 50 ? 'あと半分！' : 'がんばりましょう！'}
                </span>
              </div>
              <Progress value={course.progress || 0} className="h-2" />
            </div>

            <Button
              onClick={() => navigate(`/courses/${course.id}`)}
              className="w-full bg-[#F3A7A7] hover:bg-[#F08B8B] text-white font-bold rounded-full py-2.5 sm:py-3 h-auto text-sm sm:text-base"
            >
              続きから学習する
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
