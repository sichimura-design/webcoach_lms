import React, { useState } from 'react';
import { Search } from 'lucide-react';
import bffClient, { SupportHintLevel, SupportLookupResponse, SupportSchedule, SupportStageLevel } from '../../services/bffClient';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { getUserMessage } from '../../utils/errorMessage';

const LEVEL_STYLE: Record<SupportStageLevel, { label: string; background: string; color: string }> = {
  danger: { label: '要対応', background: color.primarySoft, color: color.primary },
  warning: { label: '確認', background: color.goalBg, color: color.goalText },
  info: { label: '参考', background: color.hoverBg, color: color.textSecondary },
  ok: { label: '問題なし', background: color.successSurface, color: color.success },
};

const COGNITO_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: '利用中(パスワード設定済み)',
  FORCE_CHANGE_PASSWORD: '初回ログイン前(仮パスワードのまま)',
  RESET_REQUIRED: 'パスワードの再設定が必要',
};

const GROUP_LABEL: Record<string, string> = { student: '受講生', coach: 'コーチ', admin: '管理者' };

const RESULT_LABEL: Record<string, string> = { completed: '終了', interrupted: '中断', rescheduled: 'リスケ' };

const NOTE_STATUS_LABEL: Record<string, string> = {
  ai_suggested: 'AI下書き',
  coach_confirmed: 'コーチ確認済み',
  published: '公開済み',
};

function isError(value: unknown): value is { error: string } {
  return !!value && typeof value === 'object' && 'error' in value;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatUnix(seconds: number): string {
  return seconds > 0 ? formatDateTime(new Date(seconds * 1000).toISOString()) : 'なし';
}

function formatDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
}

function Badge({ level, label }: { level: SupportStageLevel; label?: string }) {
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
      {label ?? s.label}
    </span>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ ...t.card, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ ...font.cardHeading, color: color.text }}>{title}</div>
      {description && (
        <p style={{ ...font.meta, color: color.textSecondary, margin: '4px 0 0', lineHeight: 1.7 }}>{description}</p>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: `1px solid ${color.divider}`, fontSize: 13.5 }}>
      <div style={{ width: 160, flexShrink: 0, color: color.textSecondary }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0, color: color.textBody, wordBreak: 'break-all' }}>{children}</div>
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p style={{ ...font.meta, color: color.primary, margin: 0 }}>{children}</p>;
}

