/**
 * Document Picture-in-Picture API の型。
 * ============================================================
 * 🔴 なぜ手で書いているのか。
 *    TypeScript の lib.dom.d.ts にはまだ入っていない（video 用の
 *    Picture-in-Picture とは別の API）。宣言が無いと
 *    window.documentPictureInPicture が any になり、
 *    requestWindow の戻り値も any に伝播して全部型が消える。
 *
 * 🔴 copyStyleSheets は書かないこと。
 *    Origin Trial の期間だけ存在したオプションで、製品版の API からは
 *    削除されている。「親のCSSを丸ごと持ち込む」手段は無い前提で、
 *    小窓の中身（components/quickMemo/QuickMemoPane.tsx）は
 *    自己完結したスタイルで書いている。
 *
 * 対応: Chrome / Edge 116+。Safari・Firefox には存在しないので、
 *       呼ぶ前に必ず hooks/useDocumentPiP.ts の
 *       isDocumentPiPSupported() で存在を確かめる。
 * ============================================================
 */

interface DocumentPictureInPictureOptions {
  /** 小窓の内寸。極端に小さい値はブラウザ側でクランプされる */
  width?: number;
  height?: number;
  /** true にするとタイトルバーから親タブへ戻る導線が消える（既定 false のまま使う） */
  disallowReturnToOpener?: boolean;
  /** true にすると前回の位置とサイズを覚えない（既定 false のまま使う） */
  preferInitialWindowPlacement?: boolean;
}

interface DocumentPictureInPictureEvent extends Event {
  readonly window: Window;
}

interface DocumentPictureInPicture extends EventTarget {
  /** いま開いている小窓。ブラウザ全体で常に高々1つ */
  readonly window: Window | null;
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  onenter: ((this: DocumentPictureInPicture, ev: DocumentPictureInPictureEvent) => unknown) | null;
}

interface Window {
  /** Chrome / Edge 116+ かつ secure context のときだけ存在する */
  readonly documentPictureInPicture?: DocumentPictureInPicture;
}
