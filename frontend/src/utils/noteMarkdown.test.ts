/**
 * 本文＋素材 ⇔ Markdown の往復テスト。
 *
 * 🔴 素材は「完全に同一のオブジェクトへ戻ること」は求めない。ブロックIDと日時は本文から
 *    復元できないので読み込みのたびに振り直す（本文が正）。
 * 🔴 本文は**一字も変わらずに**戻ること。空行・チェックリスト・見出しを段落に割って
 *    組み直すと、保存するたびに書いたものの形が変わってしまう。
 */
import {
  serializeNoteMarkdown,
  parseNoteMarkdown,
  excerptFromMarkdown,
  blockCountOf,
} from './noteMarkdown';
import { NoteBlock, NoteSourceRef } from '../types/notes';

const source: NoteSourceRef = {
  courseId: 12,
  courseName: 'Webデザイン入門',
  lessonId: 34,
  lessonTitle: 'Lesson 4',
  heading: null,
  blockId: null,
  offset: null,
};

const at = '2026-09-05T10:00:00.000Z';

const body = '## 今日わかったこと\n- [ ] 補色を試す\n- [x] 色相環を覚える\n\n\n==大事== なところ';

const blocks: NoteBlock[] = [
  { id: 'blk_0', createdAt: at, updatedAt: at, kind: 'clip', text: '補色は色相環の反対側にある色', source },
  {
    id: 'blk_1',
    createdAt: at,
    updatedAt: at,
    kind: 'answer',
    question: '補色を使うときの注意は?',
    answer: '面積比を変えると落ち着きます。',
    selectedText: null,
    image: null,
    source,
  },
];

