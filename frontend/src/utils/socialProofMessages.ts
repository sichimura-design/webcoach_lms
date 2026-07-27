// 「◯人が学習中」系のソーシャルプルーフ表示のバリエーション。
// 同じ文言が続くと単調になるため、日付＋表示箇所ごとに安定して1つを選ぶ
// （同じ日にリロードしても文言が変わらない一方、日が変わると違う言い回しになる）。

function pickBySeed(templates: string[], seedKey: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const seed = `${seedKey}-${today}`;
  let hash = 0;
  for (const ch of seed) {
    hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  }
  return templates[hash % templates.length];
}

// 今日の総学習人数（例: 挨拶バー、ギルドロビー上部バナー）
export function totalTodayMessage(count: number): string {
  const templates = [
    `今日は${count}人が学習中です`,
    `${count}人が今日すでに学習をスタートしました`,
    `今この瞬間、${count}人が黙々と取り組んでいます`,
    `今日の学習仲間は${count}人。あなたも一緒にどうぞ`,
    `${count}人が今日も一歩ずつ進んでいます`,
  ];
  return pickBySeed(templates, 'total-today');
}

// 活動別ルーム（例: 座学勉強中・実践課題に取り組み中・案件に挑戦中・自習室で黙々作業）の人数。
// activityLabelはすでに「〜中」の形の活動フレーズなので、そのまま人数を添える形で組み立てる
export function activityRoomMessage(activityLabel: string, count: number): string {
  const templates = [
    `${count}人が${activityLabel}`,
    `今${count}人が${activityLabel}`,
    `${activityLabel}の仲間が${count}人`,
    `${count}人が今まさに${activityLabel}`,
    `気づけば${count}人が${activityLabel}`,
  ];
  return pickBySeed(templates, `activity-${activityLabel}`);
}
