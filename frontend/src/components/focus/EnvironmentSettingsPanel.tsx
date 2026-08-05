import { useEffect } from 'react';
import { X } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import {
  AMBIENT_KIND_LABEL,
  AmbientKind,
  BGM_TRACK_LABEL,
  BgmTrack,
  useFocusEnvironmentStore,
} from '../../store/focusEnvironmentStore';

/**
 * 環境設定（BGM・環境音・通知）。右から出るドロワー。
 *
 * ポップオーバーにしないのは、3グループ＋スライダーで縦が 400px を超えてページ外に
 * はみ出すため。中央モーダルも避けたのは、音量を触りながらタイマーの状態を見たいのに
 * 左のダイヤルを覆ってしまうため。
 * overlay の作法は coaching/MeetingLinkModal.tsx を流用し、幾何だけ右寄せにしている。
 *
 * 🔴 BGM・環境音は「設定を保存するだけ」。理由は store/focusEnvironmentStore.ts に記載。
 *    機能しているふりをさせないため「近日対応」を明記する。
 */
interface EnvironmentSettingsPanelProps {
  onClose: () => void;
}

function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        width: 44,
        height: 26,
        borderRadius: radius.pill,
        border: 'none',
        background: checked ? color.primary : color.trackBg,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: 'background .18s ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: color.surface,
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transform: `translateX(${checked ? 18 : 0}px)`,
          transition: 'transform .18s ease',
        }}
      />
    </button>
  );
}

function SectionHeader({
  title,
  soon,
  children,
}: {
  title: string;
  soon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ ...font.rowTitle, color: color.text }}>{title}</span>
        {soon && (
          <span style={{ ...t.chip, background: color.pageBg, color: color.textMuted }}>
            近日対応
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

function RadioCard<T extends string>({
  name,
  value,
  current,
  label,
  onSelect,
}: {
  name: string;
  value: T;
  current: T;
  label: string;
  onSelect: (v: T) => void;
}) {
  const active = current === value;
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 13px',
        border: `1px solid ${active ? color.primaryBorder : color.border}`,
        background: active ? color.primaryTint : color.surface,
        borderRadius: radius.md,
        cursor: 'pointer',
        marginBottom: 8,
      }}
    >
      <input
        type="radio"
        name={name}
        checked={active}
        onChange={() => onSelect(value)}
        style={{ accentColor: color.primary, flexShrink: 0 }}
      />
      <span style={{ ...font.meta, color: color.text }}>{label}</span>
    </label>
  );
}

export function EnvironmentSettingsPanel({ onClose }: EnvironmentSettingsPanelProps) {
  const env = useFocusEnvironmentStore();

  // 既存のモーダルには Escape が無いが、ドロワーは面積が大きく閉じ方が分かりにくいので付ける
  // （learning/SkillSelector.tsx と同じ作法）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const backdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={backdrop}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        justifyContent: 'flex-end',
        fontFamily: font.family,
      }}
    >
      <div
        role="dialog"
        aria-label="環境設定"
        style={{
          width: 'min(380px, 100vw)',
          height: '100%',
          overflowY: 'auto',
          background: color.surface,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
          borderTopLeftRadius: radius.card,
          borderBottomLeftRadius: radius.card,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 22px 0',
          }}
        >
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>環境設定</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: 'none',
              background: color.pageBg,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X className="w-4 h-4" style={{ color: color.textMuted }} />
          </button>
        </div>

        <div style={{ padding: '16px 22px 28px' }}>
          {/* ---- BGM ---- */}
          <SectionHeader title="BGM" soon>
            <Switch
              label="BGM"
              checked={env.bgmEnabled}
              onChange={(v) => env.set({ bgmEnabled: v })}
            />
          </SectionHeader>
          {env.bgmEnabled &&
            (Object.keys(BGM_TRACK_LABEL) as BgmTrack[]).map((k) => (
              <RadioCard
                key={k}
                name="bgm-track"
                value={k}
                current={env.bgmTrack}
                label={BGM_TRACK_LABEL[k]}
                onSelect={(v) => env.set({ bgmTrack: v })}
              />
            ))}

          <div style={{ height: 1, background: color.divider, margin: '18px 0' }} />

          {/* ---- 環境音 ---- */}
          <SectionHeader title="環境音" soon>
            <Switch
              label="環境音"
              checked={env.ambientEnabled}
              onChange={(v) => env.set({ ambientEnabled: v })}
            />
          </SectionHeader>
          {env.ambientEnabled &&
            (Object.keys(AMBIENT_KIND_LABEL) as AmbientKind[]).map((k) => (
              <RadioCard
                key={k}
                name="ambient-kind"
                value={k}
                current={env.ambientKind}
                label={AMBIENT_KIND_LABEL[k]}
                onSelect={(v) => env.set({ ambientKind: v })}
              />
            ))}

          {(env.bgmEnabled || env.ambientEnabled) && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span style={{ ...font.label, color: color.textSubtle }}>音量</span>
                <span style={{ ...font.label, color: color.textBody }}>{env.volume}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={env.volume}
                onChange={(e) => env.set({ volume: Number(e.target.value) })}
                style={{ accentColor: color.primary, width: '100%' }}
              />
            </div>
          )}

          <p style={{ ...font.caption, color: color.textMuted, margin: '14px 0 0', lineHeight: 1.9 }}>
            設定は保存され、音源の準備ができ次第そのまま有効になります。いまは音は再生されません。
          </p>

          <div style={{ height: 1, background: color.divider, margin: '18px 0' }} />

          {/* ---- 通知 ---- */}
          <div style={{ ...font.rowTitle, color: color.text, marginBottom: 12 }}>通知</div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', ...font.meta, color: color.text }}>
                画面内で知らせる
              </span>
              <span
                style={{ display: 'block', ...font.caption, color: color.textSubtle, marginTop: 3 }}
              >
                ポモドーロの設定時間に到達したとき
              </span>
            </span>
            <Switch
              label="画面内で知らせる"
              checked={env.notifyInPage}
              onChange={(v) => env.set({ notifyInPage: v })}
            />
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <span style={{ minWidth: 0 }}>
              <span
                style={{ display: 'flex', alignItems: 'center', gap: 8, ...font.meta, color: color.text }}
              >
                ブラウザ通知
                <span style={{ ...t.chip, background: color.pageBg, color: color.textMuted }}>
                  近日対応
                </span>
              </span>
              <span
                style={{ display: 'block', ...font.caption, color: color.textSubtle, marginTop: 3 }}
              >
                他のタブを見ているときも知らせる
              </span>
            </span>
            <Switch
              label="ブラウザ通知"
              checked={env.notifyBrowser}
              onChange={(v) => env.set({ notifyBrowser: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnvironmentSettingsPanel;
