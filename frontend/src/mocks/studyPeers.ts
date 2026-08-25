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
  /** ストリークランキング（月間）の基準値＝今月の学習日数。0〜31 */
  monthStudyDays: number;
  /** ストリークランキング（累計）の基準値＝受講開始からの学習日数 */
  totalStudyDays: number;
}

/**
 * 🔴 monthStudyDays / totalStudyDays は weeklyMinutes と順位を一致させない。
 *    「長時間まとめてやる人」と「短くても毎日続ける人」が別の顔ぶれで上位に来るほうが、
 *    2つのランキングを並べる意味が出る（ぺんぎん3 は時間は最下位だが毎日続けている、など）。
 */
export const STUDY_PEERS: StudyPeer[] = [
  { id: 'm1', nickname: 'うさぎ58', avatarEmoji: '🐰', activityLabel: 'Webデザイン・バナー制作', weeklyMinutes: 612, monthStudyDays: 22, totalStudyDays: 96 },
  { id: 'm2', nickname: 'こあら12', avatarEmoji: '🐨', activityLabel: 'コーディング・HTML/CSS基礎', weeklyMinutes: 548, monthStudyDays: 17, totalStudyDays: 71 },
  { id: 'm3', nickname: 'ぱんだ7', avatarEmoji: '🐼', activityLabel: 'コーディング・JavaScript入門', weeklyMinutes: 431, monthStudyDays: 12, totalStudyDays: 44 },
  { id: 'm4', nickname: 'ひつじ33', avatarEmoji: '🐑', activityLabel: 'Webデザイン・Figma実践', weeklyMinutes: 355, monthStudyDays: 19, totalStudyDays: 83 },
  { id: 'm5', nickname: 'きつね21', avatarEmoji: '🦊', activityLabel: 'マーケティング・Web集客基礎', weeklyMinutes: 268, monthStudyDays: 14, totalStudyDays: 52 },
  { id: 'm6', nickname: 'ねこ9', avatarEmoji: '🐱', activityLabel: '配色理論', weeklyMinutes: 194, monthStudyDays: 9, totalStudyDays: 30 },
  { id: 'm7', nickname: 'りす44', avatarEmoji: '🐿️', activityLabel: 'キャリア・ポートフォリオ作成', weeklyMinutes: 141, monthStudyDays: 6, totalStudyDays: 24 },
  { id: 'm8', nickname: 'ぺんぎん3', avatarEmoji: '🐧', activityLabel: 'Webデザイン・LP制作', weeklyMinutes: 96, monthStudyDays: 21, totalStudyDays: 65 },
];

/** 自分のアイコン。ランキングで他の人と並べるために絵文字を1つ決めておく */
export const MY_RANKING_EMOJI = '🙂';
