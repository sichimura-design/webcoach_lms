/**
 * ブロック配列 ⇔ Markdown の往復テスト。
 *
 * 🔴 「完全に同一のオブジェクトへ戻ること」は求めない。ブロックIDと日時は本文から
 *    復元できないので読み込みのたびに振り直す（本文が正）。
 *    保証するのは「種別と中身が保たれること」と「2回目以降が安定していること」。
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

const blocks: NoteBlock[] = [
  { id: 'blk_0', createdAt: at, updatedAt: at, kind: 'text', text: '## 今日わかったこと\n- 補色は反対側' },
  { id: 'blk_1', createdAt: at, updatedAt: at, kind: 'clip', text: '補色は色相環の反対側にある色', source },
  {
    id: 'blk_2',
    createdAt: at,
    updatedAt: at,
    kind: 'answer',
    question: '補色を使うときの注意は?',
    answer: '面積比を変えると落ち着きます。',
    selectedText: null,
    image: null,
    source,
  },
  { id: 'blk_3', createdAt: at, updatedAt: at, kind: 'image', imageId: 'img_x', alt: 'パレット', caption: '作った配色' },
];

describe('noteMarkdown', () => {
  it('4種類すべてが往復して一致する', () => {
    expect(parseNoteMarkdown(serializeNoteMarkdown(blocks), at)).toEqual(blocks);
  });

  it('2回往復しても変わらない（冪等）', () => {
    const once = serializeNoteMarkdown(blocks);
    expect(serializeNoteMarkdown(parseNoteMarkdown(once, at))).toBe(once);
  });

  it('保存される本文が素のMarkdownである（メタデータを埋め込まない）', () => {
    const md = serializeNoteMarkdown(blocks);
    expect(md).not.toContain('<!--');
    expect(md).not.toContain('wc:');
    expect(md).toContain('## 今日わかったこと');
    expect(md).toContain('> 補色は色相環の反対側にある色');
    expect(md).toContain('**Q:** 補色を使うときの注意は?');
    expect(md).toContain('![パレット](img_x)');
    expect(md).toContain('— [Webデザイン入門 / Lesson 4](/materials/12/lessons/34)');
  });

  it('素のMarkdownを書いても読める（text になる）', () => {
    const parsed = parseNoteMarkdown('ただのメモ\n2行目', at);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].kind).toBe('text');
    expect((parsed[0] as any).text).toBe('ただのメモ\n2行目');
  });

  it('出典行の無い引用は clip ではなく text として読む', () => {
    const parsed = parseNoteMarkdown('> ただの引用\n> 2行目', at);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].kind).toBe('text');
  });

  it('出典行を手で消しても本文は失われない', () => {
    const md = serializeNoteMarkdown([blocks[1]]);
    const withoutSource = md.split('\n').filter((l) => !l.includes('/materials/')).join('\n');
    const parsed = parseNoteMarkdown(withoutSource, at);
    expect(parsed).toHaveLength(1);
    expect((parsed[0] as any).text).toContain('補色は色相環の反対側にある色');
  });

  it('キャプション無しの画像を読める', () => {
    const parsed = parseNoteMarkdown('![図](img_1)', at);
    expect(parsed[0]).toMatchObject({ kind: 'image', imageId: 'img_1', alt: '図', caption: null });
  });

  it('空文字は空配列', () => {
    expect(parseNoteMarkdown('', at)).toEqual([]);
    expect(parseNoteMarkdown('   \n  ', at)).toEqual([]);
  });

  it('excerpt は記法を落とした先頭の一文を返す', () => {
    expect(excerptFromMarkdown(serializeNoteMarkdown(blocks))).toBe('今日わかったこと');
  });

  it('blockCount がブロック数と一致する', () => {
    expect(blockCountOf(serializeNoteMarkdown(blocks))).toBe(4);
  });
});
