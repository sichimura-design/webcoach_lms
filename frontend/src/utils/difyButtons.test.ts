import { parseDifyMessage, serializeDifyForm } from './difyButtons';

// 応募文メーカー（B-016）が実際に返したフォームを縮めたもの
const FORM_REPLY = `<form data-format='text'>
<label for="url">URL（必須）</label>
<input type="text" id="url" name="url" placeholder="入力してください" required />
<label for="career_history">職務経歴・学んできたスキル・実績（必須）</label>
<textarea id="career_history" name="career_history" rows="15" placeholder="・職務経歴：[例]&#10;・実績：[例]" required></textarea>
<button type="submit">応募文の作成を依頼する</button>
</form>`;

describe('parseDifyMessage のフォーム', () => {
  it('フォームを取り出し、本文には HTML を残さない', () => {
    const { text, buttons, forms } = parseDifyMessage(`下記を入力してください\n\n${FORM_REPLY}`);
    expect(text).toBe('下記を入力してください');
    expect(buttons).toEqual([]);
    expect(forms).toHaveLength(1);
    const [form] = forms;
    expect(form.format).toBe('text');
    expect(form.submitLabel).toBe('応募文の作成を依頼する');
    expect(form.fields.map((f) => [f.kind, f.name, f.label, f.required])).toEqual([
      ['input', 'url', 'URL（必須）', true],
      ['textarea', 'career_history', '職務経歴・学んできたスキル・実績（必須）', true],
    ]);
    expect(form.fields[1].placeholder).toBe('・職務経歴：[例]\n・実績：[例]');
    expect(form.fields[1].rows).toBe(6);
  });

  it('Dify 標準UIと同じ「name: 値」の改行区切りで送る', () => {
    const [form] = parseDifyMessage(FORM_REPLY).forms;
    expect(serializeDifyForm(form, { url: 'https://example.com/job', career_history: 'ライター3年' })).toBe(
      'url: https://example.com/job\ncareer_history: ライター3年',
    );
  });

  it('json 形式のフォームは JSON で送る', () => {
    const [form] = parseDifyMessage(FORM_REPLY.replace("data-format='text'", "data-format='json'")).forms;
    expect(serializeDifyForm(form, { url: 'u', career_history: 'c' })).toBe('{"url":"u","career_history":"c"}');
  });

  it('選択肢ボタンだけの応答は従来どおり', () => {
    const { text, buttons, forms } = parseDifyMessage(
      '下記から選んでください\n<div><button data-message="応募文作成">応募文作成</button></div>',
    );
    expect(text).toBe('下記から選んでください');
    expect(buttons).toEqual([{ label: '応募文作成', value: '応募文作成' }]);
    expect(forms).toEqual([]);
  });
});

// 応募文メーカー（B-016）が実際に返した本文の形。1行改行で区切り、フォームの手前に区切り線を置く
describe('Dify 本文の改行・区切り線（B-016）', () => {
  it('フォーム手前の区切り線で、直前の段落が見出しに化けない', () => {
    const { text } = parseDifyMessage(
      'ご回答いただけましたら、応募文を作成いたします。\n----------------------------------------------------------\n\n' +
        FORM_REPLY,
    );
    // 「本文\n---」は Markdown では h2 見出しになるので、区切り線ごと落とす
    expect(text).toBe('ご回答いただけましたら、応募文を作成いたします。');
  });

  it('本文の途中の区切り線は、見出しにせず罫線として残す', () => {
    const { text } = parseDifyMessage('前半です。\n-----\n後半です。');
    expect(text).toBe('前半です。\n\n---\n\n後半です。');
  });

  it('1行改行はそのまま改行として表示されるようにする', () => {
    const { text } = parseDifyMessage(
      '情報のご入力ありがとうございます。\n現在、URLから案件の詳細を読み取れませんでした。\n\n① スキルについて\n- 得意なジャンルは？\n- ポートフォリオは？',
    );
    expect(text).toBe(
      // 箇条書きは段落の直後でもそのまま始まるので、区切りを足さない
      '情報のご入力ありがとうございます。  \n現在、URLから案件の詳細を読み取れませんでした。\n\n① スキルについて\n- 得意なジャンルは？\n- ポートフォリオは？',
    );
  });

  it('ボタン・フォームの無い応答（完成した応募文）も改行を保つ', () => {
    const { text } = parseDifyMessage('以下のポートフォリオをご覧いただけます。\nhttps://example.com/pf');
    expect(text).toBe('以下のポートフォリオをご覧いただけます。  \nhttps://example.com/pf');
  });

  it('コードブロックと表は崩さない', () => {
    const code = '```\na\nb\n```';
    expect(parseDifyMessage(code).text).toBe(code);
    const table = '| a | b |\n| --- | --- |\n| 1 | 2 |';
    expect(parseDifyMessage(table).text).toBe(table);
  });
});
