import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { changePassword, updateEmail, verifyEmailChange } from '../services/cognitoAuth';
import { AppHeader } from './shared';
import { Button } from './ui/button';

type Mode = 'main' | 'emailVerify' | 'success';


function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mode, setMode] = useState<Mode>('main');
  const [emailInput, setEmailInput] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordRules = [
    { label: '8文字以上', test: (p: string) => p.length >= 8 },
    { label: '大文字を含む', test: (p: string) => /[A-Z]/.test(p) },
    { label: '小文字を含む', test: (p: string) => /[a-z]/.test(p) },
    { label: '数字を含む', test: (p: string) => /[0-9]/.test(p) },
    { label: '記号を含む', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  ];

  const inputClass = 'w-full px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent';
  const inputStyle: React.CSSProperties = {
    background: '#FAF8F4',
    borderRadius: '12px',
    color: '#7E6E68',
    fontSize: '14px',
    fontWeight: 400,
  };

  const handleSave = async () => {
    const emailChanged = emailInput !== user?.email && emailInput !== '';
    const passwordChanged = newPassword !== '';

    if (!emailChanged && !passwordChanged) {
      setMode('success');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (passwordChanged) {
        const failed = passwordRules.filter(r => !r.test(newPassword));
        if (failed.length > 0) {
          setError(`パスワードの要件を満たしていません: ${failed.map(r => r.label).join('、')}`);
          return;
        }
        if (!currentPassword) {
          setError('現在のパスワードを入力してください');
          return;
        }
        await changePassword(currentPassword, newPassword);
      }

      if (emailChanged) {
        await updateEmail(emailInput);
        setMode('emailVerify');
        return;
      }

      setMode('success');
    } catch (e: any) {
      if (e.code === 'NotAuthorizedException') {
        setError('現在のパスワードが正しくありません');
      } else if (e.code === 'AliasExistsException') {
        setError('このメールアドレスはすでに使用されています');
      } else {
        setError(e.message || 'エラーが発生しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerify = async () => {
    if (!verifyCode) { setError('確認コードを入力してください'); return; }
    setLoading(true); setError('');
    try {
      await verifyEmailChange(verifyCode);
      setMode('success');
    } catch (e: any) {
      setError(e.code === 'CodeMismatchException' ? '確認コードが正しくありません' : e.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      <div className="relative flex-1">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[1152px] h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(232,109,120,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px' }} />
          <div className="absolute w-[1152px] h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(250,145,97,0.3) 0%, transparent 70%)', top: '-100px', right: '-400px' }} />
        </div>

        <main className="relative max-w-[480px] mx-auto px-4 sm:px-6 py-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-brand-bg hover:bg-[#F0EAE6] border border-brand-bg flex items-center justify-center transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5 text-[#5D5555]" />
          </button>

          <div className="bg-white rounded-3xl shadow-sm p-8">

            {/* ===== SUCCESS ===== */}
            {mode === 'success' && (
              <div className="flex flex-col items-center py-6 gap-4">
                <CheckCircle className="w-14 h-14 text-green-500" />
                <p className="text-base font-bold text-center text-brand-text">
                  設定を変更しました
                </p>
                <Button
                  onClick={() => navigate(-1)}
                  variant="brand"
                  size="pill"
                  className="mt-2 px-8"
                >
                  戻る
                </Button>
              </div>
            )}

            {/* ===== EMAIL VERIFY ===== */}
            {mode === 'emailVerify' && (
              <>
                <h2 className="font-bold mb-6 text-brand-muted" style={{ fontSize: '20px' }}>
                  メールアドレスの確認
                </h2>
                <p className="text-sm mb-4 text-brand-text">
                  <span className="font-bold">{emailInput}</span> に確認コードを送信しました。
                </p>
                <div className="mb-4">
                  <label className="block text-xs font-bold mb-1 text-brand-muted">確認コード</label>
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value)}
                    className={inputClass + ' tracking-widest'}
                    style={inputStyle}
                    placeholder="6桁のコード"
                    maxLength={6}
                  />
                </div>
                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
                <div className="flex gap-3 mt-4">
                  <Button onClick={() => navigate(-1)} variant="brand-ghost" size="pill" className="flex-1">
                    キャンセル
                  </Button>
                  <Button onClick={handleEmailVerify} disabled={loading} variant="brand" size="pill" className="flex-1">
                    {loading ? '処理中...' : '確認する'}
                  </Button>
                </div>
              </>
            )}

            {/* ===== MAIN ===== */}
            {mode === 'main' && (
              <>
                <h2 className="font-bold mb-6 text-brand-muted" style={{ fontSize: '24px' }}>
                  アカウント設定
                </h2>

                <div className="mb-5">
                  <p className="font-bold mb-3 text-brand-muted" style={{ fontSize: '14px' }}>
                    ログイン情報
                  </p>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-brand-muted" style={{ fontSize: '13px', fontWeight: 700 }}>
                        メールアドレス
                      </p>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        className={inputClass}
                        style={inputStyle}
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-brand-muted" style={{ fontSize: '13px', fontWeight: 700 }}>
                        現在のパスワード
                      </p>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          className={inputClass + ' pr-10'}
                          style={inputStyle}
                          placeholder="現在のパスワードを入力"
                        />
                        <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted">
                          {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-brand-muted" style={{ fontSize: '13px', fontWeight: 700 }}>
                        新しいパスワード
                      </p>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          className={inputClass + ' pr-10'}
                          style={inputStyle}
                          placeholder="変更する場合は新しいパスワードを入力"
                        />
                        <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted">
                          {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {newPassword && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {passwordRules.map(r => (
                            <span
                              key={r.label}
                              className="text-xs"
                              style={{ color: r.test(newPassword) ? '#4CAF50' : '#C2B9B3' }}
                            >
                              {r.test(newPassword) ? '✓' : '✗'} {r.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

                <Button
                  onClick={handleSave}
                  disabled={loading}
                  variant="brand"
                  className="w-full"
                  style={{ height: '52px', borderRadius: '12px', fontSize: '16px' }}
                >
                  {loading ? '処理中...' : '変更する'}
                </Button>
              </>
            )}

          </div>
        </main>
      </div>

      <footer className="bg-brand-footer h-10 flex items-center justify-center">
        <span className="text-[11.4px] font-bold text-white" style={{ letterSpacing: '0.6px' }}>
          2026 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

export default AccountSettingsPage;
