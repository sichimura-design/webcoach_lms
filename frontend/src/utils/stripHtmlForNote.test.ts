import { stripHtmlForNote } from './stripHtmlForNote';

describe('stripHtmlForNote', () => {
  it('HTMLを含まない本文はそのまま返す', () => {
    const md = '## 結論\n\n- a\n  - b\n\n`x < y` のとき';
    expect(stripHtmlForNote(md)).toBe(md);
  });

  it('タグを外し、ブロック要素・br・リストを改行に置き換える', () => {
    const html = '<div class="card">\n  <h3>整理した条件</h3>\n  <ul><li>職種: デザイナー</li><li>予算: 5万円</li></ul>\n  <p>1行目<br>2行目</p>\n</div>';
    expect(stripHtmlForNote(html)).toBe('整理した条件\n\n- 職種: デザイナー\n- 予算: 5万円\n\n1行目\n2行目');
  });

  it('ボタン付きカードは丸ごと落とし、ほかの本文は残す', () => {
    const html =
      'どれを探しますか？\n<div><p>選んでください</p><button data-message="Crowdworks">クラウドワークス</button></div>';
    expect(stripHtmlForNote(html)).toBe('どれを探しますか？');
  });

  it('コードブロック内のHTMLは残す', () => {
    const md = '<p>例です</p>\n\n```html\n<div class="box">hi</div>\n```\n\nインラインは `<br>` です';
    expect(stripHtmlForNote(md)).toBe('例です\n\n```html\n<div class="box">hi</div>\n```\n\nインラインは `<br>` です');
  });

  it('実体参照を文字に戻す', () => {
    expect(stripHtmlForNote('<span>A &amp; B</span>')).toBe('A & B');
  });
});
