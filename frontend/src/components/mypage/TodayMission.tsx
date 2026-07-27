import { ChevronRight, Check } from 'lucide-react';
import { DailyTodo, JourneyTodayQuest, Course } from '../../types/mypage';
import { EXP_RULES } from '../../utils/progression';

interface TodayMissionProps {
  quest: JourneyTodayQuest | null;
  questCourse?: Course;
  todos: DailyTodo[];
  onToggleTodo: (id: number) => void;
  onOpenQuest: () => void;
}

function TodayMission({ quest, questCourse, todos, onToggleTodo, onOpenQuest }: TodayMissionProps) {
  const todoRemain = todos.filter((t) => !t.done).length;
  const allDone = todos.length > 0 && todoRemain === 0;
  const expPreview = todoRemain * EXP_RULES.TODO_COMPLETE + (allDone ? 0 : EXP_RULES.MISSION_ALL_DONE_BONUS);
  const questProgress = questCourse?.progress ?? 0;

  return (
    <div
      className="bg-white flex flex-col flex-1"
      style={{ borderRadius: 20, boxShadow: '0 8px 26px rgba(190,60,70,.08)', padding: '24px 26px', gap: 16, minWidth: 260 }}
    >
      <div className="flex items-center justify-between">
        <div style={{ fontWeight: 700, color: '#2A2230', fontSize: 16 }}>今日のミッション</div>
        <span style={{ fontSize: 12, color: '#9A8B8D' }}>{todoRemain}件 残り</span>
      </div>

      {quest && (
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#3A2230' }}>{quest.title}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#E0213A', background: '#FCE7E7', padding: '2px 10px', borderRadius: 999 }}>進行中</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: '#F1E3E3' }}>
              <div className="h-full rounded-full" style={{ width: `${questProgress}%`, background: 'linear-gradient(90deg,#F0546A,#E0213A)' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#E0213A' }}>{questProgress}%</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {todos.map(t => (
          <button
            key={t.id}
            onClick={() => onToggleTodo(t.id)}
            className="flex items-center text-left appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ gap: 11, padding: '11px 13px', borderRadius: 12, background: '#FBF3F3' }}
          >
            {t.done ? (
              <span className="flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, borderRadius: 7, background: '#E0213A' }}>
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </span>
            ) : (
              <span className="flex-shrink-0" style={{ width: 22, height: 22, borderRadius: 7, border: '2px solid #E7B4B8' }} />
            )}
            <span style={{ fontSize: 14, color: '#3A2F35', fontWeight: 500, textDecoration: t.done ? 'line-through' : undefined }}>{t.text}</span>
          </button>
        ))}
      </div>

      {quest && (
        <button
          onClick={onOpenQuest}
          className="flex items-center text-left appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{ gap: 12, padding: '14px 16px', borderRadius: 14, background: '#FBF3F3' }}
        >
          <span className="flex-1 min-w-0">
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#E0213A' }}>次にやること・おすすめアクション</span>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#2A2230', marginTop: 2 }}>{quest.subtitle}</span>
          </span>
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#E0213A' }} />
        </button>
      )}

      <div style={{ marginTop: 4, borderTop: '1px solid #F3E6E6', paddingTop: 12, textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: '#9A8B8D' }}>
          ミッション達成で <span style={{ color: '#E0213A', fontWeight: 700 }}>⭐+{expPreview} exp</span>
        </span>
      </div>
    </div>
  );
}

export default TodayMission;
