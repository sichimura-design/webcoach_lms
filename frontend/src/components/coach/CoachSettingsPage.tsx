/**
 * コーチ向け 連携設定（/coach/settings）。
 *
 * 色・角丸・影・文字は index.css の --dc-*（.wc-warm スコープ）。
 * 🔴 ルート要素の className に wc-warm が必要（CoachStudentsPage と同じ理由）。
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Video, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '../shared/AppHeader';
import { AppFooter } from '../shared/AppFooter';
import { useAuth } from '../../contexts/AuthContext';
import bffClient from '../../services/bffClient';

// Google Meetはコーチ個別OAuthではなく、会社共有のOrganizerアカウントを管理者が
// 一度だけ接続するOrganizer中心モデルに移行したため、コーチ向け連携先ではない。
type Provider = 'zoom';

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
};

const cardStyle: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
};

/** 完了・失敗のバナー。連携直後のリダイレクトで1回だけ出る */
function Banner({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <div
      role="status"
      style={{
        padding: '12px 16px',
        marginBottom: 14,
        borderRadius: 'var(--dc-radius-md)',
        background: tone === 'success' ? 'var(--dc-success-surface)' : 'var(--dc-soft-100)',
        color: tone === 'success' ? 'var(--dc-success)' : 'var(--dc-primary)',
        fontSize: 'var(--dc-fs-body)',
        fontWeight: 500,
        lineHeight: 'var(--dc-lh-ui)',
      }}
    >
      {children}
    </div>
  );
}

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

  /*
   * OAuthコールバック後のリダイレクト（?connected=zoom&status=success|error）を処理。
   * 🔴 バナーの内容は state に写してから、クエリを消す。
   *    searchParams を直接読んで描いていると、同じ useEffect が消したクエリで
   *    即座に再描画されて、バナーが1フレームも出ないまま消える。
   */
  const [banner, setBanner] = useState<{ provider: string; ok: boolean } | null>(null);
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (!connected) return;
    setBanner({ provider: connected, ok: searchParams.get('status') === 'success' });
    loadStatus();
    searchParams.delete('connected');
    searchParams.delete('status');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="wc-warm min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username} />

      <div
        className="wc-page flex-1"
        style={{ '--wc-page-max': '860px' } as React.CSSProperties}
      >
        <h1
          style={{
            margin: '0 0 20px',
            fontSize: 'var(--dc-fs-display)',
            fontWeight: 700,
            letterSpacing: '-.01em',
            lineHeight: 'var(--dc-lh-heading)',
            color: 'var(--dc-text)',
          }}
        >
          連携設定
        </h1>

        {banner && (
          <Banner tone={banner.ok ? 'success' : 'error'}>
            {PROVIDER_META[banner.provider as Provider]?.label ?? banner.provider}
            {banner.ok ? 'との連携が完了しました。' : 'との連携に失敗しました。もう一度お試しください。'}
          </Banner>
        )}

        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--dc-border)' }}>
            <span style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: 700, color: 'var(--dc-text)' }}>
              ミーティング連携
            </span>
          </div>

          {loading ? (
            <p
              style={{
                margin: 0, padding: '56px 24px', textAlign: 'center',
                fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)',
              }}
            >
              読み込み中…
            </p>
          ) : error ? (
            <p
              style={{
                margin: 0, padding: '56px 24px', textAlign: 'center',
                fontSize: 'var(--dc-fs-body)', color: 'var(--dc-primary)',
              }}
            >
              {error}
            </p>
          ) : (
            (Object.keys(PROVIDER_META) as Provider[]).map((provider, i) => {
              const meta = PROVIDER_META[provider];
              const connected = isConnected(provider);
              const integration = getIntegration(provider);

              return (
                <div
                  key={provider}
                  className="coach-setting-row"
                  style={{
                    padding: '20px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--dc-rule)',
                  }}
                >
                  <span
                    style={{
                      width: 44, height: 44, flex: 'none',
                      borderRadius: '50%',
                      background: 'var(--dc-badge-pink)',
                      color: 'var(--dc-primary)',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <Video size={20} strokeWidth={2} />
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 'var(--dc-fs-lead)', fontWeight: 600,
                        color: 'var(--dc-text)', lineHeight: 'var(--dc-lh-heading)',
                      }}
                    >
                      {meta.label}
                    </p>
                    <p
                      style={{
                        margin: '2px 0 0',
                        fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)',
                        lineHeight: 'var(--dc-lh-prose)',
                      }}
                    >
                      {connected
                        ? `連携済み${integration?.provider_account_email ? `（${integration.provider_account_email}）` : ''}`
                        : meta.description}
                    </p>
                  </div>

                  <span className="coach-setting-action">
                  {connected ? (
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px',
                        borderRadius: 999,
                        background: 'var(--dc-success-surface)',
                        color: 'var(--dc-success)',
                        fontSize: 'var(--dc-fs-caption)', fontWeight: 600,
                      }}
                    >
                      <CheckCircle2 size={14} strokeWidth={2.25} />
                      連携済み
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={connectingProvider === provider}
                      onClick={() => handleConnect(provider)}
                      className="dc-cta-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                      style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '11px 20px',
                        border: 0,
                        borderRadius: 'var(--dc-radius-md)',
                        background: 'var(--dc-primary)',
                        color: '#fff',
                        fontFamily: 'inherit',
                        fontSize: 'var(--dc-fs-body)', fontWeight: 600,
                        cursor: connectingProvider === provider ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {connectingProvider === provider ? '接続中…' : `${meta.label}と連携する`}
                    </button>
                  )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
