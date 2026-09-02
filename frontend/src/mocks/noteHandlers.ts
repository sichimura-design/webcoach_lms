/**
 * MSW: マイノート（自由帳）
 * ============================================================
 *   GET    /api/webcoach/notes                      一覧（NoteSummary[]）
 *   POST   /api/webcoach/notes                      ノート作成
 *   GET    /api/webcoach/notes/:id                  1件（ブロック込み）
 *   PATCH  /api/webcoach/notes/:id                  タイトル・お気に入り・フォルダ移動
 *   DELETE /api/webcoach/notes/:id                  削除
 *   POST   /api/webcoach/notes/:id/blocks           ブロック追加
 *   PATCH  /api/webcoach/notes/:id/blocks/:blockId  ブロック編集（index で並べ替え）
 *   DELETE /api/webcoach/notes/:id/blocks/:blockId  ブロック削除
 *   GET    /api/webcoach/note-clips?lessonId=       教材ハイライト用の軽量一覧
 *   GET    /api/webcoach/note-folders               フォルダ一覧（作成順）
 *   POST   /api/webcoach/note-folders               フォルダ作成
 *   PATCH  /api/webcoach/note-folders/:id           名前の変更
 *   DELETE /api/webcoach/note-folders/:id           削除（中のノートは未整理へ）
 *
 * すべて実BFFには無い。バックエンド変更禁止のためモックで提供している。
 *
 * 設計上の判断:
 *   ・🔴 モジュールスコープにストアをキャッシュしない。リクエストごとに読む。
 *     キャッシュすると別タブの編集が見えず、片方の書き込みで消える
 *     （studyActivityHandlers.ts と同じ方針）。
 *   ・🔴 note-clips / note-folders を別エンドポイントにしてある。教材画面がハイライトを描くためだけに
 *     全ノートの全ブロックを取りに行くのを避けるため。パスが notes/:id と別なので取り違えは起きないが、
 *     読む順が分かるように notes 系より先に登録する。
 *   ・ブロックを足す・直すたびにノートの updatedAt を上げる。一覧の並び順の根拠になる。
 *     🔴 フォルダの移動と並べ替えは上げない。整理しただけでカードが並び替わると、
 *        ドロップした先でカードが逃げる。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import {
  Note,
  NoteBlock,
  NoteBlockInput,
  NoteBlockInsert,
  NoteBlockPatch,
  NoteClipRef,
  NoteCreateInput,
  NoteFolder,
  NoteFolderCreateInput,
  NoteFolderUpdateInput,
  NOTE_FOLDER_NAME_MAX,
  NoteSort,
  NoteSummary,
  NoteUpdateInput,
} from '../types/notes';
import {
  DEFAULT_SEED_COUNT,
  buildSeedFolders,
  buildSeedNotes,
  nextId,
  readNoteStore,
  writeNoteStore,
} from './noteMigration';

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

/** 検索・書き出しに使う、そのブロックの文字列。画像は文字を持たない */
function textOf(block: NoteBlock): string {
  if (block.kind === 'answer') return `${block.question} ${block.answer}`;
  if (block.kind === 'image') return block.caption ?? '';
  return block.text;
}

