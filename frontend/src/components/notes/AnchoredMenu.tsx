import { RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * ボタンに紐づくメニューを body 直下（ポータル）に出す。
 *
 * 🔴 なぜポータルなのか
 *    ノートの紙（NoteEditor の <section>）は角丸を効かせるために overflow:hidden。
 *    メニューを行の中に position:absolute で置くと、紙の下端の行（「続きを書く…」）で
 *    開いたときに下半分が切り落とされ、しかも紙の中はスクロールできないので
 *    「箇条書き」から先が永久に選べなかった。
 *
 * やっていること:
 *   ・position:fixed ＋ ボタンの矩形から座標を出す（親の overflow に切られない）
 *   ・下に入らなければ上に開く（フリップ）
 *   ・それでも入らないときは残り高さいっぱいに縮め、メニューの中でスクロールさせる
 *   ・スクロール／リサイズ／**中身の高さが変わったら**座標を取り直す
 *
 * 🔴 中身の高さは ResizeObserver で見る。以前は useLayoutEffect の依存に children を
 *    入れていたが、中身が自分の state で伸び縮みする使い方（フォルダのパネルで
 *    名前の入力欄が生える・行が消える）では children の同一性が変わらず測り直さない。
 *    上に開いていた場合、top は古い高さから逆算した値なのでボタンから浮いて残る。
 *
 * 閉じる操作もここで持つ。ポータルは anchor の DOM の外に出るので、
 * useDismissable の「ref の外側なら閉じる」だと、項目を押した瞬間に
 * mousedown で閉じてしまい click が発火しない（＝何も選べない）。
 */
interface AnchoredMenuProps {
  /** 位置の基準にするボタン */
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** ボタンの左端に揃える（既定）か、右端に揃えるか */
  align?: 'left' | 'right';
  minWidth?: number;
  /** role="menu" 以外にしたいとき（説明ポップオーバーなど） */
  role?: string;
  ariaLabel?: string;
  /**
   * 開いたら中へフォーカスを入れ、閉じたらボタンへ返す。
   * role="dialog" で使うときは付ける（入れないと Tab がパネルを飛び越し、
   * 読み上げにも存在が伝わらない）。role="menu" の項目1個ずつを選ぶ使い方では
   * 既定の off のまま（ポインタ操作の途中でフォーカスが動くと落ち着かない）。
   */
  manageFocus?: boolean;
  children: React.ReactNode;
}

/** 画面端との余白と、ボタンとの隙間 */
const GUTTER = 8;
const GAP = 4;

interface Placement {
  top: number;
  left: number;
  maxHeight: number;
}

export function AnchoredMenu({
  anchorRef,
  open,
  onClose,
  align = 'left',
  minWidth,
  role = 'menu',
  ariaLabel,
  manageFocus = false,
  children,
}: AnchoredMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const rect = anchor.getBoundingClientRect();
    // maxHeight を当てたあとの高さではなく、中身そのものの高さで判断する
    const height = menu.scrollHeight;
    const width = menu.offsetWidth;

    const below = window.innerHeight - rect.bottom - GAP - GUTTER;
    const above = rect.top - GAP - GUTTER;

    // 下に入るならそのまま下。入らないときは、広いほうへ開く
    const openDown = height <= below || below >= above;
    let maxHeight = openDown ? below : above;
    let top: number;
    if (maxHeight < 120) {
      // 上下どちらにも入らない低い画面。ボタンに重ねてでも中身を出す
      maxHeight = window.innerHeight - GUTTER * 2;
      top = GUTTER;
    } else {
      top = openDown
        ? rect.bottom + GAP
        : Math.max(GUTTER, rect.top - GAP - Math.min(height, maxHeight));
    }

    const rawLeft = align === 'right' ? rect.right - width : rect.left;
    const left = Math.min(Math.max(GUTTER, rawLeft), Math.max(GUTTER, window.innerWidth - width - GUTTER));

    setPlacement((prev) =>
      prev && prev.top === top && prev.left === left && prev.maxHeight === maxHeight
        ? prev
        : { top, left, maxHeight }
    );
  }, [anchorRef, align]);

  // 描画前に測って置き直す（一瞬だけ変な位置に見えるのを避ける）
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    measure();
  }, [open, measure]);

  // 開いたら中へフォーカスを入れ、閉じたらボタンへ返す（manageFocus のときだけ）
  useEffect(() => {
    if (!open || !manageFocus) return;
    const anchor = anchorRef.current;
    menuRef.current?.focus();
    return () => {
      // 閉じた先が別の入力ならそこを尊重する。行方不明（body）のときだけ引き戻す
      if (document.activeElement === document.body) anchor?.focus();
    };
  }, [open, manageFocus, anchorRef]);

  useEffect(() => {
    if (!open) return;

    // capture:true … 中のどの要素がスクロールしても座標を取り直す
    const onScrollOrResize = () => measure();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    // 中身が伸び縮みしたら測り直す（入力欄が生える・行が増減する）
    const menu = menuRef.current;
    const observer = menu ? new ResizeObserver(() => measure()) : null;
    if (menu && observer) observer.observe(menu);

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return; // ボタン自身の toggle に任せる
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, measure, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role={role}
      aria-label={ariaLabel}
      // フォーカスを受けられるようにする（キーボードの Tab 順には入れない）
      tabIndex={manageFocus ? -1 : undefined}
      /*
       * 🔴 wc-warm を自分で被る。--dc-* は :root ではなくスコープクラス
       *    （.mypage-3d / .wc-warm）に載っているので、body 直下に出した瞬間に
       *    var(--dc-surface) などが解決できなくなり、枠も影も地色も消える
       *    （＝項目だけが紙の上に裸で並ぶ）。
       */
      className="wc-warm notes-menu"
      style={{
        position: 'fixed',
        // 測る前は画面外に置く。幅・高さは取れるので座標は1回で決まる
        top: placement?.top ?? -9999,
        left: placement?.left ?? -9999,
        minWidth,
        maxHeight: placement?.maxHeight,
        overflowY: 'auto',
        // 箱そのものは押せる面ではないので、フォーカスを入れても枠は出さない
        outline: 'none',
        // モーダル（60〜90）より下、ページ本体・ヘッダー（45）より上
        zIndex: 60,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export default AnchoredMenu;
