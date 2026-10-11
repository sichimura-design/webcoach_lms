import { categoryOfPath, sessionCategoryOf } from './studyCategory';

describe('categoryOfPath', () => {
  it('AIコーチの個別アプリもAIコーチ', () => {
    expect(categoryOfPath('/ai-coach')).toBe('ai');
    expect(categoryOfPath('/ai-coach/apps/22')).toBe('ai');
  });
});

describe('sessionCategoryOf', () => {
  it('教材を選んだ回は、教材以外の画面（マイページ等）の時間も教材', () => {
    expect(sessionCategoryOf(categoryOfPath('/mypage'), true)).toBe('material');
    expect(sessionCategoryOf(categoryOfPath('/focus-booth'), true)).toBe('material');
  });

  it('教材を選んでいない回はその他のまま', () => {
    expect(sessionCategoryOf(categoryOfPath('/mypage'), false)).toBe('other');
  });

  it('AIコーチ・コーチング・復習は教材を選んでいてもそのまま', () => {
    expect(sessionCategoryOf('ai', true)).toBe('ai');
    expect(sessionCategoryOf('coaching', true)).toBe('coaching');
    expect(sessionCategoryOf('review', true)).toBe('review');
  });
});
