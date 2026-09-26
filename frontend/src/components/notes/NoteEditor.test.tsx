/* eslint-disable testing-library/render-result-naming-convention, testing-library/no-unnecessary-act -- @testing-library は使っていない（react-dom/client を直接使う）。名前が render で始まるだけで誤検知する */
/**
 * ノート面（NoteEditor / NoteBodyEditor / ツールバー）のテスト。
 *
 * 🔴 jsdom には document.execCommand が無い。ここでは「使えなかったとき」の直書き経路で
 *    確かめる（Ctrl+Z の履歴が残るかどうかは実ブラウザで見る）。
 */
import { act, createElement, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Note } from '../../types/notes';
import NoteBodyEditor, { parseNoteLine } from './NoteBodyEditor';
import NoteEditor, { applyInsert } from './NoteEditor';
import { toggleTaskLine } from './noteText';

jest.mock('./QuoteFromLessonModal', () => ({
  __esModule: true,
  default: (props: any) =>
    require('react').createElement('div', { 'data-testid': 'quote-modal', 'data-initial': JSON.stringify(props.initial) }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;

beforeEach(() => {
  (document as any).execCommand = () => false;
  (window as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

function render(el: React.ReactElement) {
  act(() => {
    root = createRoot(container);
    root.render(el);
  });
}

/** 制御された本文エディタ。いまの値を外から読めるようにする */
function renderBody(initial: string) {
  const state = { value: initial };
  const Host = () => {
    const [v, setV] = useState(initial);
    state.value = v;
    return createElement(NoteBodyEditor, { value: v, onChange: setV });
  };
  render(createElement(Host));
  const ta = container.querySelector('textarea')!;
  return { state, ta };
}

function key(ta: HTMLTextAreaElement, k: string, caret: number, init: KeyboardEventInit = {}) {
  ta.setSelectionRange(caret, caret);
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  act(() => {
    ta.dispatchEvent(ev);
  });
  return ev;
}

describe('parseNoteLine / toggleTaskLine', () => {
  it.each([
    ['- [ ] a', 'task'],
    ['- [x] a', 'task'],
    ['- [X] a', 'task'],
    ['- a', 'bullet'],
    ['## a', 'heading'],
    ['a', 'plain'],
    ['-a', 'plain'],
    ['# a', 'plain'],
  ])('%s は %s', (line, kind) => {
    expect(parseNoteLine(line).kind).toBe(kind);
  });

  it('チェックの付け外しはその行だけを書き換える', () => {
    const t = 'a\n- [ ] b\n- [x] c';
    expect(toggleTaskLine(t, 1, true)).toBe('a\n- [x] b\n- [x] c');
    expect(toggleTaskLine(t, 2, false)).toBe('a\n- [ ] b\n- [ ] c');
    expect(toggleTaskLine(t, 0, true)).toBe(t); // チェック行でなければ触らない
    expect(toggleTaskLine(t, 9, true)).toBe(t);
  });
});

describe('applyInsert（ツールバーの記法）', () => {
  it('行頭に記法を付け、カーソルを行末へ置く', () => {
    expect(applyInsert('heading', 'abc', 1, 1)).toEqual({ from: 0, to: 0, insert: '## ', selStart: 6, selEnd: 6 });
    expect(applyInsert('list', 'x\nabc', 3, 3)).toMatchObject({ from: 2, to: 2, insert: '- ' });
    expect(applyInsert('task', 'abc', 0, 0)).toMatchObject({ insert: '- [ ] ' });
  });

  it('別の記法が付いた行は差し替える', () => {
    expect(applyInsert('task', '- abc', 3, 3)).toMatchObject({ from: 0, to: 2, insert: '- [ ] ' });
    expect(applyInsert('heading', '- [x] abc', 3, 3)).toMatchObject({ from: 0, to: 6, insert: '## ' });
  });

  it('同じ記法の行でもう一度押すと外す（済みのチェック行も）', () => {
    expect(applyInsert('heading', '## abc', 4, 4)).toMatchObject({ from: 0, to: 3, insert: '' });
    expect(applyInsert('list', '- abc', 4, 4)).toMatchObject({ from: 0, to: 2, insert: '' });
    expect(applyInsert('task', '- [x] abc', 7, 7)).toMatchObject({ from: 0, to: 6, insert: '' });
  });

  it('マーカーは選択範囲を == で囲み、選択が無ければ ==== の間にカーソルを置く', () => {
    expect(applyInsert('marker', 'abcdef', 1, 3)).toEqual({ from: 1, to: 3, insert: '==bc==', selStart: 3, selEnd: 5 });
    expect(applyInsert('marker', 'abc', 3, 3)).toEqual({ from: 3, to: 3, insert: '====', selStart: 5, selEnd: 5 });
  });
});

describe('NoteBodyEditor', () => {
  it('記法を見た目どおりに描く（□・・・見出し・マーカー）', () => {
    renderBody('## 見出し\n- 項目\n- [ ] 未\n- [x] 済\n==大事==');
    const mirror = container.querySelector('.notes-body-mirror')!;
    expect(mirror.querySelectorAll('.notes-body-heading-bar')).toHaveLength(1);
    expect(mirror.querySelectorAll('.notes-body-bullet')).toHaveLength(1);
    const boxes = mirror.querySelectorAll<HTMLInputElement>('input.notes-body-check');
    expect(Array.from(boxes).map((b) => b.checked)).toEqual([false, true]);
    expect(mirror.querySelectorAll('.notes-body-done')).toHaveLength(1);
    expect(mirror.textContent).toContain('大事');
  });

  it('ミラーは textarea と同じ文字列を持つ（折り返しがずれない）', () => {
    const text = '## 見出し\n- [ ] 未\n\n==大事== です';
    renderBody(text);
    const lines = Array.from(container.querySelectorAll('.notes-body-mirror > div')).map((d) =>
      (d.textContent ?? '').replace('​', '')
    );
    expect(lines.join('\n')).toBe(text);
  });

  it('□を押すとその行のチェックが切り替わる', () => {
    const { state } = renderBody('- [ ] a\n- [ ] b');
    const boxes = container.querySelectorAll<HTMLInputElement>('input.notes-body-check');
    act(() => boxes[1].click());
    expect(state.value).toBe('- [ ] a\n- [x] b');
    act(() => container.querySelectorAll<HTMLInputElement>('input.notes-body-check')[1].click());
    expect(state.value).toBe('- [ ] a\n- [ ] b');
  });

  it('Enter: チェックリスト・箇条書きは次の行にも記法を付ける（済みから続けても未チェック）', () => {
    const t = renderBody('- [x] 済');
    expect(key(t.ta, 'Enter', 7).defaultPrevented).toBe(true);
    expect(t.state.value).toBe('- [x] 済\n- [ ] ');
    act(() => root!.unmount());
    root = null;
    const b = renderBody('- 項目');
    key(b.ta, 'Enter', 4);
    expect(b.state.value).toBe('- 項目\n- ');
  });

  it('Enter: 中身の無い記法だけの行ではリストを抜ける（記法を外す）', () => {
    const t = renderBody('- [ ] a\n- [ ] ');
    key(t.ta, 'Enter', t.ta.value.length);
    expect(t.state.value).toBe('- [ ] a\n');
  });

  it('Enter: 行の途中で押すと、そこで行を割って続きに記法を付ける', () => {
    const t = renderBody('- abcd');
    key(t.ta, 'Enter', 4);
    expect(t.state.value).toBe('- ab\n- cd');
  });

  it('Enter: 見出し・普通の行・Shift+Enter・変換中は触らない', () => {
    const t = renderBody('## 見出し\nふつう\n- 項目');
    expect(key(t.ta, 'Enter', 6).defaultPrevented).toBe(false);
    expect(key(t.ta, 'Enter', 10).defaultPrevented).toBe(false);
    expect(key(t.ta, 'Enter', t.ta.value.length, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(key(t.ta, 'Enter', t.ta.value.length, { isComposing: true } as any).defaultPrevented).toBe(false);
    expect(t.state.value).toBe('## 見出し\nふつう\n- 項目');
  });

  it('Backspace: 記法の直後で押すと記法ごと外す。それ以外は普通の削除', () => {
    const t = renderBody('- [ ] abc');
    expect(key(t.ta, 'Backspace', 6).defaultPrevented).toBe(true);
    expect(t.state.value).toBe('abc');
    act(() => root!.unmount());
    root = null;
    const h = renderBody('## 見出し');
    key(h.ta, 'Backspace', 3);
    expect(h.state.value).toBe('見出し');
    expect(key(h.ta, 'Backspace', 2).defaultPrevented).toBe(false);
  });

  it('範囲選択中の Enter / Backspace は触らない', () => {
    const t = renderBody('- abc');
    t.ta.setSelectionRange(2, 4);
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => {
      t.ta.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe('NoteEditor', () => {
  const at = '2026-09-26T00:00:00';
  const base: Note = {
    id: '1',
    title: 'ノート',
    body: '本文',
    blocks: [],
    favorite: false,
    origin: 'self',
    folderId: null,
    source: null,
    createdAt: at,
    updatedAt: at,
  };

  function renderEditor(note: Note) {
    const calls = {
      rename: [] as string[],
      body: [] as string[],
      save: 0,
      remove: [] as string[],
    };
    const Host = () => {
      const [n, setN] = useState(note);
      return createElement(NoteEditor, {
        note: n,
        onRename: (t: string) => calls.rename.push(t),
        onBodyChange: (b: string) => {
          calls.body.push(b);
          setN((prev) => ({ ...prev, body: b }));
        },
        onSave: () => {
          calls.save += 1;
        },
        onAddBlock: async () => ({ id: 'x' }),
        onPatchBlock: () => undefined,
        onRemoveBlock: (id: string) => calls.remove.push(id),
      });
    };
    render(createElement(Host));
    return calls;
  }

  const button = (label: string) =>
    Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;

  it('Ctrl+S / ⌘S で保存し、ブラウザの保存は出さない', () => {
    const calls = renderEditor(base);
    const ta = container.querySelector('textarea')!;
    const ev = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => {
      ta.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    act(() => {
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', metaKey: true, bubbles: true, cancelable: true }));
    });
    expect(calls.save).toBe(2);
  });

  it('ツールバーの見出し・箇条書き・チェックリスト・マーカーが本文に記法を入れる', () => {
    const calls = renderEditor({ ...base, body: 'abc' });
    const ta = container.querySelector('textarea')!;
    ta.setSelectionRange(3, 3);
    act(() => button('チェックリスト').click());
    expect(calls.body.at(-1)).toBe('- [ ] abc');
    act(() => button('チェックリスト').click());
    expect(calls.body.at(-1)).toBe('abc');
    act(() => button('見出し').click());
    expect(calls.body.at(-1)).toBe('## abc');
    act(() => button('箇条書き').click());
    expect(calls.body.at(-1)).toBe('- abc');
    ta.setSelectionRange(2, 5);
    act(() => button('マーカー').click());
    expect(calls.body.at(-1)).toBe('- ==abc==');
  });

  it('ツールバーのボタンは押しても本文のカーソルを奪わない', () => {
    renderEditor(base);
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => {
      button('見出し').dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
  });

  it('タイトルは確定（blur）で送り、空なら元に戻す', () => {
    const calls = renderEditor(base);
    const input = container.querySelector<HTMLInputElement>('input#note-title-1')!;
    const setValue = (v: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      act(() => {
        setter.call(input, v);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    setValue('新しい題');
    act(() => {
      input.focus();
      input.blur();
    });
    expect(calls.rename).toEqual(['新しい題']);
    setValue('   ');
    act(() => {
      input.focus();
      input.blur();
    });
    expect(calls.rename).toEqual(['新しい題']);
    expect(input.value).toBe('ノート');
  });

  it('本文も素材も空のノートは開いた瞬間から書ける（本文にフォーカス）', () => {
    renderEditor({ ...base, body: '' });
    expect(document.activeElement).toBe(container.querySelector('textarea'));
  });

  it('素材が無ければ見出しごと出さず、あれば本文の下に並べて × で外せる', () => {
    renderEditor(base);
    expect(container.textContent).not.toContain('教材の引用・AIの回答');
    act(() => root!.unmount());
    root = null;
    const src = { courseId: 1, courseName: 'C', lessonId: 2, lessonTitle: 'L', heading: null, blockId: null, offset: null };
    const calls = renderEditor({
      ...base,
      blocks: [
        { id: 'blk_0', kind: 'clip', text: '引用した文', source: src, createdAt: at, updatedAt: at },
        { id: 'blk_1', kind: 'answer', question: '質問', answer: '回答', selectedText: null, image: null, source: null, createdAt: at, updatedAt: at },
      ],
    });
    expect(container.textContent).toContain('教材の引用・AIの回答');
    expect(container.textContent).toContain('引用した文');
    expect(container.textContent).toContain('回答');
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="このAI回答を外す"]')!.click());
    expect(calls.remove).toEqual(['blk_1']);
  });

  it('「教材から引用」は元レッスンのあるノートならそのレッスンで引用モーダルを開く', () => {
    const src = { courseId: 5, courseName: 'C', lessonId: 6, lessonTitle: 'L', heading: null, blockId: null, offset: null };
    renderEditor({ ...base, source: src });
    expect(container.querySelector('[data-testid="quote-modal"]')).toBeNull();
    act(() => button('教材から引用').click());
    const modal = container.querySelector('[data-testid="quote-modal"]')!;
    expect(JSON.parse(modal.getAttribute('data-initial')!)).toEqual({ courseId: 5, lessonId: 6 });
  });

  it('元レッスンの無いノートでは、モーダル側で教材を選ばせる', () => {
    renderEditor(base);
    act(() => button('教材から引用').click());
    expect(container.querySelector('[data-testid="quote-modal"]')!.getAttribute('data-initial')).toBe('null');
  });
});

describe('NoteEditorBar の保存状態', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const NoteEditorBar = require('./NoteEditorBar').default ?? require('./NoteEditorBar').NoteEditorBar;
  const at = '2026-09-26T03:53:00Z';
  const note: Note = {
    id: '1', title: 't', body: '', blocks: [], favorite: false, origin: 'self', folderId: null, source: null, createdAt: at, updatedAt: at,
  };
  const bar = (saveState: any) => {
    const saves: number[] = [];
    render(
      createElement(NoteEditorBar, {
        note, folders: [], saveState, onBack: () => undefined, backToSource: null,
        onMoveToFolder: () => undefined, onToggleFavorite: () => undefined, onDelete: () => undefined,
        onSave: () => saves.push(1),
      })
    );
    const saveBtn = container.querySelector<HTMLButtonElement>('button[title="保存（Ctrl+S）"]')!;
    return { saves, saveBtn, status: container.querySelector('[role=status]')!.textContent };
  };

  it('未保存が無ければ保存ボタンは押せず、保存した時刻（ローカル時刻）を出す', () => {
    const v = bar({ saving: false, lastSavedAt: null, error: null, dirty: false });
    expect(v.saveBtn.disabled).toBe(true);
    const local = new Date(at);
    const hhmm = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
    expect(v.status).toContain(`保存しました${hhmm}`);
  });

  it('未保存があれば押せて、押すと保存する', () => {
    const v = bar({ saving: false, lastSavedAt: null, error: null, dirty: true });
    expect(v.status).toContain('未保存の変更があります');
    act(() => v.saveBtn.click());
    expect(v.saves).toHaveLength(1);
  });

  it('保存に失敗したら、未保存よりも失敗を出す', () => {
    const v = bar({ saving: false, lastSavedAt: null, error: '保存できませんでした', dirty: true });
    expect(v.status).toContain('保存できませんでした');
    expect(v.saveBtn.disabled).toBe(false);
  });

  it('保存中は押せない', () => {
    const v = bar({ saving: true, lastSavedAt: null, error: null, dirty: true });
    expect(v.status).toContain('保存中');
    expect(v.saveBtn.disabled).toBe(true);
  });
});
