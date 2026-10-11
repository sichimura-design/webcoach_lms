import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import bffClient, { AiModelInfo, ExpiryLevel, ExpiryStatusResponse } from '../../services/bffClient';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { getUserMessage } from '../../utils/errorMessage';

const LEVEL_STYLE: Record<ExpiryLevel, { label: string; background: string; color: string }> = {
  ok: { label: '問題なし', background: color.successSurface, color: color.success },
  warning: { label: 'もうすぐ期限', background: color.goalBg, color: color.goalText },
  danger: { label: '要対応', background: color.primarySoft, color: color.primary },
  expired: { label: '期限切れ', background: color.primarySoft, color: color.primary },
  error: { label: '確認できません', background: color.primarySoft, color: color.primary },
  none: { label: '未連携', background: color.hoverBg, color: color.textSecondary },
};

function Badge({ level }: { level: ExpiryLevel }) {
  const s = LEVEL_STYLE[level];
  return (
    <span
      style={{
        background: s.background,
        color: s.color,
        borderRadius: radius.pill,
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ ...t.card, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ ...font.cardHeading, color: color.text }}>{title}</div>
      <p style={{ ...font.meta, color: color.textSecondary, margin: '4px 0 12px', lineHeight: 1.7 }}>{description}</p>
      {children}
    </div>
  );
}

function Row({ title, level, children }: { title: string; level: ExpiryLevel; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderTop: `1px solid ${color.divider}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: color.text, wordBreak: 'break-all' }}>{title}</div>
        <div style={{ ...font.meta, color: color.textBody, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
          {children}
        </div>
      </div>
      <Badge level={level} />
    </div>
  );
}

function aiModelLevel(model: AiModelInfo): ExpiryLevel {
  const life = model.lifecycle;
  if (!model.id || !life) return 'error';
  if (life.state !== 'active') return 'danger';
  return life.warning ? 'warning' : 'ok';
}

/** 証明書・Google連携・AIモデルなど、期限があるものをまとめて確かめる画面 */
export function AdminExpiryPage() {
  const [status, setStatus] = useState<ExpiryStatusResponse | null>(null);
  const [aiModel, setAiModel] = useState<AiModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.allSettled([bffClient.getExpiryStatus(), bffClient.getRuntimeSettings()])
      .then(([expiry, runtime]) => {
        if (expiry.status === 'fulfilled') setStatus(expiry.value);
        else setError(getUserMessage(expiry.reason, '期限の確認に失敗しました'));
        setAiModel(runtime.status === 'fulfilled' ? runtime.value.aiModel : null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const google = status?.google;
  const th = status?.thresholds;

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ ...font.sectionTitle, fontSize: 22, color: color.text, margin: '0 0 6px' }}>期限管理</h1>
          <p style={{ ...font.meta, color: color.textSecondary, margin: 0 }}>
            この画面を開いた時点で実際に確かめた結果です
            {status && `(${formatDateTime(status.checkedAt)}時点)`}。
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          style={{ ...t.outlineButton, padding: '8px 14px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} />
          {loading ? '確認中...' : 'もう一度確認'}
        </button>
      </div>

      {error && (
        <div style={{ background: color.primarySoft, color: color.primary, borderRadius: radius.md, padding: '12px 16px', fontSize: 13.5, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && !status ? (
        <div style={{ ...t.card, padding: '40px 20px', textAlign: 'center', ...font.meta, color: color.textSecondary }}>確認中...</div>
      ) : status && (
        <>
          <Section
            title="SSL証明書"
            description={`公開ドメインへ実際に接続して、配信中の証明書の有効期限を読んでいます。AWSの証明書(ACM)は期限の約60日前から自動で更新されるため、残り${th?.warnDays ?? 30}日を切っている場合は自動更新が止まっている可能性があります(DNSの検証用レコードが消えていないか確認してください)。`}
          >
            {status.certificates.length === 0 ? (
              <p style={{ ...font.meta, color: color.textSecondary, margin: 0 }}>
                確認するドメインがありません(この環境はhttpsの公開URLが設定されていません)。
              </p>
            ) : (
              status.certificates.map(cert => (
                <Row key={cert.host} title={cert.host} level={cert.status}>
                  {cert.error && <span style={{ color: color.primary }}>{cert.error}</span>}
                  {cert.validTo && (
                    <span>
                      有効期限: <strong>{formatDate(cert.validTo)}</strong>(あと{cert.daysLeft}日)
                    </span>
                  )}
                  {cert.validFrom && <span>発行日: {formatDate(cert.validFrom)}</span>}
                  {cert.issuer && <span>発行元: {cert.issuer}</span>}
                </Row>
              ))
            )}
          </Section>

          <Section
            title="Google Meet連携(会社共有アカウント)"
            description="Googleの連携には決まった有効期限日がありません(1時間ごとの更新は自動で行われます)。代わりに、パスワード変更・アクセスの取り消し・6か月以上使われない・OAuth同意画面が「テスト」のまま(7日で失効)などで突然使えなくなるため、保存済みの連携情報で実際に更新できるかを確かめています。"
          >
            {google && (
              <Row title={google.providerAccountEmail || 'Google Meet'} level={google.status}>
                {!google.configured && <span>この環境にはGoogle連携の設定(OAuthクライアント)がありません。</span>}
                {google.configured && google.connected === false && (
                  <span>
                    未連携です。<Link to="/admin/settings" style={{ color: color.primary }}>連携設定</Link>から接続してください。
                  </span>
                )}
                {google.connected && (
                  <>
                    <span>
                      更新の確認: <strong>{google.refreshOk ? '成功' : '失敗'}</strong>
                    </span>
                    {google.connectedAt && <span>接続日: {formatDate(google.connectedAt)}</span>}
                  </>
                )}
                {google.refreshError && (
                  <span style={{ color: color.primary }}>
                    {google.refreshError === 'invalid_grant'
                      ? '連携が取り消されたか失効しています。連携設定から接続し直してください(Google Meetの発行が止まります)。'
                      : `確認できませんでした(${google.refreshError})。時間をおいてもう一度確認してください。`}
                  </span>
                )}
              </Row>
            )}
          </Section>

          <Section
            title="AIモデルの提供期限"
            description="AIチャット・ノート生成で使っているClaudeのモデルの提供終了予定です。詳しくは動作設定の画面を参照してください。"
          >
            {aiModel ? (
              <Row title={aiModel.id ?? '取得できません'} level={aiModelLevel(aiModel)}>
                {aiModel.lifecycle?.stateLabel && <span>状態: {aiModel.lifecycle.stateLabel}</span>}
                {aiModel.lifecycle?.retirementOn && (
                  <span>
                    提供終了: <strong>{formatDate(aiModel.lifecycle.retirementOn)}</strong>
                    {aiModel.lifecycle.retirementNotSoonerThan ? '以降(目安)' : ''}
                    {aiModel.lifecycle.daysUntilRetirement != null && `(あと${aiModel.lifecycle.daysUntilRetirement}日)`}
                  </span>
                )}
                <Link to="/admin/runtime-settings" style={{ color: color.primary }}>動作設定を開く</Link>
              </Row>
            ) : (
              <p style={{ ...font.meta, color: color.primary, margin: 0 }}>AIモデルの情報を取得できませんでした。</p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
