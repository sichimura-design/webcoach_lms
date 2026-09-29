import { extractChoiceButtons } from './aiChoices';

describe('extractChoiceButtons', () => {
  it('「どちらですか？」の後の番号付きリストを選択肢にする（B-015 のスクショ）', () => {
    const text = [
      '単価の伝え方についてのご質問ですね。',
      '',
      '**あなたの状況は以下のどちらですか？**',
      '',
      '1. **すでに応募する案件が決まっていて、その案件に対する応募文の中で単価をどう伝えるか知りたい**',
      '   → 案件の詳細情報を教えていただければ、応募文作成ツールで一緒に考えます',
      '2. **案件応募全般において、単価をどう伝えるのが効果的かという一般的なアドバイスが欲しい** → 専門用語解説ツールで説明してもらえます',
      '',
      'どちらのご希望でしょうか？',
    ].join('\n');
    const buttons = extractChoiceButtons(text);
    expect(buttons.map((b) => b.value)).toEqual([
      'すでに応募する案件が決まっていて、その案件に対する応募文の中で単価をどう伝えるか知りたい',
      '案件応募全般において、単価をどう伝えるのが効果的かという一般的なアドバイスが欲しい',
    ]);
    // 長い見出しは表示だけ縮める（送る文言は全文）
    expect(buttons[0].label.endsWith('…')).toBe(true);
  });

  it('太字でなければ「→」「：」より前を見出しにする', () => {
    const text = '使える時間はどれくらいですか？\n- 30分 → 小さな課題\n- 2時間：しっかり取り組む\n- 3時間';
    expect(extractChoiceButtons(text).map((b) => b.value)).toEqual(['30分', '2時間', '3時間']);
  });

  it('問いかけの無い手順のリストはボタンにしない', () => {
    const text = '次にやること\n1. Figma を開く\n2. フレームを作る\n3. 書き出す\n\nがんばってください！';
    expect(extractChoiceButtons(text)).toEqual([]);
  });

  it('項目が1つだけ・7つ以上のときは選択肢とみなさない', () => {
    expect(extractChoiceButtons('どれにしますか？\n- A')).toEqual([]);
    const many = ['どれにしますか？', ...Array.from({ length: 7 }, (_, i) => `- 案${i + 1}`)].join('\n');
    expect(extractChoiceButtons(many)).toEqual([]);
  });

  it('リストの後に「どちら」と聞く形も拾う', () => {
    const text = '進め方は2つあります。\n1. 自分で作る\n2. テンプレートを使う\nどちらで進めますか？';
    expect(extractChoiceButtons(text).map((b) => b.value)).toEqual(['自分で作る', 'テンプレートを使う']);
  });
});
