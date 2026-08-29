/**
 * 次回コーチングカード（マイページ用）。
 *
 * 表現する状態（仕様§19）:
 *   会議リンク未登録 / 登録済み / コーチ未連携 / 記録中 / AI生成中 / AIノート完成
 *
 * ボタン名を「録音を開始」にしないのは意図的。
 * 実際に録音するのは受講生の端末ではなく、コーチの認証済み権限を使った会議側の記録機能なので、
 * 「録音を開始」だと何が起きているかを取り違えさせる。
 *
 * 🔴 かつては /coaching とこのカードを variant='full' / 'compact' で共有していた。
 *    /coaching はデザイン『コーチング トップ 3案.dc.html』案1C に作り替え、
 *    専用の CoachingHeroCard を持つようになったので、ここはマイページ専用に絞った。
 *    ＝ --dc-* の CSS 変数（.mypage-3d 配下でしか定義されない）を無条件に使ってよい。
 */
import React from 'react';
import { AlertTriangle, CalendarDays, Link as LinkIcon, Loader2, Sparkles, Video } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { untilLabel } from '../../utils/coachingSchedule';
import { displayMeetingUrl } from '../../utils/parseMeetingLink';
import { PROVIDER_LABEL } from '../../types/coaching';
import type { AutoImportReadiness, NextCoaching } from '../../types/coaching';

const DC_CARD: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 20,
};

/** 主ボタン。赤ベタにしないのは、マイページの赤ベタを「続きから学習する」に集約しているため */
const DC_SECONDARY_BUTTON: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
  background: 'var(--dc-surface)',
  color: 'var(--dc-primary)',
  border: '1px solid var(--dc-primary)',
  borderRadius: 'var(--dc-radius-md)',
  padding: '9px 15px',
  fontSize: 13,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

