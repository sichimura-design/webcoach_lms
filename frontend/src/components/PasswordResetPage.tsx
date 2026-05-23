import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { forgotPassword, confirmForgotPassword } from '../services/cognitoAuth';
import { Button } from './ui/button';

type Step = 'email' | 'code' | 'done';

function PasswordResetPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCognitoErrorMessage = (err: any): string => {
    const code = err?.code || err?.name || '';
    switch (code) {
      case 'UserNotFoundException':
        return 'このメールアドレスは登録されていません。';
      case 'LimitExceededException':
        return 'リクエスト回数の上限に達しました。しばらくしてから再試行してください。';
      case 'CodeMismatchException':
        return '認証コードが正しくありません。';
      case 'ExpiredCodeException':
        return '認証コードの有効期限が切れています。再送信してください。';
      case 'InvalidPasswordException':
        return 'パスワードは8文字以上で、大文字・小文字・数字を含めてください。';
      case 'InvalidParameterException':
        return '入力内容が正しくありません。';
      default:
        return err?.message || 'エラーが発生しました。もう一度お試しください。';
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
      setStep('code');
    } catch (err: any) {
      setError(getCognitoErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }
    setLoading(true);
    try {
      await confirmForgotPassword(email, code, newPassword);
      setStep('done');
    } catch (err: any) {
      setError(getCognitoErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email);
    } catch (err: any) {
      setError(getCognitoErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full h-[46px] px-4 bg-[#FAF8F4] text-sm text-[#7E6E68] placeholder:text-[#C2B9B3] focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors';
  const inputStyle = { borderRadius: '12px' };

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
        <div className="w-full max-w-[448px] bg-white/95 backdrop-blur-[10px] rounded-3xl shadow-sm pt-5 pb-10 px-6 sm:px-10" style={{ borderRadius: '24px' }}>

          {/* Back button + Title */}
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => step === 'code' ? setStep('email') : navigate('/login')}
              className="w-10 h-10 rounded-full bg-brand-bg hover:bg-[#F0EAE6] flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#5D5555]" />
            </button>
            <h1 className="text-xl font-bold text-brand-muted">
              パスワードの再設定
            </h1>
          </div>

          {/* Step 1: Email Input */}
          {step === 'email' && (
            <>
              <p className="text-sm text-brand-muted mb-6">
                登録メールアドレスを入力してください。認証コードを送信します。
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-sm text-red-600 rounded-xl">
                  {error}
                </div>
              )}

              <form onSubmit={handleSendCode} className="space-y-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                  placeholder="user@example.com"
                  className={inputClass}
                  style={inputStyle}
                />
                <Button
                  type="submit"
                  disabled={loading}
                  variant="brand-gradient"
                  className="w-full"
                  style={{ height: '52px', borderRadius: '12px', fontSize: '16px' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      送信中...
                    </span>
                  ) : '送信する'}
                </Button>
              </form>
            </>
          )}

          {/* Step 2: Code + New Password */}
          {step === 'code' && (
            <>
              <p className="text-sm text-brand-muted mb-2">
                <span className="font-bold">{email}</span> に認証コードを送信しました。新しいパスワードと合わせて入力してください。
              </p>
              <p className="text-xs text-brand-muted mb-6">
                メールが届かない場合は、迷惑メールフォルダもご確認ください。
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-sm text-red-600 rounded-xl">
                  {error}
                </div>
              )}

              <form onSubmit={handleConfirmPassword} className="space-y-4" autoComplete="off">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  required
                  placeholder="認証コード（6桁）"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className={inputClass + ' tracking-widest'}
                  style={inputStyle}
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="新しいパスワード"
                  autoComplete="new-password"
                  className={inputClass}
                  style={inputStyle}
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="新しいパスワード（確認）"
                  autoComplete="new-password"
                  className={inputClass}
                  style={inputStyle}
                />
                <Button
                  type="submit"
                  disabled={loading}
                  variant="brand-gradient"
                  className="w-full"
                  style={{ height: '52px', borderRadius: '12px', fontSize: '16px' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      確認中...
                    </span>
                  ) : 'パスワードを再設定'}
                </Button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="w-full text-sm text-brand-muted hover:opacity-70 disabled:opacity-30 transition-opacity underline"
                >
                  認証コードを再送信
                </button>
              </form>
            </>
          )}

          {/* Step 3: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center py-6 gap-4">
              <CheckCircle className="w-14 h-14 text-green-500" />
              <div className="text-center">
                <p className="text-base font-bold text-brand-text mb-1">
                  パスワードを再設定しました
                </p>
                <p className="text-sm text-brand-muted">
                  新しいパスワードでログインしてください。
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate('/login')}
                variant="brand-gradient"
                className="mt-2 px-8"
                style={{ height: '52px', borderRadius: '12px', fontSize: '16px' }}
              >
                ログインページへ
              </Button>
            </div>
          )}

        </div>
      </div>

      <footer className="relative bg-brand-footer h-10 flex items-center justify-center">
        <span className="text-[11.4px] font-bold text-white" style={{ letterSpacing: '0.6px' }}>
          2024 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

export default PasswordResetPage;
