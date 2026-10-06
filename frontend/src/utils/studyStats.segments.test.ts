import { adjustSegments, displaySegments, mergeSegmentTotals } from './studyStats';

describe('adjustSegments', () => {
  const timeline = [
    { category: 'material' as const, seconds: 20 * 60 },
    { category: 'ai' as const, seconds: 40 * 60 },
  ];

  it('減らした分は最後の区間から削る（比例配分しない）', () => {
    expect(adjustSegments(timeline, 25 * 60)).toEqual([
      { category: 'material', seconds: 20 * 60 },
      { category: 'ai', seconds: 5 * 60 },
    ]);
  });

  it('最後の区間で足りなければ前の区間も削る', () => {
    expect(adjustSegments(timeline, 10 * 60)).toEqual([{ category: 'material', seconds: 10 * 60 }]);
  });

  it('増やした分は実測を触らず「その他」として足す', () => {
    expect(adjustSegments(timeline, 70 * 60)).toEqual([...timeline, { category: 'other', seconds: 10 * 60 }]);
  });

  it('最後がその他なら、そこにまとめる', () => {
    const t = [{ category: 'material' as const, seconds: 60 }, { category: 'other' as const, seconds: 60 }];
    expect(adjustSegments(t, 300)).toEqual([t[0], { category: 'other', seconds: 240 }]);
  });

  it('内訳が無ければ全部その他', () => {
    expect(adjustSegments([], 600)).toEqual([{ category: 'other', seconds: 600 }]);
  });

  it('合計は常に目標秒と一致する', () => {
    for (const target of [60, 1500, 3600, 5000]) {
      expect(adjustSegments(timeline, target).reduce((s, x) => s + x.seconds, 0)).toBe(target);
    }
  });
});

describe('mergeSegmentTotals / displaySegments', () => {
  it('時系列で同じカテゴリが何度出ても1行にまとめる', () => {
    const t = [
      { category: 'material' as const, seconds: 600 },
      { category: 'ai' as const, seconds: 300 },
      { category: 'material' as const, seconds: 600 },
    ];
    expect(mergeSegmentTotals(t)).toEqual([
      { category: 'material', seconds: 1200 },
      { category: 'ai', seconds: 300 },
    ]);
    expect(displaySegments(t, 25)).toEqual([
      { category: 'material', minutes: 20 },
      { category: 'ai', minutes: 5 },
    ]);
  });
});
