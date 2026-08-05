import { Sparkles, ImagePlus, Maximize2 } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import {
  AiSkillId,
  AI_SKILL_CTA,
  AI_SKILL_META,
  AI_SKILL_NEEDS_IMAGE,
  AI_SKILL_PREFER_WIDE,
  AI_SKILL_SHORT_LABEL,
  isConcreteSkill,
  SkillSuggestion,
} from '../../types/aiSkill';
import type { ProposalResolution } from '../../types/aiCoach';

/**
 * 専門モードへ入る前の提案カード（仕様§2・§4）。
 *
 * ここで一番大事なのは文言。ユーザーには「Difyアプリを起動する」ではなく
 * 「詳しく添削する」と見せる。裏で何のアプリが動くかは実装の話であって、
 * ユーザーの目的ではないため。AI_SKILL_CTA に文言を寄せてある。
 *
 * variant:
 *   confirm … 明確に専門処理を求めているとき。回答の前に出し、押すまで実行しない
 *   inline  … 通常回答の下に控えめに出すとき。押さなければ何も起きない
 */
interface SkillProposalCardProps {
  suggestion: SkillSuggestion;
  variant: 'confirm' | 'inline';
  resolution: ProposalResolution;
  /** 画像が必要なスキルで画像が無いとき、添付を促すために使う */
  hasImage: boolean;
  disabled: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  onRequestImage: () => void;
  /**
   * 「広い画面で開く」（要件§「教材学習画面との接続」）。
   * 教材ページの右パネルは手狭なので、添削のように作業が続くモードは
   * AI専用ページで開けるようにする。渡されたときだけボタンを出す。
   */
  onOpenWide?: (skillId: AiSkillId) => void;
}

export function SkillProposalCard({
  suggestion,
  variant,
  resolution,
  hasImage,
  disabled,
  onAccept,
  onDismiss,
  onRequestImage,
  onOpenWide,
}: SkillProposalCardProps) {
  const name = AI_SKILL_SHORT_LABEL[suggestion.skillId];
  const needsImage = AI_SKILL_NEEDS_IMAGE[suggestion.skillId] && !hasImage;
  const canOpenWide = !!onOpenWide && AI_SKILL_PREFER_WIDE[suggestion.skillId] && !needsImage;

  // 決着済みの提案は、経過として1行だけ残す。カードのまま残すと会話が読みにくい。
  if (resolution) {
    return (
      <div
        style={{
          margin: variant === 'inline' ? '8px 0 0' : '0 0 14px',
          fontSize: 10,
          color: color.textFaint,
        }}
      >
        {resolution === 'accepted'
          ? `この提案から${name}を実行しました`
          : `この提案は使いませんでした`}
      </div>
    );
  }

  return (
    <div
      style={{
        margin: variant === 'inline' ? '9px 0 0' : '0 0 14px',
        padding: variant === 'inline' ? '10px 11px' : '12px 13px',
        border: `1px solid ${color.primaryBorder}`,
        borderRadius: 12,
        background: variant === 'inline' ? color.hoverBgTint : color.primarySoft,
      }}
    >
      <div className="flex items-center" style={{ gap: 6, marginBottom: 6 }}>
        <Sparkles size={13} style={{ color: color.primary, flexShrink: 0 }} />
        <strong style={{ ...font.label, fontWeight: 800, color: color.text }}>
          {variant === 'confirm' ? `${name}モードで確認しますか？` : `${name}が適しています`}
        </strong>
      </div>

      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.75, color: color.textBody }}>
        {needsImage
          ? '制作物の画像を添付すると、いまの教材と課題基準に照らして項目別に確認できます。'
          : descriptionOf(suggestion.skillId) || '教材の内容に沿って、もう一段詳しく見ていきます。'}
      </p>

      {suggestion.references.length > 0 && !needsImage && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: color.textSubtle, marginBottom: 3 }}>
            参照予定
          </div>
          <ul style={{ margin: 0, paddingLeft: 14, listStyleType: 'disc' }}>
            {suggestion.references.map((ref) => (
              <li key={ref} style={{ fontSize: 10.5, lineHeight: 1.7, color: color.textSecondary }}>
                {ref}
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestion.reason && (
        <div style={{ marginTop: 6, fontSize: 9.5, color: color.textFaint }}>
          判定の根拠：{suggestion.reason}
        </div>
      )}

      <div className="flex flex-wrap" style={{ gap: 6, marginTop: 10 }}>
        {needsImage ? (
          <button
            type="button"
            onClick={onRequestImage}
            className="inline-flex items-center"
            style={primaryStyle}
          >
            <ImagePlus size={12} /> 画像を添付する
          </button>
        ) : (
          <button
            type="button"
            onClick={onAccept}
            disabled={disabled}
            className="inline-flex items-center disabled:opacity-50"
            style={primaryStyle}
          >
            {variant === 'confirm' ? `${name}を開始` : AI_SKILL_CTA[suggestion.skillId]}
          </button>
        )}
        {canOpenWide && (
          <button
            type="button"
            onClick={() => onOpenWide?.(suggestion.skillId)}
            disabled={disabled}
            title="いまの教材・課題基準・添付画像・会話を引き継いで、広い画面で開きます"
            className="inline-flex items-center disabled:opacity-50"
            style={{ ...ghostStyle, gap: 4, borderColor: color.primaryBorder, color: color.primary }}
          >
            <Maximize2 size={11} /> 広い画面で開く
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          disabled={disabled}
          style={ghostStyle}
        >
          {variant === 'confirm' ? 'このまま質問する' : '今はしない'}
        </button>
      </div>
    </div>
  );
}

/**
 * スキルごとの説明。「何を根拠に、何をするか」だけを書く。
 * 文言は AI_SKILL_META（カードと同じ情報源）から取る。
 * ここに別の説明文を持つと、一覧のカードと提案カードで説明が食い違う。
 */
const descriptionOf = (skillId: SkillSuggestion['skillId']): string =>
  isConcreteSkill(skillId) ? AI_SKILL_META[skillId].description : '';

const primaryStyle: React.CSSProperties = {
  gap: 5,
  height: 29,
  padding: '0 12px',
  border: 0,
  borderRadius: 8,
  background: color.primary,
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};

const ghostStyle: React.CSSProperties = {
  height: 29,
  padding: '0 11px',
  border: `1px solid ${color.borderSoft}`,
  borderRadius: 8,
  background: color.surface,
  color: color.textMuted,
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
};

export default SkillProposalCard;
