/**
 * AIチャットの「生成を中止」（B-009）のテスト。
 * 🔴 見たいのは「中止したらポーリングをやめて AbortError で抜けること」。
 *    サーバー側は止まらないので、せめてこちらから問い合わせ続けない。
 */
const mockCalls: string[] = [];

// 🔴 jest.fn は使わない（CRA の resetMocks で実装が消える）。jest.mock の中からは mock で始まる名前しか参照できない
jest.mock('axios', () => {
  const instance: any = { interceptors: { request: { use: () => 0 }, response: { use: () => 0 } } };
  instance.post = async (url: string) => {
    mockCalls.push(`post ${url}`);
    return { data: { status: 'processing', job_id: 'job-1' } };
  };
  instance.get = async (url: string) => {
    mockCalls.push(`get ${url}`);
    return { data: { status: 'processing' } };
  };
  return { __esModule: true, default: { create: () => instance } };
});
jest.mock('./cognitoAuth', () => ({ getIdToken: async () => 'token' }));

import bffClient from './bffClient'; // eslint-disable-line import/first

beforeEach(() => {
  mockCalls.length = 0;
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

/** Jest 27 には advanceTimersByTimeAsync が無いので、タイマーを進めてから Promise の後続を流す */
async function advance(ms: number) {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
  jest.advanceTimersByTime(ms);
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

it('中止するとポーリングをやめて AbortError で抜ける', async () => {
  const controller = new AbortController();
  let waited = 0;
  const promise = bffClient.sendAIMessage({ message: 'hi' } as any, () => (waited += 1), controller.signal);
  const settled = promise.catch((e) => e);

  // 1回目のポーリングまで進める
  await advance(3000);
  expect(waited).toBe(1);
  expect(mockCalls.filter((c) => c.startsWith('get'))).toHaveLength(1);

  controller.abort();
  const err = await settled;
  expect(err?.name).toBe('AbortError');

  // 中止のあとは問い合わせない
  await advance(10000);
  expect(mockCalls.filter((c) => c.startsWith('get'))).toHaveLength(1);
});
