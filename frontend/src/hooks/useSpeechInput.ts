/**
 * 音声入力（B-006）。ブラウザの音声認識（Web Speech API）で、話した内容を入力欄に書き足す。
 *
 * 🔴 送信まではしない。認識の誤りを直してから自分で送れるように、入力欄に入れるだけ。
 * 🔴 認識は「押したときの入力欄の文章」の後ろに足す。途中の仮の認識結果（interim）も
 *    その場で見せ、確定したら置き換える。打ち込んでいた文章は消さない。
 * 🔴 Chrome / Edge / Safari にある。Firefox には無いので supported=false でボタンごと出さない。
 *    マイクの許可は初回にブラウザが聞く。拒否されたら error に理由を入れる。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface SpeechInput {
  supported: boolean;
  listening: boolean;
  error: string | null;
  toggle: () => void;
  stop: () => void;
}

export function useSpeechInput(currentText: string, onText: (text: string) => void): SpeechInput {
  const Ctor = getRecognitionCtor();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const textRef = useRef(currentText);
  textRef.current = currentText;
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;

    const base = textRef.current;
    const sep = base && !/\s$/.test(base) ? ' ' : '';
    let finalText = '';

    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onTextRef.current(`${base}${sep}${finalText}${interim}`);
    };
    rec.onerror = (e: any) => {
      const code = e?.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください。');
      } else if (code === 'no-speech') {
        setError('音声が聞き取れませんでした。もう一度お試しください。');
      } else if (code !== 'aborted') {
        setError('音声入力を開始できませんでした。');
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setError('音声入力を開始できませんでした。');
    }
  }, [Ctor]);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  // 送信して入力欄が空になったら止める。止めないと、残りの認識結果が空の欄に戻ってくる
  const wroteRef = useRef(false);
  useEffect(() => {
    if (!listening) {
      wroteRef.current = false;
      return;
    }
    if (currentText) wroteRef.current = true;
    else if (wroteRef.current) recRef.current?.abort();
  }, [currentText, listening]);

  // 画面を離れたら止める（マイクを掴んだままにしない）
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported: !!Ctor, listening, error, toggle, stop };
}
