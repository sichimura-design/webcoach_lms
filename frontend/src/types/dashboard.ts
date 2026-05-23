export interface ParentCategory {
  id: number;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CourseProgress {
  id: number;
  fullname: string;
  shortname: string;
  categoryname: string;
  parentCategory: string;
  type: 'required' | 'advanced'; // 必修/発展
  progressPercentage: number;
  isCompleted: boolean;
  summary?: string;
  startdate?: number;
  enddate?: number;
}

export interface CategoryProgress {
  id: number;
  name: string;
  description?: string;
  courses: CourseProgress[];
  totalCourses: number;
  completedCourses: number;
  averageProgress: number;
}

export interface ParentCategoryProgress {
  parentCategory: ParentCategory;
  categories: CategoryProgress[];
  totalCourses: number;
  completedCourses: number;
  averageProgress: number;
}

export interface DashboardData {
  parentCategories: ParentCategoryProgress[];
  totalProgress: {
    totalCourses: number;
    completedCourses: number;
    averageProgress: number;
  };
}

export interface FilterOptions {
  searchQuery: string;
  courseType: 'all' | 'required' | 'advanced';
  parentCategory: string | 'all';
  completionStatus: 'all' | 'completed' | 'in_progress' | 'not_started';
}