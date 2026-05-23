/**
 * HTML Normalizer Utilities
 * Normalize Moodle HTML content
 */

const { JSDOM } = require('jsdom');

/**
 * MoodleのHTML変換（<p>ラッパー・<br>改行）を正規化する
 * @param {string} content - HTML content
 * @returns {string} Normalized HTML
 */
function normalizeMoodleContent(content) {
  if (!content) return content;
  const dom = new JSDOM(content);
  const doc = dom.window.document;

  // <style> を収集しつつ CSS 内のノイズを除去
  // Moodleエディタは <style> 内の改行を <br>、インデントを &nbsp;/U+00A0 に変換するため
  const styles = Array.from(doc.querySelectorAll('style'))
    .map(s => {
      // <style> は raw text 要素なので textContent に生テキストが入っている
      s.textContent = s.textContent
        .replace(/<br\s*\/?>/gi, '\n')  // <br> テキスト → 改行
        .replace(/&nbsp;/g, ' ')        // HTML エンティティ → スペース
        .replace(/\u00a0/g, ' ');       // U+00A0 非改行スペース → スペース
      return s.outerHTML;
    })
    .join('\n');

  // <p> の直下にブロック要素がある場合は <p> を外す
  doc.querySelectorAll('p').forEach(p => {
    if (p.querySelector('div, h1, h2, h3, h4, ul, ol, table, section, nav, header, footer, details, summary')) {
      p.replaceWith(...p.childNodes);
    }
  });

  // body から <style> を除去（上で収集済み）
  doc.querySelectorAll('style').forEach(s => s.remove());

  // body 内の <meta>, <title>, <link> を除去（元 HTML の <head> 要素が Moodle エディタに混入したもの）
  doc.querySelectorAll('meta, title, link').forEach(el => el.remove());

  // 可視テキストを持たない先頭の <p> を除去（<br> や空白のみの行で大きな余白になる）
  // body の先頭から連続する空 <p> を削除する
  const bodyChildren = Array.from(doc.body.childNodes);
  for (const node of bodyChildren) {
    if (node.nodeType === 1 /* ELEMENT_NODE */ && node.tagName === 'P') {
      const text = node.textContent.replace(/[\s\u00a0]/g, '');
      if (text === '') {
        node.remove();
        continue;
      }
    }
    break; // 可視テキストを持つ要素に達したら終了
  }

  return styles + doc.body.innerHTML;
}

/**
 * HTMLエンティティをデコード
 * @param {string} str - HTML string with entities
 * @returns {string} Decoded HTML
 */
function decodeHtml(str) {
  if (!str) return str;
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

module.exports = {
  normalizeMoodleContent,
  decodeHtml
};
