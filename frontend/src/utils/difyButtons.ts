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
const ANY_TAG_RE = /<[^>]+>/g;

export function parseDifyMessage(content: string): ParsedDifyMessage {
  const buttons: DifyMessageButton[] = [];

  if (!content || !content.includes('data-message=')) {
    return { text: content, buttons };
  }

  if (typeof DOMParser === 'undefined') {
    return parseDifyMessageWithoutDom(content);
  }

  const doc = new DOMParser().parseFromString(content, 'text/html');
  const buttonEls = Array.from(doc.body.querySelectorAll('button[data-message]'));

  if (buttonEls.length === 0) {
    return { text: content, buttons };
  }

  // ボタンを含む「本文直下(body直下)の要素」を特定し、それをまるごと除去する。
  // Difyアプリはボタンを1つのカードdivにまとめて出力するが、応答に案件条件の
  // 整理内容など「ボタンとは無関係な別のdivブロック」が同時に含まれることがある。
  // 従来は正規表現で最初の<div>〜最後の</div>を一括除去しており、この場合
  // 無関係な整理内容までまとめて消えてしまっていた（body直下の要素単位で
  // 判定すれば、ボタンを含む要素だけをピンポイントで除去できる）。
  const topLevelNodesToRemove = new Set<Element>();
  for (const btn of buttonEls) {
    const value = (btn.getAttribute('data-message') || '').trim();
    const label = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    if (value) {
      buttons.push({ label: label || value, value });
    }

    let node: Element = btn;
    while (node.parentElement && node.parentElement !== doc.body) {
      node = node.parentElement;
    }
    topLevelNodesToRemove.add(node);
  }

  topLevelNodesToRemove.forEach((node) => node.remove());

  const text = (doc.body.textContent || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, buttons };
}

/** DOMParserが利用できない環境向けの簡易フォールバック（ボタンの抽出のみ行い、本文はタグを外すだけ） */
function parseDifyMessageWithoutDom(content: string): ParsedDifyMessage {
  const buttons: DifyMessageButton[] = [];

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
    .replace(BUTTON_RE, '')
    .replace(ANY_TAG_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, buttons };
}
