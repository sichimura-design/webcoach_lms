/* eslint-disable testing-library/render-result-naming-convention, testing-library/no-unnecessary-act -- @testing-library は使っていない（react-dom/client を直接使う）。名前が render で始まるだけで誤検知する */
/**
 * 流れに沿って進むAIアプリ（応募文メーカー等）の入口のテスト。
 *
 * 🔴 見たいのは:
 *    - 選択肢のあるアプリのモードに入ったら、Difyに送らずに挨拶文と選択肢を出す
 *    - 選んだ文言を最初の発言としてアプリへ送り、挨拶文は付け直させない（opening_shown）
 *    - 選択肢の無いアプリは何も出さない（従来どおり）
 *    - 提案カードを受け入れても、直前の発言をアプリへ送らない（最初の分岐に当たらず進まなくなる）
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { AiApplication, AiApplicationIntro } from '../types/aiApplication';
import { useAiCoachStore } from '../store/aiCoachStore';
import { useLessonAi, UseLessonAi } from './useLessonAi';

const api: Record<string, jest.Mock> = {};
jest.mock('../services/bffClient', () => ({
  __esModule: true,
  bffClient: {
    getAIApplications: (...a: unknown[]) => api.getAIApplications(...a),
    getAIApplicationIntro: (...a: unknown[]) => api.getAIApplicationIntro(...a),
    sendAIMessage: (...a: unknown[]) => api.sendAIMessage(...a),
  },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const app = (id: number, appKey: string): AiApplication => ({
  id,
  name: appKey,
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
  created_at: '',
  updated_at: '',
});

const INTROS: Record<string, AiApplicationIntro> = {
  'project-application-writer': {
    app_key: 'project-application-writer',
    opening_statement: 'こんにちは！',
    suggested_questions: ['応募文作成', '応募文添削'],
    has_choices: true,
    message: 'こんにちは！\n\n<div>\n  <button data-message="応募文作成">応募文作成</button>\n  <button data-message="応募文添削">応募文添削</button>\n</div>',
  },
  'catchcopy-idea-maker': {
    app_key: 'catchcopy-idea-maker',
    opening_statement: '商品を入力してください',
    suggested_questions: [],
    has_choices: false,
    message: '商品を入力してください',
  },
};

beforeEach(() => {
  api.getAIApplications = jest
    .fn()
    .mockResolvedValue([app(19, 'project-application-writer'), app(16, 'catchcopy-idea-maker')]);
  api.getAIApplicationIntro = jest.fn((key: string) => Promise.resolve(INTROS[key]));
  api.sendAIMessage = jest.fn().mockResolvedValue({ message: '<form>URL</form>' });
});

const unmounts: (() => void)[] = [];
afterEach(() => unmounts.splice(0).forEach((u) => u()));

async function render(sessionId: string) {
  const result: { current: UseLessonAi } = { current: null as any };
  const Probe = () => {
    result.current = useLessonAi(null, sessionId);
    return null;
  };
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(Probe)));
  await flush();
  unmounts.push(() => act(() => root.unmount()));
  return result;
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });

test('選択肢のあるアプリのモードに入ると、Difyに送らずに挨拶文と選択肢を出す', async () => {
  const id = useAiCoachStore.getState().createSkillSession({ skillId: 'application' });
  const ai = await render(id);

  const last = ai.current.messages[ai.current.messages.length - 1];
  expect(last.role).toBe('assistant');
  expect(last.answer?.conclusion).toContain('data-message="応募文作成"');
  expect(api.sendAIMessage).not.toHaveBeenCalled();

  // 選んだ文言を最初の発言としてアプリへ送り、挨拶文は付け直させない
  await act(async () => {
    await ai.current.send('応募文作成');
  });
  expect(api.sendAIMessage).toHaveBeenCalledTimes(1);
  const req = api.sendAIMessage.mock.calls[0][0];
  expect(req.message).toBe('応募文作成');
  expect(req.force_app_key).toBe('project-application-writer');
  expect(req.opening_shown).toBe(true);

  // 2回目以降は挨拶文を出し直さない
  await flush();
  const intros = ai.current.messages.filter((m) => m.answer?.conclusion.includes('こんにちは！'));
  expect(intros).toHaveLength(1);
});

test('選択肢の無いアプリは挨拶文を出さず、opening_shown も付けない', async () => {
  const id = useAiCoachStore.getState().createSkillSession({ skillId: 'copy' });
  const ai = await render(id);
  expect(ai.current.messages.filter((m) => m.role === 'assistant')).toHaveLength(0);

  await act(async () => {
    await ai.current.send('オンライン英会話');
  });
  const req = api.sendAIMessage.mock.calls[0][0];
  expect(req.force_app_key).toBe('catchcopy-idea-maker');
  expect(req.opening_shown).toBeUndefined();
});

test('提案カードを受け入れても、直前の発言を流れのあるアプリへ送らず、選択肢を出す', async () => {
  const id = useAiCoachStore.getState().createPageSession();
  const ai = await render(id);
  const pasted =
    '募集内容：Webデザイナー（業務委託）。LP・バナー制作。週10時間、フルリモート。' +
    'Figma必須。ポートフォリオ提出あり。'.repeat(10) +
    'この案件に応募したいです。';

  expect(pasted.length).toBeGreaterThanOrEqual(200);
  await act(async () => {
    await ai.current.send(pasted);
  });
  const proposal = ai.current.pendingProposal;
  expect(proposal?.suggestion.skillId).toBe('application');

  await act(async () => {
    await ai.current.acceptProposal(proposal!.messageId);
  });
  await flush();

  expect(api.sendAIMessage).not.toHaveBeenCalled();
  const last = ai.current.messages[ai.current.messages.length - 1];
  expect(last.answer?.conclusion).toContain('data-message="応募文添削"');
});
