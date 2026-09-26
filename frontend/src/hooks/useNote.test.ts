/* eslint-disable testing-library/render-result-naming-convention, testing-library/no-unnecessary-act -- @testing-library は使っていない（react-dom/client を直接使う）。名前が render で始まるだけで誤検知する */
/**
 * useNote（ノート1件の読み書き）のテスト。
 *
 * 🔴 見たいのは本文の保存の約束ごと:
 *    - 打っただけでは送らない（自動保存しない）
 *    - 保存（ボタン / Ctrl+S）で1回だけ送る
 *    - 書いたものは失わせない（切り替え・画面を離れるときは送る／失敗しても画面に残す）
 *    - サーバの応答で、画面の未保存の本文を巻き戻さない
 */
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Note } from '../types/notes';
import { useNote } from './useNote';

// 🔴 jest.fn は beforeEach で作り直す（CRA の resetMocks で実装が消えるため）
const api: Record<string, jest.Mock> = {};
jest.mock('../services/bffClient', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_t, key: string) => (...args: any[]) => mockApi[key](...args) }),
}));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockApi = api;

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const at = '2026-09-26T00:00:00';
function note(id: string, patch: Partial<Note> = {}): Note {
  return {
    id,
    title: `ノート${id}`,
    body: `本文${id}`,
    blocks: [],
    favorite: false,
    origin: 'self',
    folderId: null,
    source: null,
    createdAt: at,
    updatedAt: at,
    ...patch,
  };
}

const clip = (id: string) =>
  ({
    id,
    kind: 'clip',
    text: '引用',
    createdAt: at,
    updatedAt: at,
    source: { courseId: 1, courseName: '', lessonId: 2, lessonTitle: '', heading: null, blockId: null, offset: null },
  }) as const;

/** テストごとに片付ける。残すと前のテストの未保存が beforeunload を握ったままになる */
const mounted: (() => void)[] = [];
afterEach(() => {
  mounted.splice(0).forEach((u) => u());
});

/** 最小の renderHook。@testing-library を入れずに済ませる */
function renderUseNote(initialId: string | null) {
  const result: { current: ReturnType<typeof useNote> } = { current: null as any };
  let id = initialId;
  const container = document.createElement('div');
  let root: Root;
  const Probe = () => {
    result.current = useNote(id);
    return null;
  };
  act(() => {
    root = createRoot(container);
    root.render(createElement(Probe));
  });
  let alive = true;
  mounted.push(() => {
    if (alive) act(() => root.unmount());
    alive = false;
  });
  return {
    result,
    rerender(nextId: string | null) {
      id = nextId;
      act(() => root.render(createElement(Probe)));
    },
    unmount() {
      if (alive) act(() => root.unmount());
      alive = false;
    },
  };
}

/** Promise を解決させて、それに続く setState を反映させる */
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

/** 解決を手で握れる Promise */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let server: Record<string, Note>;

beforeEach(() => {
  server = { '1': note('1'), '2': note('2') };
  api.getNote = jest.fn(async (id: string) => ({ ...server[id] }));
  api.updateNote = jest.fn(async (id: string, patch: any) => {
    server[id] = { ...server[id], ...patch, updatedAt: '2026-09-26T01:00:00' };
    return { ...server[id] };
  });
  api.appendNoteBlock = jest.fn(async () => clip('blk_0'));
  api.updateNoteBlock = jest.fn(async () => clip('blk_0'));
  api.deleteNoteBlock = jest.fn(async () => undefined);
});

