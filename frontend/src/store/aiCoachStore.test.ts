import { useAiCoachStore } from './aiCoachStore';
import type { AiCoachMessage } from '../types/aiCoach';

const msg = (id: string, patch: Partial<AiCoachMessage> = {}): AiCoachMessage => ({
  id,
  role: 'assistant',
  content: id,
  createdAt: '2026-09-30T00:00:00.000Z',
  ...patch,
});

describe('aiCoachStore.appendMessage と待機中の一時表示', () => {
  beforeEach(() => {
    useAiCoachStore.setState({ sessions: {}, order: [] });
    useAiCoachStore.getState().ensureSession('s1');
  });

  const ids = () => useAiCoachStore.getState().sessions.s1.messages.map((m) => m.id);

  it('回答が届いたら「回答を作成しています…」を取り除く', () => {
    const { appendMessage } = useAiCoachStore.getState();
    appendMessage('s1', msg('u1', { role: 'user' }));
    appendMessage('s1', msg('wait', { transient: true }));
    appendMessage('s1', msg('a1'));
    expect(ids()).toEqual(['u1', 'a1']);
  });

  it('一時表示どうしは積んだままにする（回答が来るまでは消さない）', () => {
    const { appendMessage } = useAiCoachStore.getState();
    appendMessage('s1', msg('u1', { role: 'user' }));
    appendMessage('s1', msg('wait', { transient: true }));
    expect(ids()).toEqual(['u1', 'wait']);
  });

  it('中止（system）でも一時表示を取り除く', () => {
    const { appendMessage } = useAiCoachStore.getState();
    appendMessage('s1', msg('wait', { transient: true }));
    appendMessage('s1', msg('stop', { role: 'system' }));
    expect(ids()).toEqual(['stop']);
  });
});
