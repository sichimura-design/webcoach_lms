/* eslint-disable testing-library/render-result-naming-convention, testing-library/no-unnecessary-act -- @testing-library は使っていない（react-dom/client を直接使う）。名前が render で始まるだけで誤検知する */
/**
 * useAiApplications（「AIコーチでできること」の顔ぶれをDBから決める）のテスト。
 *
 * 🔴 見たいのは一覧の約束ごと（顔ぶれ・表示名・説明・分類・並び順はすべてDBで決まる）:
 *    - DBに行があるAIアプリだけを、sort_order の順に出す
 *    - 分類は display_category で束ね、分類の並びも sort_order で決まる
 *    - 表示名・説明は display_* が優先、空ならDBの name / description
 *    - 取得に失敗したら、画面側の一覧で代用せず空にする
 */
import type { AiApplication } from '../types/aiApplication';
import type { AiSkillCatalog } from './useAiApplications';

// 🔴 jest.fn は各テストで作り直す（CRA の resetMocks で実装が消えるため）
let mockGetAIApplications: jest.Mock;
jest.mock('../services/bffClient', () => ({
  __esModule: true,
  bffClient: { getAIApplications: (...args: unknown[]) => mockGetAIApplications(...args) },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const app = (appKey: string | null, patch: Partial<AiApplication> = {}): AiApplication => ({
  id: 1,
  name: `app-${appKey}`,
  category: '',
  description: '',
  url: null,
  icon_url: null,
  tags: [],
  display_name: null,
  display_description: null,
  display_category: null,
  sort_order: null,
  app_key: appKey,
  created_at: '2026-09-26T00:00:00',
  updated_at: '2026-09-26T00:00:00',
  ...patch,
});

/** フックを描画して、読み込みが終わった後の結果を返す */
async function renderCatalog(): Promise<AiSkillCatalog> {
  // 取得結果はモジュール内にキャッシュされるので、テストごとに読み込み直す。
  // React も同じ登録簿から読み込まないと、フックが別の React を見て動かない
  let React!: typeof import('react');
  let createRoot!: typeof import('react-dom/client').createRoot;
  let useAiApplications!: typeof import('./useAiApplications').useAiApplications;
  jest.isolateModules(() => {
    React = require('react');
    ({ createRoot } = require('react-dom/client'));
    ({ useAiApplications } = require('./useAiApplications'));
  });
  const { act, createElement } = React;
  let latest!: AiSkillCatalog;
  const Probe = () => {
    latest = useAiApplications();
    return null;
  };
  const root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(createElement(Probe));
  });
  await act(async () => {
    await Promise.resolve();
  });
  act(() => root.unmount());
  return latest;
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

test('DBに行があるAIアプリだけを、sort_order の順に出す', async () => {
  mockGetAIApplications = jest.fn().mockResolvedValue([
    app('project-extractor-coconala', { id: 1, sort_order: 90 }),
    app('technical-term-ai-assistant', { id: 2, sort_order: 10 }),
    app('catchcopy-idea-maker', { id: 3 }), // sort_order が無い行は末尾
    app(null, { id: 4, name: 'ChatGPT', sort_order: 1 }), // AIチャット連携の無い古い行は出さない
  ]);

  const catalog = await renderCatalog();

  expect(catalog.loading).toBe(false);
  // 教材について質問（learning）はDBに行が無いので出さない
  expect(catalog.listedSkills).toEqual(['glossary', 'job-search-coconala', 'copy']);
});

test('分類は display_category で束ね、分類の並びも sort_order で決まる', async () => {
  mockGetAIApplications = jest.fn().mockResolvedValue([
    app('project-extractor-coconala', { id: 1, sort_order: 90, display_category: '案件獲得' }),
    app('catchcopy-idea-maker', { id: 2, sort_order: 50, display_category: '制作サポート' }),
    app('technical-term-ai-assistant', { id: 3, sort_order: 10, display_category: '学習サポート' }),
    app('ai-interview-simulator', { id: 4, sort_order: 70, display_category: '案件獲得' }),
    app('design-sprint-challenger', { id: 5, sort_order: 20 }), // 分類が空なら「そのほか」
  ]);

  const catalog = await renderCatalog();

  expect(catalog.groups).toEqual([
    { label: '学習サポート', skills: ['glossary'] },
    { label: 'そのほか', skills: ['design-sprint'] },
    { label: '制作サポート', skills: ['copy'] },
    { label: '案件獲得', skills: ['interview', 'job-search-coconala'] },
  ]);
});

test('表示名・説明は display_* が優先で、空ならDBの name / description を使う', async () => {
  mockGetAIApplications = jest.fn().mockResolvedValue([
    app('technical-term-ai-assistant', {
      display_name: '用語をやさしく',
      display_description: 'DBの説明',
    }),
    app('catchcopy-idea-maker', { name: 'キャッチコピーアイデアメーカー', description: 'AI向けの説明' }),
  ]);

  const catalog = await renderCatalog();

  expect(catalog.labelOf('glossary')).toBe('用語をやさしく');
  expect(catalog.descriptionOf('glossary')).toBe('DBの説明');
  expect(catalog.labelOf('copy')).toBe('キャッチコピーアイデアメーカー');
  expect(catalog.descriptionOf('copy')).toBe('AI向けの説明');
});

test('画面側の定義が無いAIアプリは出さず、警告する', async () => {
  mockGetAIApplications = jest.fn().mockResolvedValue([app('brand-new-app')]);

  const catalog = await renderCatalog();

  expect(catalog.listedSkills).toEqual([]);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining('AI_SKILL_META'),
    ['app-brand-new-app (app_key=brand-new-app)']
  );
});

test('取得に失敗したら、画面側の一覧で代用せず空にする', async () => {
  mockGetAIApplications = jest.fn().mockRejectedValue(new Error('network'));

  const catalog = await renderCatalog();

  expect(catalog.loading).toBe(false);
  expect(catalog.failed).toBe(true);
  expect(catalog.listedSkills).toEqual([]);
  expect(catalog.groups).toEqual([]);
});

test('app_key を返さない古いAPIなら、取得失敗として扱う', async () => {
  const legacy = app(null, { name: 'デザインフィードバックメンターPro ver.2' }) as Partial<AiApplication>;
  delete legacy.app_key;
  mockGetAIApplications = jest.fn().mockResolvedValue([legacy]);

  const catalog = await renderCatalog();

  expect(catalog.failed).toBe(true);
  expect(catalog.listedSkills).toEqual([]);
});
