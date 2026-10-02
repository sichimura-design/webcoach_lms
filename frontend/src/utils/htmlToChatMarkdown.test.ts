import { parseDifyMessage } from './difyButtons';
import { htmlToChatMarkdown } from './htmlToChatMarkdown';

// デザインフィードバックメンターProが実際に返した形を縮めたもの
const FEEDBACK_REPLY = `ありがとうございます。それでは整理します。

<h3>プロジェクト概要</h3>
<table><tbody>
<tr><th>概要</th><td><strong>デザインの種類：Webスクールの広告バナー</strong><br>目的：無料説明会への申込</td></tr>
<tr><th>ターゲット</th><td>20〜30代女性</td></tr>
</tbody></table>
<h3>まとめ</h3>
<p>それでは「完成しました」と一言添えて、作成いただいた成果物をアップロードしてください！</p>`;

describe('htmlToChatMarkdown', () => {
  it('HTML の無い本文はそのまま返す', () => {
    const md = '### 見出し\n\n- a\n- b';
    expect(htmlToChatMarkdown(md)).toBe(md);
  });

  it('見出し・縦並びの表・段落を Markdown にし、タグを残さない', () => {
    const md = htmlToChatMarkdown(FEEDBACK_REPLY);
    expect(md).not.toMatch(/<\/?(h3|table|tr|th|td|strong|br|p)\b/);
    expect(md).toContain('### プロジェクト概要');
    expect(md).toContain('**概要**\n**デザインの種類：Webスクールの広告バナー**\n目的：無料説明会への申込');
    expect(md).toContain('**ターゲット**\n20〜30代女性');
    expect(md).toContain('### まとめ');
    expect(md.startsWith('ありがとうございます。それでは整理します。')).toBe(true);
  });

  it('見出し行のある表は GFM の表にする', () => {
    const md = htmlToChatMarkdown(
      '<table><thead><tr><th>観点</th><th>評価</th></tr></thead><tbody><tr><td>CTR</td><td>A|B<br>良い</td></tr></tbody></table>',
    );
    expect(md).toBe('| 観点 | 評価 |\n| --- | --- |\n| CTR | A\\|B / 良い |');
  });

  it('リストとリンクを Markdown にする', () => {
    expect(htmlToChatMarkdown('<ul><li>一つ目</li><li><b>二つ目</b></li></ul>')).toBe('- 一つ目\n- **二つ目**');
    expect(htmlToChatMarkdown('<ol><li>a</li><li>b</li></ol>')).toBe('1. a\n2. b');
    expect(htmlToChatMarkdown('<a href="https://example.com">詳細</a>')).toBe('[詳細](https://example.com)');
  });

  it('コードブロックの中の HTML は触らない', () => {
    const md = '<p>例</p>\n\n```html\n<h3>そのまま</h3>\n```';
    expect(htmlToChatMarkdown(md)).toBe('例\n\n```html\n<h3>そのまま</h3>\n```');
  });
});

describe('parseDifyMessage と HTML 本文', () => {
  it('ボタンの無い HTML 本文もタグが見えない', () => {
    const { text, buttons } = parseDifyMessage(FEEDBACK_REPLY);
    expect(buttons).toEqual([]);
    expect(text).not.toMatch(/<\/?(h3|table|td|th)\b/);
    expect(text).toContain('### プロジェクト概要');
  });

  it('ボタン付きでも残りの本文の見出し・表を潰さない', () => {
    const { text, buttons } = parseDifyMessage(
      `${FEEDBACK_REPLY}\n<div><button data-message="CPA・CVRを追うWebマーケター">CPA・CVRを追うWebマーケター</button></div>`,
    );
    expect(buttons).toEqual([{ label: 'CPA・CVRを追うWebマーケター', value: 'CPA・CVRを追うWebマーケター' }]);
    expect(text).toContain('### プロジェクト概要');
    expect(text).toContain('**ターゲット**');
    expect(text).not.toContain('<');
  });
});
