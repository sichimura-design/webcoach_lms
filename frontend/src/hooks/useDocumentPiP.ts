import { useCallback, useEffect, useRef, useState } from 'react';
import { color, font } from '../theme/webcoachTheme';

/**
 * Document Picture-in-Picture の小窓を1つ開いて持つ。
 * ============================================================
 * 中身は呼び出し側が createPortal(pane, pipWindow.document.body) で描く。
 * 小窓に別のReactアプリを起動しないのが要点で、JSは親のrealmで動いたまま
 * DOMだけが移る。おかげで MSW・localStorage・Context・axios は
 * 何も手当てせずそのまま効く。
 *
 * 🔴 open() はクリックハンドラから直接呼ぶこと。
 *    requestWindow() は transient user activation を消費する。
 *    前に別の await（ノートの検索や作成など）を挟むとアクティベーションが
 *    切れて NotAllowedError になる。転記先の解決のような準備は
 *    「開いたあと」に遅らせる。
 *
 * 🔴 親のCSSは持ち込めない。
 *    copyStyleSheets は製品版APIから削除済み。加えて CRA は
 *    dev が <style> 注入・prod が <link> で構造が変わる。
 *    小窓の中では Tailwind クラスも --dc-* 変数も index.css も効かない前提で、
 *    Pane 側を自己完結して書く。ここで面倒を見るのはフォントだけ
 *    （@font-face はドキュメント単位なので、見た目を親と揃えるために
 *    public/index.html の Google Fonts のタグだけを複製する）。
 * ============================================================
 */

const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 320;

/** public/index.html:13-18 の3タグ。@font-face をこの小窓でも解決させる */
const FONT_TAG_SELECTOR =
  'link[rel="preconnect"][href*="fonts.g"], link[rel="stylesheet"][href*="fonts.googleapis.com"]';

export function isDocumentPiPSupported(): boolean {
  // インターフェースが [SecureContext] なので、この存在チェックだけで
  // http:// 配信も自動的に弾ける（isSecureContext を別に見る必要はない）
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

/*
 * Document PiP はブラウザ（プロファイル）全体で高々1つ。2回目の
 * requestWindow() は既存の小窓を黙って閉じて新しいのを開く。
 * 導線が複数あるので、奪われた側が pipWindow を握ったままにならないよう、
 * いまの持ち主をモジュールスコープで1つだけ覚えておく。
 */
let currentOwner: symbol | null = null;
const releaseByOwner = new Map<symbol, () => void>();

function claimOwnership(owner: symbol, release: () => void) {
  if (currentOwner && currentOwner !== owner) releaseByOwner.get(currentOwner)?.();
  currentOwner = owner;
  releaseByOwner.set(owner, release);
}

function dropOwnership(owner: symbol) {
  releaseByOwner.delete(owner);
  if (currentOwner === owner) currentOwner = null;
}

/** 小窓の head/body を親と同じ見た目の土台に整える */
function dressUp(pip: Window, title: string) {
  const doc = pip.document;
  doc.title = title;
  doc.documentElement.lang = 'ja';

  document.head.querySelectorAll(FONT_TAG_SELECTOR).forEach((tag) => {
    const clone = tag.cloneNode(true) as HTMLLinkElement;
    // 小窓の base URL は親と違う。相対hrefで壊れないよう解決済みの絶対URLを入れ直す
    clone.href = (tag as HTMLLinkElement).href;
    doc.head.appendChild(clone);
  });

  const base = doc.createElement('style');
  base.textContent = [
    '*{box-sizing:border-box}',
    `html,body{margin:0;padding:0;height:100%}`,
    `body{font-family:${font.family};background:${color.notePaper};color:${color.text};`,
    '-webkit-font-smoothing:antialiased;overscroll-behavior:contain}',
  ].join('');
  doc.head.appendChild(base);
}

export interface OpenPiPOptions {
  /** タスクバー・スクリーンリーダー向けの窓の名前 */
  title: string;
  width?: number;
  height?: number;
}

export interface UseDocumentPiP {
  /** Chrome / Edge 以外では false。導線ごと描かないために使う */
  supported: boolean;
  /** 開いていれば小窓の window。ポータルの描画先の判定に使う */
  pipWindow: Window | null;
  /** クリックハンドラから直接呼ぶ。開けなければ null */
  open: (options: OpenPiPOptions) => Promise<Window | null>;
  close: () => void;
}

export function useDocumentPiP(): UseDocumentPiP {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  // このフックの個体識別子。誰が小窓を持っているかの照合にだけ使う
  const [owner] = useState(() => Symbol('pip-owner'));
  const windowRef = useRef<Window | null>(null);
  const aliveRef = useRef(true);

  const forget = useCallback(() => {
    windowRef.current = null;
    dropOwnership(owner);
    if (aliveRef.current) setPipWindow(null);
  }, [owner]);

  const close = useCallback(() => {
    const w = windowRef.current;
    forget();
    // close() は pagehide を起こすが、上で既に忘れているので二重処理にならない
    if (w && !w.closed) w.close();
  }, [forget]);

  const open = useCallback(
    async ({ title, width, height }: OpenPiPOptions) => {
      if (!isDocumentPiPSupported()) return null;
      const api = window.documentPictureInPicture;
      if (!api) return null;

      let pip: Window;
      try {
        // 🔴 ここがハンドラ内の最初の await。前に何も挟まないこと
        pip = await api.requestWindow({
          width: width ?? DEFAULT_WIDTH,
          height: height ?? DEFAULT_HEIGHT,
        });
      } catch {
        // ユーザーが許可しなかった / アクティベーション切れ。黙って何もしない
        return null;
      }

      if (!aliveRef.current) {
        pip.close();
        return null;
      }

      dressUp(pip, title);
      pip.addEventListener('pagehide', forget, { once: true });

      claimOwnership(owner, forget);
      windowRef.current = pip;
      setPipWindow(pip);
      return pip;
    },
    [owner, forget]
  );

  /*
   * 🔴 親のドキュメントが捨てられるときも閉じる（リロード・別サイトへの遷移）。
   *    小窓は opener とは別のドキュメントなので、親が読み直されても生き残る。
   *    Reactのアンマウントはこの経路では走らないので、pagehide で明示的に閉じないと
   *    「中身だけ消えた真っ白な小窓」が最前面に residual として残る。
   *    タブを閉じたときだけはブラウザが片付けてくれるが、区別せず同じ扱いでよい。
   */
  useEffect(() => {
    if (!pipWindow) return;
    const closePip = () => {
      if (!pipWindow.closed) pipWindow.close();
    };
    window.addEventListener('pagehide', closePip);
    return () => window.removeEventListener('pagehide', closePip);
  }, [pipWindow]);

  // 🔴 アンマウントでも必ず閉じる。
  //    SPA のルート遷移では親のドキュメントは生きたままなので上の pagehide は鳴らない。
  //    ポータルを描いていたコンポーネントが消えると、中身だけが失われる。
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      const w = windowRef.current;
      windowRef.current = null;
      dropOwnership(owner);
      if (w && !w.closed) w.close();
    };
  }, [owner]);

  return { supported: isDocumentPiPSupported(), pipWindow, open, close };
}

export default useDocumentPiP;
