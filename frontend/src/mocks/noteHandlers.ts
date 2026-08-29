/**
 * MSW: マイノート（自由帳）
 * ============================================================
 *   GET    /api/webcoach/notes                      一覧（NoteSummary[]）
 *   POST   /api/webcoach/notes                      ノート作成
 *   GET    /api/webcoach/notes/:id                  1件（ブロック込み）
 *   PATCH  /api/webcoach/notes/:id                  タイトル・お気に入り
 *   DELETE /api/webcoach/notes/:id                  削除
 *   POST   /api/webcoach/notes/:id/blocks           ブロック追加
 *   PATCH  /api/webcoach/notes/:id/blocks/:blockId  ブロック編集
 *   DELETE /api/webcoach/notes/:id/blocks/:blockId  ブロック削除
 *   GET    /api/webcoach/note-clips?lessonId=       教材ハイライト用の軽量一覧
 *
 * すべて実BFFには無い。バックエンド変更禁止のためモックで提供している。
 *
 * 設計上の判断:
 *   ・🔴 モジュールスコープにストアをキャッシュしない。リクエストごとに読む。
 *     キャッシュすると別タブの編集が見えず、片方の書き込みで消える
 *     （studyActivityHandlers.ts と同じ方針）。
 *   ・🔴 note-clips を別エンドポイントにしてある。教材画面がハイライトを描くためだけに
 *     全ノートの全ブロックを取りに行くのを避けるため。
 *   ・ブロックを足す・直すたびにノートの updatedAt を上げる。一覧の並び順の根拠になる。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import {
  Note,
  NoteBlock,
  NoteBlockInput,
  NoteBlockPatch,
  NoteClipRef,
  NoteCreateInput,
  NoteSort,
  NoteSummary,
  NoteUpdateInput,
} from '../types/notes';
import { nextId, readNoteStore, writeNoteStore } from './noteMigration';

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

/** 一覧カードの書き出し。記法（## / - / ==）は落として素の文にする */
function excerptOf(note: Note): string {
  for (const block of note.blocks) {
    const raw =
      block.kind === 'answer' ? block.question || block.answer : block.text;
    const plain = raw
      .split('\n')
      .map((line) => line.replace(/^\s*(##\s+|-\s+)/, '').replace(/==(.+?)==/g, '$1').trim())
      .filter(Boolean)[0];
    if (plain) return plain.slice(0, 60);
  }
  return '';
}

function toSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    favorite: note.favorite,
    origin: note.origin,
    blockCount: note.blocks.length,
    excerpt: excerptOf(note),
    source: note.source,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

/** ノート全体を検索対象にする。タイトルだけだと「あの話どこに書いたっけ」に答えられない */
function matchesQuery(note: Note, q: string): boolean {
  if (!q) return true;
  const haystack = [
    note.title,
    note.source?.courseName ?? '',
    note.source?.lessonTitle ?? '',
    ...note.blocks.map((b) =>
      b.kind === 'answer' ? `${b.question} ${b.answer}` : b.text
    ),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

/** そのレッスンから触ったノートか（source かブロックの出どころで判定） */
function touchesLesson(note: Note, lessonId: number): boolean {
  if (note.source?.lessonId === lessonId) return true;
  return note.blocks.some(
    (b) => b.kind !== 'text' && b.source?.lessonId === lessonId
  );
}

function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  const copy = [...notes];
  if (sort === 'title') return copy.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  if (sort === 'created') return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function buildBlock(input: NoteBlockInput, nowIso: string): NoteBlock | null {
  const base = { id: nextId(input.kind), createdAt: nowIso, updatedAt: nowIso };
  if (input.kind === 'text') {
    return { ...base, kind: 'text', text: input.text ?? '' };
  }
  if (input.kind === 'clip') {
    if (!input.source) return null;
    return { ...base, kind: 'clip', text: input.text ?? '', source: input.source };
  }
  if (input.kind === 'answer') {
    return {
      ...base,
      kind: 'answer',
      question: input.question ?? '',
      answer: input.answer ?? '',
      selectedText: input.selectedText ?? null,
      image: input.image ?? null,
      source: input.source ?? null,
    };
  }
  return null;
}

/** ノートを1件書き換えて updatedAt を進める。見つからなければ null */
function updateNote(id: string, mutate: (note: Note) => void): Note | null {
  const store = readNoteStore();
  const note = store.notes.find((n) => n.id === id);
  if (!note) return null;
  mutate(note);
  note.updatedAt = new Date().toISOString();
  writeNoteStore(store);
  return note;
}

export const noteHandlers = [
  // --- 教材ハイライト用（:id より先に登録する。'note-clips' が id に食われないようパスは別） ---
  http.get('*/api/webcoach/note-clips', ({ request }) => {
    const lessonIdRaw = new URL(request.url).searchParams.get('lessonId');
    const lessonId = Number(lessonIdRaw);
    if (!Number.isFinite(lessonId) || lessonId <= 0) return HttpResponse.json([]);

    const refs: NoteClipRef[] = [];
    for (const note of readNoteStore().notes) {
      for (const block of note.blocks) {
        if (block.kind !== 'clip') continue;
        if (block.source.lessonId !== lessonId || !block.source.blockId) continue;
        refs.push({
          noteId: note.id,
          noteTitle: note.title,
          blockId: block.id,
          sourceBlockId: block.source.blockId,
          text: block.text,
          offset: block.source.offset,
        });
      }
    }
    return HttpResponse.json(refs);
  }),

  // --- 一覧 ---
  http.get('*/api/webcoach/notes', async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const sort = (url.searchParams.get('sort') as NoteSort) || 'updated';
    const favoriteOnly = url.searchParams.get('favorite') === 'true';
    const lessonIdRaw = url.searchParams.get('lessonId');

    let notes = readNoteStore().notes;
    if (favoriteOnly) notes = notes.filter((n) => n.favorite);
    if (lessonIdRaw) {
      const lessonId = Number(lessonIdRaw);
      notes = notes.filter((n) => touchesLesson(n, lessonId));
    }
    notes = notes.filter((n) => matchesQuery(n, q));

    return HttpResponse.json(sortNotes(notes, sort).map(toSummary));
  }),

  // --- 作成 ---
  http.post('*/api/webcoach/notes', async ({ request }) => {
    let body: NoteCreateInput = {};
    try {
      body = (await request.json()) as NoteCreateInput;
    } catch {
      /* ボディ無しでも作れる（「新しいノートを作成」の既定） */
    }
    const nowIso = new Date().toISOString();
    const note: Note = {
      id: nextId('note'),
      title: (body.title ?? '').trim() || '無題のノート',
      blocks: [],
      favorite: false,
      // 出どころは「どこで作ったか」で一度決まる。指定が無ければ
      // レッスンの文脈を持って来たかどうかで 教材 / 自分のメモ に振る
      origin: body.origin ?? (body.source ? 'material' : 'self'),
      source: body.source ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const store = readNoteStore();
    store.notes.unshift(note);
    writeNoteStore(store);
    return HttpResponse.json(note, { status: 201 });
  }),

  // --- 1件取得 ---
  http.get('*/api/webcoach/notes/:id', ({ params }) => {
    const note = readNoteStore().notes.find((n) => n.id === String(params.id));
    if (!note) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(note);
  }),

  // --- タイトル・お気に入り ---
  http.patch('*/api/webcoach/notes/:id', async ({ params, request }) => {
    let body: NoteUpdateInput = {};
    try {
      body = (await request.json()) as NoteUpdateInput;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const note = updateNote(String(params.id), (n) => {
      if (typeof body.title === 'string') n.title = body.title.trim() || '無題のノート';
      if (typeof body.favorite === 'boolean') n.favorite = body.favorite;
    });
    if (!note) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(note);
  }),

  // --- 削除 ---
  http.delete('*/api/webcoach/notes/:id', ({ params }) => {
    const store = readNoteStore();
    const before = store.notes.length;
    store.notes = store.notes.filter((n) => n.id !== String(params.id));
    if (store.notes.length === before) return new HttpResponse(null, { status: 404 });
    writeNoteStore(store);
    return new HttpResponse(null, { status: 204 });
  }),

  // --- ブロック追加 ---
  http.post('*/api/webcoach/notes/:id/blocks', async ({ params, request }) => {
    let input: NoteBlockInput | null = null;
    try {
      input = (await request.json()) as NoteBlockInput;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const nowIso = new Date().toISOString();
    const block = input ? buildBlock(input, nowIso) : null;
    if (!block) return HttpResponse.json({ error: 'invalid block' }, { status: 400 });

    const note = updateNote(String(params.id), (n) => n.blocks.push(block));
    if (!note) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(block, { status: 201 });
  }),

  // --- ブロック編集 ---
  http.patch('*/api/webcoach/notes/:id/blocks/:blockId', async ({ params, request }) => {
    let patch: NoteBlockPatch = {};
    try {
      patch = (await request.json()) as NoteBlockPatch;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    let updated: NoteBlock | null = null;
    const note = updateNote(String(params.id), (n) => {
      const block = n.blocks.find((b) => b.id === String(params.blockId));
      if (!block) return;
      if (typeof patch.text === 'string' && block.kind !== 'answer') block.text = patch.text;
      if (typeof patch.answer === 'string' && block.kind === 'answer') block.answer = patch.answer;
      block.updatedAt = new Date().toISOString();
      updated = block;
    });
    if (!note || !updated) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(updated);
  }),

  // --- ブロック削除 ---
  http.delete('*/api/webcoach/notes/:id/blocks/:blockId', ({ params }) => {
    let removed = false;
    const note = updateNote(String(params.id), (n) => {
      const before = n.blocks.length;
      n.blocks = n.blocks.filter((b) => b.id !== String(params.blockId));
      removed = n.blocks.length < before;
    });
    if (!note || !removed) return new HttpResponse(null, { status: 404 });
    return new HttpResponse(null, { status: 204 });
  }),
];

export default noteHandlers;
