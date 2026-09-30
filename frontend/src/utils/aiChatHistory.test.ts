import { toConversationHistory } from './aiChatHistory';
import { toHistory, AI_ERROR_CONCLUSION } from './aiCoachText';
import type { AiCoachMessage } from '../types/aiCoach';

describe('会話履歴に画面の定型文を入れない（A-4）', () => {
  it('上部チャット・レッスン画面：中止とエラーの定型文を外す', () => {
    const history = toConversationHistory([
      { role: 'user', content: '配色の相談' },
      { role: 'assistant', content: '回答の生成を中止しました。', kind: 'notice' },
      { role: 'user', content: 'もう一度お願いします' },
      { role: 'assistant', content: '回答を取得できませんでした。', kind: 'error' },
    ]);
    expect(history).toEqual([
      { role: 'user', content: '配色の相談' },
      { role: 'user', content: 'もう一度お願いします' },
    ]);
  });

  it('AIコーチ画面：エラーの回答と一時表示を外す', () => {
    const base = { content: '', createdAt: '2026-09-30T00:00:00.000Z' };
    const answer = (conclusion: string) => ({
      conclusion, basis: '', apply: '', next: '', sources: [], groundedInMaterial: false, generalNote: null,
    });
    const messages: AiCoachMessage[] = [
      { ...base, id: 'u1', role: 'user', content: '質問' },
      { ...base, id: 'w', role: 'assistant', answer: answer('回答を作成しています…'), transient: true },
      { ...base, id: 'e', role: 'assistant', answer: answer(AI_ERROR_CONCLUSION) },
      { ...base, id: 'a', role: 'assistant', answer: answer('本当の回答') },
    ];
    expect(toHistory(messages).map((m) => m.role)).toEqual(['user', 'assistant']);
  });
});
