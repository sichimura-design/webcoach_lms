import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAiCoachStore } from '../store/aiCoachStore';

const AI_COACH_PATH = '/ai-coach';

/**
 * AI専用ページを離れたときの後始末。ルート直下（AppRoutes）で1回だけ呼ぶ。
 *
 * 2つのことをする。
 *
 * 1. ブラウザバックを戻り帯と同じ結果にする。
 *    「広い画面で続ける」→ ブラウザバック だと、元の画面には戻れてもドロワーは
 *    閉じたままで、続けていた会話が消えたように見えていた。戻り先が
 *    ドロワー由来で、かつ帰り着いた先が預けたパスそのものなら開き直す。
 *
 * 2. 使われなかった戻り先を捨てる。
 *    expandOrigin は sessionStorage に載るので、サイドバー等で離脱すると
 *    残り続け、後で開いた会話に古い行き先のボタンが復活していた。
 *
 * 置き場所が AppHeader ではなくルートなのは、教材ページ（LearningWorkspacePage）が
 * AppHeader を描かないから。そこへ抜けた遷移を AppHeader からは観測できない。
 */
export function useAiCoachExpandOriginCleanup(): void {
  const { pathname } = useLocation();
  // 直前の pathname。「離れた瞬間」だけを捉えるために持つ。
  // 現在地だけで判定すると、拡大時に「元の画面に居るあいだ」に書いた戻り先を
  // 遷移する前に自分で消してしまう（StrictMode の二重実行も同じ理由で素通りする）。
  const prevPath = useRef(pathname);

  useEffect(() => {
    const left = prevPath.current === AI_COACH_PATH && pathname !== AI_COACH_PATH;
    prevPath.current = pathname;
    if (!left) return;

    const { expandOrigin, clearExpandOrigin, setDrawerOpen } = useAiCoachStore.getState();
    if (!expandOrigin) return;
    // 預けたパスは pathname + search。pathname 同士で比べる
    // （前方一致にすると "/" が何にでも当たってしまう）。
    if (expandOrigin.fromDrawer && expandOrigin.path.split('?')[0] === pathname) setDrawerOpen(true);
    clearExpandOrigin();
  }, [pathname]);
}

export default useAiCoachExpandOriginCleanup;
