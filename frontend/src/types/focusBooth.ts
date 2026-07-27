// 集中ブース（自習室の発展版：応援・ランキング・AIコーチ付き）
// 在室メンバー・ランキングは仮名＋匿名アイコンで表示する（実名・実写真は使わない）

export interface FocusBoothMember {
  id: string;
  nickname: string;
  avatarEmoji: string;
  activityLabel: string; // 例: 'Webデザイン・バナー制作'
  elapsedMinutes: number;
  hearts: number;
  cheeredByMe: boolean;
}

export type RankingType = 'studyTime' | 'cheersGiven' | 'cheersReceived';

export interface RankingEntry {
  rank: number;
  nickname: string;
  avatarEmoji: string;
  value: number; // studyTime=分、cheersGiven/Received=回数
  isMe?: boolean;
}

export interface FocusBoothPulse {
  concentratingCount: number; // いま集中中の人数
  cheerFeedCount: number; // 直近の応援件数（雰囲気表示用）
  myCheerCountToday: number;
}
