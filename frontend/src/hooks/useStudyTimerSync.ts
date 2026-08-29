import { useEffect } from 'react';
import { useStudyTimerStore } from '../store/studyTimerStore';

const STORE_KEY = 'webcoach-study-timer';

/**
 * 別タブでのタイマー操作をこのタブに反映させる。
 *
 * zustand の persist は書き込みはするがタブ間の同期はしない。
 * これが無いと「タブAで学習を終了したのに、タブBではタイマーが回り続ける」ことになり、
 * タブBから終了すると同じ時間が二重に見える（記録自体は id で冪等なので増えない）。
 * App に1つだけ置く。
 */
export function useStudyTimerSync(): void {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORE_KEY) return;
      void useStudyTimerStore.persist.rehydrate();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
}

export default useStudyTimerSync;
