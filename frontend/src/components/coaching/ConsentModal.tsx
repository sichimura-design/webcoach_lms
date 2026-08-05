/**
 * 初回のみ表示する同意モーダル。
 *
 * 記録するのは受講生の端末ではなく会議側だが、記録されること自体は本人が把握して
 * 同意している必要がある。同意は一度記録したら以降は省略する。
 */
import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';

interface ConsentModalProps {
  onAgree: () => Promise<void>;
  onClose: () => void;
}

const WHAT_WE_DO = [
  '会話の録音',
  '文字起こし',
  'AIによる要約',
  '次回までの目標・タスクの整理',
];

export function ConsentModal({ onAgree, onClose }: ConsentModalProps) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const agree = async () => {
    if (!checked || saving) return;
    setSaving(true);
    try {
      await onAgree();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: font.family,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: color.surface,
          borderRadius: radius.card,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles className="w-5 h-5" style={{ color: color.primary }} />
            <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>
              AIコーチングノートを開始します
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
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

        <p style={{ ...font.meta, color: color.textBody, margin: '16px 0 12px', lineHeight: 1.9 }}>
          このコーチングでは、振り返りと目標設定のために以下を行います。
        </p>

        <ul
          style={{
            listStyle: 'none',
            margin: '0 0 16px',
            padding: '14px 16px',
            background: color.pageBg,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {WHAT_WE_DO.map((item) => (
            <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span aria-hidden style={{ color: color.primary }}>・</span>
              <span style={{ ...font.meta, color: color.textBody }}>{item}</span>
            </li>
          ))}
        </ul>

        <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 18px', lineHeight: 1.9 }}>
          記録内容は、受講生・担当コーチ・運営管理者のみが確認できます。
        </p>

        <label
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            cursor: 'pointer',
            padding: '12px 14px',
            border: `1px solid ${checked ? color.primaryBorder : color.border}`,
            background: checked ? color.primaryTint : color.surface,
            borderRadius: radius.md,
            marginBottom: 18,
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: 3, accentColor: color.primary }}
          />
          <span style={{ ...font.meta, color: color.textBody }}>
            録音・文字起こし・AI要約に同意します。
          </span>
        </label>

        <button
          type="button"
          onClick={agree}
          disabled={!checked || saving}
          style={{
            ...t.primaryButton,
            justifyContent: 'center',
            opacity: checked && !saving ? 1 : 0.5,
            cursor: checked && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? '準備しています…' : '同意してコーチングに参加'}
        </button>
      </div>
    </div>
  );
}

export default ConsentModal;
