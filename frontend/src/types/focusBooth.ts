// 集中ブースの在室メンバー（マイページの「他の人の様子」カードが使う）。
// 仮名＋匿名アイコンで表示する（実名・実写真は使わない）。
//
// ランキング（RankingType / RankingEntry）は初期実装から外したので削除した。
// 復活させるときは他ユーザーを含む横断集計＝サーバ側の仕事になる。クライアント側で
// 必要なのは1件が localDate/durationMinutes/courseId/userId を持つことだけで、
// それは types/studyActivity.ts の StudyActivity が満たしている。

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
