/* eslint-disable testing-library/render-result-naming-convention, testing-library/no-unnecessary-act -- @testing-library は使っていない（react-dom/client を直接使う）。名前が render で始まるだけで誤検知する */
/**
 * useAiApplications（「AIコーチでできること」の顔ぶれをDBから決める）のテスト。
 *
 * 🔴 見たいのは一覧の約束ごと:
 *    - DBに行があるAIアプリだけを出す（DBに無いものは出さない）
 *    - 組み込みの機能（教材について質問）はDBにかかわらず出す
 *    - 表示名・説明はDBの display_* が優先、空なら画面の既定文言
 *    - 取得に失敗しても一覧を空にしない
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

test('DBに行があるAIアプリと組み込みの機能だけを、宣言順で出す', async () => {
  mockGetAIApplications = jest.fn().mockResolvedValue([
    app('project-extractor-coconala'),
    app('technical-term-ai-assistant'),
    app(null, { name: 'ChatGPT' }), // AIチャット連携の無い古い行は出さない
  ]);

  const catalog = await renderCatalog();

  expect(catalog.loading).toBe(false);
  expect(catalog.listedSkills).toEqual(['learning', 'glossary', 'job-search-coconala']);
});

test('表示名・説明はDBの値が優先で、空なら画面の既定文言を使う', async () => {
  mockGetAIApplications = jest.fn().mockResolvedValue([
    app('technical-term-ai-assistant', {
      display_name: '用語をやさしく',
      display_description: 'DBの説明',
    }),
    app('catchcopy-idea-maker'),
  ]);

  const catalog = await renderCatalog();

  expect(catalog.labelOf('glossary')).toBe('用語をやさしく');
  expect(catalog.descriptionOf('glossary')).toBe('DBの説明');
  expect(catalog.labelOf('copy')).toBe('キャッチコピーを考える');
});

test('画面側の定義が無いAIアプリは出さず、警告する', async () => {
  mockGetAIApplications = jest.fn().mockResolvedValue([app('brand-new-app')]);

  const catalog = await renderCatalog();

  expect(catalog.listedSkills).toEqual(['learning']);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining('AI_SKILL_META'),
    ['app-brand-new-app (app_key=brand-new-app)']
  );
});

test('取得に失敗したら、AIアプリを持つスキルをすべて出す（一覧を空にしない）', async () => {
  mockGetAIApplications = jest.fn().mockRejectedValue(new Error('network'));

  const catalog = await renderCatalog();

  expect(catalog.loading).toBe(false);
  expect(catalog.listedSkills).toContain('interview');
  expect(catalog.listedSkills).toContain('job-search-crowdworks');
  // AIアプリの無いモードは失敗時も出さない
  expect(catalog.listedSkills).not.toContain('writing');
});

test('app_key を返さない古いAPIなら、取得失敗と同じく既定の一覧を出す', async () => {
  const legacy = app(null, { name: 'デザインフィードバックメンターPro ver.2' }) as Partial<AiApplication>;
  delete legacy.app_key;
  mockGetAIApplications = jest.fn().mockResolvedValue([legacy]);

  const catalog = await renderCatalog();

  expect(catalog.listedSkills).toContain('design-review');
  expect(catalog.listedSkills).toContain('job-search-coconala');
});
