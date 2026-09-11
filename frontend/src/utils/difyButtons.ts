/**
 * DifyのチャットAPIが返す「ボタン付き」応答を解釈するユーティリティ。
 *
 * 連携先のDifyアプリ（案件抽出メーカー等）の一部は、Dify標準のチャットUIで
 * ボタンをクリックすると、そのボタンの data-message 属性の値が次の発言として
 * 「一言一句そのまま」送信されることを前提にしたステップ形式のフローで作られている。
 * 自由文で言い換えて送ると、フローが正しく先に進まない（毎回最初の選択肢に戻る等）。
 *
 * WebCoach側のAIチャットはこのHTMLをそのまま描画しないため、ここでボタンの
 * (表示ラベル, 送信すべき厳密な文字列) を抜き出し、実際に押せるボタンとして
 * 再構成できるようにする。
 */

export interface DifyMessageButton {
  label: string;
  value: string;
}

export interface ParsedDifyMessage {
  /** ボタンのHTMLを取り除いた残りの本文（Markdownとして描画する） */
  text: string;
  buttons: DifyMessageButton[];
}

const BUTTON_RE = /<button\b[^>]*\bdata-message="([^"]*)"[^>]*>([\s\S]*?)<\/button>/gi;
// ボタンはDifyアプリ側が1つのラッパーdivにまとめて出力する想定。
// 最初の<div>から最後の</div>までをまとめて取り除く。
const DIV_BLOCK_RE = /<div[\s\S]*<\/div>/i;
const ANY_TAG_RE = /<[^>]+>/g;

export function parseDifyMessage(content: string): ParsedDifyMessage {
  const buttons: DifyMessageButton[] = [];

  if (!content || !content.includes('data-message=')) {
    return { text: content, buttons };
  }

  const re = new RegExp(BUTTON_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const value = match[1].trim();
    const label = match[2].replace(ANY_TAG_RE, ' ').replace(/\s+/g, ' ').trim();
    if (value) {
      buttons.push({ label: label || value, value });
    }
  }

  if (buttons.length === 0) {
    return { text: content, buttons };
  }

  const text = content
    .replace(DIV_BLOCK_RE, '')
    .replace(ANY_TAG_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, buttons };
}
