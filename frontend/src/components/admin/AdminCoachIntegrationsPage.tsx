/**
 * 運営向け: コーチの録画連携（Zoom / Google Meet）管理。
 *
 * コーチはLMSを使わない運用なので、連携の設定は**コーチの初回セットアップ**で
 * 運営が済ませる。この画面で未接続のコーチを選んで接続リンクを一括発行し、
 * その場で画面共有しながら、またはチャットでまとめて渡す。
 *
 * コーチが個人アカウント（Zoom無料・個人Googleアカウント）を使っている場合は
 * 構造的に自動取得できないため、リンクを配らず「手動取り込みのみ」と明示する。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Link as LinkIcon, RefreshCw, Send, Video } from 'lucide-react';
import bffClient from '../../services/bffClient';
import { useToast } from '../../contexts/ToastContext';
import { CONNECTION_STATUS_LABEL } from '../../types/coaching';
import type { ConnectionInvite, ConnectionStatus, MeetingConnection } from '../../types/coaching';

const PROVIDER_LABEL: Record<string, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  manual: '—',
};

const STATUS_STYLE: Record<ConnectionStatus, { bg: string; color: string }> = {
  connected: { bg: '#E4F3EC', color: '#2F7F5B' },
  not_connected: { bg: '#F1ECEC', color: '#6B6467' },
  reauth_required: { bg: '#FFF6E5', color: '#B26A00' },
  expired: { bg: '#FFF6E5', color: '#B26A00' },
  plan_unsupported: { bg: '#FDECEE', color: '#C4102A' },
  revoked: { bg: '#F1ECEC', color: '#6B6467' },
};

/** 認証URLの再送で復帰できる状態 */
const NEEDS_RESEND: ConnectionStatus[] = ['reauth_required', 'expired', 'revoked'];

