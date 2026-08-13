// 集中ブースの在室メンバー（マイページの「他の人の様子」カードが使う）。
// 仮名＋匿名アイコンで表示する（実名・実写真は使わない）。

export interface FocusBoothMember {
  id: string;
  nickname: string;
  avatarEmoji: string;
  activityLabel: string; // 例: 'Webデザイン・バナー制作'
  elapsedMinutes: number;
  hearts: number;
  cheeredByMe: boolean;
}

export interface FocusBoothPulse {
  concentratingCount: number; // いま集中中の人数
  cheerFeedCount: number; // 直近の応援件数（雰囲気表示用）
  myCheerCountToday: number;
}

/** 学習時間ランキングの集計期間 */
export type StudyRankingPeriod = 'week' | 'month';

export interface StudyRankingEntry {
  rank: number;
  /** 仮名。自分の行だけ「あなた」になる */
  nickname: string;
  avatarEmoji: string;
  minutes: number;
  /** 自分の行はハイライトする */
  isMe: boolean;
}

/** GET /webcoach/study-ranking/{userId}?period=week|month */
export interface StudyRanking {
  period: StudyRankingPeriod;
  /** 「今週（8/11〜）」のように期間を明示するためのラベル */
  periodLabel: string;
  entries: StudyRankingEntry[];
  /** 自分が上位に入っていないときに末尾へ別枠で出す */
  me: StudyRankingEntry;
  /** 母数。順位の意味が分かるようにする */
  participantCount: number;
}
