/**
 * /coaching 先頭の「次回コーチング」カード。
 * デザイン『コーチング トップ 3案.dc.html』案1C。
 *
 * 左＝いつ・あと何日、右＝当日の入口（会議リンク登録 → 参加）、下段＝コーチへの連絡手段。
 *
 * 🔴 会議リンクの登録はモーダルではなくこのカードの中で完結させる（1Cの指定）。
 *    マイページ側は従来どおり MeetingLinkModal を使う（あちらは幅が足りない）。
 * 🔴 記録中・生成中・確認待ち・失敗の各状態は右列のCTAを差し替えて表現する。
 *    ここを落とすと、コーチング当日に「いま何が起きているか」が画面から消える。
 */
import React, { useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Link2, Loader2, Mail, Sparkles, Video } from 'lucide-react';
import { parseMeetingLink } from '../../utils/parseMeetingLink';
import { untilLabel } from '../../utils/coachingSchedule';
import CoachContactCell from './CoachContactCell';
import { C, CARD, INPUT, PRIMARY_BUTTON, TEXT_LINK_BUTTON, WARN_PILL } from './design1c';
import type { AutoImportReadiness, CoachContacts, MeetingLink, NextCoaching } from '../../types/coaching';

interface CoachingHeroCardProps {
  next: NextCoaching;
  readiness: AutoImportReadiness | null;
  contacts: CoachContacts | null;
  /** 会議リンクの登録。失敗時は throw する */
  onRegisterLink: (link: MeetingLink) => Promise<void>;
  onStart: () => void;
  onOpenSession: (sessionId: number) => void;
  /** 連絡先の保存。エラー文言を返すと入力欄に留まる */
  onSaveContacts: (patch: Partial<CoachContacts>) => Promise<string | null>;
  onCopyEmail: (email: string) => void;
  starting?: boolean;
}

/** 状態バナー（記録中・生成中・完成・失敗）。1Cには無い面だが、状態表示は落とせない */
function StatusBanner({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: { bg: string; border: string; title: string; body: string };
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 9,
        padding: '10px 12px',
        borderRadius: 10,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <span style={{ flex: 'none', marginTop: 2, display: 'flex' }}>{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: tone.title }}>{title}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: tone.body, marginTop: 3, lineHeight: 1.7 }}>{body}</span>
      </span>
    </div>
  );
}

const TONE = {
  brand: { bg: C.brandFaint, border: '#F3D3D8', title: C.brand, body: C.body },
  ok: { bg: C.okSoft, border: C.okBorder, title: '#246145', body: '#3E7A5F' },
  warn: { bg: C.warnBg, border: '#F0DDB8', title: '#7A4A00', body: '#8A5A10' },
  neutral: { bg: C.line, border: C.border, title: C.ink, body: C.muted },
} as const;

