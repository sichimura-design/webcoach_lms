import { ArrowRight, ImagePlus } from 'lucide-react';
import { color } from '../../theme/webcoachTheme';
import { AI_SKILL_CATEGORY_LABEL, AI_SKILL_META, ConcreteAiSkillId } from '../../types/aiSkill';
import { AI_SKILL_ICON } from './aiSkillIcons';

/**
 * AI機能1件のカード（要件「アプリカードに表示する内容」）。
 *
 * 名前だけを並べても受講生は違いを判断できないので、必ず
 *   何ができるか / 何を入力するか / どんな場面で使うか
 * の3点を出す。文言は types/aiSkill.ts の AI_SKILL_META にあり、
 * 裏で動くアプリ名（Dify側の識別子）はここへ渡ってこない。
 *
 * variant:
 *   full    … 「すべてのAI機能」の一覧。3点すべてを出す
 *   compact … 「よく使うAI」。説明1文までに絞って横に6件並べる
 */
interface AiSkillCardProps {
  skillId: ConcreteAiSkillId;
  variant?: 'full' | 'compact';
  onSelect: (skillId: ConcreteAiSkillId) => void;
}

export function AiSkillCard({ skillId, variant = 'full', onSelect }: AiSkillCardProps) {
  const meta = AI_SKILL_META[skillId];
  const Icon = AI_SKILL_ICON[meta.icon];
  const compact = variant === 'compact';

  return (
    <button
      type="button"
      onClick={() => onSelect(skillId)}
      className="group flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        gap: compact ? 8 : 10,
        height: '100%',
        padding: compact ? '14px 14px 13px' : '17px 18px 16px',
        border: `1px solid ${color.border}`,
        borderRadius: 16,
        background: color.surface,
        cursor: 'pointer',
        transition: 'border-color .15s ease, box-shadow .15s ease, transform .15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color.primaryBorderSoft;
        e.currentTarget.style.boxShadow = '0 8px 22px rgba(190,60,70,.07)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = color.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-center" style={{ gap: 10, width: '100%' }}>
        <span
          aria-hidden
          className="grid place-items-center flex-shrink-0"
          style={{
            width: compact ? 32 : 36,
            height: compact ? 32 : 36,
            borderRadius: 10,
            background: color.primarySoft,
            color: color.primary,
          }}
        >
          <Icon size={compact ? 16 : 18} />
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: compact ? 12.5 : 13.5,
            fontWeight: 800,
            color: color.text,
            lineHeight: 1.45,
          }}
        >
          {meta.label}
        </span>
        {!compact && (
          <ArrowRight
            size={15}
            style={{ color: color.textFaint, flexShrink: 0 }}
            className="transition-transform group-hover:translate-x-0.5"
          />
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 11.5,
          lineHeight: 1.75,
          color: color.textSecondary,
          display: '-webkit-box',
          WebkitLineClamp: compact ? 2 : 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {meta.description}
      </p>

      {!compact && (
        <>
          <div style={{ height: 1, background: color.border, margin: '2px 0' }} />
          <dl style={{ margin: 0, display: 'grid', gap: 5 }}>
            <div className="flex" style={{ gap: 7 }}>
              <dt style={labelStyle}>入力</dt>
              <dd style={valueStyle}>{meta.inputHint}</dd>
            </div>
            <div className="flex" style={{ gap: 7 }}>
              <dt style={labelStyle}>使う場面</dt>
              <dd style={valueStyle}>{meta.useCase}</dd>
            </div>
          </dl>
          <div className="flex items-center" style={{ gap: 6, marginTop: 'auto', paddingTop: 8 }}>
            <span
              style={{
                padding: '3px 9px',
                borderRadius: 999,
                background: color.hoverBg,
                color: color.textMuted,
                fontSize: 9.5,
                fontWeight: 700,
              }}
            >
              {AI_SKILL_CATEGORY_LABEL[meta.category]}
            </span>
            {meta.needsImage && (
              <span
                className="inline-flex items-center"
                style={{
                  gap: 3,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: color.primarySoft,
                  color: color.primary,
                  fontSize: 9.5,
                  fontWeight: 700,
                }}
              >
                <ImagePlus size={10} /> 画像が必要
              </span>
            )}
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10.5,
                fontWeight: 800,
                color: color.primary,
              }}
            >
              使ってみる
            </span>
          </div>
        </>
      )}
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 46,
  fontSize: 9.5,
  fontWeight: 800,
  color: color.textFaint,
  paddingTop: 1,
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 10.5,
  lineHeight: 1.7,
  color: color.textMuted,
};

export default AiSkillCard;
