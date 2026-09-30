import { isAskingUser, needsTypedReply } from './aiAwaitingReply';

describe('isAskingUser', () => {
  it('「どちらですか？」で終わる回答は問いかけ', () => {
    const text = [
      '**あなたの状況は以下のどちらですか？**',
      '',
      '1. **すでに応募する案件が決まっている**',
      '2. **一般的なアドバイスが欲しい**',
      '',
      'どちらのご希望でしょうか？',
    ].join('\n');
    expect(isAskingUser(text)).toBe(true);
  });

  it('「教えてください。」で終わる回答は問いかけ', () => {
    expect(isAskingUser('ポートフォリオを拝見します。\n\n作品のURLを教えてください。')).toBe(true);
  });

  it('説明だけで終わる回答は問いかけではない', () => {
    expect(isAskingUser('配色は3色までに絞ると整って見えます。\n\nまずはメインカラーを決めましょう。')).toBe(false);
  });

  it('途中に？があっても、最後が説明で終わるなら問いかけではない', () => {
    const text = ['なぜ余白が大事なのか？', '', '情報の区切りが見えるからです。', '', '要素の間は8の倍数でそろえます。', '見出しの上は広めに取ります。'].join('\n');
    expect(isAskingUser(text)).toBe(false);
  });

  it('空文字は問いかけではない', () => {
    expect(isAskingUser('')).toBe(false);
  });
});

describe('needsTypedReply', () => {
  it('Dify のボタンがある回答は、ボタンで答えられるので案内しない', () => {
    const content = 'どれにしますか？\n<button data-message="30分">30分</button><button data-message="1時間">1時間</button>';
    expect(needsTypedReply(content)).toBe(false);
  });

  it('ボタンの無い問いかけは案内する', () => {
    expect(needsTypedReply('今日使える時間はどれくらいですか？')).toBe(true);
  });
});