function ScheduleRow({ schedule }: { schedule: SupportSchedule }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderTop: `1px solid ${color.divider}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: color.text }}>
          第{schedule.coachingNo}回 {formatDate(schedule.coachingDate)}
        </div>
        <div style={{ ...font.meta, color: color.textBody, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
          <span>実施結果: {schedule.result ? RESULT_LABEL[schedule.result] ?? schedule.result : '未記録'}</span>
          <span>Meet: {schedule.meetingProvider === 'google_meet' ? '自動発行' : schedule.hasMeetingUrl ? '手入力のURL' : 'なし'}</span>
          <span>リマインド: {schedule.reminderSentAt ? `送信済み(${formatDateTime(schedule.reminderSentAt)})` : '未送信'}</span>
          <span>文字起こし: {schedule.transcript ? `取り込み済み(${formatDateTime(schedule.transcript.updatedAt)})` : 'なし'}</span>
          <span>
            記録: {schedule.note ? NOTE_STATUS_LABEL[schedule.note.status] ?? schedule.note.status : 'なし'}
            {schedule.note?.publishedAt && `(${formatDateTime(schedule.note.publishedAt)}公開)`}
          </span>
        </div>
        {schedule.errors.length > 0 && <ErrorText>一部を確認できませんでした: {schedule.errors.join(' / ')}</ErrorText>}
      </div>
      <Badge level={schedule.level} label={schedule.label} />
    </div>
  );
}

function Hints({ hints }: { hints: SupportLookupResponse['hints'] }) {
  if (hints.length === 0) {
    return <p style={{ ...font.meta, color: color.success, margin: 0 }}>気になる点は見つかりませんでした。</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {hints.map((hint, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Badge level={hint.level as SupportHintLevel} />
          <p style={{ fontSize: 13.5, color: color.textBody, margin: 0, lineHeight: 1.7 }}>{hint.text}</p>
        </div>
      ))}
    </div>
  );
}

/** 問い合わせ対応: メールアドレスから、その人がどこで止まっているかを1画面で確かめる */
export function AdminSupportLookupPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<SupportLookupResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    bffClient.lookupSupportUser(value)
      .then(setResult)
      .catch(err => {
        setResult(null);
        setError(getUserMessage(err, '状態を確認できませんでした'));
      })
      .finally(() => setLoading(false));
  };

  const cognito = result?.cognito;
  const moodle = result?.moodle;
  const isStudent = !!cognito?.groups.includes('student');
  const isCoach = !!cognito?.groups.includes('coach');

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ ...font.sectionTitle, fontSize: 22, color: color.text, margin: '0 0 6px' }}>受講生の状態確認</h1>
      <p style={{ ...font.meta, color: color.textSecondary, margin: '0 0 16px', lineHeight: 1.7 }}>
        問い合わせのあった人のメールアドレスを入れると、ログイン・学習データ・コーチングの状態と、原因の目安を表示します。
        確認するだけで、何も変更しません。
      </p>

      <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="user@example.com"
          aria-label="メールアドレス"
          style={{
            flex: 1,
            minWidth: 240,
            height: 44,
            padding: '0 14px',
            border: `1px solid ${color.borderSoft}`,
            borderRadius: radius.md,
            fontSize: 14,
            fontFamily: 'inherit',
            color: color.text,
            background: color.surface,
          }}
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          style={{ ...t.primaryButton, padding: '0 20px', height: 44, fontSize: 14, gap: 6, opacity: loading || !email.trim() ? 0.5 : 1 }}
        >
          <Search size={16} />
          {loading ? '確認中...' : '確認する'}
        </button>
      </form>

      {error && (
        <div style={{ background: color.primarySoft, color: color.primary, borderRadius: radius.md, padding: '12px 16px', fontSize: 13.5, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <Section title="原因の目安" description={`${result.email}(${formatDateTime(result.checkedAt)}時点)`}>
            <Hints hints={result.hints} />
          </Section>

          <Section title="ログイン(アカウント)">
            {!cognito ? (
              <p style={{ ...font.meta, color: color.textSecondary, margin: 0 }}>このメールアドレスのアカウントはありません。</p>
            ) : (
              <>
                <Field label="状態">{COGNITO_STATUS_LABEL[cognito.status] ?? cognito.status}{!cognito.enabled && '・無効'}</Field>
                <Field label="役割">{cognito.groups.length ? cognito.groups.map(g => GROUP_LABEL[g] ?? g).join('・') : 'なし'}</Field>
                <Field label="ユーザーID">{cognito.username}</Field>
                {cognito.name && <Field label="名前">{cognito.name}</Field>}
                <Field label="メールアドレス確認">{cognito.emailVerified ? '確認済み' : '未確認'}</Field>
                <Field label="アカウント発行">{formatDateTime(cognito.createdAt)}</Field>
                <Field label="最終更新">{formatDateTime(cognito.updatedAt)}</Field>
                {cognito.tempPasswordExpiresAt && (
                  <Field label="仮パスワードの期限(目安)">
                    {formatDateTime(cognito.tempPasswordExpiresAt)}
                    {cognito.tempPasswordExpired && <strong style={{ color: color.primary }}> 期限切れ</strong>}
                  </Field>
                )}
              </>
            )}
          </Section>

          {cognito && (
            <Section title="学習データ" description="初回ログインのときに作られます。最終アクセスはWEBCOACHを最後に開いた日時です。">
              {!moodle ? (
                <p style={{ ...font.meta, color: color.textSecondary, margin: 0 }}>まだありません(初回ログイン前、またはログイン後の初期処理に失敗)。</p>
              ) : isError(moodle) ? (
                <ErrorText>確認できませんでした: {moodle.error}</ErrorText>
              ) : (
                <>
                  <Field label="氏名">{moodle.fullname}</Field>
                  <Field label="初回アクセス">{formatUnix(moodle.firstaccess)}</Field>
                  <Field label="最終アクセス">{formatUnix(moodle.lastaccess)}</Field>
                  {moodle.suspended && <Field label="状態"><strong style={{ color: color.primary }}>停止中</strong></Field>}
                  <Field label="受講中のコース">
                    {isError(result.courses) ? (
                      <ErrorText>確認できませんでした: {result.courses.error}</ErrorText>
                    ) : result.courses?.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {result.courses.map(c => (
                          <span key={c.id}>{c.fullname}{c.progress != null && `(進捗 ${c.progress}%)`}</span>
                        ))}
                      </div>
                    ) : 'なし(教材を開くと受講登録されます)'}
                  </Field>
                </>
              )}
            </Section>
          )}

          {isCoach && result.coachStudents && (
            <Section title="コーチとしての担当">
              {isError(result.coachStudents) ? (
                <ErrorText>確認できませんでした: {result.coachStudents.error}</ErrorText>
              ) : (
                <Field label="担当受講生">{result.coachStudents.length}人</Field>
              )}
            </Section>
          )}

          {isStudent && moodle && !isError(moodle) && (
            <Section
              title="コーチング"
              description="新しい回から最大20回分です。記録は、コーチが公開すると受講生の画面に表示されます。"
            >
              {isError(result.coach) ? (
                <ErrorText>担当コーチを確認できませんでした: {result.coach.error}</ErrorText>
              ) : (
                <Field label="担当コーチ">
                  {result.coach?.id ? `${result.coach.fullname ?? `ID ${result.coach.id}`}${result.coach.email ? `(${result.coach.email})` : ''}` : '未割り当て'}
                </Field>
              )}
              {isError(result.schedules) ? (
                <ErrorText>予約を確認できませんでした: {result.schedules.error}</ErrorText>
              ) : result.schedules?.length ? (
                result.schedules.map(s => <ScheduleRow key={s.id} schedule={s} />)
              ) : (
                <Field label="予約">なし(予約はコーチが登録します)</Field>
              )}
            </Section>
          )}
        </>
      )}
    </div>
  );
}
