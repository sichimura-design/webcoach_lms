/**
 * AI の最新の回答が「受講生に文章で答えてもらう問いかけ」で終わっているかを見る（B-015）。
 *
 * 選択肢をボタンにできるのは Dify が data-message 付きで返したときだけ（difyButtons.ts）。
 * 回答の文章から選択肢を切り出してボタンにする方式は、誤って分割したり言い換えた文言を
 * 送ったりして不具合が入りやすいので採らない（エンジニアと合意、以前の aiChoices.ts は撤去）。
 * 代わりに「下の入力欄に文章で答える」ことを案内する。
 *
 * 🔴 ここは案内を出すかどうかにしか使わない。外れても案内が出る・出ないだけで、
 *    送る内容には一切影響させない。
 */
import { parseDifyMessage } from './difyButtons';

const ASK_RE = /[？?]|選んで|お選び|教えてください|どちら|どれ/;

/** 回答の末尾（空でない最後の2行）に問いかけがあるか */
export function isAskingUser(text: string): boolean {
  if (!text) return false;
  const tail = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(-2);
  return tail.some((line) => ASK_RE.test(line));
}

/** Dify のボタンもフォームも無く、問いかけで終わっている＝文章で答えてもらう回答 */
export function needsTypedReply(content: string): boolean {
  const { text, buttons, forms } = parseDifyMessage(content);
  if (buttons.length > 0 || forms.length > 0) return false;
  return isAskingUser(text);
}

/** 入力欄の上に出す案内と、そのあいだの placeholder */
export const TYPED_REPLY_HINT = 'AI の質問には、下の入力欄に文章で答えてください。番号や項目名だけでも伝わります。';
export const TYPED_REPLY_PLACEHOLDER = 'AI の質問への答えを入力…（例：1、〇〇 など）';
