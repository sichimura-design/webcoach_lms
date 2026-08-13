import { useEffect, useState } from 'react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { COACHING_AGENDA_MAX } from '../../types/coaching';
import type { CoachingAgenda } from '../../types/coaching';

/**
 * 「コーチに相談したいこと」。
 *
 * コーチング当日に「何を話すんだっけ」から始まらないよう、
 * 思いついたときに書き置ける場所として新設した。
 * このページを「予定を確認するだけの場所」から「次回に向けて準備する場所」に変える部品。
 *
 * 保存は明示的なボタン。自動保存にすると、打っている途中の断片が
 * コーチに見える前提の文章として確定してしまう。
 */
interface CoachingAgendaCardProps {
  agenda: CoachingAgenda | null;
  saving: boolean;
  onSave: (text: string) => void;
}

function formatUpdatedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm} に保存`;
}

export function CoachingAgendaCard({ agenda, saving, onSave }: CoachingAgendaCardProps) {
  const [draft, setDraft] = useState('');

  // 取得が返ってきたら下書きに流し込む。以後の編集は上書きしない
  useEffect(() => {
    setDraft(agenda?.text ?? '');
  }, [agenda]);

  const dirty = draft !== (agenda?.text ?? '');
  const savedAt = formatUpdatedAt(agenda?.updatedAt ?? null);

  return (
    <section style={{ ...t.card, padding: 24 }}>
      <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>コーチに相談したいこと</h2>
      <p style={{ ...font.meta, color: color.textMuted, margin: '6px 0 14px', lineHeight: 1.8 }}>
        課題や悩み、次回のコーチングで相談したいことを自由に書いておけます。
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, COACHING_AGENDA_MAX))}
            placeholder="記入例：バナー制作で迷っている点、フィードバックしてほしい部分 など"
            rows={3}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: `1px solid ${color.border}`,
              borderRadius: radius.md,
              padding: '13px 15px',
              fontFamily: 'inherit',
              fontSize: 13.5,
              lineHeight: 1.9,
              color: color.textStrong,
              background: color.surface,
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
            <span style={{ ...font.caption, color: color.textFaint }}>{savedAt ?? ''}</span>
            <span style={{ ...font.caption, color: color.textFaint, fontVariantNumeric: 'tabular-nums' }}>
              {draft.length} / {COACHING_AGENDA_MAX}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={!dirty || saving}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            ...t.ghostButton,
            width: 'auto',
            marginBottom: 26,
            padding: '13px 24px',
            cursor: !dirty || saving ? 'default' : 'pointer',
            opacity: !dirty || saving ? 0.5 : 1,
            ...(dirty && !saving
              ? { background: color.primary, color: color.textOnPrimary, border: 'none' }
              : null),
          }}
        >
          {saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </section>
  );
}

export default CoachingAgendaCard;
