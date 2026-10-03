/* eslint-disable testing-library/render-result-naming-convention, testing-library/no-unnecessary-act -- @testing-library は使っていない（react-dom/client を直接使う）。名前が render で始まるだけで誤検知する */
/**
 * 流れに沿って進むAIアプリ（応募文メーカー等）の入口のテスト。
 *
 * 🔴 見たいのは:
 *    - 選択肢のあるアプリのモードに入ったら、Difyに送らずに挨拶文と選択肢を出す
 *    - 選んだ文言を最初の発言としてアプリへ送り、挨拶文は付け直させない（opening_shown）
 *    - 選択肢の無いアプリは何も出さない（従来どおり）
 *    - 提案カードを受け入れても、直前の発言をアプリへ送らない（最初の分岐に当たらず進まなくなる）
 *    - 開始前の入力項目（求人URL等）があるアプリは入口に入力欄を添え、最初の発言と一緒に app_inputs で送る（ID 22）
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { introNeedsDisplay } from '../types/aiApplication';
import type { AiApplication, AiApplicationIntro } from '../types/aiApplication';
import { useAiCoachStore } from '../store/aiCoachStore';
import { appInputsReady, useLessonAi, UseLessonAi } from './useLessonAi';

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

INTROS['ai-interview-simulator'] = {
  app_key: 'ai-interview-simulator',
  opening_statement: 'はじめまして、AI面接官です！',
  suggested_questions: ['クライアントとの業務委託面談', '企業の採用面接'],
  has_choices: true,
  message:
    'はじめまして、AI面接官です！\n\n<div>\n  <button data-message="クライアントとの業務委託面談">クライアントとの業務委託面談</button>\n</div>',
  inputs: [
    {
      variable: 'job_posting',
      label: '求人情報のURLを入力してください',
      type: 'text-input',
      required: true,
      options: [],
      max_length: null,
    },
  ],
};

beforeEach(() => {
  api.getAIApplications = jest
    .fn()
    .mockResolvedValue([
      app(19, 'project-application-writer'),
      app(16, 'catchcopy-idea-maker'),
      app(15, 'ai-interview-simulator'),
    ]);
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

test('選択肢の無いアプリも挨拶文を先に出し、最初の応答に挨拶文を付け直させない', async () => {
  // 先に出さないと、サーバーが最初の応答の頭に挨拶文（「〜を教えてください」）を付け、
  // 同じ吹き出しでアプリの「ありがとうございます」が続いて、入力を待たずに進んだように見えた
  const id = useAiCoachStore.getState().createSkillSession({ skillId: 'copy' });
  const ai = await render(id);
  const assistants = ai.current.messages.filter((m) => m.role === 'assistant');
  expect(assistants).toHaveLength(1);
  expect(assistants[0].answer?.conclusion).toBe('商品を入力してください');
  expect(api.sendAIMessage).not.toHaveBeenCalled();

  await act(async () => {
    await ai.current.send('オンライン英会話');
  });
  const req = api.sendAIMessage.mock.calls[0][0];
  expect(req.force_app_key).toBe('catchcopy-idea-maker');
  expect(req.opening_shown).toBe(true);
});

test('挨拶文も選択肢も入力欄も無いアプリは入口を出さない', () => {
  expect(
    introNeedsDisplay({ app_key: 'x', opening_statement: '  ', suggested_questions: [], has_choices: false, message: '' })
  ).toBe(false);
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

describe('開始前の入力項目（求人URL）があるアプリ', () => {
  const URL = 'https://crowdworks.jp/public/jobs/123';

  test('入口に入力欄を添え、入れたURLを最初の発言と一緒に app_inputs で送る', async () => {
    const id = useAiCoachStore.getState().createSkillSession({ skillId: 'interview' });
    const ai = await render(id);

    const intro = ai.current.messages[ai.current.messages.length - 1];
    expect(intro.appInputFields?.map((f) => f.variable)).toEqual(['job_posting']);
    expect(appInputsReady(ai.current.appInputs)).toBe(false);

    await act(async () => ai.current.setAppInput('job_posting', ` ${URL} `));
    expect(appInputsReady(ai.current.appInputs)).toBe(true);

    await act(async () => {
      await ai.current.send('クライアントとの業務委託面談');
    });
    const req = api.sendAIMessage.mock.calls[0][0];
    expect(req.force_app_key).toBe('ai-interview-simulator');
    expect(req.app_inputs).toEqual({ job_posting: URL });

    // 2回目以降は送らない（サーバーが覚えている）
    await act(async () => {
      await ai.current.send('よろしくお願いします');
    });
    expect(api.sendAIMessage.mock.calls[1][0].app_inputs).toBeUndefined();
  });

  test('「URLなしで始める」を選ぶと空欄で送る', async () => {
    const id = useAiCoachStore.getState().createSkillSession({ skillId: 'interview' });
    const ai = await render(id);
    await act(async () => ai.current.setAppInputsSkipped(true));
    await act(async () => {
      await ai.current.send('企業の採用面接');
    });
    expect(api.sendAIMessage.mock.calls[0][0].app_inputs).toEqual({ job_posting: '' });
  });

  test('何も選ばずに入力欄から送ったときは app_inputs を付けない（サーバーがチャットの中で尋ねる）', async () => {
    const id = useAiCoachStore.getState().createSkillSession({ skillId: 'interview' });
    const ai = await render(id);
    await act(async () => {
      await ai.current.send('面接の練習をしたい');
    });
    expect(api.sendAIMessage.mock.calls[0][0].app_inputs).toBeUndefined();
  });
});