describe('useNote', () => {
  it('開くとノートを読み込む。null なら何も読まない', async () => {
    const view = renderUseNote('1');
    await flush();
    expect(view.result.current.note?.body).toBe('本文1');
    expect(view.result.current.saveState).toMatchObject({ dirty: false, saving: false, error: null });

    const empty = renderUseNote(null);
    await flush();
    expect(empty.result.current.note).toBeNull();
  });

  it('読み込みに失敗したらエラー文言を出す', async () => {
    api.getNote.mockRejectedValueOnce(new Error('404'));
    const view = renderUseNote('9');
    await flush();
    expect(view.result.current.note).toBeNull();
    expect(view.result.current.error).toBe('ノートを開けませんでした');
  });

  it('打っただけでは送らない（自動保存しない）。未保存として表示される', async () => {
    const view = renderUseNote('1');
    await flush();
    act(() => view.result.current.setBody('書いた'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1500));
    });
    expect(view.result.current.note?.body).toBe('書いた');
    expect(view.result.current.saveState.dirty).toBe(true);
    expect(api.updateNote).not.toHaveBeenCalled();
  });

  it('保存で本文を1回だけ送り、未保存が消える。素材と更新日は応答から取り込む', async () => {
    const view = renderUseNote('1');
    await flush();
    act(() => view.result.current.setBody('書いた'));
    server['1'].blocks = [clip('blk_0') as any]; // 別の画面で足された素材
    await act(async () => {
      await view.result.current.saveBody();
    });
    expect(api.updateNote).toHaveBeenCalledTimes(1);
    expect(api.updateNote).toHaveBeenCalledWith('1', { body: '書いた' });
    expect(view.result.current.saveState).toMatchObject({ dirty: false, saving: false, error: null });
    expect(view.result.current.saveState.lastSavedAt).not.toBeNull();
    expect(view.result.current.note?.blocks).toHaveLength(1);
    expect(view.result.current.note?.updatedAt).toBe('2026-09-26T01:00:00');
  });

  it('未保存が無いときの保存は何も送らない', async () => {
    const view = renderUseNote('1');
    await flush();
    await act(async () => {
      await view.result.current.saveBody();
    });
    expect(api.updateNote).not.toHaveBeenCalled();
  });

  it('保存中に打ち足した分は未保存のまま残り、画面の本文も巻き戻らない', async () => {
    const view = renderUseNote('1');
    await flush();
    const d = deferred<Note>();
    api.updateNote.mockReturnValueOnce(d.promise);
    act(() => view.result.current.setBody('一'));
    let saving!: Promise<void>;
    act(() => {
      saving = view.result.current.saveBody();
    });
    expect(view.result.current.saveState.saving).toBe(true);
    act(() => view.result.current.setBody('一二'));
    await act(async () => {
      d.resolve(note('1', { body: '一' }));
      await saving;
    });
    expect(view.result.current.note?.body).toBe('一二');
    expect(view.result.current.saveState.dirty).toBe(true);
  });

  it('同じ本文の保存を続けて押しても二重には送らない', async () => {
    const view = renderUseNote('1');
    await flush();
    act(() => view.result.current.setBody('書いた'));
    await act(async () => {
      await Promise.all([view.result.current.saveBody(), view.result.current.saveBody()]);
    });
    expect(api.updateNote).toHaveBeenCalledTimes(1);
  });

  it('保存に失敗しても本文は画面に残り、未保存のまま。もう一度押せば送れる', async () => {
    const view = renderUseNote('1');
    await flush();
    api.updateNote.mockRejectedValueOnce(new Error('500'));
    act(() => view.result.current.setBody('消えては困る'));
    await act(async () => {
      await view.result.current.saveBody();
    });
    expect(view.result.current.note?.body).toBe('消えては困る');
    expect(view.result.current.saveState).toMatchObject({ dirty: true, error: '保存できませんでした' });
    expect(api.getNote).toHaveBeenCalledTimes(1); // 取り直して巻き戻していない

    await act(async () => {
      await view.result.current.saveBody();
    });
    expect(api.updateNote).toHaveBeenLastCalledWith('1', { body: '消えては困る' });
    expect(view.result.current.saveState).toMatchObject({ dirty: false, error: null });
  });

  it('未保存のままタイトル・重要・フォルダを変えても、本文は巻き戻らない', async () => {
    const view = renderUseNote('1');
    await flush();
    act(() => view.result.current.setBody('未保存の本文'));
    await act(async () => {
      await view.result.current.renameNote('新しい題');
    });
    await act(async () => {
      await view.result.current.toggleFavorite();
    });
    await act(async () => {
      await view.result.current.moveToFolder('3');
    });
    expect(view.result.current.note).toMatchObject({ title: '新しい題', favorite: true, folderId: '3', body: '未保存の本文' });
    expect(view.result.current.saveState.dirty).toBe(true);
    expect(api.updateNote).not.toHaveBeenCalledWith('1', expect.objectContaining({ body: expect.anything() }));
  });

  it('同じタイトル・同じフォルダへの変更は送らない', async () => {
    const view = renderUseNote('1');
    await flush();
    await act(async () => {
      await view.result.current.renameNote('ノート1');
      await view.result.current.moveToFolder(null);
    });
    expect(api.updateNote).not.toHaveBeenCalled();
  });

  it('別のノートへ切り替えると、前のノートの未保存分をそのノートに送る', async () => {
    const view = renderUseNote('1');
    await flush();
    act(() => view.result.current.setBody('1に書いた'));
    view.rerender('2');
    await flush();
    expect(api.updateNote).toHaveBeenCalledWith('1', { body: '1に書いた' });
    expect(view.result.current.note?.id).toBe('2');
    expect(view.result.current.note?.body).toBe('本文2'); // 前のノートの本文を持ち込まない
    expect(view.result.current.saveState.dirty).toBe(false);
  });

  it('画面を離れる（アンマウント）ときも未保存分を送る', async () => {
    const view = renderUseNote('1');
    await flush();
    act(() => view.result.current.setBody('離れる前に'));
    view.unmount();
    await flush();
    expect(api.updateNote).toHaveBeenCalledWith('1', { body: '離れる前に' });
  });

  it('未保存がある間だけ、タブを閉じるときの確認を出す', async () => {
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const view = renderUseNote('1');
    await flush();
    expect(add.mock.calls.some(([t]) => t === 'beforeunload')).toBe(false);
    act(() => view.result.current.setBody('x'));
    expect(add.mock.calls.some(([t]) => t === 'beforeunload')).toBe(true);

    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);

    await act(async () => {
      await view.result.current.saveBody();
    });
    expect(remove.mock.calls.some(([t]) => t === 'beforeunload')).toBe(true);
    const ev2 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(false);
  });

  it('素材の追加・書き換え・削除。失敗したら取り直すが、未保存の本文は残す', async () => {
    const view = renderUseNote('1');
    await flush();
    await act(async () => {
      await view.result.current.addBlock({ kind: 'clip', text: '引用', source: clip('x').source });
    });
    expect(view.result.current.note?.blocks.map((b) => b.id)).toEqual(['blk_0']);

    await act(async () => {
      await view.result.current.patchBlock('blk_0', { text: '直した' });
    });
    expect((view.result.current.note?.blocks[0] as any).text).toBe('直した');

    act(() => view.result.current.setBody('未保存'));
    api.deleteNoteBlock.mockRejectedValueOnce(new Error('500'));
    await act(async () => {
      await view.result.current.removeBlock('blk_0');
    });
    await flush();
    expect(api.getNote).toHaveBeenCalledTimes(2); // 失敗で取り直した
    expect(view.result.current.note?.body).toBe('未保存');
  });
});
