import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PictureInPicture2 } from 'lucide-react';
import { useDocumentPiP } from '../../hooks/useDocumentPiP';
import { QuickMemoPane } from './QuickMemoPane';

/**
 * ノートを小窓で開く（Document Picture-in-Picture）。
 * ============================================================
 * コーチングは会議ツールを別タブで開いて行う（CoachingPage.tsx の window.open）。
 * Meet は iframe に入れられないので、LMS側でメモを取ろうとするとタブの往復になる。
 * Document PiP なら会議の上に小窓を浮かべたまま書ける。
 *
 * 🔴 小窓に出るのは**そのノートの本文そのもの**。
 *    かつては「速記メモ」という名前で、専用の localStorage に下書きを溜め、
 *    「ノートに追加」を押したぶんだけがブロックとして転記される片道の投入口だった。
 *    小窓を開いてもノートの中身が出ないので、名前から何をする所か読めなかった。
 *    いまは本文（Note.body）を呼び出し側と同じ state で編集する。
 *    **ここに独自のテキスト状態を持たせないこと。** 持たせると
 *    親の紙と小窓で別々の本文ができて、あとから書いた方が相手を潰す。
 *
 * 【ボタンと小窓を分けられるようにしてある理由】
 *   マイノートではボタンをノート面の上部バーに置くが、あのバーは
 *   ノートを閉じると一緒に消える。小窓の寿命をバーに預けると、一覧へ戻った
 *   だけで小窓が落ちる。そこで useQuickMemoWindow（小窓を持つ）と
 *   QuickMemoButton（押すだけ）に分け、ページ側が小窓を持てるようにした。
 *   コーチングの記録中画面のように寿命が一致する場所では、両方をまとめた
 *   QuickMemoLauncher をそのまま使えばよい。
 *
 * 🔴 Chrome / Edge 以外ではボタンごと描かない（supported === false）。
 *    Safari・Firefox に Document PiP が無く、常時最前面にする代替も無い。
 *    押せないボタンを置くより存在しない方がよい。
 * ============================================================
 */

export interface UseQuickMemoWindowOptions {
  /** 小窓の中に出す、いま開いているノートの名前 */
  targetLabel: string;
  /** 小窓そのものの名前（タスクバー・支援技術向け） */
  windowTitle: string;
  /** 本文。呼び出し側の useNote が持っているものをそのまま渡す */
  text: string;
  onChangeText: (text: string) => void;
  /** 小窓から手が離れたときに、待たずに保存させる */
  onFlush: () => void;
  status: 'idle' | 'saving' | 'saved';
  /** 保存に失敗したときの文言 */
  error: string | null;
  /** 小窓を開く前にやること（コーチングでは記録ノートを作る）。失敗したら開かない */
  onBeforeOpen?: () => Promise<boolean>;
}

export interface QuickMemoWindow {
  supported: boolean;
  isOpen: boolean;
  /** クリックハンドラから直接呼ぶ。開いていれば閉じる */
  toggle: () => Promise<void>;
  /** 明示的に閉じる（ノートが閉じられたときなど） */
  close: () => void;
  /** ページのどこかで描く。閉じていれば null */
  portal: React.ReactNode;
}

export function useQuickMemoWindow({
  targetLabel,
  windowTitle,
  text,
  onChangeText,
  onFlush,
  status,
  error,
  onBeforeOpen,
}: UseQuickMemoWindowOptions): QuickMemoWindow {
  const { supported, pipWindow, open, close } = useDocumentPiP();

  const toggle = useCallback(async () => {
    if (pipWindow) {
      onFlush();
      close();
      return;
    }
    /*
     * 🔴 onBeforeOpen（ノートの作成）を await してから requestWindow() を呼ぶと、
     *    user activation が切れて小窓が開けない。先に窓を出して、
     *    中身は開いたあとに揃える。
     */
    await open({ title: windowTitle });
    if (onBeforeOpen) {
      const ok = await onBeforeOpen();
      if (!ok) close();
    }
  }, [pipWindow, onFlush, close, open, windowTitle, onBeforeOpen]);

  const portal = pipWindow
    ? createPortal(
        <QuickMemoPane
          targetLabel={targetLabel}
          text={text}
          onChangeText={onChangeText}
          onFlush={onFlush}
          status={status}
          error={error}
        />,
        pipWindow.document.body
      )
    : null;

  return { supported, isOpen: pipWindow !== null, toggle, close, portal };
}

export interface QuickMemoButtonProps {
  isOpen: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export function QuickMemoButton({ isOpen, onClick, style, className }: QuickMemoButtonProps) {
  return (
    <button type="button" onClick={onClick} aria-pressed={isOpen} className={className} style={style}>
      <PictureInPicture2 size={14} style={{ flexShrink: 0 }} />
      {isOpen ? '小窓を閉じる' : 'ノートを小窓で開く'}
    </button>
  );
}

export interface QuickMemoLauncherProps extends UseQuickMemoWindowOptions {
  /** 呼び出し側の並びに合わせるための見た目。ロジックには影響しない */
  buttonStyle?: React.CSSProperties;
  buttonClassName?: string;
}

/** ボタンと小窓の寿命が一致する場所向けのひとまとめ版 */
export function QuickMemoLauncher({ buttonStyle, buttonClassName, ...options }: QuickMemoLauncherProps) {
  const memoWindow = useQuickMemoWindow(options);
  if (!memoWindow.supported) return null;

  return (
    <>
      <QuickMemoButton
        isOpen={memoWindow.isOpen}
        onClick={() => void memoWindow.toggle()}
        style={buttonStyle}
        className={buttonClassName}
      />
      {memoWindow.portal}
    </>
  );
}

export default QuickMemoLauncher;
