/**
 * ノート本文の「元に戻す／やり直す」の履歴（B-021）。
 *
 * 🔴 ブラウザ標準の取り消し（textarea の Ctrl+Z）に任せない理由
 *    - □ の切り替えは value を直接書き換えるので、標準の履歴がそこで切れる
 *    - 小窓（PiP）で打った文字は、本画面の textarea から見ると外からの書き換えで、これも履歴に残らない
 *    - ツールバーから押せる「元に戻す」ボタンを出したい（execCommand('undo') は環境で効き方が揺れる）
 *    そこで本文の値そのものを履歴に積む。記法の挿入も□も小窓も、value が変わった時点で等しく1手になる。
 *
 * 🔴 続けて打った文字は1手にまとめる（mergeMs 以内の変更は同じ手）。
 *    1文字ずつ戻るのは使いものにならない。□の切り替えやツールバー操作は
 *    boundary を立てて単独の1手にする。
 */
export interface TextSnap {
  value: string;
  /** その時点の選択範囲。戻したときにキャレットを置き直す */
  start: number;
  end: number;
}

export class TextHistory {
  private past: TextSnap[] = [];
  private future: TextSnap[] = [];
  private current: TextSnap;
  /** 直前の変更の時刻。0 は「次の変更は必ず新しい手」 */
  private lastAt = 0;

  constructor(initial: TextSnap, private readonly limit = 200, private readonly mergeMs = 1000) {
    this.current = initial;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** 別のノートを開いたときなど。前の本文へ戻れてはいけないので履歴ごと捨てる */
  reset(initial: TextSnap): void {
    this.past = [];
    this.future = [];
    this.current = initial;
    this.lastAt = 0;
  }

  /** 本文が変わったら呼ぶ。値が同じなら何もしない（戻した直後の再描画など） */
  record(snap: TextSnap, now: number, opts: { boundary?: boolean } = {}): void {
    if (snap.value === this.current.value) return;
    const merge = !opts.boundary && this.lastAt !== 0 && now - this.lastAt < this.mergeMs;
    if (!merge) {
      this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.current = snap;
    this.future = [];
    // □・ツールバーの1手には、次に打つ文字を混ぜない
    this.lastAt = opts.boundary ? 0 : now;
  }

  /** 次の変更を必ず新しい手にする */
  breakGroup(): void {
    this.lastAt = 0;
  }

  undo(): TextSnap | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(this.current);
    this.current = prev;
    this.lastAt = 0;
    return prev;
  }

  redo(): TextSnap | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(this.current);
    this.current = next;
    this.lastAt = 0;
    return next;
  }
}
