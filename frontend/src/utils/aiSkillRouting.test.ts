import { detectSkill, DetectSkillInput } from './aiSkillRouting';

// 面接練習で実際に送られた答え（286字、「応募」を含む）に近い長さで再現したもの
const INTERVIEW_ANSWER =
  '本日はお時間をいただき、ありがとうございます。〇〇と申します。\n\n' +
  'これまでWebデザイナーとして、WebサイトやLP、広告バナーなどの制作に携わってきました。' +
  'Figma、Photoshop、Illustratorを使用し、ターゲットや目的に合わせて伝わりやすいデザインを心がけています。' +
  '今回応募させていただいた理由は、幅広い案件に挑戦できる環境と、長期的に協業できる点に魅力を感じたためです。' +
  'これまでの経験を活かしながら、御社のサービスの成果に貢献できるよう努めてまいります。どうぞよろしくお願いいたします。';

const base: DetectSkillInput = {
  question: INTERVIEW_ANSWER,
  hasImage: false,
  quote: null,
  currentSkillId: 'auto',
  contextHeading: null,
  taskHeading: null,
};

describe('detectSkill', () => {
  it('前提: 長い答えは200字以上', () => {
    expect(INTERVIEW_ANSWER.length).toBeGreaterThanOrEqual(200);
  });

  it('面接練習モード中の長い答えに「応募」が入っても、応募文モードへの切り替えを出さない', () => {
    const s = detectSkill({ ...base, currentSkillId: 'interview' });
    expect(s.strength).toBe('none');
    expect(s.skillId).toBe('interview');
  });

  it('おまかせでは、募集内容の貼り付け＋「応募」は従来どおり応募文を提案する', () => {
    const s = detectSkill(base);
    expect(s.skillId).toBe('application');
    expect(s.strength).toBe('explicit');
  });

  it('モード中でも、画像＋「添削」の明確な依頼は制作物添削へ切り替えを出す', () => {
    const s = detectSkill({ ...base, question: 'このバナーを添削して', hasImage: true, currentSkillId: 'interview' });
    expect(s.skillId).toBe('design-review');
    expect(s.strength).toBe('explicit');
  });
});
