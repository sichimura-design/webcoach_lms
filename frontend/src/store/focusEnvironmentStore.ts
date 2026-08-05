import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 集中ブースの環境設定（BGM・環境音・通知）。
 *
 * 🔴 初期実装では音を鳴らさない。ここは「設定を覚えておく」だけ。
 *    理由:
 *      1. 音源アセットがリポジトリに無く、調達とライセンス確認・配信が別途必要
 *      2. autoplay policy でユーザー操作なしの再生はブロックされ、
 *         iOSのサイレントスイッチ・タブ非アクティブ・ページ遷移での二重再生と
 *         検証項目が一気に増える
 *      3. 設定を先に永続化しておけば、音源が用意できた時点でこのストアを読む
 *         プレイヤーを1つ足すだけで有効になる（UIの作り直しが発生しない）
 *    そのため画面側では該当項目に「近日対応」と明記する。機能しているふりをさせない。
 *
 *    例外は notifyInPage（ポモドーロ完了の画面内通知）。これは音を使わないので実際に効く。
 */
export type BgmTrack = 'lofi' | 'piano' | 'ambient';
export type AmbientKind = 'rain' | 'cafe' | 'forest' | 'waves';

export const BGM_TRACK_LABEL: Record<BgmTrack, string> = {
  lofi: 'Lo-Fi ビート',
  piano: '静かなピアノ',
  ambient: 'アンビエント',
};

export const AMBIENT_KIND_LABEL: Record<AmbientKind, string> = {
  rain: '雨の音',
  cafe: 'カフェの環境音',
  forest: '森の音',
  waves: '波の音',
};

interface FocusEnvironmentState {
  bgmEnabled: boolean;
  bgmTrack: BgmTrack;
  ambientEnabled: boolean;
  ambientKind: AmbientKind;
  /** 0-100 */
  volume: number;
  /** ポモドーロ完了を画面内で知らせる（★これだけ実際に効く） */
  notifyInPage: boolean;
  /** ブラウザ通知。権限ダイアログを増やすので初期実装では保存のみ */
  notifyBrowser: boolean;
  set: (patch: Partial<Omit<FocusEnvironmentState, 'set'>>) => void;
}

export const useFocusEnvironmentStore = create<FocusEnvironmentState>()(
  persist(
    (set) => ({
      bgmEnabled: false,
      bgmTrack: 'lofi',
      ambientEnabled: false,
      ambientKind: 'rain',
      volume: 50,
      notifyInPage: true,
      notifyBrowser: false,
      set: (patch) => set(patch),
    }),
    { name: 'webcoach-focus-environment' }
  )
);
