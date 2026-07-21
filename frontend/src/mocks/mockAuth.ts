/**
 * 認証モック（完全オフライン開発用）
 *
 * REACT_APP_ENABLE_MOCKS=true のとき、cognitoAuth.ts の各関数がここに委譲する。
 * 実 Cognito に一切アクセスせず、固定の擬似ユーザーでログイン状態を作る。
 *
 * ログイン/ログアウトの状態は localStorage に保存する（リロードしても保持）。
 *   - キーが無い初期状態 = 未ログイン（＝まず /login が表示される）
 *   - ログイン画面で任意のメール/パスワードを送信するとログイン成功（擬似）→ /mypage へ
 *   - ログアウトすると再び未ログイン状態に戻る
 *
 * 擬似ユーザーは admin + coach グループ所属（全画面に到達可能）。
 * 学生視点で見たい場合は MOCK_GROUPS を [] にする。
 */
import type { CognitoAuthResult } from '../services/cognitoAuth';

const MOCK_GROUPS = ['admin', 'coach'];
const LOGGED_IN_KEY = 'webcoach-mock-logged-in';

const mockAuthResult: CognitoAuthResult = {
  idToken: 'mock-id-token',
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  email: 'mock@webcoach.dev',
  sub: 'mock-sub-0001',
  username: 'mock@webcoach.dev',
  groups: MOCK_GROUPS,
};

function isLoggedIn(): boolean {
  try {
    return localStorage.getItem(LOGGED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

function setLoggedIn(value: boolean): void {
  try {
    if (value) localStorage.setItem(LOGGED_IN_KEY, '1');
    else localStorage.removeItem(LOGGED_IN_KEY);
  } catch {
    /* localStorage 不可の環境では無視 */
  }
}

export function mockSignIn(): Promise<CognitoAuthResult> {
  setLoggedIn(true);
  return Promise.resolve(mockAuthResult);
}

export function mockGetCurrentSession(): Promise<CognitoAuthResult | null> {
  return Promise.resolve(isLoggedIn() ? mockAuthResult : null);
}

export function mockGetIdToken(): Promise<string | null> {
  return Promise.resolve(isLoggedIn() ? mockAuthResult.idToken : null);
}

export function mockSignOut(): void {
  setLoggedIn(false);
}
