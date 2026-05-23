/**
 * プロフィール設定の型定義
 */

export interface ProfileSettings {
  id?: number;
  userid: number;
  theme: 'light' | 'dark';
  language: 'ja' | 'en';
  notifications_enabled: boolean;
  email_notifications: boolean;
  timezone: string;
  items_per_page: number;
  avatar_url: string | null;
  bio: string | null;
  preferences: ProfilePreferences | null;
  timemodified?: number;
  timecreated?: number;
}

export interface ProfilePreferences {
  nick_name?: string;
  career_goal?: string;
  work_style_goal?: string;
  custom_settings?: Record<string, any>;
}

export interface ProfileFormData {
  nickName: string;
  idealCareer: string;
  todaySmallStep: string;
  avatar_url: string;
  avatar_id: string;
}

export type ProfileTab = 'profile' | 'account' | 'notifications' | 'payment';
