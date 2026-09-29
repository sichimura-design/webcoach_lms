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
