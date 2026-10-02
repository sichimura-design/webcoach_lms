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

import { domToChatMarkdown, htmlToChatMarkdown } from './htmlToChatMarkdown';

export interface DifyMessageButton {
  label: string;
  value: string;
}

/**
 * Dify の「フォーム付き」応答（`<form data-format="text|json">`）の入力欄1つ。
 * 応募文メーカー等が「URL・職務経歴・自己PR…」をまとめて聞くときに使う。
 * 描画しないと生のHTMLが本文に出てしまう（B-016）。
 */
export interface DifyFormField {
  kind: 'input' | 'textarea' | 'select' | 'checkbox' | 'hidden';
  name: string;
  label: string;
  /** input の type（text / email / number / date など）。kind='input' のときだけ使う */
  inputType: string;
  placeholder: string;
  defaultValue: string;
  required: boolean;
  rows?: number;
  options?: string[];
}

export interface DifyForm {
  /** 送信時の書式。Dify 標準UIと同じく text は `name: 値` を改行で並べ、json は JSON 文字列 */
  format: 'text' | 'json';
  fields: DifyFormField[];
  submitLabel: string;
}

export interface ParsedDifyMessage {
  /** ボタン・フォームのHTMLを取り除いた残りの本文（Markdownとして描画する） */
  text: string;
  buttons: DifyMessageButton[];
  forms: DifyForm[];
}

const BUTTON_RE = /<button\b[^>]*\bdata-message="([^"]*)"[^>]*>([\s\S]*?)<\/button>/gi;
const ANY_TAG_RE = /<[^>]+>/g;

const FORM_RE = /<form\b/i;

export function parseDifyMessage(content: string): ParsedDifyMessage {
  const parsed = extractDifyParts(content);
  // ボタン・フォーム以外の HTML（見出し・表など）も Markdown に直す（タグが文字で見えないように）
  return { ...parsed, text: normalizeChatMarkdown(htmlToChatMarkdown(parsed.text)) };
}

// 罫線だけの行（--- / *** / ___ / ===）
const SEPARATOR_LINE_RE = /^ {0,3}([-*_=])(?:[ \t]*\1){2,}[ \t]*$/;
const FENCE_RE = /^ {0,3}(```|~~~)/;
// 段落を中断して始まるブロック（箇条書き・見出し・引用・表・コード）。この手前に改行記号は要らない
const BLOCK_START_RE = /^ {0,3}([-*+] |\d+[.)] |#{1,6}(\s|$)|>|\||```|~~~)/;

/**
 * Dify アプリの本文を、チャットの Markdown 描画で崩れない形に整える（B-016）。
 *
 * Dify 標準UIは1行改行をそのまま改行として出すが、react-markdown では同じ段落に
 * つながってしまい、文がくっついて読めない。また応募文メーカー等はフォームの手前に
 * 「-----」の区切り線を置くため、その直前の段落が Markdown の見出し（h2）に化けていた。
 * - 本文中の1行改行は、行末に空白2つを付けて改行として描画させる
 * - 区切り線は前後に空行を入れて罫線にする。先頭・末尾の区切り線（ボタン・フォームの
 *   手前だったもの）は意味が無いので落とす
 * - コードブロックの中と表は触らない
 */
