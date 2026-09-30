import { TextHistory } from './textHistory';

const snap = (value: string) => ({ value, start: value.length, end: value.length });

describe('TextHistory', () => {
  it('続けて打った文字は1手にまとめ、間が空いたら別の手にする', () => {
    const h = new TextHistory(snap(''), 200, 1000);
    h.record(snap('あ'), 1000);
    h.record(snap('あい'), 1500);
    h.record(snap('あいう'), 3000); // 1.5秒あいた
    expect(h.undo()?.value).toBe('あい');
    expect(h.undo()?.value).toBe('');
    expect(h.undo()).toBeNull();
    expect(h.redo()?.value).toBe('あい');
    expect(h.redo()?.value).toBe('あいう');
    expect(h.canRedo).toBe(false);
  });

  it('boundary の変更は前後の打鍵と混ぜない', () => {
    const h = new TextHistory(snap('- [ ] a'), 200, 1000);
    h.record(snap('- [x] a'), 100, { boundary: true });
    h.record(snap('- [x] ab'), 200);
    expect(h.undo()?.value).toBe('- [x] a');
    expect(h.undo()?.value).toBe('- [ ] a');
  });

  it('戻したあとに書いたら、やり直しの先は捨てる', () => {
    const h = new TextHistory(snap(''), 200, 1000);
    h.record(snap('a'), 0 + 1);
    h.record(snap('ab'), 5000);
    h.undo();
    h.record(snap('ax'), 9000);
    expect(h.canRedo).toBe(false);
    expect(h.undo()?.value).toBe('a');
  });

  it('reset で前の本文へは戻れない', () => {
    const h = new TextHistory(snap(''), 200, 1000);
    h.record(snap('前のノート'), 1);
    h.reset(snap('次のノート'));
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toBeNull();
  });

  it('上限を超えた古い手は捨てる', () => {
    const h = new TextHistory(snap('0'), 3, 0);
    ['1', '2', '3', '4', '5'].forEach((v, i) => h.record(snap(v), (i + 1) * 10));
    const values = [];
    let s;
    while ((s = h.undo())) values.push(s.value);
    expect(values).toEqual(['4', '3', '2']);
  });
});
