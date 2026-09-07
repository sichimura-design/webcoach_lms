import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PictureInPicture2 } from 'lucide-react';
import { useDocumentPiP } from '../../hooks/useDocumentPiP';
import { useQuickMemo } from '../../hooks/useQuickMemo';
import { QuickMemoPane } from './QuickMemoPane';

/**
 * 「速記メモ」の小窓（Document Picture-in-Picture）。
 * ============================================================
 * コーチングは会議ツールを別タブで開いて行う（CoachingPage.tsx の window.open）。
 * Meet は iframe に入れられないので、LMS側でメモを取ろうとするとタブの往復になる。
 * Document PiP なら会議の上に小窓を浮かべたまま書ける。
 *
 * 転記先は「開く側」が決める。ここは下書きと小窓の面倒だけを見て、
 * どのノートへ入れるかは onCommit に委ねる。
 *
 * 【ボタンと小窓を分けられるようにしてある理由】
 *   マイノートではボタンをノート面の上部バーに置くが、あのバーは
 *   ノートを閉じると一緒に消える。小窓の寿命をバーに預けると、一覧へ戻った
 *   だけで小窓が落ちる。そこで useQuickMemoWindow（小窓と下書きを持つ）と
 *   QuickMemoButton（押すだけ）に分け、ページ側が小窓を持てるようにした。
 *   コーチングの記録中画面のように寿命が一致する場所では、両方をまとめた
 *   QuickMemoLauncher をそのまま使えばよい。
 *
 * 🔴 Chrome / Edge 以外ではボタンごと描かない（supported === false）。
 *    Safari・Firefox に Document PiP が無く、常時最前面にする代替も無い。
 *    押せないボタンを置くより存在しない方がよい。
 * ============================================================
 */

const FALLBACK_ERROR = 'ノートに追加できませんでした。もう一度お試しください。';

/**
 * onCommit がこれを投げたときだけ、その文言をそのまま小窓に出す。
 * ふつうの Error（axios の "Request failed with status code 404" など）は
 * 読み手に意味が無いので FALLBACK_ERROR に置き換える。
 */
export class QuickMemoError extends Error {}

export interface UseQuickMemoWindowOptions {
  /** 下書きの宛先。utils/quickMemoDraft.ts の coachingDraftKey / noteDraftKey で作る */
  draftKey: string;
  /** 小窓の中に出す転記先の名前 */
  targetLabel: string;
  /** 小窓そのものの名前（タスクバー・支援技術向け） */
  windowTitle: string;
  /** 追加を実行する。失敗は throw で伝える（下書きを残すため） */
  onCommit: (text: string) => Promise<void>;
}

export interface QuickMemoWindow {
  supported: boolean;
  isOpen: boolean;
  /** 書きかけがあるか。ボタンの文言に使う */
  hasDraft: boolean;
  /** クリックハンドラから直接呼ぶ。開いていれば閉じる */
  toggle: () => Promise<void>;
  /** ページのどこかで描く。閉じていれば null */
  portal: React.ReactNode;
}

export function useQuickMemoWindow({
  draftKey,
  targetLabel,
  windowTitle,
  onCommit,
}: UseQuickMemoWindowOptions): QuickMemoWindow {
  const { supported, pipWindow, open, close } = useDocumentPiP();
  const memo = useQuickMemo(draftKey);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * 「前回の書きかけを復元しました」を出すか。
   * 🔴 判定は下書きを読んだ時点ではなく "小窓を開いた時点"。フックはページと同じだけ
   *    生きているので、読み込み時に空でも、書いて閉じて開き直せば復元は起きる。
   */
  const [restored, setRestored] = useState(false);

  const { flush, clear, setText, text, status } = memo;

  // 小窓が消えたら（× でも、他所に奪われても）状態を持ち越さない
  useEffect(() => {
    if (!pipWindow) {
      setError(null);
      setRestored(false);
    }
  }, [pipWindow]);

  const toggle = useCallback(async () => {
    if (pipWindow) {
      flush();
      close();
      return;
    }
    setError(null);
    setRestored(text.trim() !== '');
    // 🔴 requestWindow() より前に await を挟まないこと（user activation を消費する）
    await open({ title: windowTitle });
  }, [pipWindow, flush, close, open, windowTitle, text]);

  // 一文字でも打てば「復元しました」は役目を終える
  const handleChangeText = useCallback(
    (next: string) => {
      setRestored(false);
      setText(next);
    },
    [setText]
  );

  const handleCommit = useCallback(async () => {
    const body = text.trim();
    if (!body || committing) return;
    setCommitting(true);
    setError(null);
    try {
      await onCommit(body);
      clear();
    } catch (e) {
      // 🔴 失敗したら下書きは消さない。useNoteCapture.ts:37-41 と同じ規約
      setError(e instanceof QuickMemoError && e.message ? e.message : FALLBACK_ERROR);
    } finally {
      setCommitting(false);
    }
  }, [text, committing, onCommit, clear]);

  const portal = pipWindow
    ? createPortal(
        <QuickMemoPane
          targetLabel={targetLabel}
          text={text}
          onChangeText={handleChangeText}
          status={status}
          restored={restored}
          committing={committing}
          error={error}
          onCommit={handleCommit}
        />,
        pipWindow.document.body
      )
    : null;

  return { supported, isOpen: pipWindow !== null, hasDraft: text.trim() !== '', toggle, portal };
}

export interface QuickMemoButtonProps {
  isOpen: boolean;
  hasDraft: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export function QuickMemoButton({ isOpen, hasDraft, onClick, style, className }: QuickMemoButtonProps) {
  return (
    <button type="button" onClick={onClick} aria-pressed={isOpen} className={className} style={style}>
      <PictureInPicture2 size={14} style={{ flexShrink: 0 }} />
      {isOpen ? '速記メモを閉じる' : hasDraft ? '速記メモ（書きかけ）' : '速記メモを小窓で開く'}
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
        hasDraft={memoWindow.hasDraft}
        onClick={() => void memoWindow.toggle()}
        style={buttonStyle}
        className={buttonClassName}
      />
      {memoWindow.portal}
    </>
  );
}

export default QuickMemoLauncher;
