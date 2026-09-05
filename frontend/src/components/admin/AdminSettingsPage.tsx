import React, { useEffect, useState, useCallback } from 'react';
import { Video, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../ui/button';
import bffClient from '../../services/bffClient';

interface OrganizerStatus {
  provider: string;
  connected: boolean;
  providerAccountEmail?: string | null;
  expiresAt?: string;
  connectedAt?: string;
}

export function AdminSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<OrganizerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const loadStatus = useCallback(() => {
    setLoading(true);
    setError(null);
    bffClient.getOrganizerIntegrationStatus()
      .then(data => setStatus(data))
      .catch(() => setError('連携状態の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // OAuthコールバック後のリダイレクト（?connected=google&status=success|error）を処理
  const connectedResult = searchParams.get('connected');
  const connectedStatus = searchParams.get('status');
  useEffect(() => {
    if (connectedResult) {
      loadStatus();
      searchParams.delete('connected');
      searchParams.delete('status');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedResult]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { authorizeUrl } = await bffClient.getOrganizerIntegrationAuthorizeUrl('google');
      window.location.href = authorizeUrl;
    } catch {
      setError('Google Meetとの連携開始に失敗しました');
      setConnecting(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold mb-6" style={{ color: '#4B3A33' }}>連携設定</h1>

      {connectedResult === 'google' && connectedStatus === 'success' && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: '#E9F7EF', color: '#2E7D46' }}>
          Google Meetとの連携が完了しました。
        </div>
      )}
      {connectedResult === 'google' && connectedStatus === 'error' && (
        <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: '#FDEEEE', color: '#E86D78' }}>
          Google Meetとの連携に失敗しました。もう一度お試しください。
        </div>
      )}

      <div className="bg-white rounded-2xl overflow-hidden max-w-[640px]" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}>
          <span className="text-sm font-bold text-white">Google Meet連携（会社共有アカウント）</span>
        </div>

        <div style={{ borderColor: '#F5F0ED' }}>
          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: '#7E6E68' }}>読み込み中...</div>
          ) : error ? (
            <div className="py-12 text-center text-sm" style={{ color: '#E86D78' }}>{error}</div>
          ) : (
            <div className="flex items-center gap-4 px-5 py-5">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#EDE8E3' }}
              >
                <Video className="w-5 h-5" style={{ color: '#7E6E68' }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: '#4B3A33' }}>Google Meet</p>
                <p className="text-xs mt-0.5" style={{ color: '#7E6E68' }}>
                  {status?.connected
                    ? `連携済み${status.providerAccountEmail ? `（${status.providerAccountEmail}）` : ''}`
                    : '会社共有のGoogle Workspaceアカウントを一度接続すると、全コーチのミーティングで利用できるようになります。'}
                </p>
              </div>

              {status?.connected ? (
                <span
                  className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold flex-shrink-0"
                  style={{ background: '#E9F7EF', color: '#2E7D46' }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  連携済み
                </span>
              ) : (
                <Button
                  variant="brand-gradient"
                  size="pill-sm"
                  disabled={connecting}
                  onClick={handleConnect}
                  className="flex-shrink-0"
                >
                  {connecting ? '接続中...' : 'Google Meetと連携する'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
