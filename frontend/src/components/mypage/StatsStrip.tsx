import { useNavigate } from 'react-router-dom';
import { color, radius, shadow, t } from '../../theme/webcoachTheme';
import { ArrowRightIcon } from './ContinueLearningHero';

interface StatsStripProps {
  thisWeekMinutes: number;
  weekDeltaMinutes: number | null;
  weeklyTargetMinutes: number;
  totalStudyMinutes: number;
  completedLessons: number;
  completedCourses: number;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

function ClockIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8.2" />
      <path d="M12 8.6V13l3 2" />
      <path d="M8.6 2.8 6 4.6M15.4 2.8 18 4.6" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color.textBody} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.5S9.5 4.5 3.5 4.5v13C9.5 17.5 12 19.5 12 19.5s2.5-2 8.5-2v-13C14.5 4.5 12 6.5 12 6.5z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

function GraduationIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color.textBody} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5 2.5 9.5 12 14l9.5-4.5z" />
      <path d="M6.5 11.5V16c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.5" />
      <path d="M21.5 9.5V15" />
    </svg>
  );
}

function AwardIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={color.textBody} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.8 7 21.5l5-2.6 5 2.6-1.5-7.7" />
    </svg>
  );
}

function Divider() {
  return <div className="home-stat-divider" style={{ width: 1, height: 56, background: color.divider, margin: '0 26px' }} />;
}

function StatsStrip({ thisWeekMinutes, weekDeltaMinutes, weeklyTargetMinutes, totalStudyMinutes, completedLessons, completedCourses }: StatsStripProps) {
  const navigate = useNavigate();

  return (
    <div className="home-stats" style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.card, boxShadow: shadow.card, padding: '20px 28px' }}>
      <div className="home-stat-item" style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
        <ClockIcon />
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: color.textSubtle }}>今週の学習時間</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: color.text, letterSpacing: '.2px' }}>{formatMinutes(thisWeekMinutes)}</span>
            {weekDeltaMinutes !== null && (
              <span style={t.chip}>{weekDeltaMinutes >= 0 ? '+' : ''}{weekDeltaMinutes}分</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: color.textFaint, marginTop: 5 }}>目標 {formatMinutes(weeklyTargetMinutes)} / 週</div>
        </div>
      </div>
      <Divider />
      <div className="home-stat-item" style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 200px' }}>
        <BookIcon />
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: color.textSubtle }}>累計学習時間</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: color.text, marginTop: 4 }}>{Math.round(totalStudyMinutes / 60)} 時間</div>
        </div>
      </div>
      <Divider />
      <div className="home-stat-item" style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 190px' }}>
        <GraduationIcon />
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: color.textSubtle }}>レッスン完了数</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: color.text, marginTop: 4 }}>{completedLessons}</div>
        </div>
      </div>
      <Divider />
      <div className="home-stat-item" style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 160px' }}>
        <AwardIcon />
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: color.textSubtle }}>修了コース数</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: color.text, marginTop: 4 }}>{completedCourses}</div>
        </div>
      </div>
      <button
        onClick={() => navigate('/badges')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: color.surface, border: `1px solid ${color.primaryBorder}`, borderRadius: radius.pill, padding: '13px 22px', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: color.primary, cursor: 'pointer', whiteSpace: 'nowrap' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#FFF3F4'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = color.surface; }}
      >
        <span>学習ログを見る</span>
        <ArrowRightIcon size={15} stroke={color.primary} />
      </button>
    </div>
  );
}

export default StatsStrip;
