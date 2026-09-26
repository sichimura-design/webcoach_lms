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
