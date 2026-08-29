import { LayoutGrid } from 'lucide-react';
import { color } from '../../theme/webcoachTheme';
import { AI_SKILL_META, ConcreteAiSkillId, FEATURED_AI_SKILLS } from '../../types/aiSkill';
import { AI_SKILL_ICON } from './aiSkillIcons';

/**
 * メインチャット状態の機能一覧（要件§「画面は3つの状態に分ける」2）。
 *
 * 会話が始まったあともカードを大きく出し続けると邪魔になるので、
 * ここでは名前だけの小さな行に縮める。それでも「機能はここにある」ことは
 * 見えていないと、また探せなくなる。だから消さずに縮める。
 */
interface AiSkillDockProps {
  /** 直前に使った機能を前に出す */
  recentSkills?: ConcreteAiSkillId[];
  /** 押した機能でその会話から専門モードを始める */
  onSelectSkill: (skillId: ConcreteAiSkillId) => void;
  /** ホーム（全機能一覧）へ戻る */
  onShowAll: () => void;
  /** 並べる件数。既定は3件 */
  limit?: number;
}

export function AiSkillDock({
  recentSkills = [],
  onSelectSkill,
  onShowAll,
  limit = 3,
}: AiSkillDockProps) {
  const recent = recentSkills.filter((id) => FEATURED_AI_SKILLS.includes(id));
  const shown = [...recent, ...FEATURED_AI_SKILLS.filter((id) => !recent.includes(id))].slice(
    0,
    limit
  );

  return (
    <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
      <span style={{ fontSize: 9.5, color: color.textFaint, flexShrink: 0 }}>この会話から使える機能</span>
      {shown.map((id) => {
        const meta = AI_SKILL_META[id];
        const Icon = AI_SKILL_ICON[meta.icon];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectSkill(id)}
            title={meta.description}
            className="inline-flex items-center"
            style={{
              gap: 5,
              height: 28,
              padding: '0 10px',
              border: `1px solid ${color.border}`,
              borderRadius: 999,
              background: color.surface,
              color: color.textBody,
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Icon size={11} />
            {meta.shortLabel}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onShowAll}
        className="inline-flex items-center"
        style={{
          gap: 5,
          height: 28,
          padding: '0 10px',
          border: `1px solid ${color.primaryBorder}`,
          borderRadius: 999,
          background: color.primarySoft,
          color: color.primary,
          fontSize: 10.5,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <LayoutGrid size={11} /> すべて見る
      </button>
    </div>
  );
}

export default AiSkillDock;
