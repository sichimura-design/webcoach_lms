/**
 * AI の回答を待っているあいだの経過表示（A-6）。
 *
 * 案件検索などの AIアプリは1〜2分かかるのに、以前は「考え中...」が出たままで、
 * 止まったのか動いているのか分からなかった。10秒を過ぎたら経過を出し、
 * 30秒を過ぎたら「時間がかかっている」ことをはっきり言う。
 */

/** これより短い待ちでは経過を出さない（普通の回答で数字がちらつかないように） */
export const WAIT_ELAPSED_FROM_SEC = 10;
/** これを超えたら「時間がかかっています」と言う */
export const WAIT_SLOW_FROM_SEC = 30;

/** 「経過 45秒」「経過 1分20秒」。短い待ちでは null */
export function formatWaitElapsed(seconds: number): string | null {
  if (seconds < WAIT_ELAPSED_FROM_SEC) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `経過 ${m}分${s}秒` : `経過 ${s}秒`;
}

export const WAIT_SLOW_MESSAGE = '時間がかかっています。画面はそのままでお待ちください';