/** 接続リンクは dev-preview のサブパス配信でも開けるよう PUBLIC_URL を含める */
function connectBaseUrl(): string {
  const publicUrl = process.env.PUBLIC_URL || '';
  return `${window.location.origin}${publicUrl}`.replace(/\/$/, '');
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** リンクを配っても接続できない状態か */
function isInvitable(c: MeetingConnection): boolean {
  return c.status !== 'plan_unsupported';
}

export function AdminCoachIntegrationsPage() {
  const { showToast } = useToast();
  const [connections, setConnections] = useState<MeetingConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyUnconnected, setOnlyUnconnected] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [invites, setInvites] = useState<Record<number, ConnectionInvite>>({});
  const [issuing, setIssuing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await bffClient.getMeetingConnections();
      setConnections(data.connections);
    } catch {
      showToast('連携状況を取得できませんでした', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (onlyUnconnected ? connections.filter((c) => c.status !== 'connected') : connections),
    [connections, onlyUnconnected],
  );

  const selectableIds = useMemo(
    () => visible.filter(isInvitable).map((c) => c.coachId),
    [visible],
  );

  const toggle = (coachId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(coachId)) next.delete(coachId);
      else next.add(coachId);
      return next;
    });
  };

  const issueInvites = async () => {
    if (selected.size === 0 || issuing) return;
    setIssuing(true);
    try {
      const { invites: created } = await bffClient.createConnectionInvites(
        Array.from(selected),
        connectBaseUrl(),
      );
      setInvites((prev) => ({
        ...prev,
        ...Object.fromEntries(created.map((i) => [i.coachId, i])),
      }));
      showToast(`${created.length}名分の接続リンクを発行しました`, 'success');
      setSelected(new Set());
    } catch {
      showToast('接続リンクを発行できませんでした', 'error');
    } finally {
      setIssuing(false);
    }
  };

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message, 'success');
    } catch {
      showToast('コピーできませんでした', 'error');
    }
  };

  /** 発行済みリンクを1つのテキストにまとめる。チャットで一括送付する用 */
  const copyAll = () => {
    const list = Object.values(invites);
    if (list.length === 0) return;
    const body = list
      .map(
        (i) =>
          `${i.coachName} 様（${i.coachEmail}）\n${i.url}\n有効期限: ${formatDateTime(i.expiresAt)}\n`,
      )
      .join('\n');
    void copy(
      `WEBCOACH コーチング録画連携のご案内\n\n下記リンクを開いて、Zoom または Google アカウントとの接続をお願いします。\n接続は1回のみで、LMSへのログインは不要です。\n\n${body}`,
      `${list.length}件のリンクをまとめてコピーしました`,
    );
  };

  /** 期限切れ・再認証待ちのコーチに、新しい認証URLを発行し直す */
  const resend = async (c: MeetingConnection) => {
    try {
      const invite = await bffClient.resendConnectionInvite(c.coachId, connectBaseUrl());
      setInvites((prev) => ({ ...prev, [c.coachId]: invite }));
      showToast(`${c.coachName}の認証URLを再発行しました`, 'success');
      void load();
    } catch {
      showToast('認証URLを再発行できませんでした', 'error');
    }
  };

  const disconnect = async (c: MeetingConnection) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`${c.coachName}の録画連携を解除しますか？`)) return;
    try {
      await bffClient.disconnectMeetingConnection(c.id);
      showToast('連携を解除しました', 'success');
      void load();
    } catch {
      showToast('解除できませんでした', 'error');
    }
  };

  const unsupportedCount = connections.filter((c) => c.status === 'plan_unsupported').length;

  return (
    <div className="p-6 sm:p-8 max-w-[1100px]">
      <div className="flex items-center gap-2 mb-1">
        <Video className="w-5 h-5" style={{ color: '#E0213A' }} />
        <h1 className="text-xl font-bold" style={{ color: '#1F1D1E' }}>録画連携</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: '#6B6467', lineHeight: 1.8 }}>
        コーチの初回セットアップで接続リンクを発行し、Zoom / Google Meet の録画・文字起こしを
        面談後に自動で取り込めるようにします。<strong>コーチのLMSログインは不要</strong>で、リンクを1回開くだけです。
        取得するのはLMSに登録された会議のみで、それ以外の録画には触れません。
      </p>

      {unsupportedCount > 0 && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3 mb-5"
          style={{ background: '#FDECEE', border: '1px solid #F3C3C9' }}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#C4102A' }} />
          <p className="text-xs" style={{ color: '#4A4245', lineHeight: 1.8 }}>
            {unsupportedCount}名のコーチは、アカウントのプラン上そもそも自動取得ができません
            （Zoom無料プランにはクラウド録画が無く、個人GoogleアカウントではMeetの文字起こしが使えません）。
            この方々の面談は<strong>受講生による手動取り込み</strong>のままになります。
          </p>
        </div>
      )}

      {/* 操作バー */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#4A4245' }}>
          <input
            type="checkbox"
            checked={onlyUnconnected}
            onChange={(e) => {
              setOnlyUnconnected(e.target.checked);
              setSelected(new Set());
            }}
            style={{ accentColor: '#E0213A' }}
          />
          未接続のみ表示
        </label>

        <button
          type="button"
          onClick={() =>
            setSelected((prev) => (prev.size === selectableIds.length ? new Set() : new Set(selectableIds)))
          }
          className="text-sm font-bold px-3 py-1.5 rounded-full"
          style={{ color: '#E0213A', border: '1px solid #F3C3C9', background: '#fff' }}
        >
          {selected.size === selectableIds.length && selectableIds.length > 0 ? '選択を解除' : 'すべて選択'}
        </button>

        <button
          type="button"
          onClick={issueInvites}
          disabled={selected.size === 0 || issuing}
          className="inline-flex items-center gap-2 text-sm font-bold text-white px-4 py-2 rounded-xl disabled:opacity-50"
          style={{ background: '#E0213A' }}
        >
          <LinkIcon className="w-4 h-4" />
          {issuing ? '発行しています…' : `接続リンクを一括発行（${selected.size}名）`}
        </button>

        {Object.keys(invites).length > 0 && (
          <button
            type="button"
            onClick={copyAll}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl"
            style={{ color: '#4A4245', border: '1px solid #E6DFDF', background: '#fff' }}
          >
            <Copy className="w-4 h-4" />
            発行済み{Object.keys(invites).length}件をまとめてコピー
          </button>
        )}

        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full ml-auto"
          style={{ color: '#6B6467', border: '1px solid #E6DFDF', background: '#fff' }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          更新
        </button>
      </div>

      {/* 一覧 */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #F3EDED' }}>
        <div
          className="grid items-center px-4 py-3 text-xs font-bold text-white"
          style={{ gridTemplateColumns: '36px 1.6fr 1fr 1fr 1.1fr 1fr', background: '#E0213A' }}
        >
          <span />
          <span>コーチ</span>
          <span>プロバイダ</span>
          <span>状態</span>
          <span>プラン</span>
          <span>最終自動取得</span>
        </div>

        <div className="bg-white">
          {loading ? (
            <p className="py-12 text-center text-sm" style={{ color: '#6B6467' }}>読み込み中…</p>
          ) : visible.length === 0 ? (
            <p className="py-12 text-center text-sm" style={{ color: '#6B6467' }}>該当するコーチがいません</p>
          ) : (
            visible.map((c) => {
              const invite = invites[c.coachId];
              const style = STATUS_STYLE[c.status];
              const invitable = isInvitable(c);
              return (
                <div key={c.id} style={{ borderTop: '1px solid #F5F0ED' }}>
                  <div
                    className="grid items-center px-4 py-3.5"
                    style={{ gridTemplateColumns: '36px 1.6fr 1fr 1fr 1.1fr 1fr' }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.coachId)}
                      disabled={!invitable}
                      onChange={() => toggle(c.coachId)}
                      aria-label={`${c.coachName}を選択`}
                      style={{ accentColor: '#E0213A' }}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold truncate" style={{ color: '#1F1D1E' }}>
                        {c.coachName}
                      </span>
                      <span className="block text-xs truncate" style={{ color: '#8B8386' }}>{c.coachEmail}</span>
                    </span>
                    <span className="text-sm" style={{ color: '#4A4245' }}>
                      {c.provider ? PROVIDER_LABEL[c.provider] : '—'}
                    </span>
                    <span>
                      <span
                        className="inline-block text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{ background: style.bg, color: style.color }}
                      >
                        {CONNECTION_STATUS_LABEL[c.status]}
                      </span>
                    </span>
                    <span className="text-xs" style={{ color: '#6B6467' }}>{c.planLabel ?? '—'}</span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs" style={{ color: '#6B6467' }}>
                        {formatDateTime(c.lastAutoImportAt)}
                      </span>
                      {NEEDS_RESEND.includes(c.status) && (
                        <button
                          type="button"
                          onClick={() => resend(c)}
                          className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                          style={{ color: '#E0213A', border: '1px solid #F3C3C9', background: '#fff' }}
                        >
                          <Send className="w-3 h-3" />
                          認証URLを再送
                        </button>
                      )}
                      {c.status === 'connected' && (
                        <button
                          type="button"
                          onClick={() => disconnect(c)}
                          className="text-xs underline flex-shrink-0"
                          style={{ color: '#8B8386' }}
                        >
                          解除
                        </button>
                      )}
                    </span>
                  </div>

                  {/* プラン非対応の理由 */}
                  {c.status === 'plan_unsupported' && c.reason && (
                    <div className="px-4 pb-3.5 pl-[52px]">
                      <p className="text-xs" style={{ color: '#C4102A', lineHeight: 1.8 }}>
                        {c.reason} このコーチの面談は手動取り込みのみになります。
                      </p>
                    </div>
                  )}
                  {(c.status === 'reauth_required' || c.status === 'expired') && c.reason && (
                    <div className="px-4 pb-3.5 pl-[52px]">
                      <p className="text-xs" style={{ color: '#B26A00', lineHeight: 1.8 }}>{c.reason}</p>
                    </div>
                  )}

                  {/* 発行済みリンク */}
                  {invite && (
                    <div className="px-4 pb-3.5 pl-[52px]">
                      <div
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                        style={{ background: '#FDFCFC', border: '1px solid #F3EDED' }}
                      >
                        {invite.usedAt ? (
                          <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#2F7F5B' }} />
                        ) : (
                          <LinkIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#E0213A' }} />
                        )}
                        <code className="text-xs flex-1 min-w-0 truncate" style={{ color: '#4A4245' }}>
                          {invite.url}
                        </code>
                        <span className="text-[11px] flex-shrink-0" style={{ color: '#8B8386' }}>
                          期限 {formatDateTime(invite.expiresAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => copy(invite.url, `${invite.coachName}のリンクをコピーしました`)}
                          className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                          style={{ color: '#E0213A', border: '1px solid #F3C3C9', background: '#fff' }}
                        >
                          <Copy className="w-3 h-3" />
                          コピー
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminCoachIntegrationsPage;
