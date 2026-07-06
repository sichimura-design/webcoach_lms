/**
 * 認証モック（完全オフライン開発用）
 *
 * REACT_APP_ENABLE_MOCKS=true のとき、cognitoAuth.ts の各関数がここに委譲する。
 * 実 Cognito に一切アクセスせず、固定の擬似ユーザーで自動ログイン状態を作る。
 *
 * 擬似ユーザーは admin + coach グループ所属にしてあるため、
 * 一般画面・管理画面・コーチ画面のすべてに到達できる（開発の利便性のため）。
 * 学生視点で確認したい場合は下の MOCK_GROUPS を [] にする。
 */
import type { CognitoAuthResult } from '../services/cognitoAuth';

const MOCK_GROUPS = ['admin', 'coach'];

const mockAuthResult: CognitoAuthResult = {
  idToken: 'mock-id-token',
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  email: 'mock@webcoach.dev',
  sub: 'mock-sub-0001',
  username: 'mock@webcoach.dev',
  groups: MOCK_GROUPS,
};

// signOut 後は getCurrentSession が null を返すようにするための簡易フラグ
let loggedOut = false;

export function mockSignIn(): Promise<CognitoAuthResult> {
  loggedOut = false;
  return Promise.resolve(mockAuthResult);
}

export function mockGetCurrentSession(): Promise<CognitoAuthResult | null> {
  return Promise.resolve(loggedOut ? null : mockAuthResult);
}

export function mockGetIdToken(): Promise<string | null> {
  return Promise.resolve(loggedOut ? null : mockAuthResult.idToken);
}

export function mockSignOut(): void {
  loggedOut = true;
}
