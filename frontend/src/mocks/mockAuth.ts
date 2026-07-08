/**
 * 認証モック（完全オフライン開発用）
 *
 * REACT_APP_ENABLE_MOCKS=true のとき、cognitoAuth.ts の各関数がここに委譲する。
 * 実 Cognito に一切アクセスせず、固定の擬似ユーザーでログイン状態を作る。
 *
 * ログイン/ログアウトの状態は localStorage に保存する（リロードしても保持）。
 *   - キーが無い初期状態 = ログイン済み（＝開発ではそのままアプリに入れる）
 *   - ログアウトすると /login にとどまり、ログイン画面を試せる
 *   - 任意のメール/パスワードでログイン成功（擬似）
 *
 * ログイン画面を試したいとき（手動でログアウト状態にする方法）:
 *   1) /webcoach のヘッダーの「ログアウト」を押す、または
 *   2) DevTools のコンソールで: localStorage.setItem('webcoach-mock-logged-out','1') → リロード
 *   元に戻す（自動ログイン）: localStorage.removeItem('webcoach-mock-logged-out') → リロード
 *
 * 擬似ユーザーは admin + coach グループ所属（全画面に到達可能）。
 * 学生視点で見たい場合は MOCK_GROUPS を [] にする。
 */
import type { CognitoAuthResult } from '../services/cognitoAuth';

const MOCK_GROUPS = ['admin', 'coach'];
const LOGGED_OUT_KEY = 'webcoach-mock-logged-out';

const mockAuthResult: CognitoAuthResult = {
  idToken: 'mock-id-token',
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  email: 'mock@webcoach.dev',
  sub: 'mock-sub-0001',
  username: 'mock@webcoach.dev',
  groups: MOCK_GROUPS,
};

function isLoggedOut(): boolean {
  try {
    return localStorage.getItem(LOGGED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

function setLoggedOut(value: boolean): void {
  try {
    if (value) localStorage.setItem(LOGGED_OUT_KEY, '1');
    else localStorage.removeItem(LOGGED_OUT_KEY);
  } catch {
    /* localStorage 不可の環境では無視 */
  }
}

export function mockSignIn(): Promise<CognitoAuthResult> {
  setLoggedOut(false);
  return Promise.resolve(mockAuthResult);
}

export function mockGetCurrentSession(): Promise<CognitoAuthResult | null> {
  return Promise.resolve(isLoggedOut() ? null : mockAuthResult);
}

export function mockGetIdToken(): Promise<string | null> {
  return Promise.resolve(isLoggedOut() ? null : mockAuthResult.idToken);
}

export function mockSignOut(): void {
  setLoggedOut(true);
}
