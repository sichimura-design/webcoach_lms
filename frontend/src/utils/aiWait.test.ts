import { formatWaitElapsed } from './aiWait';

describe('formatWaitElapsed', () => {
  it('10秒未満は出さない', () => {
    expect(formatWaitElapsed(0)).toBeNull();
    expect(formatWaitElapsed(9)).toBeNull();
  });

  it('10秒からは秒で出す', () => {
    expect(formatWaitElapsed(10)).toBe('経過 10秒');
    expect(formatWaitElapsed(59)).toBe('経過 59秒');
  });

  it('1分を超えたら分と秒で出す', () => {
    expect(formatWaitElapsed(60)).toBe('経過 1分0秒');
    expect(formatWaitElapsed(95)).toBe('経過 1分35秒');
  });
});
