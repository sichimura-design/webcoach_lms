/**
 * マイノートの実API変換（bffClient）のテスト。
 *
 * 実API `/api/my-note/*` を手元の配列で真似た偽サーバーに差し替え、
 * UI側の Note（body + 素材）と contents（Markdown 1列）の橋渡しを確かめる。
 * 🔴 見たいのは「本文を書き戻しても素材が消えないこと」「素材を足しても本文が変わらないこと」。
 *    どちらも contents を丸ごと上書きする実APIなので、読み直しを忘れると片方が消える。
 */
import { MyNote } from '../types/api';
import { NoteSourceRef } from '../types/notes';

type Handler = (url: string, body?: any, config?: any) => any;

const fake = {
  rows: [] as MyNote[],
  folders: [] as { folder_id: number; name: string; created_at: string }[],
  calls: [] as { method: string; url: string; body?: any; config?: any }[],
};

let clock = 0;
const now = () => `2026-09-26T00:00:${String(clock++).padStart(2, '0')}`;

function row(noteid: number, patch: Partial<MyNote> = {}): MyNote {
  return {
    noteid,
    mdl_user_id: 7,
    folder_id: null,
    courseid: null,
    cmid: null,
    favorite: 0,
    from_ai: 0,
    from_coaching: 0,
    title: `ノート${noteid}`,
    contents: '',
    created_at: now(),
    updated_at: now(),
    ...patch,
  };
}

const idOf = (url: string) => Number(url.split('/').pop());

const handlers: Record<string, Handler> = {
  get: (url, _b, config) => {
    if (url === '/user/info') return { moodle: { id: mockToken === 'token-B' ? 8 : 7 } };
    if (url === '/my-note/folders/7') return fake.folders;
    if (/^\/my-note\/notes\/\d+$/.test(url)) {
      const p = config?.params ?? {};
      return fake.rows.filter(
        (r) =>
          (p.cmid === undefined || r.cmid === p.cmid) &&
          (p.folder_id === undefined || r.folder_id === p.folder_id)
      );
    }
    const found = fake.rows.find((r) => r.noteid === idOf(url));
    if (!found) throw Object.assign(new Error('404'), { response: { status: 404 } });
    return found;
  },
  post: (url, body) => {
    if (url === '/my-note/folders/7') {
      const f = { folder_id: fake.folders.length + 1, name: body.name, created_at: now() };
      fake.folders.push(f);
      return f;
    }
    const r = row(fake.rows.length + 1, body);
    fake.rows.push(r);
    return r;
  },
  put: (url, body) => {
    if (url.startsWith('/my-note/folders/')) {
      const f = fake.folders.find((x) => x.folder_id === idOf(url))!;
      Object.assign(f, body);
      return f;
    }
    const r = fake.rows.find((x) => x.noteid === idOf(url))!;
    Object.assign(r, body, { updated_at: now() });
    return r;
  },
  delete: (url) => {
    if (url.startsWith('/my-note/folders/')) {
      const id = idOf(url);
      fake.folders = fake.folders.filter((f) => f.folder_id !== id);
      fake.rows.forEach((r) => {
        if (r.folder_id === id) r.folder_id = null;
      });
      return null;
    }
    fake.rows = fake.rows.filter((r) => r.noteid !== idOf(url));
    return null;
  },
};

// 🔴 jest.fn は使わない（CRA の resetMocks で毎テスト実装が消える）。jest.mock の中からは mock で始まる名前しか参照できない。呼ばれるのはテスト中なので初期化順は問題ない
jest.mock('axios', () => {
  const instance: any = { interceptors: { request: { use: () => 0 }, response: { use: () => 0 } } };
  instance.get = async (url: string, config?: any) => mockHandle('get', url, undefined, config);
  instance.delete = async (url: string, config?: any) => mockHandle('delete', url, undefined, config);
  instance.post = async (url: string, body?: any) => mockHandle('post', url, body);
  instance.put = async (url: string, body?: any) => mockHandle('put', url, body);
  return { __esModule: true, default: { create: () => instance } };
});
let mockToken: string | null = 'token-A';
jest.mock('./cognitoAuth', () => ({ getIdToken: async () => mockToken }));

function mockHandle(method: string, url: string, body?: any, config?: any) {
  fake.calls.push({ method, url, body, config });
  return { data: JSON.parse(JSON.stringify(handlers[method](url, body, config) ?? null)) };
}

import bffClient, { utcIso } from './bffClient'; // eslint-disable-line import/first

const source: NoteSourceRef = {
  courseId: 12,
  courseName: 'Webデザイン入門',
  lessonId: 34,
  lessonTitle: 'Lesson 4',
  heading: null,
  blockId: null,
  offset: null,
};

const puts = () => fake.calls.filter((c) => c.method === 'put');

beforeEach(() => {
  mockToken = 'token-A';
  fake.rows = [];
  fake.folders = [];
  fake.calls = [];
});

