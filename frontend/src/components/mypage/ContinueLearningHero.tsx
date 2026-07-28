import { Course } from '../../types/mypage';
import { color, radius, shadow, gradient, font, t } from '../../theme/webcoachTheme';

interface ContinueLearningHeroProps {
  course: Course;
  onOpen: () => void;
}

function ArrowRightIcon({ size = 15, stroke = '#FFFFFF' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function ContinueLearningHero({ course, onOpen }: ContinueLearningHeroProps) {
  const meta = [course.currentChapter && `${course.currentChapter}から再開`, course.remainingMinutes && `残り約${course.remainingMinutes}分`]
    .filter(Boolean)
    .join('・');

  return (
    <div className="home-hero" style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.hero, boxShadow: shadow.hero, overflow: 'hidden' }}>
      <div className="home-hero-thumb" style={{ width: 198, flex: '0 0 198px', background: gradient.heroThumb, position: 'relative', overflow: 'hidden' }}>
        <img src={`${process.env.PUBLIC_URL}/images/home/hero-thumb.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div className="home-hero-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, padding: '26px 30px 26px 34px' }}>
        <div>
          <div style={{ ...font.eyebrow, color: color.primary }}>CONTINUE</div>
          <div style={{ ...font.heroTitle, color: color.text, marginTop: 10 }}>{course.currentLesson || course.title}</div>
          <div style={{ fontSize: 12.5, color: color.textSubtle, marginTop: 9 }}>
            {course.title}{meta && `・${meta}`}
          </div>
        </div>
        <button onClick={onOpen} style={t.primaryButton} onMouseEnter={(e) => { e.currentTarget.style.background = color.primaryHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = color.primary; }}>
          <span>続きからはじめる</span>
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

export default ContinueLearningHero;
export { ArrowRightIcon };