/** 注意書き（会議リンク未登録など）。DESIGN.md の Warning 面 */
function DcWarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--dc-gold-surface)',
        borderRadius: 'var(--dc-radius-md)',
        padding: '12px 14px',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
        marginBottom: 14,
      }}
    >
      <AlertTriangle size={16} strokeWidth={1.75} color="var(--dc-gold-text)" style={{ flex: 'none', marginTop: 2 }} />
      <span style={{ fontSize: 12, color: 'var(--dc-gold-text)', lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}

interface NextCoachingCardProps {
  next: NextCoaching;
  readiness: AutoImportReadiness | null;
  onRegisterLink: () => void;
  onChangeLink: () => void;
  onStart: () => void;
  /** 記録中・生成中・完成のセッションを開く */
  onOpenSession: (sessionId: number) => void;
  starting?: boolean;
}

export function NextCoachingCard({
  next,
  readiness,
  onRegisterLink,
  onChangeLink,
  onStart,
  onOpenSession,
  starting,
}: NextCoachingCardProps) {
  const link = next.meetingLink;
  /** 会議リンク未登録以外の問題（コーチ未連携・プラン非対応・サービス不一致など） */
  const coachIssue = readiness?.issues.find((i) => i.code !== 'no_meeting_link') ?? null;
  const until = untilLabel(next.startsAt);

  const heading = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span
          style={{ width: 38, height: 38, flex: 'none', borderRadius: 9999, background: 'var(--dc-soft-100)', display: 'grid', placeItems: 'center' }}
        >
          <CalendarDays size={18} strokeWidth={1.75} color="var(--dc-primary)" />
        </span>
        <span>
          <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--dc-text)' }}>次回コーチング</span>
          {until && <span style={{ display: 'block', fontSize: 11, color: 'var(--dc-text-muted)' }}>{until}</span>}
        </span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--dc-text)', marginBottom: 2 }}>{next.date}</div>
      <div style={{ fontSize: 13, color: 'var(--dc-text-muted)', marginBottom: 14 }}>担当：{next.coach}</div>
    </>
  );

  // ---- 進行中（記録中 / 生成中 / 完成） ----
  if (next.activeSessionId && next.activeStatus) {
    const s = next.activeStatus;
    const open = () => onOpenSession(next.activeSessionId as number);

    if (s === 'recording') {
      return (
        <section style={DC_CARD}>
          {heading}
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: radius.md,
              background: color.primaryTint,
              border: `1px solid ${color.primaryBorder}`,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color.primary,
                flex: '0 0 10px',
                marginTop: 5,
                animation: 'coaching-blink 1.4s ease-in-out infinite',
              }}
            />
            <div>
              <p style={{ ...font.rowTitle, color: color.primary, margin: 0 }}>AIコーチングノート記録中</p>
              <p style={{ ...font.caption, color: color.textBody, margin: '4px 0 0', lineHeight: 1.8 }}>
                コーチング終了後、内容を自動で整理します。
              </p>
            </div>
          </div>
          <button type="button" onClick={open} style={{ ...t.ghostButton, marginTop: 14, width: '100%' }}>
            記録中の画面を開く
          </button>
          <style>{'@keyframes coaching-blink{0%,100%{opacity:1}50%{opacity:.25}}'}</style>
        </section>
      );
    }

    if (s === 'review_required') {
      return (
        <section style={DC_CARD}>
          {heading}
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: radius.md,
              background: '#E4F3EC',
              border: '1px solid #C6E5D5',
            }}
          >
            <Sparkles className="w-4 h-4" style={{ color: '#2F7F5B', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ ...font.rowTitle, color: '#246145', margin: 0 }}>
                AIコーチングノートが完成しました
              </p>
              <p style={{ ...font.caption, color: '#3E7A5F', margin: '4px 0 0', lineHeight: 1.8 }}>
                今回話した内容と、次回までに進めることを確認してください。
              </p>
            </div>
          </div>
          <button type="button" onClick={open} style={{ ...DC_SECONDARY_BUTTON, marginTop: 14 }}>
            ノートを確認する
          </button>
        </section>
      );
    }

    if (s === 'failed') {
      return (
        <section style={DC_CARD}>
          {heading}
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: radius.md,
              background: '#FFF6E5',
              border: '1px solid #F0DDB8',
            }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: '#B26A00', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ ...font.rowTitle, color: '#7A4A00', margin: 0 }}>
                記録を自動で取得できませんでした
              </p>
              <p style={{ ...font.caption, color: '#8A5A10', margin: '4px 0 0', lineHeight: 1.8 }}>
                お手数ですが、記録を手動で取り込んでください。
              </p>
            </div>
          </div>
          <button type="button" onClick={open} style={{ ...DC_SECONDARY_BUTTON, marginTop: 14 }}>
            記録を取り込む
          </button>
        </section>
      );
    }

    // uploading / transcribing / summarizing
    return (
      <section style={DC_CARD}>
        {heading}
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            borderRadius: radius.md,
            background: color.pageBg,
            border: `1px solid ${color.border}`,
          }}
        >
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: color.primary, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ ...font.rowTitle, color: color.text, margin: 0 }}>
              AIコーチングノートを作成しています
            </p>
            <p style={{ ...font.caption, color: color.textMuted, margin: '4px 0 0', lineHeight: 1.8 }}>
              コーチング内容から、要約・決定事項・次回までのタスクを整理しています。
            </p>
          </div>
        </div>
        <button type="button" onClick={open} style={{ ...t.ghostButton, marginTop: 14, width: '100%' }}>
          進捗を見る
        </button>
      </section>
    );
  }

  // ---- 会議リンク未登録 ----
  if (!link) {
    return (
      <section style={DC_CARD}>
        {heading}
        <DcWarnBox>会議リンクがまだ登録されていません。</DcWarnBox>
        <button type="button" onClick={onRegisterLink} style={DC_SECONDARY_BUTTON}>
          <LinkIcon className="w-4 h-4" />
          会議リンクを登録する
        </button>
      </section>
    );
  }

  // ---- 会議リンク登録済み ----
  return (
    <section style={DC_CARD}>
      {heading}

      <div
        style={{
          marginTop: 16,
          padding: '12px 14px',
          borderRadius: radius.md,
          background: color.pageBg,
          border: `1px solid ${color.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Video className="w-4 h-4" style={{ color: color.primary }} />
          <span style={{ ...font.rowTitle, color: color.text }}>{PROVIDER_LABEL[link.provider]}</span>
        </div>
        <p style={{ ...font.caption, color: color.textMuted, margin: 0, wordBreak: 'break-all' }}>
          {displayMeetingUrl(link)}
        </p>
        {link.passcode && (
          <p style={{ ...font.caption, color: color.textSubtle, margin: '4px 0 0' }}>
            パスコード: {link.passcode}
          </p>
        )}
      </div>

      {/* コーチ側の設定が未完了なら、参加前に必ず知らせる */}
      {coachIssue && (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            borderRadius: radius.md,
            background: '#FFF6E5',
            border: '1px solid #F0DDB8',
          }}
        >
          <AlertTriangle className="w-4 h-4" style={{ color: '#B26A00', flexShrink: 0, marginTop: 2 }} />
          <p style={{ ...font.caption, color: '#8A5A10', margin: 0, lineHeight: 1.9 }}>{coachIssue.message}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        style={{ ...DC_SECONDARY_BUTTON, marginTop: 16, opacity: starting ? 0.6 : 1 }}
      >
        <Sparkles className="w-4 h-4" />
        {starting ? '準備しています…' : 'AIノートを開始して参加'}
      </button>

      <button
        type="button"
        onClick={onChangeLink}
        style={{
          ...font.link,
          display: 'block',
          margin: '12px auto 0',
          color: color.textMuted,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        会議リンクを変更
      </button>
    </section>
  );
}

export default NextCoachingCard;
