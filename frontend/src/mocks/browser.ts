/**
 * MSW ブラウザ用ワーカー。
 * index.tsx から MOCKS_ENABLED のときだけ動的 import される
 * （本番バンドルには読み込まれない）。
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
