import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { MOCKS_ENABLED } from '../mocks/config';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, submitNewPassword, needsNewPassword, user } = useAuth();

  // モック時は自動ログイン済みなので、ログイン画面に来たら /mypage へ送る。
  // ただし userid が未解決（0）のときはリダイレクトしない
  // （SW取りこぼし等で userid=0 になった場合に /mypage⇄/login の無限ループを防ぐ）。
  useEffect(() => {
    if (MOCKS_ENABLED && user?.userid) {
      navigate('/mypage', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await login(username, password);
      if (result === 'SUCCESS') {
        navigate('/mypage');
      }
      // NEW_PASSWORD_REQUIRED の場合は AuthContext が needsNewPassword を true にする
    } catch (err: any) {
      const code = err?.code || err?.name || '';
      if (code === 'NotAuthorizedException') {
        if (err.message?.includes('Temporary password has expired')) {
          setError('仮パスワードの有効期限が切れています。管理者にお問い合わせください。');
        } else {
          setError('メールアドレスまたはパスワードが正しくありません');
        }
      } else if (code === 'UserNotFoundException') {
        setError('ユーザーが見つかりません');
      } else if (code === 'UserNotConfirmedException') {
        setError('メールアドレスの確認が完了していません');
      } else {
        setError(err.message || 'ログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setLoading(true);

    try {
      await submitNewPassword(newPassword);
      navigate('/mypage');
    } catch (err: any) {
      const code = err?.code || err?.name || '';
      if (code === 'InvalidPasswordException') {
        setError('パスワードは大文字・小文字・数字を含む8文字以上にしてください');
      } else {
        setError(err.message || 'パスワードの変更に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Background with gradient circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div
          className="absolute w-[500px] h-[500px] sm:w-[800px] sm:h-[800px] lg:w-[1152px] lg:h-[1152px] rounded-full blur-[200px] sm:blur-[300px] lg:blur-[400px]"
          style={{ background: '#E17079', top: '-288px', left: '-288px' }}
        />
        <div
          className="absolute w-[500px] h-[500px] sm:w-[800px] sm:h-[800px] lg:w-[1152px] lg:h-[1152px] rounded-full blur-[200px] sm:blur-[300px] lg:blur-[400px]"
          style={{ background: '#FDEAE2', top: '-288px', right: '-288px' }}
        />
        <div
          className="absolute w-[500px] h-[500px] sm:w-[800px] sm:h-[800px] lg:w-[1152px] lg:h-[1152px] rounded-full blur-[200px] sm:blur-[300px] lg:blur-[400px]"
          style={{ background: '#F29367', top: '160px', left: '144px' }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 relative">
        <div
          className="w-full max-w-[448px] bg-white/95 backdrop-blur-[10px] rounded-3xl shadow-sm px-5 py-8 sm:px-8 sm:py-12 lg:px-10 lg:py-[60px]"
          style={{ borderRadius: '24px' }}
        >
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-10">
            <div className="mb-4">
              <img
                src={`${process.env.PUBLIC_URL}/logo_WEBCOACH.png`}
                alt="WEBCOACH"
                className="h-12 sm:h-16 w-auto object-contain"
              />
            </div>
            <div className="text-center">
              <p
                className="text-xl sm:text-2xl lg:text-[28px] font-bold text-brand-muted mb-3.5"
              >
                学習システム
              </p>
              <p
                className="text-sm font-medium text-brand-muted"
              >
                未来の自分を、いま作る。
              </p>
            </div>
          </div>

          {needsNewPassword ? (
            /* New Password Form */
            <form onSubmit={handleNewPassword} className="space-y-6">
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                初回ログインのためパスワードの変更が必要です
              </div>

              <div>
                <label
                  className="block text-[13px] font-bold text-[#5D5555] mb-1.5"
                >
                  新しいパスワード
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    required
                    placeholder="8文字以上（大文字・小文字・数字を含む）"
                    className="w-full h-12 px-4 pr-12 bg-brand-bg border border-[#CEC3BB] rounded-xl text-sm text-brand-muted placeholder:text-brand-muted/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0 bg-transparent border-0 cursor-pointer text-brand-muted/50 hover:text-brand-muted transition-colors flex items-center"
                    tabIndex={-1}
                  >
                    <EyeIcon open={showNewPassword} />
                  </button>
                </div>
              </div>

              <div>
                <label
                  className="block text-[13px] font-bold text-[#5D5555] mb-1.5"
                >
                  パスワード確認
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    placeholder="もう一度入力してください"
                    className="w-full h-12 px-4 pr-12 bg-brand-bg border border-[#CEC3BB] rounded-xl text-sm text-brand-muted placeholder:text-brand-muted/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0 bg-transparent border-0 cursor-pointer text-brand-muted/50 hover:text-brand-muted transition-colors flex items-center"
                    tabIndex={-1}
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                variant="brand"
                className="w-full h-11 sm:h-[52px] rounded-xl text-base"
                style={{
                  boxShadow: '0 4px 6px -4px rgba(232,109,120,0.3), 0 10px 15px -3px rgba(232,109,120,0.3)',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    変更中...
                  </span>
                ) : (
                  'パスワードを変更してログイン'
                )}
              </Button>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label
                  className="block text-[13px] font-bold text-[#5D5555] mb-1.5"
                >
                  メールアドレス
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  placeholder="user@example.com"
                  className="w-full h-12 px-4 bg-brand-bg border border-[#CEC3BB] rounded-xl text-sm text-brand-muted placeholder:text-brand-muted/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="text-[13px] font-bold text-[#5D5555]"
                  >
                    パスワード
                  </label>
                  <span
                    onClick={() => navigate('/password-reset')}
                    className="text-[10px] text-[#E86D78]/70 cursor-pointer"
                  >
                    パスワードお忘れですか？
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="パスワードを入力"
                    className="w-full h-12 px-4 pr-12 bg-brand-bg border border-[#CEC3BB] rounded-xl text-sm text-brand-muted placeholder:text-brand-muted/40 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0 bg-transparent border-0 cursor-pointer text-brand-muted/50 hover:text-brand-muted transition-colors flex items-center"
                    tabIndex={-1}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                variant="brand"
                className="w-full h-11 sm:h-[52px] rounded-xl text-base"
                style={{
                  boxShadow: '0 4px 6px -4px rgba(232,109,120,0.3), 0 10px 15px -3px rgba(232,109,120,0.3)',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ログイン中...
                  </span>
                ) : (
                  'ログイン'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative bg-brand-footer h-10 flex items-center justify-center">
        <span
          className="text-[11.4px] font-bold text-white"
          style={{ letterSpacing: '0.6px' }}
        >
          2026 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

export default LoginPage;
