import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CognitoUser } from 'amazon-cognito-identity-js';
import {
  signIn as cognitoSignIn,
  completeNewPassword,
  signOut as cognitoSignOut,
  getCurrentSession,
  CognitoAuthResult,
  NewPasswordRequiredResult,
} from '../services/cognitoAuth';
import { bffClient } from '../services/bffClient';
import { fetchUserProfile } from '../services/mypageApi';

interface User {
  sub: string;
  email: string;
  username: string;
  userid: number; // Moodle連携用（BFF JWT対応後に実値になる）
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  idToken: string | null;
  contentToken: string | null;
  avatarUrl: string | null;
  nickName: string | null;
  loading: boolean;
  needsNewPassword: boolean;
  login: (username: string, password: string) => Promise<'SUCCESS' | 'NEW_PASSWORD_REQUIRED'>;
  submitNewPassword: (newPassword: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [contentToken, setContentToken] = useState<string | null>(null);
  const [contentTokenExpiry, setContentTokenExpiry] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nickName, setNickName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [pendingCognitoUser, setPendingCognitoUser] = useState<CognitoUser | null>(null);
  const [pendingUserAttributes, setPendingUserAttributes] = useState<Record<string, string>>({});

  // 起動時にCognitoセッションを復元
  useEffect(() => {
    getCurrentSession()
      .then(async (result) => {
        if (result) {
          await setAuthFromResult(result);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Lambda@Edge の認証チェック用クッキーをセットする。
   * BFF から短命トークンを取得して document.cookie に書き込む。
   * SPA と コンテンツ CloudFront が同ドメインであるため Cookie が共有される。
   */
  const setContentAuthCookie = async () => {
    try {
      const { token, expiresAt } = await bffClient.getContentToken();
      const maxAge = Math.floor((expiresAt - Date.now()) / 1000);
      document.cookie = `cf_access=${token}; path=/; secure; SameSite=Lax; max-age=${maxAge}`;
      setContentToken(token);
      setContentTokenExpiry(expiresAt);
    } catch (e) {
      // コンテンツ認証クッキーのセットに失敗しても認証フロー自体は続行する
      console.warn('[Auth] Failed to set content auth cookie:', e);
    }
  };

  // トークン期限5分前に自動更新（CloudFront保護コンテンツが1時間で切れるのを防ぐ）
  useEffect(() => {
    if (!contentTokenExpiry) return;
    const delay = contentTokenExpiry - Date.now() - 5 * 60 * 1000;
    const timer = setTimeout(() => setContentAuthCookie(), Math.max(delay, 0));
    return () => clearTimeout(timer);
  }, [contentTokenExpiry]);

  const clearContentAuthCookie = () => {
    document.cookie = 'cf_access=; path=/; max-age=0';
  };

  const setAuthFromResult = async (result: CognitoAuthResult) => {
    setIdToken(result.idToken);
    setNeedsNewPassword(false);
    setPendingCognitoUser(null);

    const isAdmin = (result.groups || []).includes('admin');

    // BFFからMoodleユーザー情報を取得
    let moodleUserId = 0;
    try {
      const userInfo = await bffClient.getUserInfo();
      moodleUserId = userInfo.moodle?.id || 0;
      setUser({
        sub: result.sub,
        email: result.email,
        username: result.username,
        userid: moodleUserId,
        isAdmin,
      });
    } catch {
      // BFFが未対応の場合はCognito情報のみで設定
      setUser({
        sub: result.sub,
        email: result.email,
        username: result.username,
        userid: 0,
        isAdmin,
      });
    }

    // Lambda@Edge 用コンテンツ認証クッキーをセット
    await setContentAuthCookie();

    // アバター URL とニックネームを取得してキャッシュ
    if (moodleUserId) {
      fetchUserProfile(moodleUserId)
        .then((profile) => {
          setAvatarUrl(profile.avatar_url || null);
          setNickName(profile.nick_name || null);
        })
        .catch(() => {});
    }
  };

  const login = useCallback(async (username: string, password: string): Promise<'SUCCESS' | 'NEW_PASSWORD_REQUIRED'> => {
    const result = await cognitoSignIn(username, password);

    if ('type' in result && result.type === 'NEW_PASSWORD_REQUIRED') {
      const npResult = result as NewPasswordRequiredResult;
      setNeedsNewPassword(true);
      setPendingCognitoUser(npResult.cognitoUser);
      setPendingUserAttributes(npResult.userAttributes);
      return 'NEW_PASSWORD_REQUIRED';
    }

    await setAuthFromResult(result as CognitoAuthResult);
    return 'SUCCESS';
  }, []);

  const submitNewPassword = useCallback(async (newPassword: string) => {
    if (!pendingCognitoUser) {
      throw new Error('パスワード変更のセッションがありません');
    }

    const result = await completeNewPassword(pendingCognitoUser, newPassword, pendingUserAttributes);
    setAuthFromResult(result);
  }, [pendingCognitoUser, pendingUserAttributes]);

  const logout = useCallback(() => {
    cognitoSignOut();
    setUser(null);
    setIdToken(null);
    setContentToken(null);
    setContentTokenExpiry(null);
    setAvatarUrl(null);
    setNickName(null);
    setNeedsNewPassword(false);
    setPendingCognitoUser(null);
    clearContentAuthCookie();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.userid) return;
    const profile = await fetchUserProfile(user.userid);
    setAvatarUrl(profile.avatar_url || null);
    setNickName(profile.nick_name || null);
  }, [user?.userid]);

  return (
    <AuthContext.Provider value={{ user, idToken, contentToken, avatarUrl, nickName, loading, needsNewPassword, login, submitNewPassword, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
