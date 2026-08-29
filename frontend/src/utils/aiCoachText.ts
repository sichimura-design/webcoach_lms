/**
 * frontend/src/utils/aiCoachText.ts
 * AIコーチのメッセージをプレーンテキストへ落とす。
 *
 * 通常回答（結論／根拠／当てはめ／次にやること）と専門モードの結果（全体講評／項目別／
 * 修正案）は形が違うので、ノートへ保存するときとコンパクト表示するときの変換を
 * ここに集約する。教材ページ・AI専用ページ・集中ブースで別々に組み立てると、
 * 同じ回答が画面ごとに違う文章で残ってしまう。
 */

import { AiCoachMessage } from '../types/aiCoach';

/** ノートへ保存する全文。見出し付きで構造を保つ */
export function messageToText(message: AiCoachMessage): string {
  const a = message.answer;
  if (a) {
    return [
      `結論：${a.conclusion}`,
      a.basis && `教材の根拠：${a.basis}`,
      a.apply && `今回のケースへの当てはめ：${a.apply}`,
      a.next && `次にやること：${a.next}`,
      a.generalNote && `教材外の一般的な補足：${a.generalNote}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const s = message.skillResult;
  if (s) {
    return [
      `全体講評：${s.summary}`,
      ...s.findings.map((f) => `【${f.label}】${f.comment}${f.basis ? `\n  ${f.basis}` : ''}`),
      s.revision && `修正案：\n${s.revision}`,
      s.next && `次にやること：${s.next}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return message.content;
}

/**
 * 吹き出し1個ぶんの短い本文（集中ブースのミニチャットなど）。
 * 構造を全部見せる場所ではないので、いちばん言いたいこと1文に絞る。
 */
export function messageSummary(message: AiCoachMessage): string {
  if (message.answer) return message.answer.conclusion;
  if (message.skillResult) return message.skillResult.summary;
  return message.content;
}

/**
 * メッセージ列を LLM へ渡す履歴の形へ落とす。
 * 提案カードやモード切替の通知（proposal / system）は会話の中身ではないので除く。
 */
export function toHistory(
  messages: AiCoachMessage[],
  limit = 6
): { role: 'user' | 'assistant'; content: string }[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-limit)
    .map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.role === 'assistant' ? messageSummary(m) : m.content,
    }));
}
