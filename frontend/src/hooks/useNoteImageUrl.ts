import { useEffect, useState } from 'react';
import { getNoteImageUrl } from '../utils/noteImageStore';

/**
 * IndexedDB（utils/noteImageStore.ts）に置いた画像を表示するための objectURL を作る。
 *
 * 【なぜフックに切り出したか】
 * もとは NoteBlockView の NoteImage の中にだけあった。一覧カードのサムネイルでも
 * 同じことが必要になり、下の3つの罠を2箇所に書き写すことになるため共通化した。
 *   1. objectURL は使い終わりに revoke する。作りっぱなしにすると、そのタブが
 *      画像を掴んだままになる（ノート面や一覧を開き閉じするたびに積み上がる）。
 *   2. await の途中でアンマウントしたときは、後から届いた URL も revoke する。
 *      でないと revoke されない孤児が残る。
 *   3. imageId が変わったら前の URL を捨てる。
 *
 * 見つからない（missing）のは、別の端末で貼った画像を見ているとき。画像の実体は
 * その端末の IndexedDB にしかないので、呼び出し側は「無い」ことを描く必要がある。
 */
export type NoteImageStatus = 'loading' | 'ready' | 'missing';

export function useNoteImageUrl(imageId: string | null | undefined): {
  url: string | null;
  status: NoteImageStatus;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<NoteImageStatus>(imageId ? 'loading' : 'missing');

  useEffect(() => {
    if (!imageId) {
      setUrl(null);
      setStatus('missing');
      return;
    }

    let revoked = false;
    let current: string | null = null;
    setStatus('loading');

    void getNoteImageUrl(imageId).then((next) => {
      if (revoked) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      current = next;
      setUrl(next);
      setStatus(next ? 'ready' : 'missing');
    });

    return () => {
      revoked = true;
      if (current) URL.revokeObjectURL(current);
      setUrl(null);
    };
  }, [imageId]);

  return { url, status };
}

export default useNoteImageUrl;