export function normalizeChatMarkdown(text: string): string {
  if (!text) return text;
  const lines = text.split('\n');
  const out: string[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    if (SEPARATOR_LINE_RE.test(line)) {
      out.push('', '---', '');
      continue;
    }
    const next = lines[i + 1];
    const needsBreak =
      line.trim() !== '' &&
      !/^ {0,3}(#|\|)/.test(line) &&
      next !== undefined &&
      next.trim() !== '' &&
      !SEPARATOR_LINE_RE.test(next) &&
      !BLOCK_START_RE.test(next) &&
      !/ {2}$/.test(line);
    out.push(needsBreak ? `${line.replace(/[ \t]+$/, '')}  ` : line);
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(?:\s*---\s*)+/, '')
    .replace(/(?:\s*---\s*)+$/, '')
    .trim();
}

function extractDifyParts(content: string): ParsedDifyMessage {
  const buttons: DifyMessageButton[] = [];
  const forms: DifyForm[] = [];

  const hasButtons = !!content && content.includes('data-message=');
  const hasForm = !!content && FORM_RE.test(content);
  if (!hasButtons && !hasForm) {
    return { text: content, buttons, forms };
  }

  if (typeof DOMParser === 'undefined') {
    return parseDifyMessageWithoutDom(content);
  }

  const doc = new DOMParser().parseFromString(content, 'text/html');
  const buttonEls = Array.from(doc.body.querySelectorAll('button[data-message]'));
  const formEls = Array.from(doc.body.querySelectorAll('form'));

  if (buttonEls.length === 0 && formEls.length === 0) {
    return { text: content, buttons, forms };
  }

  // フォームはボタンより先に処理する（フォーム内の送信ボタンを選択肢ボタンと取り違えないため）
  for (const formEl of formEls) {
    forms.push(readForm(formEl));
    formEl.remove();
  }

  // ボタンを含む「本文直下(body直下)の要素」を特定し、それをまるごと除去する。
  // Difyアプリはボタンを1つのカードdivにまとめて出力するが、応答に案件条件の
  // 整理内容など「ボタンとは無関係な別のdivブロック」が同時に含まれることがある。
  // 従来は正規表現で最初の<div>〜最後の</div>を一括除去しており、この場合
  // 無関係な整理内容までまとめて消えてしまっていた（body直下の要素単位で
  // 判定すれば、ボタンを含む要素だけをピンポイントで除去できる）。
  const topLevelNodesToRemove = new Set<Element>();
  for (const btn of buttonEls) {
    if (!btn.isConnected) continue; // フォームごと取り除いた中にあったもの
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

  // 残りの本文は見出し・表などの構造を保ったまま Markdown にする（textContent だと潰れる）
  const text = domToChatMarkdown(doc.body);

  return { text, buttons, forms };
}

/**
 * Dify の markdown-form と同じ要素を読む：label / input / textarea / button。
 * select は `<input type="select" data-options='["A","B"]'>` の形で来る。
 * label は直後の入力欄の見出しとして扱い、for 属性があればそちらを優先する。
 */
function readForm(formEl: Element): DifyForm {
  const format = (formEl.getAttribute('data-format') || 'text').toLowerCase() === 'json' ? 'json' : 'text';
  const fields: DifyFormField[] = [];
  const labelsByFor = new Map<string, string>();
  let pendingLabel = '';
  let submitLabel = '';

  formEl.querySelectorAll('label').forEach((l) => {
    const target = l.getAttribute('for');
    if (target) labelsByFor.set(target, (l.textContent || '').trim());
  });

  formEl.querySelectorAll('label, input, textarea, button').forEach((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'label') {
      pendingLabel = (el.textContent || '').trim();
      return;
    }
    if (tag === 'button') {
      if (!submitLabel) submitLabel = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return;
    }
    const name = el.getAttribute('name') || el.getAttribute('id') || '';
    if (!name) return;
    const id = el.getAttribute('id') || '';
    const label = (id && labelsByFor.get(id)) || pendingLabel || name;
    pendingLabel = '';
    const base = {
      name,
      label,
      placeholder: el.getAttribute('placeholder') || '',
      required: el.hasAttribute('required'),
    };
    if (tag === 'textarea') {
      const rows = Number(el.getAttribute('rows'));
      fields.push({
        ...base,
        kind: 'textarea',
        inputType: 'text',
        defaultValue: el.textContent || '',
        // Dify は rows=15 を平気で付けてくるので、チャット欄に収まる高さに抑える
        rows: Number.isFinite(rows) && rows > 0 ? Math.min(rows, 6) : 4,
      });
      return;
    }
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    const value = el.getAttribute('value') || '';
    if (type === 'hidden') {
      fields.push({ ...base, kind: 'hidden', inputType: type, defaultValue: value });
    } else if (type === 'checkbox') {
      fields.push({ ...base, kind: 'checkbox', inputType: type, defaultValue: el.hasAttribute('checked') ? 'true' : '' });
    } else if (type === 'select') {
      let options: string[] = [];
      try {
        const parsed = JSON.parse(el.getAttribute('data-options') || '[]');
        if (Array.isArray(parsed)) options = parsed.map(String);
      } catch {
        options = [];
      }
      fields.push({ ...base, kind: 'select', inputType: type, defaultValue: value || options[0] || '', options });
    } else {
      fields.push({ ...base, kind: 'input', inputType: type, defaultValue: value });
    }
  });

  return { format, fields, submitLabel: submitLabel || '送信する' };
}

/** フォームの入力値を、Dify 標準UIが送るのと同じ文字列にする */
export function serializeDifyForm(form: DifyForm, values: Record<string, string | boolean>): string {
  const entries = form.fields.map((f) => [f.name, values[f.name] ?? (f.kind === 'checkbox' ? false : '')] as const);
  if (form.format === 'json') {
    return JSON.stringify(Object.fromEntries(entries));
  }
  return entries.map(([k, v]) => `${k}: ${v}`).join('\n');
}

/** DOMParserが利用できない環境向けの簡易フォールバック（ボタンの抽出のみ行い、本文はタグを外すだけ） */
function parseDifyMessageWithoutDom(content: string): ParsedDifyMessage {
  const buttons: DifyMessageButton[] = [];
  const forms: DifyForm[] = [];

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
    return { text: content, buttons, forms };
  }

  const text = content
    .replace(BUTTON_RE, '')
    .replace(ANY_TAG_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, buttons, forms };
}