/** 一覧カードの書き出し。記法（## / - / - [ ] / ==）は落として素の文にする */
function excerptOf(note: Note): string {
  for (const block of note.blocks) {
    const raw =
      block.kind === 'answer' ? block.question || block.answer : textOf(block);
    const plain = raw
      .split('\n')
      .map((line) =>
        line
          .replace(/^\s*(##\s+|-\s+(\[[ xX]\]\s+)?)/, '')
          .replace(/==(.+?)==/g, '$1')
          .trim()
      )
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
    folderId: note.folderId ?? null,
    blockCount: note.blocks.length,
    excerpt: excerptOf(note),
    source: note.source,
    coachingSessionId: note.coachingSessionId ?? null,
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
    ...note.blocks.map(textOf),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

/** そのレッスンから触ったノートか（source かブロックの出どころで判定） */
function touchesLesson(note: Note, lessonId: number): boolean {
  if (note.source?.lessonId === lessonId) return true;
  return note.blocks.some(
    (b) => (b.kind === 'clip' || b.kind === 'answer') && b.source?.lessonId === lessonId
  );
}

function sortNotes(notes: Note[], sort: NoteSort): Note[] {
  const copy = [...notes];
  if (sort === 'title') return copy.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  if (sort === 'created') return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === 'createdAsc') return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (sort === 'updatedAsc') return copy.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
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
  if (input.kind === 'image') {
    // 画像の中身は IndexedDB（utils/noteImageStore.ts）にあり、ここは参照キーだけ持つ
    if (!input.imageId) return null;
    return {
      ...base,
      kind: 'image',
      imageId: input.imageId,
      alt: input.alt ?? '',
      caption: input.caption ?? null,
    };
  }
  return null;
}

/**
 * ノートを1件書き換えて updatedAt を進める。見つからなければ null。
 * touch=false は「整理」（フォルダ移動・並べ替え）用で、更新日を動かさない。
 */
function updateNote(
  id: string,
  mutate: (note: Note) => void,
  { touch = true }: { touch?: boolean } = {}
): Note | null {
  const store = readNoteStore();
  const note = store.notes.find((n) => n.id === id);
  if (!note) return null;
  mutate(note);
  if (touch) note.updatedAt = new Date().toISOString();
  writeNoteStore(store);
  return note;
}

/** フォルダ名の正規化。空は null（＝不正） */
function normalizeFolderName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().slice(0, NOTE_FOLDER_NAME_MAX);
  return name || null;
}

function folderExists(folders: NoteFolder[], id: string): boolean {
  return folders.some((f) => f.id === id);
}

export const noteHandlers = [
  // --- デモデータの入れ直し（モック専用。実APIには無い） -----------------
  // ページ送りの見え方を件数を変えて確かめるため。'/notes' の POST（作成）とは
  // パスが違うので取り違えは起きないが、読む順を分かりやすくするため先頭に置く。
  http.post('*/api/webcoach/notes/reset', async ({ request }) => {
    let count = DEFAULT_SEED_COUNT;
    try {
      const body = (await request.json()) as { count?: number };
      if (Number.isFinite(body?.count)) count = Math.max(0, Math.min(500, Math.trunc(body!.count!)));
    } catch {
      /* ボディ無しなら既定件数 */
    }
    const store = readNoteStore();
    const now = new Date();
    store.notes = count > 0 ? buildSeedNotes(now, count) : [];
    // シードノートは固定IDのデモフォルダを指しているので、フォルダも一緒に置き直す
    store.folders = count > 0 ? buildSeedFolders(now) : [];
    // 0件を指定したときに次の読み込みでデモが戻ってこないよう、置いた印を立てる
    store.seeded = true;
    writeNoteStore(store);
    return HttpResponse.json({ ok: true, count: store.notes.length });
  }),

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

  // --- フォルダ（デザイン『マイノート 改善案』の左列）------------------------
  http.get('*/api/webcoach/note-folders', () => {
    const folders = [...readNoteStore().folders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return HttpResponse.json(folders);
  }),

  http.post('*/api/webcoach/note-folders', async ({ request }) => {
    let body: Partial<NoteFolderCreateInput> = {};
    try {
      body = (await request.json()) as NoteFolderCreateInput;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const name = normalizeFolderName(body.name);
    if (!name) return HttpResponse.json({ error: 'name is required' }, { status: 400 });

    const folder: NoteFolder = { id: nextId('folder'), name, createdAt: new Date().toISOString() };
    const store = readNoteStore();
    store.folders.push(folder);
    writeNoteStore(store);
    return HttpResponse.json(folder, { status: 201 });
  }),

  http.patch('*/api/webcoach/note-folders/:id', async ({ params, request }) => {
    let body: NoteFolderUpdateInput = {};
    try {
      body = (await request.json()) as NoteFolderUpdateInput;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const store = readNoteStore();
    const folder = store.folders.find((f) => f.id === String(params.id));
    if (!folder) return new HttpResponse(null, { status: 404 });
    if (body.name !== undefined) {
      const name = normalizeFolderName(body.name);
      if (!name) return HttpResponse.json({ error: 'name is required' }, { status: 400 });
      folder.name = name;
    }
    writeNoteStore(store);
    return HttpResponse.json(folder);
  }),

  // 中のノートは消さず未整理（folderId=null）へ。整理なので updatedAt は動かさない
  http.delete('*/api/webcoach/note-folders/:id', ({ params }) => {
    const store = readNoteStore();
    const id = String(params.id);
    if (!folderExists(store.folders, id)) return new HttpResponse(null, { status: 404 });
    store.folders = store.folders.filter((f) => f.id !== id);
    let moved = 0;
    for (const note of store.notes) {
      if (note.folderId === id) {
        note.folderId = null;
        moved += 1;
      }
    }
    writeNoteStore(store);
    return HttpResponse.json({ moved });
  }),

  // --- 一覧 ---
  http.get('*/api/webcoach/notes', async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const sort = (url.searchParams.get('sort') as NoteSort) || 'updated';
    const favoriteOnly = url.searchParams.get('favorite') === 'true';
    const lessonIdRaw = url.searchParams.get('lessonId');
    const sessionIdRaw = url.searchParams.get('coachingSessionId');

    let notes = readNoteStore().notes;
    if (favoriteOnly) notes = notes.filter((n) => n.favorite);
    if (lessonIdRaw) {
      const lessonId = Number(lessonIdRaw);
      notes = notes.filter((n) => touchesLesson(n, lessonId));
    }
    if (sessionIdRaw) {
      const sessionId = Number(sessionIdRaw);
      notes = notes.filter((n) => n.coachingSessionId === sessionId);
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
    const store = readNoteStore();
    // フォルダは省略時 未整理。消えたフォルダを指されたら 400（黙って未整理に入れると、
    // 一覧で開いていたフォルダに出てこず「作ったのに無い」に見える）
    const folderId = body.folderId ?? null;
    if (folderId !== null && !folderExists(store.folders, folderId)) {
      return HttpResponse.json({ error: 'folder not found' }, { status: 400 });
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
      folderId,
      source: body.source ?? null,
      coachingSessionId: body.coachingSessionId ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
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

  // --- タイトル・お気に入り・フォルダ移動 ---
  http.patch('*/api/webcoach/notes/:id', async ({ params, request }) => {
    let body: NoteUpdateInput = {};
    try {
      body = (await request.json()) as NoteUpdateInput;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const movesFolder = 'folderId' in body;
    if (movesFolder && body.folderId !== null && typeof body.folderId === 'string') {
      if (!folderExists(readNoteStore().folders, body.folderId)) {
        return HttpResponse.json({ error: 'folder not found' }, { status: 400 });
      }
    }
    // 中身を変えず置き場所だけ動かすときは updatedAt を進めない（一覧の並びを崩さない）
    const editsContent = typeof body.title === 'string' || typeof body.favorite === 'boolean';
    const note = updateNote(
      String(params.id),
      (n) => {
        if (typeof body.title === 'string') n.title = body.title.trim() || '無題のノート';
        if (typeof body.favorite === 'boolean') n.favorite = body.favorite;
        if (movesFolder) n.folderId = body.folderId ?? null;
      },
      { touch: editsContent }
    );
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
  // index を渡すとその位置に差し込む（ブロック間の ＋ から挿入するため）。
  // 省略・範囲外は末尾。order 列は持たず、配列の順序が正。
  http.post('*/api/webcoach/notes/:id/blocks', async ({ params, request }) => {
    let input: (NoteBlockInput & NoteBlockInsert) | null = null;
    try {
      input = (await request.json()) as NoteBlockInput & NoteBlockInsert;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const nowIso = new Date().toISOString();
    const block = input ? buildBlock(input, nowIso) : null;
    if (!block) return HttpResponse.json({ error: 'invalid block' }, { status: 400 });

    const at = input?.index;
    const note = updateNote(String(params.id), (n) => {
      if (typeof at === 'number' && at >= 0 && at < n.blocks.length) n.blocks.splice(at, 0, block);
      else n.blocks.push(block);
    });
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

    const editsContent =
      typeof patch.text === 'string' || typeof patch.answer === 'string' || patch.caption !== undefined;
    const moves = typeof patch.index === 'number';

    let updated: NoteBlock | null = null;
    const note = updateNote(
      String(params.id),
      (n) => {
        const from = n.blocks.findIndex((b) => b.id === String(params.blockId));
        if (from < 0) return;
        const block = n.blocks[from];
        if (typeof patch.text === 'string' && (block.kind === 'text' || block.kind === 'clip')) {
          block.text = patch.text;
        }
        if (typeof patch.answer === 'string' && block.kind === 'answer') block.answer = patch.answer;
        if (patch.caption !== undefined && block.kind === 'image') block.caption = patch.caption;
        if (editsContent) block.updatedAt = new Date().toISOString();
        // 並べ替え（ノート面の ⠿）。範囲外は端に寄せる。配列の順序が正で order 列は持たない
        if (moves) {
          const to = Math.max(0, Math.min(n.blocks.length - 1, Math.trunc(patch.index!)));
          if (to !== from) {
            n.blocks.splice(from, 1);
            n.blocks.splice(to, 0, block);
          }
        }
        updated = block;
      },
      { touch: editsContent }
    );
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
