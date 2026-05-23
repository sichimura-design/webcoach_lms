/**
 * Type definitions for Courses List Page
 * These interfaces are designed for future API integration
 */

// Course category
export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
}

// Course difficulty level
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

// Course type
export type CourseType = 'roadmap' | 'skill' | 'single' | 'tool';

// Course card data
export interface CourseCard {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  thumbnailUrl?: string;
  thumbnailColor?: string; // For placeholder backgrounds
  thumbnailText?: string; // For text-based thumbnails
  category: string;
  categoryId: string;
  type: CourseType;
  difficulty?: DifficultyLevel;
  duration?: string; // e.g., "16分", "3時間"
  enrolledCount?: number;
  rating?: number; // 0-5
  tags?: string[];
  isNew?: boolean;
  isFree?: boolean;
  isRecommended?: boolean;
  progress?: number; // 0-100, if user has started
}

// Course section (for grouping courses)
export interface CourseSection {
  id: string;
  title: string;
  subtitle?: string;
  courses: CourseCard[];
  viewAllLink?: string;
}

// Filter options
export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

// Search and filter state
export interface CoursesFilter {
  searchQuery: string;
  selectedCategory: string;
  selectedDifficulty?: DifficultyLevel;
  selectedType?: CourseType;
  showFreeOnly?: boolean;
  sortBy?: 'popular' | 'newest' | 'rating' | 'duration';
}

// Complete courses list page data (what the API should return)
export interface CoursesPageData {
  categories: CourseCategory[];
  recommendedRoadmaps: CourseCard[];
  skillCourses: CourseCard[];
  singleCourses: CourseCard[];
  toolCourses?: CourseCard[];
  featuredCourses?: CourseCard[];
  popularCategories?: string[];
}

// API response for courses list
export interface CoursesApiResponse {
  success: boolean;
  data: CoursesPageData;
  meta?: {
    totalCourses: number;
    timestamp: string;
  };
}

// Course detail (for future use)
export interface CourseDetail extends CourseCard {
  fullDescription: string;
  syllabus: CourseSyllabus[];
  instructorName?: string;
  instructorBio?: string;
  prerequisites?: string[];
  learningOutcomes?: string[];
  totalLessons?: number;
  totalQuizzes?: number;
  certificateAvailable?: boolean;
  lastUpdated?: string; // ISO date string
}

// Course syllabus/curriculum
export interface CourseSyllabus {
  id: number;
  title: string;
  lessons: CourseLesson[];
  duration?: string;
}

// Individual lesson
export interface CourseLesson {
  id: number;
  title: string;
  type: 'video' | 'reading' | 'quiz' | 'assignment' | 'interactive';
  duration?: string;
  isCompleted?: boolean;
  isLocked?: boolean;
}
