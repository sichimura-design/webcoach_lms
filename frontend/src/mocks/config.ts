/**
 * モック機構の有効/無効フラグ。
 * REACT_APP_ENABLE_MOCKS=true のときのみ、MSW と認証モックが有効になる。
 * 未設定（本番 master ビルド）ではすべて無効で、挙動は従来どおり。
 */
export const MOCKS_ENABLED = process.env.REACT_APP_ENABLE_MOCKS === 'true';
