import { useCallback, useEffect, useReducer, useRef } from 'react';
import { bffClient } from '../services/bffClient';
import { parseApiTimestamp } from '../utils/noteDate';

/**
 * 教材ごとの学習メモ（GET/PUT /api/webcoach/study-note/{userid}/{courseid}/{cmid}）。
 *
 * 【なぜ state をまとめて持つか】
 * 以前は memoContent / memoStatus / タイマー / 読み込み済みキー が別々の
 * useState・useRef に散っていて、「どの教材の話なのか」がどこにも書かれていなかった。
 * そのため教材を切り替えた直後に前の教材の本文が表示され、その隙に1文字打つと
 * 前のテキストが新しい cmid のメモとして保存され得た。
 *
 * ここでは state 自身が「どのキーのものか」を持つ。表示側はキーが一致しない
 * state を絶対に描かないので、取り違えが構造的に起きない。
 *
 * 【不変条件】
 * GET が成功していないキーには PUT しない。読み込みに失敗した状態で
 * 編集を許すと、前の教材の本文でサーバ側のメモを上書きしてしまう。
 */

/** 打ち終わってから保存するまでの待ち */
const DEBOUNCE_MS = 600;

/**
 * 打鍵が止まらないときでも、これだけ経ったら保存する。
 * 🔴 これが無いと、休みなく打ち続けている間は1度も保存されない。
 */
const MAX_WAIT_MS = 5000;

/**
 * content の上限。
 * 🔴 DB は utf8mb4 の text 列なので実際の上限は 65,535 **バイト**（日本語で約21,800字）。
 *    サーバ側に検証が無く、超えると MySQL が切り詰めるか 500 になる＝無言で消える。
 *    ここで止めるしかない。文字数ではなくバイト数で見る。
 */
export const MAX_CONTENT_BYTES = 63000;

/** ここを超えたら残りを知らせ始める */
const WARN_CONTENT_BYTES = 48000;

const ERROR_SAVE_FAILED = '保存できませんでした';
const ERROR_TOO_LONG = '文字数が上限を超えています。分割して保存してください';

export type StudyNotePhase = 'loading' | 'ready' | 'loadError';

interface State {
  /** この state がどの教材のものか。`${userId}:${courseId}:${cmid}` */
  key: string | null;
  content: string;
  phase: StudyNotePhase;
  /**
   * 進行中の保存の件数。
   * 🔴 boolean にしないこと。教材切り替え時の flush と次のデバウンスが重なると、
   *    先に終わった方が「保存中」の表示を消してしまう。
   */
  savingCount: number;
  lastSavedAt: string | null;
  /** その時刻がサーバ由来（最終更新）かこのセッションの保存か */
  savedAtSource: 'server' | 'client' | null;
  saveError: string | null;
  /** 未保存の変更があるか（デバウンス待ち、または保存に失敗したまま） */
  dirty: boolean;
}

type Action =
  | { type: 'LOAD_START'; key: string }
  | { type: 'LOAD_SUCCESS'; key: string; content: string; updatedAt: string | null }
  | { type: 'LOAD_FAILURE'; key: string }
  | { type: 'EDIT'; key: string; content: string; error: string | null }
  | { type: 'SAVE_START'; key: string }
  | { type: 'SAVE_SUCCESS'; key: string; at: string }
  | { type: 'SAVE_FAILURE'; key: string }
  | { type: 'CLEAN'; key: string };

const initialState: State = {
  key: null,
  content: '',
  phase: 'loading',
  savingCount: 0,
  lastSavedAt: null,
  savedAtSource: null,
  saveError: null,
  dirty: false,
};

function reducer(state: State, action: Action): State {
  // LOAD_START だけは新しいキーを迎え入れる。それ以外は、いま表示している
  // キーに対する応答でなければ捨てる（遅れて届いた前の教材の結果）
  if (action.type !== 'LOAD_START' && action.key !== state.key) return state;

  switch (action.type) {
    case 'LOAD_START':
      return { ...initialState, key: action.key, phase: 'loading' };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        phase: 'ready',
        content: action.content,
        lastSavedAt: action.updatedAt,
        savedAtSource: action.updatedAt ? 'server' : null,
      };
    case 'LOAD_FAILURE':
      return { ...state, phase: 'loadError', content: '' };
    case 'EDIT':
      return { ...state, content: action.content, dirty: true, saveError: action.error };
    case 'SAVE_START':
      return { ...state, savingCount: state.savingCount + 1, saveError: null };
    case 'SAVE_SUCCESS':
      return {
        ...state,
        savingCount: Math.max(0, state.savingCount - 1),
        lastSavedAt: action.at,
        savedAtSource: 'client',
        saveError: null,
        dirty: false,
      };
    case 'SAVE_FAILURE':
      return {
        ...state,
        savingCount: Math.max(0, state.savingCount - 1),
        saveError: ERROR_SAVE_FAILED,
        dirty: true,
      };
    case 'CLEAN':
      return { ...state, dirty: false };
    default:
      return state;
  }
}