describe('bffClient マイノート', () => {
  it('新規作成: 自分のノートは空の本文・未整理・自分のメモとして作られる', async () => {
    const note = await bffClient.createNote({});
    expect(note).toMatchObject({ title: '無題のノート', body: '', blocks: [], folderId: null, origin: 'self', favorite: false });
    expect(fake.rows[0]).toMatchObject({ contents: '', from_ai: 0, from_coaching: 0, cmid: null });
  });

  it('新規作成: 教材・AI・コーチング・フォルダ指定がそれぞれ列に載る', async () => {
    await bffClient.createNote({ title: 't', source, origin: 'material', folderId: '3' });
    await bffClient.createNote({ origin: 'ai' });
    await bffClient.createNote({ coachingSessionId: 5 });
    expect(fake.rows[0]).toMatchObject({ title: 't', courseid: 12, cmid: 34, folder_id: 3 });
    expect(fake.rows[1]).toMatchObject({ from_ai: 1 });
    expect(fake.rows[2]).toMatchObject({ from_coaching: 1 });
  });

  it('本文の保存: 既存の素材を読み直して末尾に残す', async () => {
    const n = await bffClient.createNote({});
    await bffClient.appendNoteBlock(n.id, { kind: 'clip', text: '引用', source });
    const saved = await bffClient.updateNote(n.id, { body: '## 見出し\n- [ ] やること' });
    expect(saved.body).toBe('## 見出し\n- [ ] やること');
    expect(saved.blocks).toHaveLength(1);
    expect(saved.blocks[0]).toMatchObject({ kind: 'clip', text: '引用' });
    expect(fake.rows[0].contents).toBe(
      '## 見出し\n- [ ] やること\n\n> 引用\n> — [Webデザイン入門 / Lesson 4](/materials/12/lessons/34)'
    );
  });

  it('本文の保存: 別画面で足された素材（このタブが知らないもの）も消さない', async () => {
    const n = await bffClient.createNote({});
    // 別タブ／教材画面が先に素材を足した
    fake.rows[0].contents = '古い本文\n\n**Q:** 質問\n\n**A:** 回答';
    await bffClient.updateNote(n.id, { body: '新しい本文' });
    const reread = await bffClient.getNote(n.id);
    expect(reread.body).toBe('新しい本文');
    expect(reread.blocks[0]).toMatchObject({ kind: 'answer', question: '質問', answer: '回答' });
  });

  it('タイトル・重要・フォルダだけの更新は contents を送らない', async () => {
    const n = await bffClient.createNote({});
    fake.calls = [];
    await bffClient.updateNote(n.id, { title: '新題' });
    await bffClient.updateNote(n.id, { favorite: true });
    await bffClient.updateNote(n.id, { folderId: '2' });
    await bffClient.updateNote(n.id, { folderId: null });
    expect(puts().map((c) => c.body)).toEqual([
      { title: '新題' },
      { favorite: 1 },
      { folder_id: 2 },
      { folder_id: null },
    ]);
  });

  it('素材の追加: 本文を変えずに末尾へ足す（AI回答は複数段落のまま残る）', async () => {
    const n = await bffClient.createNote({});
    await bffClient.updateNote(n.id, { body: '本文\n\n\n段落' });
    await bffClient.appendNoteBlock(n.id, { kind: 'clip', text: 'c', source });
    await bffClient.appendNoteBlock(n.id, { kind: 'answer', question: 'q', answer: 'a1\n\na2', source });
    const note = await bffClient.getNote(n.id);
    expect(note.body).toBe('本文\n\n\n段落');
    expect(note.blocks.map((b) => b.kind)).toEqual(['clip', 'answer']);
    expect(note.blocks[1]).toMatchObject({ answer: 'a1\n\na2', source: { courseId: 12, lessonId: 34 } });
  });

  it('素材の書き換え・削除: 本文と他の素材は変えない', async () => {
    const n = await bffClient.createNote({});
    await bffClient.updateNote(n.id, { body: '本文' });
    await bffClient.appendNoteBlock(n.id, { kind: 'clip', text: 'c1', source });
    await bffClient.appendNoteBlock(n.id, { kind: 'answer', question: 'q', answer: 'a' });
    await bffClient.updateNoteBlock(n.id, 'blk_1', { answer: 'a（直した）' });
    let note = await bffClient.getNote(n.id);
    expect(note.blocks[1]).toMatchObject({ answer: 'a（直した）' });
    await bffClient.updateNoteBlock(n.id, 'blk_0', { text: 'c1（直した）' });
    await bffClient.deleteNoteBlock(n.id, 'blk_1');
    note = await bffClient.getNote(n.id);
    expect(note.body).toBe('本文');
    expect(note.blocks).toHaveLength(1);
    expect(note.blocks[0]).toMatchObject({ kind: 'clip', text: 'c1（直した）' });
  });

  it('存在しない素材の書き換えはエラーにする', async () => {
    const n = await bffClient.createNote({});
    await expect(bffClient.updateNoteBlock(n.id, 'blk_9', { text: 'x' })).rejects.toThrow();
  });

  it('一覧: 検索（タイトル・本文）・重要・並び順・書き出し・素材数', async () => {
    fake.rows = [
      row(1, { title: 'いろは', contents: '配色のメモ', updated_at: '2026-09-01', created_at: '2026-08-01' }),
      row(2, { title: 'あいう', contents: '余白', favorite: 1, updated_at: '2026-09-03', created_at: '2026-08-03' }),
      row(3, {
        title: 'かきく',
        contents: '> 引用\n> — [C / L](/materials/1/lessons/2)',
        cmid: 2,
        courseid: 1,
        updated_at: '2026-09-02',
        created_at: '2026-08-05',
      }),
    ];
    const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
    expect(ids(await bffClient.listNotes())).toEqual(['2', '3', '1']);
    expect(ids(await bffClient.listNotes({ sort: 'updatedAsc' }))).toEqual(['1', '3', '2']);
    expect(ids(await bffClient.listNotes({ sort: 'created' }))).toEqual(['3', '2', '1']);
    expect(ids(await bffClient.listNotes({ sort: 'createdAsc' }))).toEqual(['1', '2', '3']);
    expect(ids(await bffClient.listNotes({ sort: 'title' }))).toEqual(['2', '1', '3']);
    expect(ids(await bffClient.listNotes({ q: '配色' }))).toEqual(['1']);
    expect(ids(await bffClient.listNotes({ q: 'かき' }))).toEqual(['3']);
    expect(ids(await bffClient.listNotes({ favorite: true }))).toEqual(['2']);
    const [summary] = await bffClient.listNotes({ q: 'かき' });
    expect(summary).toMatchObject({ origin: 'material', excerpt: '引用', blockCount: 1 });
  });

  it('教材からの逆引き: そのレッスンのクリップだけを返す', async () => {
    fake.rows = [
      row(1, {
        cmid: 34,
        contents:
          '本文\n\n> A\n> — [C / L](/materials/12/lessons/34)\n\n> B\n> — [C / L](/materials/12/lessons/99)',
      }),
      row(2, { cmid: 99, contents: '> C\n> — [C / L](/materials/12/lessons/99)' }),
    ];
    const clips = await bffClient.listNoteClips(34);
    expect(clips.map((c) => c.text)).toEqual(['A']);
    expect(clips[0]).toMatchObject({ noteId: '1', noteTitle: 'ノート1' });
  });

  it('フォルダ: 作成順に並び、名前変更・削除（中のノートは未整理へ・件数を返す）', async () => {
    const a = await bffClient.createNoteFolder({ name: 'A' });
    await bffClient.createNoteFolder({ name: 'B' });
    await bffClient.updateNoteFolder(a.id, { name: 'A2' });
    expect((await bffClient.listNoteFolders()).map((f) => f.name)).toEqual(['A2', 'B']);
    const n = await bffClient.createNote({ folderId: a.id });
    const res = await bffClient.deleteNoteFolder(a.id);
    expect(res).toEqual({ moved: 1 });
    expect((await bffClient.getNote(n.id)).folderId).toBeNull();
  });

  it('削除: ノートが消える', async () => {
    const n = await bffClient.createNote({});
    await bffClient.deleteNote(n.id);
    expect(fake.rows).toHaveLength(0);
  });

  it('アカウントが変わる（IDトークンが変わる）と、ユーザーIDを取り直す', async () => {
    await bffClient.listNotes();
    mockToken = 'token-B';
    fake.calls = [];
    await bffClient.listNotes();
    expect(fake.calls.map((c) => c.url)).toEqual(['/user/info', '/my-note/notes/8']);
  });

  it('日時はタイムゾーン無しのUTCとして読む（9時間ずれない）', async () => {
    fake.rows = [row(1, { created_at: '2026-09-26T03:53:00', updated_at: '2026-09-26 15:10:00' })];
    const note = await bffClient.getNote('1');
    expect(note.createdAt).toBe('2026-09-26T03:53:00Z');
    expect(new Date(note.updatedAt).toISOString()).toBe('2026-09-26T15:10:00.000Z');
    expect(utcIso('2026-09-26T03:53:00+09:00')).toBe('2026-09-26T03:53:00+09:00');
    expect(utcIso('2026-09-26T03:53:00.123Z')).toBe('2026-09-26T03:53:00.123Z');
  });

  it('ユーザーIDは一度だけ取りに行く', async () => {
    await bffClient.listNotes();
    await bffClient.listNotes();
    // 他のテストで解決済みなら0回、初回なら1回。2回以上は取りに行かない
    expect(fake.calls.filter((c) => c.url === '/user/info').length).toBeLessThanOrEqual(1);
  });
});
