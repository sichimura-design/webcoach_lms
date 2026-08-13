/**
 * 他の受講者（仮名＋絵文字アイコン）の名簿。
 *
 * 集中ブースの在室メンバー（handlers.ts）と学習時間ランキング（studyActivityHandlers.ts）が
 * 同じ人を指せるように、人物の定義はここ1箇所に置く。
 * 別々に持つと「在室していない人がランキング上位にいる」ようなちぐはぐが起きる。
 *
 * 🔴 frontend/docs/design-token-spec.md の規約により、他の受講者は必ず仮名＋絵文字。
 *    実名・実写真は使わない。
 */

export interface StudyPeer {
  id: string;
  nickname: string;
  avatarEmoji: string;
  /** 集中ブースの在室表示に出す作業内容 */
  activityLabel: string;
  /** ランキングの基準値（分／週）。月次はこれを4.3倍して端数を id で散らす */
  weeklyMinutes: number;
}

export const STUDY_PEERS: StudyPeer[] = [
  { id: 'm1', nickname: 'うさぎ58', avatarEmoji: '🐰', activityLabel: 'Webデザイン・バナー制作', weeklyMinutes: 612 },
  { id: 'm2', nickname: 'こあら12', avatarEmoji: '🐨', activityLabel: 'コーディング・HTML/CSS基礎', weeklyMinutes: 548 },
  { id: 'm3', nickname: 'ぱんだ7', avatarEmoji: '🐼', activityLabel: 'コーディング・JavaScript入門', weeklyMinutes: 431 },
  { id: 'm4', nickname: 'ひつじ33', avatarEmoji: '🐑', activityLabel: 'Webデザイン・Figma実践', weeklyMinutes: 355 },
  { id: 'm5', nickname: 'きつね21', avatarEmoji: '🦊', activityLabel: 'マーケティング・Web集客基礎', weeklyMinutes: 268 },
  { id: 'm6', nickname: 'ねこ9', avatarEmoji: '🐱', activityLabel: '配色理論', weeklyMinutes: 194 },
  { id: 'm7', nickname: 'りす44', avatarEmoji: '🐿️', activityLabel: 'キャリア・ポートフォリオ作成', weeklyMinutes: 141 },
  { id: 'm8', nickname: 'ぺんぎん3', avatarEmoji: '🐧', activityLabel: 'Webデザイン・LP制作', weeklyMinutes: 96 },
];

/** 自分のアイコン。ランキングで他の人と並べるために絵文字を1つ決めておく */
export const MY_RANKING_EMOJI = '🙂';
