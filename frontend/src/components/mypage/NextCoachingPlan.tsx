import { useNextCoachingPlan } from '../../hooks/useNextCoachingPlan';
import { color, radius, shadow, font } from '../../theme/webcoachTheme';
import { ArrowRightIcon } from './ContinueLearningHero';

interface NextCoachingPlanProps {
  userId: number | undefined;
  onContinue: () => void;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function NextCoachingPlan({ userId, onContinue }: NextCoachingPlanProps) {
  const { items, nextSession, loading } = useNextCoachingPlan(userId);
  const completedCount = items.filter((g) => g.completed).length;
  const currentIndex = items.findIndex((g) => !g.completed);

  if (loading) return null;

  return (
    <section style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.card, boxShadow: shadow.card, padding: '22px 24px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ ...font.cardTitle, color: color.text }}>次回コーチングまでの目標</div>
        {items.length > 0 && (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: color.primary }}>{completedCount}/{items.length} 完了</div>
        )}
      </div>

      {nextSession && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <CalendarIcon />
          <span style={{ fontSize: 12.5, fontWeight: 500, color: color.textSecondary }}>{nextSession.date} - {nextSession.coach}</span>
        </div>
      )}

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: color.textSubtle, marginTop: 16 }}>
          次回のコーチングで、コーチと一緒にここまでの目標を決めましょう。
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 24 }}>
          {items.map((item, i) => {
            const isNext = i === currentIndex;
            const isLater = !item.completed && !isNext;
            return (
              <div key={item.no} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {item.completed ? (
                  <span style={{ width: 27, height: 27, flex: '0 0 27px', borderRadius: '50%', background: color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckIcon />
                  </span>
                ) : isLater ? (
                  <span style={{ width: 27, height: 27, flex: '0 0 27px', borderRadius: '50%', border: `2px dashed ${color.primaryDashed}`, boxSizing: 'border-box' }} />
                ) : (
                  <span style={{ width: 27, height: 27, flex: '0 0 27px', borderRadius: '50%', border: `2px solid ${color.textStrong}`, boxSizing: 'border-box' }} />
                )}
                <span style={{ fontSize: 14.5, fontWeight: 500, color: isLater ? color.textSubtle : color.textStrong }}>{item.text}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 22 }} />
      <div
        onClick={onContinue}
        role="button"
        tabIndex={0}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 13, fontWeight: 700, color: color.textMuted, cursor: 'pointer' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = color.primary; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = color.textMuted; }}
      >
        <span>続ける</span>
        <ArrowRightIcon size={15} stroke="currentColor" />
      </div>
    </section>
  );
}

export default NextCoachingPlan;
