/**
 * frontend/src/components/learning/moodleContent.ts
 *
 * 旧 CourseContentPage.tsx から移設した Moodle コンテンツ描画ヘルパ。
 *
 * モックOFF（本番）では構造化教材APIが 404 になるため、実Moodleのモジュールを
 * 従来どおり iframe で描画する縮退モードにフォールバックする。その描画に必要な
 * ロジックはここに集約する。ロジックそのものは旧実装から変更していない
 * （本番の見え方を変えないため）。
 */

import Encoding from 'encoding-japanese';

export interface MoodleModuleContent {
  type: string;
  filename: string;
  fileurl: string;
  content?: string;
}

export interface MoodleModule {
  id: number;
  name: string;
  modname: string;
  contents?: MoodleModuleContent[];
  description?: string;
  content?: string;
  externalurl?: string;
}

/** モジュールのコンテンツ種別（modname + ファイル種別） */
export type MoodleContentType =
  | 'page'              // mod/page → description にHTML
  | 'label'             // mod/label → description にHTML（インライン表示）
  | 'url'               // mod/url → 外部リンク
  | 'resource-video'    // mod/resource（動画ファイル）
  | 'resource-markdown' // mod/resource（.md ファイル）
  | 'resource-html'     // mod/resource（.html ファイル）
  | 'resource-other'    // mod/resource（その他）
  | 'unknown';

export const isMarkdownFile = (filename: string) => /\.(md|markdown)$/i.test(filename);
export const isVideoFile = (filename: string) => /\.(mp4|webm|ogg|mov|avi|mkv|flv|wmv)$/i.test(filename);
export const isHtmlFile = (filename: string) => /\.(html|htm|xhtml)$/i.test(filename);

/** modname とファイル拡張子からコンテンツ種別を決定 */
export function getContentType(module: MoodleModule): MoodleContentType {
  switch (module.modname) {
    case 'page':  return 'page';
    case 'label': return 'label';
    case 'url':   return 'url';
    case 'resource': {
      const contents = module.contents ?? [];
      if (contents.some(c => isVideoFile(c.filename)))    return 'resource-video';
      if (contents.some(c => isMarkdownFile(c.filename))) return 'resource-markdown';
      if (contents.some(c => isHtmlFile(c.filename)))     return 'resource-html';
      return 'resource-other';
    }
    default: return 'unknown';
  }
}

/**
 * iframe内でのテキスト選択を親に通知するスクリプト。
 *
 * 🔴 現在この postMessage の受け手はいない。
 *    受けていた「なぞって解説」（AppHeader の全画面共通ポップアップ）は、
 *    どの画面でも文章をなぞるたびに割り込むため撤去した。
 *    復活させるときは受け手を作り、かつ出す画面を絞ること。
 *    通知そのものは副作用が無い（誰も listen していなければ何も起きない）ので、
 *    復活しやすいよう送信側は残している。
 */
const EXPLAIN_INJECT = `<script>(function(){
  function report(){
    var s=window.getSelection();var t=s&&s.toString().trim();
    if(t&&t.length>=2&&t.length<=400&&s.rangeCount>0){
      var r=s.getRangeAt(0).getBoundingClientRect();
      parent.postMessage({__lmsExplain:true,text:t,top:r.top,left:r.left},'*');
    }else{parent.postMessage({__lmsExplain:true,clear:true},'*');}
  }
  document.addEventListener('mouseup',function(){setTimeout(report,0);});
  document.addEventListener('mousedown',function(){parent.postMessage({__lmsExplain:true,clear:true},'*');});
})();<` + `/script>`;
// 閉じタグは文字列連結で組み立てる。1つの文字列リテラルに </script> を含めると、
// このJSがHTMLへインライン展開されたときにスクリプトが途中で閉じてしまうため。

const IFRAME_FIXUP_CSS = `<style>
  /* Moodleエディタがブロック要素間の改行を <br> に変換した余分な空白を除去 */
  div > br, nav > br, ul > br, ol > br, li > br { display: none !important; }
  /* コンテンツ内蔵のサイドバー・プログレスバーはiframe内では不要 */
  .toc-sidebar { display: none !important; }
  #progressBar { display: none !important; }
  /*
   * .quiz-options は display:flex。
   * Moodleが &nbsp; テキストノードをブロック要素間に挿入するため、
   * それらが flex アイテムとして扱われレイアウトが崩れる。
   * font-size:0 でテキストノードのサイズを潰し、子要素で元に戻す。
   */
  .quiz-options { font-size: 0 !important; }
  .quiz-options > * { font-size: revert !important; }
</style>`;

/** <style> を <head> へ移し、body 側からは取り除く */
function splitStyles(html: string): { head: string; body: string } {
  const headStyles: string[] = [];
  const body = html.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_, open, css, close) => {
      headStyles.push(`${open}${css}${close}`);
      return '';
    }
  );
  return { head: headStyles.join('\n'), body };
}

/**
 * Moodle コンテンツ HTML から srcdoc 用の完全な HTML を生成する。
 * CSS の正規化は BFF の normalizeMoodleContent で実施済みのため、
 * ここでは <style> を <head> に移動し iframe 表示用の補正 CSS を注入するのみ。
 */
export function buildSrcdoc(html: string): string {
  const { head, body } = splitStyles(html);
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${head}
${IFRAME_FIXUP_CSS}
</head>
<body>${body}${EXPLAIN_INJECT}</body></html>`;
}

function buildSrcdocShiftJis(html: string): string {
  const { head, body } = splitStyles(html);
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="shift-jis">
<meta name="viewport" content="width=device-width,initial-scale=1">
${head}
${IFRAME_FIXUP_CSS}
</head>
<body>${body}${EXPLAIN_INJECT}</body></html>`;
}

/**
 * Moodle コンテンツを Shift-JIS の Blob として新しいタブで開く。
 * 教材HTMLが Shift-JIS 前提で書かれているものがあるため、変換して渡す。
 */
export function openMoodleContentInNewTab(html: string): void {
  if (!html) return;
  const fullHtml = buildSrcdocShiftJis(html);
  const unicodeArray = Encoding.stringToCode(fullHtml);
  const sjisArray = Encoding.convert(unicodeArray, { to: 'SJIS', from: 'UNICODE' });
  const blob = new Blob([new Uint8Array(sjisArray)], { type: 'text/html; charset=shift-jis' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
}

/** content / description が「URLだけ」のとき、そのURLを取り出す */
export function extractSoleUrl(html: string): string | undefined {
  const match = html.trim().match(/^(?:<[^>]+>\s*)*?(https?:\/\/[^\s<"']+?)(?:\s*<\/[^>]+>)*\s*$/i);
  return match?.[1];
}

/** mod/url の遷移先を、externalurl → contents → 本文中の <a href> の順で解決する */
export function resolveExternalUrl(module: MoodleModule): string | undefined {
  if (module.externalurl) return module.externalurl;

  const fromContents =
    module.contents?.find(c => c.type === 'url')?.fileurl || module.contents?.[0]?.fileurl;
  if (fromContents) return fromContents;

  for (const raw of [module.content, module.description]) {
    const text = raw?.trim();
    if (!text) continue;
    if (/^https?:\/\//i.test(text)) return text;
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const href = doc.querySelector('a[href]')?.getAttribute('href');
    if (href) return href;
  }
  return undefined;
}
