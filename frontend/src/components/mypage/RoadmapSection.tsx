import { useHomeRoadmap } from '../../hooks/useHomeRoadmap';
import { color, radius, shadow, font } from '../../theme/webcoachTheme';
import { ArrowRightIcon } from './ContinueLearningHero';

interface RoadmapSectionProps {
  userId: number | undefined;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function RoadmapSection({ userId }: RoadmapSectionProps) {
  const { journey, steps, currentIndex, doneCount, progressFraction } = useHomeRoadmap(userId);

  if (!journey || steps.length === 0) return null;

  const spanPercent = 100 - 2 * 8.33;
  const currentLabel = currentIndex >= 0 ? steps[currentIndex].label : steps[steps.length - 1].label;

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.card, boxShadow: shadow.card, padding: '24px 28px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...font.sectionTitle, color: color.text }}>目標に向けたロードマップ</div>
          <div style={{ fontSize: 12.5, color: color.textSubtle, marginTop: 7 }}>
            {steps.length} ステップ中 {doneCount} つ完了・いまは「{currentLabel}」
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: color.primary, cursor: 'pointer', paddingTop: 4 }}>
          <span>全体をみる</span>
          <ArrowRightIcon size={14} stroke={color.primary} />
        </div>
      </div>

      <div className="home-roadmap-grid" style={{ position: 'relative', alignItems: 'start', marginTop: 34 }}>
        <div style={{ position: 'absolute', left: '8.33%', right: '8.33%', top: 13, height: 3, background: color.trackBg, borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: '8.33%', width: `${spanPercent * progressFraction}%`, top: 13, height: 3, background: color.primary, borderRadius: 2 }} />

        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          return (
            <div key={step.label} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, cursor: step.onClick ? 'pointer' : undefined }} onClick={step.onClick}>
              {isCurrent && (
                <div style={{ position: 'absolute', top: -40, left: 'calc(50% + 22px)', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: color.primary, background: color.primarySoft, borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap' }}>いまここ</span>
                </div>
              )}
              {step.status === 'done' ? (
                <span style={{ width: 29, height: 29, borderRadius: '50%', background: color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow.stepRing }}>
                  <CheckIcon />
                </span>
              ) : isCurrent ? (
                <span style={{ width: 33, height: 33, borderRadius: '50%', background: color.surface, border: `3px solid ${color.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: shadow.currentStep, marginTop: -2 }}>
                  <img src={`${process.env.PUBLIC_URL}/images/home/avatar-user.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </span>
              ) : (
                <span style={{ width: 29, height: 29, borderRadius: '50%', background: color.surface, border: `2px solid ${color.borderNeutral}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: color.textSubtle, boxShadow: shadow.stepRing }}>
                  {i + 1}
                </span>
              )}
              <span style={{ fontSize: 12.5, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? color.primary : step.status === 'done' ? color.textSecondary : color.textSubtle }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RoadmapSection;
