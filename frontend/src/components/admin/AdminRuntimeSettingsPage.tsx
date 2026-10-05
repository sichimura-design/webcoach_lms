import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import bffClient, { RuntimeSetting, RuntimeSettingsResponse, RuntimeSettingValue } from '../../services/bffClient';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { getUserMessage } from '../../utils/errorMessage';

// 再起動中は、終わったかどうかをこの間隔で確かめる
const RESTART_POLL_MS = 15000;

const inputStyle: React.CSSProperties = {
  width: 120,
  padding: '8px 10px',
  border: `1px solid ${color.borderNeutral}`,
  borderRadius: radius.nav,
  fontFamily: 'inherit',
  fontSize: 14,
  color: color.text,
};

const smallButton: React.CSSProperties = {
  ...t.outlineButton,
  padding: '8px 14px',
  fontSize: 12.5,
};

function Notice({ tone, children }: { tone: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  const palette = {
    info: { background: color.hoverBg, color: color.textBody },
    error: { background: color.primarySoft, color: color.primary },
    success: { background: color.successSurface, color: color.success },
  }[tone];
  return (
    <div style={{ ...palette, borderRadius: radius.md, padding: '12px 16px', fontSize: 13.5, marginBottom: 16 }}>
      {children}
    </div>
  );
}

/** 画面に出す値の書き方(有効/無効・モデル名の表示名) */
function formatValue(setting: RuntimeSetting, value: RuntimeSettingValue): string {
  if (setting.type === 'boolean') return value ? '有効' : '無効';
  if (setting.type === 'select') return setting.options?.find((o) => o.value === value)?.label ?? String(value);
  return String(value);
}

/** 入力欄の文字列が保存できる値か(BFFの確かめ方と同じ) */
function validationError(setting: RuntimeSetting, text: string): string | null {
  const v = text.trim();
  switch (setting.type) {
    case 'boolean':
    case 'select':
      return null;
    case 'url':
      return /^https?:\/\/[^\s/?#]+(\/[^\s?#]*[^\s?#/])?$/.test(v)
        ? null
        : 'http(s)://で始まるURLを、末尾の/なしで入力してください';
    default: {
      const n = Number(v);
      return /^\d+$/.test(v) && n >= (setting.min ?? 0) && n <= (setting.max ?? Infinity)
        ? null
        : `${setting.min}〜${setting.max}の整数で入力してください`;
    }
  }
}

function SettingRow({
  setting,
  editable,
  onSaved,
}: {
  setting: RuntimeSetting;
  editable: boolean;
  onSaved: (message: string) => void;
}) {
  const [value, setValue] = useState(String(setting.saved ?? setting.defaultValue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(String(setting.saved ?? setting.defaultValue));
  }, [setting.saved, setting.defaultValue]);

  const invalidMessage = validationError(setting, value);
  const valid = invalidMessage === null;
  const unchanged = value.trim() === String(setting.saved ?? setting.defaultValue);

  const run = async (action: () => Promise<void>, message: string) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      onSaved(message);
    } catch (err) {
      setError(getUserMessage(err, '保存に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '16px 20px', borderTop: `1px solid ${color.divider}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...font.rowTitle, color: color.textStrong }}>{setting.label}</span>
        {setting.pendingRestart && <span style={t.chip}>再起動待ち</span>}
      </div>
      <p style={{ ...font.meta, color: color.textSecondary, margin: '4px 0 10px' }}>{setting.description}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', ...font.meta, color: color.textBody }}>
        <span>
          今の値: <strong>{setting.current === null ? '取得できません' : formatValue(setting, setting.current)}</strong>
        </span>
        <span>既定値: {formatValue(setting, setting.defaultValue)}</span>
        {editable && <span>保存値: {setting.saved === null ? 'なし(既定値)' : formatValue(setting, setting.saved)}</span>}
        <span style={{ color: color.textMuted }}>
          {setting.type === 'int' && `${setting.min}〜${setting.max} / `}
          {setting.service}
        </span>
      </div>

      {editable && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {setting.type === 'boolean' || setting.type === 'select' ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ ...inputStyle, width: 'auto', background: color.surface }}
              aria-label={setting.label}
            >
              {(setting.type === 'boolean'
                ? [{ value: 'true', label: '有効' }, { value: 'false', label: '無効' }]
                : setting.options ?? []
              ).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : setting.type === 'url' ? (
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ ...inputStyle, width: 320, maxWidth: '100%' }}
              aria-label={setting.label}
            />
          ) : (
            <input
              type="number"
              inputMode="numeric"
              min={setting.min}
              max={setting.max}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={inputStyle}
              aria-label={setting.label}
            />
          )}
          <button
            type="button"
            style={{ ...smallButton, opacity: !valid || unchanged || saving ? 0.5 : 1 }}
            disabled={!valid || unchanged || saving}
            onClick={() => run(() => bffClient.updateRuntimeSetting(setting.name, value.trim()), `「${setting.label}」を保存しました`)}
          >
            保存
          </button>
          {setting.saved !== null && (
            <button
              type="button"
              style={{ ...smallButton, color: color.textBody, borderColor: color.borderSoft, opacity: saving ? 0.5 : 1 }}
              disabled={saving}
              onClick={() => run(() => bffClient.resetRuntimeSetting(setting.name), `「${setting.label}」を既定値に戻しました`)}
            >
              <RotateCcw size={13} />
              既定値に戻す
            </button>
          )}
          {!valid && <span style={{ ...font.label, color: color.primary }}>{invalidMessage}</span>}
        </div>
      )}
      {error && <p style={{ ...font.label, color: color.primary, margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}

export function AdminRuntimeSettingsPage() {
  const [data, setData] = useState<RuntimeSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await bffClient.getRuntimeSettings());
      setError(null);
    } catch (err) {
      setError(getUserMessage(err, '動作設定の取得に失敗しました'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const restartInProgress = !!data?.restart.inProgress;
  useEffect(() => {
    if (!restartInProgress) return undefined;
    const timer = window.setInterval(load, RESTART_POLL_MS);
    return () => window.clearInterval(timer);
  }, [restartInProgress, load]);

  const handleSaved = (text: string) => {
    setMessage(`${text}。サービスを再起動すると反映されます。`);
    load();
  };

  const handleRestart = async () => {
    setRestarting(true);
    setMessage(null);
    try {
      await bffClient.restartForRuntimeSettings();
      setConfirmingRestart(false);
      setMessage('再起動を始めました。サーバーを1台ずつ入れ替えるので、終わるまで数分〜10分ほどかかります。');
      await load();
    } catch (err) {
      setError(getUserMessage(err, '再起動を始められませんでした'));
    } finally {
      setRestarting(false);
    }
  };

  const groups = (data?.settings ?? []).reduce<Record<string, RuntimeSetting[]>>((acc, s) => {
    (acc[s.group] ||= []).push(s);
    return acc;
  }, {});
  const pendingCount = (data?.settings ?? []).filter((s) => s.pendingRestart).length;

  return (
    <div style={{ fontFamily: font.family, maxWidth: 820 }}>
      <h1 style={{ ...font.sectionTitle, fontSize: 22, color: color.text, margin: '0 0 6px' }}>動作設定</h1>
      <p style={{ ...font.meta, color: color.textSecondary, margin: '0 0 20px' }}>
        AIのモデル・トークン上限、定期処理のオン/オフと間隔、接続まわりの設定を変更します。保存した値は、サービスを再起動したときに反映されます。
      </p>

      {loading ? (
        <p style={{ ...font.meta, color: color.textSecondary }}>読み込み中...</p>
      ) : (
        <>
          {error && <Notice tone="error">{error}</Notice>}
          {message && <Notice tone="success">{message}</Notice>}
          {data && !data.editable && (
            <Notice tone="info">
              この環境では今の値を表示するだけです。変更できるのは本番環境だけです(この環境の値は.envで設定します)。
            </Notice>
          )}

          {data?.restart.available && (
            <div style={{ ...t.card, padding: '18px 20px', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <p style={{ ...font.rowTitle, color: color.textStrong, margin: 0 }}>
                    {restartInProgress
                      ? `再起動中です(${data.restart.runningCount ?? '-'}/${data.restart.desiredCount ?? '-'}台が稼働中)`
                      : pendingCount > 0
                        ? `再起動待ちの設定が${pendingCount}件あります`
                        : '保存した設定はすべて反映されています'}
                  </p>
                  <p style={{ ...font.meta, color: color.textSecondary, margin: '4px 0 0' }}>
                    再起動はサーバーを1台ずつ入れ替えます。その間は処理が遅くなることがあり、実行中のAIチャットやノート生成は途中で止まることがあります。
                  </p>
                </div>
                {restartInProgress ? (
                  <button type="button" style={smallButton} onClick={load}>
                    <RefreshCw size={13} />
                    状態を更新
                  </button>
                ) : confirmingRestart ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      style={{ ...smallButton, background: color.primary, color: color.textOnPrimary, opacity: restarting ? 0.5 : 1 }}
                      disabled={restarting}
                      onClick={handleRestart}
                    >
                      {restarting ? '開始中...' : '再起動する'}
                    </button>
                    <button
                      type="button"
                      style={{ ...smallButton, color: color.textBody, borderColor: color.borderSoft }}
                      disabled={restarting}
                      onClick={() => setConfirmingRestart(false)}
                    >
                      やめる
                    </button>
                  </div>
                ) : (
                  <button type="button" style={smallButton} onClick={() => setConfirmingRestart(true)}>
                    サービスを再起動
                  </button>
                )}
              </div>
            </div>
          )}

          {Object.entries(groups).map(([group, settings]) => (
            <div key={group} style={{ ...t.card, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', ...font.cardHeading, color: color.text }}>{group}</div>
              {settings.map((setting) => (
                <SettingRow key={setting.name} setting={setting} editable={!!data?.editable} onSaved={handleSaved} />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