export function CoachingHeroCard({
  next,
  readiness,
  contacts,
  onRegisterLink,
  onStart,
  onOpenSession,
  onSaveContacts,
  onCopyEmail,
  starting,
}: CoachingHeroCardProps) {
  const [editingLink, setEditingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);

  const until = untilLabel(next.startsAt);
  /** 会議リンク未登録以外の問題（コーチ未連携・プラン非対応・サービス不一致など） */
  const coachIssue = readiness?.issues.find((i) => i.code !== 'no_meeting_link') ?? null;

  const startLinkEdit = () => {
    setLinkDraft(next.meetingLink?.url ?? '');
    setLinkError(null);
    setEditingLink(true);
  };

  const submitLink = async () => {
    if (savingLink) return;
    const parsed = parseMeetingLink(linkDraft);
    if (parsed.kind === 'none') {
      setLinkError('Zoom / Google Meet のURLが見つかりませんでした。届いた文面をそのまま貼っても大丈夫です。');
      return;
    }
    // 複数見つかったら先頭を採る。招待文面には参加URLの他にカレンダーURLが混ざることがある
    const link = parsed.kind === 'single' ? parsed.link : parsed.links[0];
    setSavingLink(true);
    try {
      await onRegisterLink(link);
      setEditingLink(false);
      setLinkError(null);
    } catch {
      setLinkError('登録できませんでした。時間をおいて試してください。');
    } finally {
      setSavingLink(false);
    }
  };

  // ---- 右列 ----------------------------------------------------------------

  const renderRightColumn = () => {
    // 進行中（記録中 / 生成中 / 確認待ち / 失敗）
    if (next.activeSessionId && next.activeStatus) {
      const open = () => onOpenSession(next.activeSessionId as number);
      const s = next.activeStatus;

      if (s === 'recording') {
        return (
          <>
            <StatusBanner
              tone={TONE.brand}
              icon={<span style={{ width: 9, height: 9, borderRadius: '50%', background: C.brand, display: 'block', marginTop: 3, animation: 'coaching-blink 1.4s ease-in-out infinite' }} />}
              title="AIコーチングノート記録中"
              body="コーチング終了後、内容を自動で整理します。"
            />
            <button type="button" className="cg-btn-primary" onClick={open} style={PRIMARY_BUTTON}>
              記録中の画面を開く
            </button>
            <style>{'@keyframes coaching-blink{0%,100%{opacity:1}50%{opacity:.25}}'}</style>
          </>
        );
      }

      if (s === 'review_required') {
        return (
          <>
            <StatusBanner
              tone={TONE.ok}
              icon={<Sparkles size={15} color="#2F7F5B" />}
              title="AIコーチングノートが完成しました"
              body="今回話した内容と、次回までに進めることを確認してください。"
            />
            <button type="button" className="cg-btn-primary" onClick={open} style={PRIMARY_BUTTON}>
              ノートを確認する
            </button>
          </>
        );
      }

      if (s === 'failed') {
        return (
          <>
            <StatusBanner
              tone={TONE.warn}
              icon={<AlertTriangle size={15} color="#B26A00" />}
              title="記録を自動で取得できませんでした"
              body="お手数ですが、記録を手動で取り込んでください。"
            />
            <button type="button" className="cg-btn-primary" onClick={open} style={PRIMARY_BUTTON}>
              記録を取り込む
            </button>
          </>
        );
      }

      // uploading / transcribing / summarizing
      return (
        <>
          <StatusBanner
            tone={TONE.neutral}
            icon={<Loader2 size={15} color={C.brand} className="animate-spin" />}
            title="AIコーチングノートを作成しています"
            body="要約・決定事項・次回までのタスクを整理しています。"
          />
          <button type="button" className="cg-btn-primary" onClick={open} style={PRIMARY_BUTTON}>
            進捗を見る
          </button>
        </>
      );
    }

    // 入力中
    if (editingLink) {
      return (
        <>
          <input
            value={linkDraft}
            autoFocus
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitLink();
              if (e.key === 'Escape') setEditingLink(false);
            }}
            placeholder="https:// からはじまるURL"
            aria-label="会議リンク"
            style={{ ...INPUT, height: 42, borderRadius: 10, fontSize: 13, padding: '0 12px' }}
          />
          {linkError && <div style={{ fontSize: 12, color: C.brandInk, lineHeight: 1.7 }}>{linkError}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="cg-btn-ghost"
              onClick={() => setEditingLink(false)}
              style={{
                flex: 1,
                background: C.surface,
                border: `1px solid ${C.borderInput}`,
                color: C.muted,
                borderRadius: 10,
                padding: '12px 0',
                fontSize: 13,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="cg-btn-primary"
              onClick={() => void submitLink()}
              disabled={savingLink}
              style={{
                flex: 1.6,
                background: C.brand,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 0',
                fontSize: 13.5,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: savingLink ? 'default' : 'pointer',
                opacity: savingLink ? 0.6 : 1,
              }}
            >
              {savingLink ? '登録しています…' : 'リンクを登録する'}
            </button>
          </div>
        </>
      );
    }

    // 未登録
    if (!next.meetingLink) {
      return (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 500,
              color: C.warn,
              background: C.warnBg,
              borderRadius: 9999,
              padding: '6px 12px',
            }}
          >
            会議リンク未登録
          </div>
          <button type="button" className="cg-btn-primary" onClick={startLinkEdit} style={PRIMARY_BUTTON}>
            送られてきたリンクを登録
          </button>
        </>
      );
    }

    // 登録済み
    return (
      <>
        {/* コーチ側の設定が未完了なら、参加前に必ず知らせる。
            これを出さないと「自動で記録が届く」と思わせておいて届かないことになる */}
        {coachIssue && (
          <StatusBanner
            tone={TONE.warn}
            icon={<AlertTriangle size={15} color="#B26A00" />}
            title="自動での記録ができない可能性があります"
            body={coachIssue.message}
          />
        )}
        <button
          type="button"
          className="cg-btn-primary"
          onClick={onStart}
          disabled={starting}
          style={{ ...PRIMARY_BUTTON, opacity: starting ? 0.6 : 1 }}
        >
          <Video size={17} fill="#fff" strokeWidth={1.5} />
          {starting ? '準備しています…' : 'コーチングに参加する'}
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 12,
            color: C.ok,
            fontWeight: 700,
          }}
        >
          <Check size={12} strokeWidth={3} />
          リンク登録済み
          <button type="button" onClick={startLinkEdit} style={TEXT_LINK_BUTTON}>
            変更
          </button>
        </div>
      </>
    );
  };

  return (
    <section style={{ ...CARD, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: 9999,
              background: C.brandSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <CalendarDays size={24} color={C.brand} strokeWidth={1.75} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
              次回コーチング
              <span style={{ fontWeight: 400, color: C.muted, marginLeft: 8 }}>{next.coach}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>{next.date}</span>
              {until && (
                <span
                  style={{
                    ...WARN_PILL,
                    fontWeight: 700,
                    color: C.brand,
                    background: C.brandSoft,
                    padding: '4px 10px',
                  }}
                >
                  {until}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 300, flex: 'none', maxWidth: '100%' }}>
          {renderRightColumn()}
        </div>
      </div>

      {/* コーチへの連絡手段。会議リンクと同じカードに置くことで、
          「コーチとのやりとりはここを見る」を1箇所にまとめる */}
      <div
        className="cg-contacts"
        style={{ border: `1px solid ${C.border}`, borderRadius: 12, display: 'grid', gridTemplateColumns: '1fr 1fr' }}
      >
        <CoachContactCell
          borderRight
          icon={<Link2 size={16} color={C.brand} strokeWidth={1.75} />}
          label="コーチとのSlackリンク"
          value={contacts?.slackUrl ?? null}
          placeholder="https://～.slack.com/…"
          idleButtonLabel="リンクを登録"
          onSave={(v) => onSaveContacts({ slackUrl: v || null })}
          renderAction={(v) => (
            <a
              href={v}
              target="_blank"
              rel="noopener noreferrer"
              className="cg-link"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 12.5,
                fontWeight: 700,
                color: C.brand,
                flex: 'none',
                textDecoration: 'none',
              }}
            >
              開く ›
            </a>
          )}
        />
        <CoachContactCell
          icon={<Mail size={16} color={C.brand} strokeWidth={1.75} />}
          label="コーチのメールアドレス"
          value={contacts?.email ?? null}
          placeholder="coach@example.com"
          idleButtonLabel="アドレスを登録"
          onSave={(v) => onSaveContacts({ email: v || null })}
          renderAction={(v) => (
            <button
              type="button"
              className="cg-btn-ghost"
              onClick={() => onCopyEmail(v)}
              style={{
                background: C.surface,
                border: `1px solid ${C.borderInput}`,
                borderRadius: 7,
                padding: '5px 12px',
                fontSize: 11.5,
                fontWeight: 500,
                fontFamily: 'inherit',
                color: C.ink,
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              コピー
            </button>
          )}
        />
      </div>
    </section>
  );
}

export default CoachingHeroCard;