/** 表示に必要な保存状態。パネル側に判断を持たせないための1本の union */
export type StudyNoteStatus =
  | { kind: 'loading' }
  | { kind: 'loadError' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  | { kind: 'dirty' }
  | { kind: 'savedClient'; at: Date }
  | { kind: 'savedServer'; at: Date }
  | { kind: 'idle' };

function deriveSaveStatus(state: State, savedAt: Date | null): StudyNoteStatus {
  if (state.phase === 'loading') return { kind: 'loading' };
  if (state.phase === 'loadError') return { kind: 'loadError' };
  if (state.saveError) return { kind: 'error', message: state.saveError };
  if (state.savingCount > 0) return { kind: 'saving' };
  if (state.dirty) return { kind: 'dirty' };
  if (savedAt && state.savedAtSource === 'client') return { kind: 'savedClient', at: savedAt };
  if (savedAt && state.savedAtSource === 'server') return { kind: 'savedServer', at: savedAt };
  return { kind: 'idle' };
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

interface PendingSave {
  key: string;
  userId: number;
  courseId: number;
  cmid: number;
  content: string;
}

interface UseStudyNoteParams {
  userId?: number;
  courseId: number;
  cmid: number | null;
  /** 保存に失敗した瞬間に1度だけ呼ぶ（トーストを出す用） */
  onSaveError?: (message: string) => void;
}

export function useStudyNote({ userId, courseId, cmid, onSaveError }: UseStudyNoteParams) {
  const currentKey = userId && cmid ? `${userId}:${courseId}:${cmid}` : null;

  const [state, dispatch] = useReducer(reducer, initialState);

  const keyRef = useRef<string | null>(null);
  keyRef.current = currentKey;

  const aliveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDirtyAtRef = useRef<number | null>(null);
  const pendingRef = useRef<PendingSave | null>(null);
  /** サーバにある内容。同じものを送り直さないための比較用 */
  const savedContentRef = useRef<string | null>(null);
  const reqSeqRef = useRef(0);
  const hadErrorRef = useRef(false);
  const onSaveErrorRef = useRef(onSaveError);
  onSaveErrorRef.current = onSaveError;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ─── 読み込み ─────────────────────────────
  const load = useCallback(() => {
    const key = keyRef.current;
    if (!key || !userId || !cmid) return;
    const seq = ++reqSeqRef.current;
    savedContentRef.current = null;
    pendingRef.current = null;
    firstDirtyAtRef.current = null;
    hadErrorRef.current = false;
    dispatch({ type: 'LOAD_START', key });

    bffClient
      .getStudyNote(userId, courseId, cmid)
      .then(note => {
        if (seq !== reqSeqRef.current || !aliveRef.current) return;
        // 🔴 reject だけでは足りない。開発サーバは /api をプロキシしないので
        //    index.html が 200 で返り、content が undefined で届くことがある。
        if (typeof note?.content !== 'string') throw new Error('unexpected shape');
        savedContentRef.current = note.content;
        dispatch({
          type: 'LOAD_SUCCESS',
          key,
          content: note.content,
          updatedAt: note.updated_at ?? null,
        });
      })
      .catch(() => {
        if (seq !== reqSeqRef.current || !aliveRef.current) return;
        dispatch({ type: 'LOAD_FAILURE', key });
      });
  }, [userId, courseId, cmid]);

  useEffect(() => {
    if (!currentKey) return;
    load();
  }, [currentKey, load]);

  // ─── 保存 ─────────────────────────────────
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const target = pendingRef.current;
    if (!target) return;

    // 上限超えは送らない。理由はすでに saveError に出ている
    if (byteLength(target.content) > MAX_CONTENT_BYTES) return;

    // 打って消して元に戻した場合。送る意味がない
    if (target.content === savedContentRef.current) {
      pendingRef.current = null;
      firstDirtyAtRef.current = null;
      if (aliveRef.current) dispatch({ type: 'CLEAN', key: target.key });
      return;
    }

    pendingRef.current = null;
    firstDirtyAtRef.current = null;
    if (aliveRef.current) dispatch({ type: 'SAVE_START', key: target.key });

    try {
      await bffClient.updateStudyNote(target.userId, target.courseId, target.cmid, {
        content: target.content,
      });
      if (target.key === keyRef.current) savedContentRef.current = target.content;
      hadErrorRef.current = false;
      if (aliveRef.current) {
        // 🔴 時刻はクライアントの時計を使う。API の updated_at はタイムゾーンの
        //    情報が無く、そのまま読むとずれることがある（utils/noteDate.ts 参照）
        dispatch({ type: 'SAVE_SUCCESS', key: target.key, at: new Date().toISOString() });
      }
    } catch {
      // やり直せるように内容を戻す（新しい編集が入っていればそちらを優先）
      if (!pendingRef.current) pendingRef.current = target;
      if (aliveRef.current) dispatch({ type: 'SAVE_FAILURE', key: target.key });
      // 🔴 失敗し続けているあいだ何度も通知しない。落ちた瞬間だけ知らせる
      if (!hadErrorRef.current) {
        hadErrorRef.current = true;
        onSaveErrorRef.current?.(ERROR_SAVE_FAILED);
      }
    }
  }, []);

  const schedule = useCallback(() => {
    const now = Date.now();
    if (firstDirtyAtRef.current === null) firstDirtyAtRef.current = now;
    if (timerRef.current) clearTimeout(timerRef.current);

    // 打鍵が止まらないままでも、待たされ過ぎたら書く
    if (now - firstDirtyAtRef.current >= MAX_WAIT_MS) {
      void flush();
      return;
    }
    timerRef.current = setTimeout(() => void flush(), DEBOUNCE_MS);
  }, [flush]);

  const onChange = useCallback(
    (value: string) => {
      const key = keyRef.current;
      // 読み込みが終わっていないキーには書かない（不変条件）
      if (!key || !userId || !cmid || state.phase !== 'ready' || state.key !== key) return;

      const tooLong = byteLength(value) > MAX_CONTENT_BYTES;
      dispatch({ type: 'EDIT', key, content: value, error: tooLong ? ERROR_TOO_LONG : null });
      pendingRef.current = { key, userId, courseId, cmid, content: value };
      if (tooLong) {
        if (timerRef.current) clearTimeout(timerRef.current);
        return;
      }
      schedule();
    },
    [userId, courseId, cmid, state.phase, state.key, schedule]
  );

  // 教材を切り替えたときとアンマウント時に、デバウンス待ちを書き切る。
  // pendingRef が宛先（userId/courseId/cmid）を自分で持っているので、
  // props が次の教材に進んだあとに走っても正しい宛先に届く。
  useEffect(
    () => () => {
      void flush();
    },
    [currentKey, flush]
  );

  // タブを離れる・アプリを畳む。unload より確実に呼ばれる
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) void flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [flush]);

  // 未保存のまま閉じようとしたときだけ引き止める。
  // 🔴 PUT は unload 中に完了を保証できない（sendBeacon は PUT も
  //    Authorization ヘッダも扱えない）。せめて確認を出す。
  useEffect(() => {
    if (!state.dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      void flush();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [state.dirty, flush]);

  // ─── 表示用の値 ───────────────────────────
  // 🔴 キーが変わった瞬間から、前の教材の本文は出さない。
  //    effect で消すと1フレームだけ前の本文が描かれてしまうので、描画時に落とす。
  const stale = state.key !== currentKey;
  const content = stale ? '' : state.content;
  const phase: StudyNotePhase = stale ? 'loading' : state.phase;

  // サーバ由来はタイムゾーン情報が無いので parseApiTimestamp を通す。
  // クライアント由来（toISOString）は Z 付きなのでそのまま解釈される。
  const savedAt = stale ? null : parseApiTimestamp(state.lastSavedAt);

  const status = deriveSaveStatus(stale ? { ...state, phase: 'loading' } : state, savedAt);

  const byteCount = byteLength(content);

  return {
    content,
    phase,
    status,
    onChange,
    /** いますぐ保存する（Ctrl+S・入力欄から離れたとき） */
    flush,
    /** 失敗した保存をやり直す */
    retry: flush,
    /** 読み込みに失敗したときの再読み込み */
    reload: load,
    charCount: content.length,
    byteCount,
    overLimit: byteCount > MAX_CONTENT_BYTES,
    nearLimit: byteCount > WARN_CONTENT_BYTES,
    /** この教材にメモが入っているか（タブのドット表示用） */
    hasNote: phase === 'ready' && content.trim().length > 0,
  };
}

export type UseStudyNote = ReturnType<typeof useStudyNote>;
