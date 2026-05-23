/**
 * Mock data for Courses List Page
 * This simulates the data that will be fetched from the API in the future
 */

import { CoursesPageData, CourseCategory, CourseCard } from '../types/courses';

// Course categories
export const mockCategories: CourseCategory[] = [
  { id: 'all', name: 'すべて', slug: 'all' },
  { id: 'web-design', name: 'Webデザイン', slug: 'web-design' },
  { id: 'video-editing', name: '動画編集', slug: 'video-editing' },
  { id: 'sns-management', name: 'SNS運用', slug: 'sns-management' },
  { id: 'marketing', name: 'マイデザイン', slug: 'marketing' },
  { id: 'ai-generation', name: 'AI生成', slug: 'ai-generation' },
];

// Recommended roadmaps (おすすめのロードマップ)
export const mockRecommendedRoadmaps: CourseCard[] = [
  {
    id: 1,
    title: 'Web基礎講座',
    subtitle: '未経験からのWebデザイナー養成コース',
    description: 'Figma活用開始から+(16時間)、基礎を体系的に習得します。',
    thumbnailColor: '#87CEEB',
    thumbnailText: 'Web基礎講座',
    category: 'Webデザイン',
    categoryId: 'web-design',
    type: 'roadmap',
    difficulty: 'beginner',
    duration: '3ヶ月',
    enrolledCount: 1234,
    rating: 4.8,
    isRecommended: true,
  },
  {
    id: 2,
    title: 'SNS運営',
    subtitle: 'インスタ運用&ファンをマスター',
    description: 'プロインフルエンサーからつ、各種運用とするスキルを習得します。',
    thumbnailColor: '#FFB6C1',
    thumbnailText: 'SNS運営',
    category: 'SNS運用',
    categoryId: 'sns-management',
    type: 'roadmap',
    difficulty: 'intermediate',
    duration: '2ヶ月',
    enrolledCount: 987,
    rating: 4.6,
    isFree: true,
    isNew: true,
  },
  {
    id: 3,
    title: '????',
    subtitle: 'Premiere Pro動画編集プロコース',
    description: '初心者級編集から-(6ヶ月視点)、全体最終まとめきれるプロの技術を身につけます。',
    thumbnailColor: '#D3D3D3',
    thumbnailText: '????',
    category: '動画編集',
    categoryId: 'video-editing',
    type: 'roadmap',
    difficulty: 'advanced',
    duration: '4ヶ月',
    enrolledCount: 756,
    rating: 4.9,
  },
];

// Skill & tool courses (スキル・ツール別教材)
export const mockSkillCourses: CourseCard[] = [
  {
    id: 11,
    title: 'Photoshop完全マスター',
    subtitle: 'Photoshop完全マスター',
    description: '基礎から応用まで学べるPhotoshop講座',
    thumbnailColor: '#87CEEB',
    thumbnailText: '✏️',
    category: 'Webデザイン',
    categoryId: 'web-design',
    type: 'tool',
    difficulty: 'intermediate',
    duration: '5時間',
    enrolledCount: 2341,
    rating: 4.7,
  },
  {
    id: 12,
    title: 'CapCut文字装飾講座',
    subtitle: 'CapCut文字装飾講座',
    description: '人気の文字装飾テクニックをマスター',
    thumbnailColor: '#FFB6C1',
    thumbnailText: '🎬',
    category: '動画編集',
    categoryId: 'video-editing',
    type: 'tool',
    difficulty: 'beginner',
    duration: '2時間',
    enrolledCount: 1876,
    rating: 4.5,
  },
  {
    id: 13,
    title: 'ノンデザイナーのための配色',
    subtitle: 'ノンデザイナーのための配色',
    description: '誰でもプロの配色センスを身につける',
    thumbnailColor: '#FFB6C1',
    thumbnailText: '🎨',
    category: 'Webデザイン',
    categoryId: 'web-design',
    type: 'skill',
    difficulty: 'beginner',
    duration: '1.5時間',
    enrolledCount: 3214,
    rating: 4.8,
  },
  {
    id: 14,
    title: 'SEOマイデング講座',
    subtitle: 'SEOマイデング講座',
    description: '検索エンジンで上位表示を目指す',
    thumbnailColor: '#90EE90',
    thumbnailText: '📊',
    category: 'マイデザイン',
    categoryId: 'marketing',
    type: 'skill',
    difficulty: 'intermediate',
    duration: '3時間',
    enrolledCount: 1567,
    rating: 4.6,
  },
];