describe('noteMarkdown', () => {
  it('本文と素材が往復して一致する', () => {
    expect(parseNoteMarkdown(serializeNoteMarkdown(body, blocks), at)).toEqual({ body, blocks });
  });

  it('2回往復しても変わらない（冪等）', () => {
    const once = serializeNoteMarkdown(body, blocks);
    const parsed = parseNoteMarkdown(once, at);
    expect(serializeNoteMarkdown(parsed.body, parsed.blocks)).toBe(once);
  });

  it('本文の空行の数を変えない', () => {
    const text = '1行目\n\n\n\n2行目';
    expect(parseNoteMarkdown(serializeNoteMarkdown(text, blocks), at).body).toBe(text);
    expect(parseNoteMarkdown(serializeNoteMarkdown(text, []), at).body).toBe(text);
  });

  it('本文だけ・素材だけでも往復する', () => {
    expect(parseNoteMarkdown(serializeNoteMarkdown(body, []), at)).toEqual({ body, blocks: [] });
    expect(parseNoteMarkdown(serializeNoteMarkdown('', blocks), at)).toEqual({ body: '', blocks });
  });

  it('出典の無い AI回答や、AI回答の後ろのクリップも読める', () => {
    const noSource: NoteBlock[] = [
      { ...(blocks[1] as any), id: 'blk_0', source: null },
      { ...blocks[0], id: 'blk_1' },
    ];
    expect(parseNoteMarkdown(serializeNoteMarkdown('メモ', noSource), at)).toEqual({ body: 'メモ', blocks: noSource });
  });

  it('保存される本文が素のMarkdownである（メタデータを埋め込まない）', () => {
    const md = serializeNoteMarkdown(body, blocks);
    expect(md).not.toContain('<!--');
    expect(md).toContain('## 今日わかったこと');
    expect(md).toContain('> 補色は色相環の反対側にある色');
    expect(md).toContain('**Q:** 補色を使うときの注意は?');
    expect(md).toContain('— [Webデザイン入門 / Lesson 4](/materials/12/lessons/34)');
  });

  it('本文ブロック時代の、途中に引用が挟まったノートは本文として読む（内容を失わない）', () => {
    const legacy = [
      'はじめのメモ',
      '> 補色は色相環の反対側にある色\n> — [Webデザイン入門 / Lesson 4](/materials/12/lessons/34)',
      'あとのメモ',
    ].join('\n\n');
    expect(parseNoteMarkdown(legacy, at)).toEqual({ body: legacy, blocks: [] });
  });

  it('出典行の無い引用は素材ではなく本文として読む', () => {
    expect(parseNoteMarkdown('> ただの引用\n> 2行目', at)).toEqual({ body: '> ただの引用\n> 2行目', blocks: [] });
  });

  it('本文と同じ文面の素材があっても本文を削らない', () => {
    const clipText = '> 補色は色相環の反対側にある色\n> — [Webデザイン入門 / Lesson 4](/materials/12/lessons/34)';
    const text = `${clipText}\n\nここは本文`;
    expect(parseNoteMarkdown(serializeNoteMarkdown(text, [blocks[0]]), at)).toEqual({ body: text, blocks: [blocks[0]] });
  });

  it('複数段落のAI回答（空行を含む）が本文に落ちずに往復する', () => {
    const multi: NoteBlock[] = [
      { ...(blocks[1] as any), id: 'blk_0', answer: '1段落目\n\n2段落目\n\n- 箇条書き\n- 2つ目' },
      { ...blocks[0], id: 'blk_1' },
      { ...(blocks[1] as any), id: 'blk_2', question: '次の質問\n\n2段落の質問', source: null },
    ];
    expect(parseNoteMarkdown(serializeNoteMarkdown(body, multi), at)).toEqual({ body, blocks: multi });
  });

  it('出典の無い複数段落のAI回答が最後でも往復する', () => {
    const last: NoteBlock[] = [{ ...(blocks[1] as any), id: 'blk_0', answer: 'A\n\nB', source: null }];
    expect(parseNoteMarkdown(serializeNoteMarkdown('メモ', last), at)).toEqual({ body: 'メモ', blocks: last });
  });

  it('回答が空のAI回答も往復する', () => {
    const empty: NoteBlock[] = [{ ...(blocks[1] as any), id: 'blk_0', answer: '' }];
    const parsed = parseNoteMarkdown(serializeNoteMarkdown('', empty), at);
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0]).toMatchObject({ kind: 'answer', question: '補色を使うときの注意は?', answer: '' });
  });

  it('複数行・空行を含むクリップが往復する', () => {
    const clip: NoteBlock[] = [{ ...(blocks[0] as any), text: '1行目\n2行目\n\n4行目' }];
    expect(parseNoteMarkdown(serializeNoteMarkdown(body, clip), at)).toEqual({ body, blocks: clip });
  });

  it('本文の途中の引用のあとに文章がある旧データは、引用ごと本文に残す', () => {
    const legacy = ['a', '> 引用\n> — [C / L](/materials/1/lessons/2)', 'b'].join('\n\n');
    expect(parseNoteMarkdown(legacy, at)).toEqual({ body: legacy, blocks: [] });
  });

  it('本文の途中の引用と、末尾の素材が混ざった旧データは末尾だけ素材にする', () => {
    const clip = '> 引用\n> — [Webデザイン入門 / Lesson 4](/materials/12/lessons/34)';
    const legacy = ['a', clip, 'b', clip].join('\n\n');
    const parsed = parseNoteMarkdown(legacy, at);
    expect(parsed.body).toBe(['a', clip, 'b'].join('\n\n'));
    expect(parsed.blocks).toHaveLength(1);
  });

  it('本文の末尾の空白・改行は保存時に落とす（素材との区切りを一定にする）', () => {
    expect(serializeNoteMarkdown('本文\n\n\n', [])).toBe('本文');
    expect(parseNoteMarkdown(serializeNoteMarkdown('本文\n\n', [blocks[0]]), at).body).toBe('本文');
  });

  it('本文の行頭インデントや記法を変えない', () => {
    const text = '  インデント\n- [ ] 未完了\n- [x] 完了\n## 見出し\n==マーカー==\n**太字風**';
    expect(parseNoteMarkdown(serializeNoteMarkdown(text, blocks), at).body).toBe(text);
  });

  it('**A:** だけで始まる本文の段落は素材にしない', () => {
    expect(parseNoteMarkdown('**A:** 自分で書いた', at)).toEqual({ body: '**A:** 自分で書いた', blocks: [] });
  });

  it('出典行にコース名だけの場合も読める', () => {
    const md = '> 引用\n> — [コース](/materials/1/lessons/2)';
    const parsed = parseNoteMarkdown(md, at);
    expect(parsed.blocks[0]).toMatchObject({ kind: 'clip', text: '引用', source: { courseId: 1, lessonId: 2, courseName: 'コース' } });
  });

  it('素材のIDは先頭から blk_0, blk_1 … と振られる', () => {
    const parsed = parseNoteMarkdown(serializeNoteMarkdown(body, [...blocks, ...blocks]), at);
    expect(parsed.blocks.map((b) => b.id)).toEqual(['blk_0', 'blk_1', 'blk_2', 'blk_3']);
  });

  it('excerpt は本文が空なら素材の文を返し、出典行は含めない', () => {
    const ex = excerptFromMarkdown(serializeNoteMarkdown('', [blocks[0]]));
    expect(ex).toBe('補色は色相環の反対側にある色');
  });

  it('excerpt は60文字で切る', () => {
    expect(excerptFromMarkdown('あ'.repeat(100))).toHaveLength(60);
  });

  it('空文字は空のノート', () => {
    expect(parseNoteMarkdown('', at)).toEqual({ body: '', blocks: [] });
    expect(parseNoteMarkdown('   \n  ', at)).toEqual({ body: '', blocks: [] });
  });

  it('excerpt は記法を落とした先頭の一文を返す', () => {
    expect(excerptFromMarkdown(serializeNoteMarkdown(body, blocks))).toBe('今日わかったこと');
  });

  it('blockCount が素材の数と一致する', () => {
    expect(blockCountOf(serializeNoteMarkdown(body, blocks))).toBe(2);
  });
});
