import { GoalDeclaration } from '../types/goalDeclaration';
import {
  activeDeclaration,
  awaitingReflection,
  formatPeriod,
  sortDeclarations,
} from './goalDeclaration';

const TODAY = '2026-10-06';

function goal(over: Partial<GoalDeclaration> & { id: string }): GoalDeclaration {
  return {
    userId: 1,
    text: over.id,
    periodFrom: '2026-10-01',
    periodTo: '2026-10-31',
    status: 'active',
    reflection: null,
    reflectionAchievement: null,
    reflectedAt: null,
    createdAt: '2026-10-01T00:00:00',
    updatedAt: '2026-10-01T00:00:00',
    schemaVersion: 1,
    ...over,
  };
}

describe('activeDeclaration', () => {
  it('期間中の進行中が複数あれば、開始日ではなく最後に追加したものを返す', () => {
    const early = goal({ id: 'gd-1-01', periodFrom: '2026-10-05', createdAt: '2026-10-01T09:00:00' });
    const late = goal({ id: 'gd-2-01', periodFrom: '2026-10-01', createdAt: '2026-10-03T09:00:00' });
    expect(activeDeclaration([early, late], TODAY)?.id).toBe('gd-2-01');
  });

  it('同じ秒に追加されたものは id に埋めたミリ秒で決める', () => {
    const a = goal({ id: 'gd-1000-01', createdAt: '2026-10-03T09:00:00' });
    const b = goal({ id: 'gd-1500-02', createdAt: '2026-10-03T09:00:00' });
    expect(activeDeclaration([b, a], TODAY)?.id).toBe('gd-1500-02');
  });

  it('期間外・進行中でないものは対象にしない', () => {
    const upcoming = goal({ id: 'gd-3-01', periodFrom: '2026-10-07', createdAt: '2026-10-05T00:00:00' });
    const achieved = goal({ id: 'gd-4-01', status: 'achieved', createdAt: '2026-10-05T00:00:00' });
    const current = goal({ id: 'gd-5-01' });
    expect(activeDeclaration([upcoming, achieved, current], TODAY)?.id).toBe('gd-5-01');
  });
});

describe('awaitingReflection', () => {
  const past = { periodFrom: '2026-09-01', periodTo: '2026-09-14' };

  it('期間が終わった進行中で、振り返りが無いものだけを返す', () => {
    const items = [
      goal({ id: 'none', ...past }),
      goal({ id: 'text', ...past, reflection: '書いた' }),
      goal({ id: 'ach', ...past, reflectionAchievement: 'mid' }),
      goal({ id: 'blank', ...past, reflection: '   ' }),
      goal({ id: 'done', ...past, status: 'achieved' }),
    ];
    expect(awaitingReflection(items, TODAY).map((d) => d.id)).toEqual(['none', 'blank']);
  });
});

describe('sortDeclarations', () => {
  it('開始日の新しい順、同じ日なら追加の新しい順', () => {
    const items = [
      goal({ id: 'gd-1-01', periodFrom: '2026-09-01' }),
      goal({ id: 'gd-2-01', createdAt: '2026-10-01T00:00:00' }),
      goal({ id: 'gd-3-01', createdAt: '2026-10-02T00:00:00' }),
    ];
    expect(sortDeclarations(items).map((d) => d.id)).toEqual(['gd-3-01', 'gd-2-01', 'gd-1-01']);
  });
});

describe('formatPeriod', () => {
  it('今年の期間は年を付けない', () => {
    expect(formatPeriod('2026-10-01', '2026-10-14', TODAY)).toBe('10/1〜10/14');
  });

  it('前年の期間は始まりに年を付ける', () => {
    expect(formatPeriod('2025-10-01', '2025-10-14', TODAY)).toBe('2025/10/1〜10/14');
  });

  it('年をまたぐ期間は両方に年を付ける', () => {
    expect(formatPeriod('2025-12-20', '2026-01-10', TODAY)).toBe('2025/12/20〜2026/1/10');
  });
});
