/**
 * コーチ向け AIコーチングノートの利用設定ページ（`/connect/:token`）。
 *
 * コーチ用のLMSは作らない。コーチがLMSで目にする画面はここ1枚だけで、
 * しかも初回セットアップの1回きり。そのため**未ログインで到達できる必要がある**
 * （routes/index.tsx で ProtectedRoute の外に置いている）。本番実装でも同様にすること。
 *
 * 重要な条件: 会議リンクを発行したアカウントと、ここで連携するアカウントが
 * 一致している必要がある。一致していないと録画・文字起こしを取得できないので、
 * 画面上でも明示する。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Check, Loader2, Lock, ShieldCheck, Video } from 'lucide-react';
import bffClient from '../services/bffClient';
import { color, font, radius, t } from '../theme/webcoachTheme';
import { CONNECTION_STATUS_LABEL } from '../types/coaching';
import type { ConnectionInvite, MeetingConnection, MeetingProviderId } from '../types/coaching';

type Phase = 'loading' | 'ready' | 'connecting' | 'done' | 'expired' | 'notfound' | 'failed';

const SCOPE_NOTES = [
  'WEBCOACHに登録された、担当受講生とのコーチング面談の録画・文字起こしのみを取得します。',
  'それ以外の会議（他のお客様との打ち合わせなど）は取得しません。会議IDが一致しないものは受信しても破棄します。',
  '取得した音声は最大90日で自動削除されます。文字起こしと確定した目標は受講生の学習記録として保持されます。',
  'この連携はいつでも解除できます。解除後は自動取得が停止します。',
];

export default function ConnectCoachPage() {
  const { token } = useParams<{ token: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [invite, setInvite] = useState<ConnectionInvite | null>(null);
  const [connection, setConnection] = useState<MeetingConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await bffClient.getConnectionInvite(token);
      setInvite(data.invite);
      setConnection(data.connection);
      if (data.expired) setPhase('expired');
      else if (data.connection?.status === 'connected' || data.connection?.status === 'plan_unsupported') {
        setPhase('done');
      } else setPhase('ready');
    } catch {
      setPhase('notfound');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async (provider: MeetingProviderId, opts?: { freePlan?: boolean; fail?: boolean }) => {
    if (!token) return;
    setPhase('connecting');
    setError(null);
    try {
      // 実運用ではここでプロバイダーの同意画面へリダイレクトし、コールバックで戻る
      const result = await bffClient.completeConnectionInvite(token, provider, !!opts?.freePlan, !!opts?.fail);
      setConnection(result);
      setPhase('done');
    } catch {
      setError('認証に失敗しました。もう一度お試しいただくか、WEBCOACH運営までご連絡ください。');
      setPhase('failed');
    }
  };

  const disconnect = async () => {
    if (!connection) return;
    try {
      const result = await bffClient.disconnectMeetingConnection(connection.id);
      setConnection(result);
      setPhase('ready');
    } catch {
      setError('解除できませんでした。');
    }
  };

  const shell = (children: React.ReactNode) => (
    <div
      style={{
        minHeight: '100vh',
        background: color.pageBg,
        fontFamily: font.family,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Video className="w-5 h-5" style={{ color: color.primary }} />
          <span style={{ ...font.logo, color: color.text }}>WEBCOACH</span>
        </div>
        {children}
        <p style={{ ...font.caption, color: color.textFaint, textAlign: 'center', marginTop: 28 }}>
          2026 © WEBCOACH
        </p>
      </div>
    </div>
  );

  if (phase === 'loading') {
    return shell(
      <div style={{ ...t.card, padding: 28 }}>
        <p style={{ ...font.meta, color: color.textMuted, margin: 0 }}>読み込み中…</p>
      </div>,
    );
  }

  if (phase === 'notfound' || phase === 'expired') {
    return shell(
      <div style={{ ...t.card, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertTriangle className="w-5 h-5" style={{ color: color.primary, flexShrink: 0, marginTop: 2 }} />
          <div>
            <h1 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 8px' }}>
              {phase === 'expired' ? 'このURLは期限切れです' : 'URLが見つかりません'}
            </h1>
            <p style={{ ...font.meta, color: color.textBody, margin: 0, lineHeight: 1.9 }}>
              お手数ですが、WEBCOACH運営に新しい認証URLの発行をご依頼ください。
            </p>
          </div>
        </div>
      </div>,
    );
  }

  if (phase === 'connecting') {
    return shell(
      <div style={{ ...t.card, padding: 40, textAlign: 'center' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: color.primary, margin: '0 auto 16px' }} />
        <p style={{ ...font.cardTitle, color: color.text, margin: '0 0 6px' }}>認証しています…</p>
        <p style={{ ...font.caption, color: color.textMuted, margin: 0, lineHeight: 1.9 }}>
          この画面を閉じずにお待ちください。
        </p>
      </div>,
    );
  }

  if (phase === 'done' && connection) {
    const unsupported = connection.status === 'plan_unsupported';
    return shell(
      <div style={{ ...t.card, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          {unsupported ? (
            <AlertTriangle className="w-5 h-5" style={{ color: '#B26A00', flexShrink: 0, marginTop: 2 }} />
          ) : (
            <Check className="w-5 h-5" style={{ color: '#2F7F5B', flexShrink: 0, marginTop: 2 }} />
          )}
          <div>
            <h1 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 8px' }}>
              {unsupported ? '連携しましたが、自動取得は利用できません' : '連携が完了しました'}
            </h1>
            <p style={{ ...font.meta, color: color.textBody, margin: 0, lineHeight: 1.9 }}>
              {unsupported
                ? connection.reason
                : '今後、あなたが主催するコーチングでは、AIコーチングノートを利用できます。この画面は閉じて問題ありません。'}
            </p>
          </div>
        </div>

        <dl
          style={{
            margin: '20px 0 0',
            padding: 16,
            background: color.pageBg,
            borderRadius: radius.md,
            border: `1px solid ${color.border}`,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '8px 16px',
          }}
        >
          <dt style={{ ...font.caption, color: color.textSubtle }}>状態</dt>
          <dd style={{ ...font.meta, color: color.textBody, margin: 0 }}>
            {CONNECTION_STATUS_LABEL[connection.status]}
          </dd>
          <dt style={{ ...font.caption, color: color.textSubtle }}>アカウント</dt>
          <dd style={{ ...font.meta, color: color.textBody, margin: 0 }}>{connection.planLabel ?? '—'}</dd>
        </dl>

        {!unsupported && (
          <p style={{ ...font.caption, color: color.textMuted, margin: '16px 0 0', lineHeight: 1.9 }}>
            会議リンクは、ここで連携したアカウントから発行してください。別のアカウントで発行された会議は取得できません。
          </p>
        )}

        {unsupported && (
          <p style={{ ...font.caption, color: color.textMuted, margin: '16px 0 0', lineHeight: 1.9 }}>
            受講生は面談後にご自身で記録を取り込む形になります。コーチ側で追加の操作は不要です。
          </p>
        )}

        {!unsupported && (
          <button
            type="button"
            onClick={disconnect}
            style={{
              ...font.link,
              color: color.textSubtle,
              background: 'none',
              border: 'none',
              padding: 0,
              marginTop: 20,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            連携を解除する
          </button>
        )}
      </div>,
    );
  }

  // phase === 'ready' | 'failed'
  const isReauth = connection?.status === 'reauth_required';

  return shell(
    <>
      <div style={{ ...t.card, padding: 28, marginBottom: 16 }}>
        <h1 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 8px' }}>
          AIコーチングノートの利用設定
        </h1>
        <p style={{ ...font.meta, color: color.textBody, margin: 0, lineHeight: 1.9 }}>
          {invite?.coachName} 様
          <br />
          {isReauth
            ? 'アクセス許可の有効期限が切れました。お手数ですが、もう一度連携をお願いします。'
            : '普段コーチングで使用するサービスを連携してください。連携すると、面談後の録画・文字起こしからAIが要約と次回までのタスクを作成し、受講生の振り返りに使われます。'}
        </p>
        <p style={{ ...font.caption, color: color.textMuted, margin: '14px 0 0', lineHeight: 1.9 }}>
          設定は今回1回のみです。WEBCOACHへのログインやアカウント作成は必要ありません。
        </p>
      </div>

      {/* 取得範囲の明示。OAuthは全録画への権限になるので、ここで約束を明文化する */}
      <div style={{ ...t.card, padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ShieldCheck className="w-4 h-4" style={{ color: color.primary }} />
          <h2 style={{ ...font.rowTitle, color: color.textStrong, margin: 0 }}>取得する範囲</h2>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SCOPE_NOTES.map((note, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Check className="w-4 h-4" style={{ color: color.primary, flexShrink: 0, marginTop: 3 }} />
              <span style={{ ...font.meta, color: color.textBody, lineHeight: 1.9 }}>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ ...t.card, padding: 24 }}>
        <h2 style={{ ...font.rowTitle, color: color.textStrong, margin: '0 0 6px' }}>
          お使いのサービスを連携する
        </h2>
        <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 14px', lineHeight: 1.9 }}>
          <strong>会議リンクを発行しているアカウント</strong>で連携してください。別のアカウントで発行された会議は取得できません。
        </p>

        {error && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              background: '#FDECEE',
              border: '1px solid #F3C3C9',
              borderRadius: radius.md,
              padding: '12px 14px',
              marginBottom: 14,
            }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: '#C4102A', flexShrink: 0, marginTop: 2 }} />
            <p style={{ ...font.caption, color: '#8A2230', margin: 0, lineHeight: 1.9 }}>{error}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={() => connect('google_meet')}
            style={{ ...t.primaryButton, justifyContent: 'center' }}
          >
            Google Meetを連携する
          </button>
          <button type="button" onClick={() => connect('zoom')} style={t.ghostButton}>
            Zoomを連携する
          </button>
        </div>

        <p
          style={{
            ...font.caption,
            color: color.textSubtle,
            margin: '16px 0 0',
            lineHeight: 1.9,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          <Lock className="w-3.5 h-3.5" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            連携には、Zoom は有料プラン（クラウド録画）、Google Meet は Google Workspace が必要です。
            無料プラン・個人Googleアカウントの場合は自動取得を利用できません。
          </span>
        </p>

        {/* モックのデモ用。非対応プラン・認証失敗の見え方を確認する入口 */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px dashed ${color.border}` }}>
          <p style={{ ...font.caption, color: color.textFaint, margin: '0 0 8px' }}>
            （モック確認用）例外パターンの表示
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(
              [
                ['Zoom無料プランで連携', () => connect('zoom', { freePlan: true })],
                ['個人Googleアカウントで連携', () => connect('google_meet', { freePlan: true })],
                ['認証を失敗させる', () => connect('google_meet', { fail: true })],
              ] as const
            ).map(([label, handler]) => (
              <button
                key={label}
                type="button"
                onClick={handler}
                style={{
                  ...font.link,
                  color: color.textSubtle,
                  background: 'none',
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.pill,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>,
  );
}