// Single skill courses (サクッと学べる単発スキル)
export const mockSingleCourses: CourseCard[] = [
  {
    id: 21,
    title: 'AI',
    subtitle: 'Midjourneyで簡単綺麗に生成するプロンプト',
    description: 'AI画像生成の基礎から実践まで',
    thumbnailColor: '#E6E6FA',
    thumbnailText: 'AI',
    category: 'AI生成',
    categoryId: 'ai-generation',
    type: 'single',
    difficulty: 'beginner',
    duration: '45分',
    enrolledCount: 4523,
    rating: 4.9,
    isFree: true,
  },
  {
    id: 22,
    title: 'Canva',
    subtitle: 'Canvaでラクラク作成、便利ガイド',
    description: 'デザインツールCanvaを使いこなす',
    thumbnailColor: '#FFE4B5',
    thumbnailText: 'Canva',
    category: 'Webデザイン',
    categoryId: 'web-design',
    type: 'single',
    difficulty: 'beginner',
    duration: '1時間',
    enrolledCount: 3876,
    rating: 4.7,
    isFree: true,
  },
  {
    id: 23,
    title: 'Notion',
    subtitle: 'Notionで簡単整理仕事を効率化',
    description: '業務効率化ツールNotionの活用法',
    thumbnailColor: '#D3D3D3',
    thumbnailText: 'Notion',
    category: '業務効率',
    categoryId: 'productivity',
    type: 'single',
    difficulty: 'beginner',
    duration: '1時間',
    enrolledCount: 2987,
    rating: 4.8,
    isFree: true,
  },
  {
    id: 24,
    title: 'Sales',
    subtitle: 'クラウドソーシングの副業・活用LIVE',
    description: 'フリーランスとして稼ぐためのノウハウ',
    thumbnailColor: '#B0C4DE',
    thumbnailText: 'Sales',
    category: 'フリーランス',
    categoryId: 'freelance',
    type: 'single',
    difficulty: 'intermediate',
    duration: '2時間',
    enrolledCount: 1654,
    rating: 4.5,
    isFree: true,
  },
];

// Complete page data
export const mockCoursesPageData: CoursesPageData = {
  categories: mockCategories,
  recommendedRoadmaps: mockRecommendedRoadmaps,
  skillCourses: mockSkillCourses,
  singleCourses: mockSingleCourses,
  popularCategories: ['web-design', 'ai-generation', 'video-editing'],
};

/**
 * Simulates an API call to fetch courses page data
 * In the future, replace this with actual API call to:
 * GET /api/courses?category={categoryId}&search={query}&filter={filterParams}
 */
export const fetchCoursesData = async (
  categoryId?: string,
  searchQuery?: string
): Promise<CoursesPageData> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  // In the future, this would be an actual API call like:
  // const response = await fetch(`/api/courses?category=${categoryId}&search=${searchQuery}`);
  // return response.json();

  // For now, return mock data with simple filtering
  let filteredData = { ...mockCoursesPageData };

  if (categoryId && categoryId !== 'all') {
    filteredData = {
      ...filteredData,
      recommendedRoadmaps: mockRecommendedRoadmaps.filter(
        (course) => course.categoryId === categoryId
      ),
      skillCourses: mockSkillCourses.filter(
        (course) => course.categoryId === categoryId
      ),
      singleCourses: mockSingleCourses.filter(
        (course) => course.categoryId === categoryId
      ),
    };
  }

  if (searchQuery && searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase();
    filteredData = {
      ...filteredData,
      recommendedRoadmaps: filteredData.recommendedRoadmaps.filter(
        (course) =>
          course.title.toLowerCase().includes(query) ||
          course.subtitle.toLowerCase().includes(query) ||
          course.description.toLowerCase().includes(query)
      ),
      skillCourses: filteredData.skillCourses.filter(
        (course) =>
          course.title.toLowerCase().includes(query) ||
          course.subtitle.toLowerCase().includes(query) ||
          course.description.toLowerCase().includes(query)
      ),
      singleCourses: filteredData.singleCourses.filter(
        (course) =>
          course.title.toLowerCase().includes(query) ||
          course.subtitle.toLowerCase().includes(query) ||
          course.description.toLowerCase().includes(query)
      ),
    };
  }

  return filteredData;
};
