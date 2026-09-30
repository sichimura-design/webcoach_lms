/* eslint-disable testing-library/no-unnecessary-act -- @testing-library は使っていない（react-dom/client を直接使う） */
import { act, createElement, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { SpeechInput, useSpeechInput } from './useSpeechInput';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/** 音声認識の偽物。最後に作られたものを外から操作する */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
  say(parts: { text: string; final: boolean }[]) {
    const results = parts.map((p) => Object.assign([{ transcript: p.text }], { isFinal: p.final }));
    this.onresult?.({ resultIndex: 0, results });
  }
}

let root: Root | null = null;
let container: HTMLDivElement;
const state: { text: string; setText: (v: string) => void; speech: SpeechInput | null } = {
  text: '',
  setText: () => {},
  speech: null,
};

function Host({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  state.text = text;
  state.setText = setText;
  state.speech = useSpeechInput(text, setText);
  return null;
}

beforeEach(() => {
  (window as any).webkitSpeechRecognition = FakeRecognition;
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  delete (window as any).webkitSpeechRecognition;
});

function render(initial: string) {
  act(() => {
    root = createRoot(container);
    root.render(createElement(Host, { initial }));
  });
}

it('話した内容を、入力欄の文章の後ろに書き足す（仮の結果も見せる）', () => {
  render('求人は');
  act(() => state.speech!.toggle());
  const rec = FakeRecognition.last!;
  expect(rec.lang).toBe('ja-JP');
  expect(state.speech!.listening).toBe(true);
  act(() => rec.say([{ text: 'デザイナー', final: false }]));
  expect(state.text).toBe('求人は デザイナー');
  act(() => rec.say([{ text: 'デザイナーの募集です', final: true }]));
  expect(state.text).toBe('求人は デザイナーの募集です');
  act(() => state.speech!.toggle());
  expect(state.speech!.listening).toBe(false);
});

it('送信して入力欄が空になったら認識を止める', () => {
  render('');
  act(() => state.speech!.toggle());
  act(() => FakeRecognition.last!.say([{ text: 'こんにちは', final: true }]));
  expect(state.text).toBe('こんにちは');
  act(() => state.setText(''));
  expect(state.speech!.listening).toBe(false);
});

it('マイクを拒否されたら理由を出す', () => {
  render('');
  act(() => state.speech!.toggle());
  act(() => FakeRecognition.last!.onerror?.({ error: 'not-allowed' }));
  expect(state.speech!.error).toContain('マイクの使用が許可されていません');
});

it('音声認識が無いブラウザでは supported=false', () => {
  delete (window as any).webkitSpeechRecognition;
  render('');
  expect(state.speech!.supported).toBe(false);
});
