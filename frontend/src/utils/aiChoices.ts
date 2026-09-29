/**
 * AI の回答に含まれる「選択式の問いかけ」から、押せる選択肢を取り出す（B-011 / B-015）。
 *
 * Dify アプリは data-message 付きのボタンを返すので difyButtons.ts で押せるが、
 * LangGraph（Claude）側が自分で聞き返すときは、ふつうの Markdown の番号付きリストで
 *   **あなたの状況は以下のどちらですか？**
 *   1. **すでに応募する案件が決まっていて…** → 案件の詳細情報を…
 *   2. **案件応募全般において…** → 専門用語解説ツールで…
 * のように出してくる。受講生はこれを読んで自分で文章を打ち直していた。
 *
 * 🔴 誤爆させない。手順や「次にやること」の番号付きリストまでボタンにすると、
 *    押せそうに見えて押すと話が進まない。次をすべて満たすときだけ選択肢とみなす。
 *      - リストの直前（2行以内）か直後に、選ばせる問いかけ（どちら／どれ／選んで…）がある
 *      - 項目は2〜6個
 *    呼び出し側は「最新の AI の回答で、Dify のボタンもフォームも無いとき」に限って使う。
 * 🔴 送る文言は項目の見出し部分そのまま（太字か「→」より前）。言い換えない。
 */
import type { DifyMessageButton } from './difyButtons';

const ITEM_RE = /^(\s{0,3})(?:\d+[.)．]|[-*・•])\s+(.+)$/;
const ASK_RE = /(どちら|どれ|いずれ|選んで|選択して|お選び|教えてください|ですか[？?]|ますか[？?]|でしょうか[？?])/;
const LABEL_MAX = 40;

function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/** 項目1行から、ボタンに載せる見出し部分を取る */
function itemLabel(raw: string): string {
  const bold = /^\*\*(.+?)\*\*/.exec(raw.trim());
  const head = bold ? bold[1] : raw.split(/\s*(?:→|⇒|：|: | - | — )\s*/)[0];
  return stripInline(head).replace(/[。．]$/, '');
}

interface ListBlock {
  start: number;
  end: number; // 最終行（含む）
  items: string[];
}

function findListBlocks(lines: string[]): ListBlock[] {
  const blocks: ListBlock[] = [];
  let cur: ListBlock | null = null;
  lines.forEach((line, i) => {
    const m = ITEM_RE.exec(line);
    if (m) {
      if (!cur) cur = { start: i, end: i, items: [] };
      cur.items.push(m[2]);
      cur.end = i;
      return;
    }
    // 項目の続き（字下げされた行、または「→」で始まる補足）は同じ項目に含める
    if (cur && line.trim() !== '' && (/^\s{2,}/.test(line) || /^\s*[→⇒]/.test(line))) {
      cur.end = i;
      return;
    }
    if (cur) {
      blocks.push(cur);
      cur = null;
    }
  });
  if (cur) blocks.push(cur);
  return blocks;
}

export function extractChoiceButtons(text: string): DifyMessageButton[] {
  if (!text) return [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = findListBlocks(lines);
  // 最後に出てきたリストから見る。問いかけは回答の末尾にあることが多い
  for (let b = blocks.length - 1; b >= 0; b -= 1) {
    const block = blocks[b];
    if (block.items.length < 2 || block.items.length > 6) continue;
    const before = lines.slice(Math.max(0, block.start - 2), block.start).join('\n');
    const after = lines.slice(block.end + 1, block.end + 3).join('\n');
    if (!ASK_RE.test(before) && !/(どちら|どれ|いずれ|選んで|お選び)/.test(after)) continue;

    const buttons: DifyMessageButton[] = [];
    for (const item of block.items) {
      const value = itemLabel(item);
      if (!value) continue;
      const label = value.length > LABEL_MAX ? `${value.slice(0, LABEL_MAX)}…` : value;
      buttons.push({ label, value });
    }
    if (buttons.length >= 2) return buttons;
  }
  return [];
}
