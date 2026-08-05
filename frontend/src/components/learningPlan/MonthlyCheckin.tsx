/**
 * frontend/src/components/learningPlan/MonthlyCheckin.tsx
 * 次回コーチングの数日前に出す月次ふりかえり。選択式4問・1分で終わる想定。
 *
 * 回答は「LMSが更新案を作るための材料」であって、ここで計画そのものは変わらない。
 * 未回答でもロードマップは維持され、実績シグナルだけで更新案は作られる。
 */
import { useMemo, useState } from 'react';
import { CheckinAnswers, CheckinPrompt } from '../../types/learningPlan';
import { formatJpDate } from '../../utils/learningPlanTemplate';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import ChoiceQuestionField from './ChoiceQuestionField';

type Value = string | number | boolean;

interface MonthlyCheckinProps {
  prompt: CheckinPrompt;
  busy: boolean;
  onSubmit: (answers: CheckinAnswers) => void;
  onCancel: () => void;
}

function MonthlyCheckin({ prompt, busy, onSubmit, onCancel }: MonthlyCheckinProps) {
  const [answers, setAnswers] = useState<Record<string, Value | Value[]>>({
    goalResult: 'partial',
    hoursChange: 'same',
    blockers: [],
    goalChange: 'none',
  });

  const complete = useMemo(
    () => prompt.questions.every((q) => (q.kind === 'multi' ? true : answers[q.id] !== undefined)),
    [answers, prompt.questions],
  );

  const submit = () => {
    onSubmit({
      goalResult: answers.goalResult as CheckinAnswers['goalResult'],
      hoursChange: answers.hoursChange as CheckinAnswers['hoursChange'],
      blockers: (answers.blockers as CheckinAnswers['blockers']) ?? [],
      goalChange: answers.goalChange as CheckinAnswers['goalChange'],
    });
  };

  return (
    <section
      style={{
        background: color.surface, border: `1px solid ${color.border}`,
        borderRadius: radius.card, boxShadow: '0 8px 26px rgba(190,60,70,.06)', padding: '24px 26px 22px',
      }}
    >
      <div style={{ ...font.cardTitle, color: color.text }}>今月のふりかえり（約1分）</div>
      <p style={{ ...font.meta, color: color.textMuted, margin: '8px 0 0', lineHeight: 1.8 }}>
        {formatJpDate(prompt.dueDate)}の見直しに向けて、4つだけ教えてください。
        回答をもとにLMSが更新案を作り、次回のコーチングで一緒に確認できるようにします。
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 24 }}>
        {prompt.questions.map((q) => (
          <ChoiceQuestionField
            key={q.id}
            question={q}
            size="compact"
            value={answers[q.id]}
            onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 26 }}>
        <button
          type="button"
          disabled={busy || !complete}
          onClick={submit}
          style={{ ...t.primaryButton, padding: '14px 26px', fontSize: 14, opacity: busy || !complete ? 0.6 : 1 }}
        >
          {busy ? '送信中…' : '回答して更新案をみる'}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} style={{ ...t.outlineButton }}>
          あとで
        </button>
      </div>
    </section>
  );
}

export default MonthlyCheckin;
