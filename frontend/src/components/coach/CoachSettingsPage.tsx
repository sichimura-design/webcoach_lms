import React, { useEffect, useState, useCallback } from 'react';
import { Video, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '../shared/AppHeader';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import bffClient from '../../services/bffClient';

type Provider = 'zoom' | 'google';

interface IntegrationInfo {
  provider: string;
  provider_account_email: string | null;
  connected_at: string;
  updated_at: string;
}

const PROVIDER_META: Record<Provider, { label: string; description: string }> = {
  zoom: {
    label: 'Zoom',
    description: 'Zoomと連携すると、コーチングで利用したミーティングの情報を取得できるようになります。',
  },
  google: {
    label: 'Google Meet',
    description: 'Google Meetと連携すると、コーチングで利用したミーティングの情報を取得できるようになります。',
  },
};

export function CoachSettingsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<Provider | null>(null);

  const loadStatus = useCallback(() => {
    setLoading(true);
    bffClient.getMeetingIntegrationStatus()
      .then(data => setIntegrations(data.integrations))
      .catch(() => setError('連携状態の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // OAuthコールバック後のリダイレクト（?connected=zoom&status=success|error）を処理
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

  const handleConnect = async (provider: Provider) => {
    setConnectingProvider(provider);
    try {
      const { authorizeUrl } = await bffClient.getMeetingIntegrationAuthorizeUrl(provider);
      window.location.href = authorizeUrl;
    } catch {
      setError(`${PROVIDER_META[provider].label}との連携開始に失敗しました`);
      setConnectingProvider(null);
    }
  };

  const isConnected = (provider: Provider) =>
    integrations.some(i => i.provider === provider);

  const getIntegration = (provider: Provider) =>
    integrations.find(i => i.provider === provider);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20" style={{ zIndex: 0 }}>
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px', filter: 'blur(40px)' }} />
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(253,234,226,0.5) 0%, transparent 70%)', top: '-100px', right: '-400px', filter: 'blur(40px)' }} />
        <div className="absolute w-[900px] h-[900px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(242,147,103,0.3) 0%, transparent 70%)', bottom: '-300px', left: '30%', filter: 'blur(40px)' }} />
      </div>

      <div className="relative flex-1 max-w-[860px] w-full mx-auto px-4 sm:px-6 py-8 pb-24 sm:pb-8" style={{ zIndex: 1 }}>
        <h1 className="text-xl sm:text-2xl font-bold mb-6" style={{ color: '#4B3A33' }}>連携設定</h1>

        {connectedResult && connectedStatus === 'success' && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: '#E9F7EF', color: '#2E7D46' }}>
            {PROVIDER_META[connectedResult as Provider]?.label ?? connectedResult}との連携が完了しました。
          </div>
        )}
        {connectedResult && connectedStatus === 'error' && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: '#FDEEEE', color: '#E86D78' }}>
            {PROVIDER_META[connectedResult as Provider]?.label ?? connectedResult}との連携に失敗しました。もう一度お試しください。
          </div>
        )}

        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}>
            <span className="text-sm font-bold text-white">ミーティング連携</span>
          </div>

          <div className="divide-y" style={{ borderColor: '#F5F0ED' }}>
            {loading ? (
              <div className="py-12 text-center text-sm" style={{ color: '#7E6E68' }}>読み込み中...</div>
            ) : error ? (
              <div className="py-12 text-center text-sm" style={{ color: '#E86D78' }}>{error}</div>
            ) : (
              (Object.keys(PROVIDER_META) as Provider[]).map(provider => {
                const meta = PROVIDER_META[provider];
                const connected = isConnected(provider);
                const integration = getIntegration(provider);

                return (
                  <div key={provider} className="flex items-center gap-4 px-5 py-5">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: '#EDE8E3' }}
                    >
                      <Video className="w-5 h-5" style={{ color: '#7E6E68' }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: '#4B3A33' }}>{meta.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#7E6E68' }}>
                        {connected
                          ? `連携済み${integration?.provider_account_email ? `（${integration.provider_account_email}）` : ''}`
                          : meta.description}
                      </p>
                    </div>

                    {connected ? (
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
                        disabled={connectingProvider === provider}
                        onClick={() => handleConnect(provider)}
                        className="flex-shrink-0"
                      >
                        {connectingProvider === provider ? '接続中...' : `${meta.label}と連携する`}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-8" style={{ color: '#C3BAB4' }}>2026 © WEBCOACH</p>
      </div>
    </div>
  );
}
