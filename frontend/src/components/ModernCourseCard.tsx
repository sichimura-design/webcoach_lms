import React from "react";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";
import { MoreVert } from "@mui/icons-material";

interface ModernCourseCardProps {
  course: {
    id: number;
    fullname: string;
    shortname: string;
    categoryname?: string;
    progress?: number;
    instructor?: string;
    lastAccessed?: string;
    thumbnail?: string;
  };
  onClick?: () => void;
}

export default function ModernCourseCard({ course, onClick }: ModernCourseCardProps) {
  const progress = course.progress || 0;
  const instructor = course.instructor || course.categoryname || "No instructor";
  const lastAccessed = course.lastAccessed || "未アクセス";

  return (
    <Card
      className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden w-full min-w-[240px] max-w-[380px]"
      onClick={onClick}
    >
      <div className="relative aspect-video bg-gray-200">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.fullname}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
            <span className="text-gray-400 text-sm">No Image</span>
          </div>
        )}
        <button
          className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm hover:bg-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVert className="w-4 h-4 text-gray-700" />
        </button>
      </div>
      <CardContent className="p-4">
        <h3 className="text-gray-900 line-clamp-2 mb-2 font-medium">{course.fullname}</h3>
        <p className="text-sm text-gray-500 mb-3">{instructor}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-700 font-medium">{progress}%完了</span>
            <span className="text-gray-500 text-xs">{lastAccessed}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
