import { useState } from 'react';
import { ChevronDown, ChevronUp, LayoutGrid } from 'lucide-react';
import { color } from '../../theme/webcoachTheme';
import {
  AI_SKILL_CATEGORY_LABEL,
  AI_SKILL_CATEGORY_ORDER,
  AI_SKILL_META,
  ConcreteAiSkillId,
  FEATURED_AI_SKILLS,
  skillsInCategory,
} from '../../types/aiSkill';
import { AI_SKILL_ICON } from './aiSkillIcons';

/**
 * 会話中の画面の機能一覧（入力欄の上）。
 *
 * 会話が始まったあともカードを大きく出し続けると邪魔になるので、
 * 既定では名前だけの小さな行に縮める。それでも「機能はここにある」ことは
 * 見えていないと、また探せなくなる。だから消さずに縮める。
 *
 * 🔴「すべて見る」で画面遷移しないこと。
 *    以前はホーム（全機能一覧）へ戻していたが、残り8個を見るためだけに
 *    会話から抜ける必要があり、戻る手間もかかっていた。全11件はこの場で
 *    カテゴリ別に展開する。会話を見失わせないのがこの部品の役割。
 *
 * 展開パネルには必ず高さの上限を置く。AiCoachPane は縦フレックスで
 * 会話部が flex:1 / minHeight:0、この footerSlot が flexShrink:0 なので、
 * 上限が無いと11件がメッセージ領域を押し潰す。
 */
interface AiSkillDockProps {
  /** 直前に使った機能を前に出す（畳んでいるときの3件） */
  recentSkills?: ConcreteAiSkillId[];
  /** 押した機能でその会話から専門モードを始める */
  onSelectSkill: (skillId: ConcreteAiSkillId) => void;
  /** 専門モードのとき、いま使っているアプリ。一覧内で「使用中」として出す */
  activeSkillId?: ConcreteAiSkillId | null;
  /** 畳んでいるときに並べる件数。既定は3件 */
  limit?: number;
}

const PANEL_ID = 'ai-skill-dock-panel';

export function AiSkillDock({
  recentSkills = [],
  onSelectSkill,
  activeSkillId = null,
  limit = 3,
}: AiSkillDockProps) {
  const [open, setOpen] = useState(false);

  const recent = recentSkills.filter((id) => FEATURED_AI_SKILLS.includes(id));
  const shown = [...recent, ...FEATURED_AI_SKILLS.filter((id) => !recent.includes(id))].slice(
    0,
    limit
  );

  const select = (id: ConcreteAiSkillId) => {
    setOpen(false);
    onSelectSkill(id);
  };

  return (
    <div>
      {/* ── 全件（カテゴリ別）。チップ行の上に開く ──
          入力欄から遠ざけないよう、下ではなく上へ伸ばす。 */}
      {open && (
        <div
          id={PANEL_ID}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          style={{
            maxHeight: 'min(180px, 30vh)',
            overflowY: 'auto',
            marginBottom: 8,
            padding: '9px 10px',
            border: `1px solid ${color.border}`,
            borderRadius: 10,
            background: color.pageBg,
          }}
        >
          {AI_SKILL_CATEGORY_ORDER.map((category) => (
            <div
              key={category}
              className="flex flex-wrap items-center"
              style={{ gap: 6, marginTop: 8 }}
            >
              <span
                style={{
                  width: 44,
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: color.textFaint,
                  flexShrink: 0,
                }}
              >
                {AI_SKILL_CATEGORY_LABEL[category]}
              </span>
              {skillsInCategory(category).map((id) => renderPill(id))}
            </div>
          ))}
        </div>
      )}

      {/* ── 畳んでいるときの行。開いていてもそのまま残す（戻り先を消さない） ── */}
      <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
        <span style={{ fontSize: 9.5, color: color.textFaint, flexShrink: 0 }}>
          {activeSkillId ? '他のAIアプリに切り替える' : 'この会話から使える機能'}
        </span>
        {!open && shown.map((id) => renderPill(id))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={PANEL_ID}
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
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <LayoutGrid size={11} />
          {open ? '閉じる' : 'すべて見る'}
          {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>
    </div>
  );

  /** チップ1個。畳んだ行と展開パネルで同じ形にする */
  function renderPill(id: ConcreteAiSkillId) {
    const meta = AI_SKILL_META[id];
    const Icon = AI_SKILL_ICON[meta.icon];
    const isActive = id === activeSkillId;
    return (
      <button
        key={id}
        type="button"
        onClick={() => select(id)}
        disabled={isActive}
        aria-current={isActive ? true : undefined}
        title={isActive ? `${meta.shortLabel}（いま使用中）` : meta.description}
        className="inline-flex items-center"
        style={{
          gap: 5,
          height: 28,
          padding: '0 10px',
          border: `1px solid ${isActive ? color.primaryBorder : color.border}`,
          borderRadius: 999,
          background: isActive ? color.primarySoft : color.surface,
          color: isActive ? color.primary : color.textBody,
          fontSize: 10.5,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: isActive ? 'default' : 'pointer',
        }}
      >
        <Icon size={11} />
        {meta.shortLabel}
        {isActive && (
          <span style={{ fontWeight: 400, color: color.primary }}>・使用中</span>
        )}
      </button>
    );
  }
}

export default AiSkillDock;
