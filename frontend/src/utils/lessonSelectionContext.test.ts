/**
 * 教材ページのAIコーチへ渡す選択箇所の文脈（見出し・前後文章）と、会話履歴への選択文章の添付。
 */
import {
  captureSelectionContext,
  extractLessonText,
  extractLessonTextFromHtml,
  SELECTION_SURROUNDING_CHARS,
} from './lessonSelectionContext';
import { toConversationHistory } from './aiChatHistory';

function setup(html: string) {
  document.body.innerHTML = `<div id="root">${html}</div>`;
  return document.getElementById('root')!;
}

function selectText(root: Element, target: string): Range {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const idx = node.textContent!.indexOf(target);
    if (idx >= 0) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + target.length);
      return range;
    }
  }
  throw new Error(`not found: ${target}`);
}

describe('captureSelectionContext', () => {
  const html = `
    <h2>色の三属性</h2>
    <p>色には色相・明度・彩度があります。</p>
    <h3>彩度とは</h3>
    <p>彩度は色の鮮やかさの度合いです。彩度が低いほどグレーに近づきます。</p>
    <h3>明度とは</h3>
    <p>明度は明るさです。</p>`;

  it('直近の見出しと前後の文章を切り出す', () => {
    const root = setup(html);
    const ctx = captureSelectionContext(selectText(root, '色の鮮やかさの度合い'), root);
    expect(ctx.text).toBe('色の鮮やかさの度合い');
    expect(ctx.heading).toBe('彩度とは');
    expect(ctx.before.endsWith('彩度とは 彩度は')).toBe(true);
    expect(ctx.after.startsWith('です。彩度が低いほど')).toBe(true);
    expect(ctx.after).toContain('明度とは');
  });

  it('見出しより前を選んだら見出しは null', () => {
    const root = setup(`<p>はじめに読む文章です。</p>${html}`);
    const ctx = captureSelectionContext(selectText(root, 'はじめに'), root);
    expect(ctx.heading).toBeNull();
  });

  it('見出しそのものを選んだらその見出しになる', () => {
    const root = setup(html);
    const ctx = captureSelectionContext(selectText(root, '明度とは'), root);
    expect(ctx.heading).toBe('明度とは');
  });

  it('前後の文章は上限文字数で切る', () => {
    const long = 'あ'.repeat(SELECTION_SURROUNDING_CHARS + 50);
    const root = setup(`<p>${long}選択${long}</p>`);
    const ctx = captureSelectionContext(selectText(root, '選択'), root);
    expect(ctx.before).toHaveLength(SELECTION_SURROUNDING_CHARS);
    expect(ctx.after).toHaveLength(SELECTION_SURROUNDING_CHARS);
  });
});

describe('extractLessonText', () => {
  it('script/style を除いて空白を詰める', () => {
    const root = setup('<h1>タイトル</h1>\n<script>alert(1)</script><style>p{}</style><p>本文  です</p>');
    expect(extractLessonText(root)).toBe('タイトル 本文 です');
    expect(extractLessonText(null)).toBe('');
  });

  it('HTML文字列からも抜粋できる', () => {
    expect(extractLessonTextFromHtml('<p>a</p><p>b</p>')).toBe('ab');
  });
});

describe('toConversationHistory', () => {
  it('選択文章についての質問は、選択文章を発言に添える', () => {
    const history = toConversationHistory([
      { role: 'user', content: 'これは何？', quote: '彩度' },
      { role: 'assistant', content: '鮮やかさです' },
    ]);
    expect(history[0].content).toBe('（教材の選択箇所:「彩度」）\nこれは何？');
    expect(history[1].content).toBe('鮮やかさです');
  });
});
