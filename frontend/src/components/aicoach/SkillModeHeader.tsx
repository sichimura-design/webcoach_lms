import { ArrowLeft, BookOpen, ImagePlus, PanelRight } from 'lucide-react';
import { color } from '../../theme/webcoachTheme';
import { AI_SKILL_META, ConcreteAiSkillId } from '../../types/aiSkill';
import { AI_SKILL_ICON } from './aiSkillIcons';

/**
 * 専門モード状態のヘッダー（要件§「AIアプリを選択した後の画面」）。
 *
 * 別ページを開いたようには見せない。出すのは
 *   ・AIコーチへ戻る導線
 *   ・いまどの機能を使っているか（機能名＋1行説明）
 *   ・その機能に必要な入力（画像が要るモードだけ）
 * の3つに限る。裏で専用プロンプトやモデルを使っていても、ユーザーには
 * 「AIコーチの◯◯機能を使っている」という見え方にする。
 *
 * 🔴 かつてここにあった「参照中」のチップ行は削除した。常設する情報ではなく、
 *    回答の中に「◯◯を参照して回答しています」と書けば足りる（AiCoachPane の ReferenceNote）。
 */
interface SkillModeHeaderProps {
  skillId: ConcreteAiSkillId;
  /** 添付済みの画像。画像が必要なモードで未添付なら添付を促す */
  image: string | null;
  /** AIコーチ（汎用チャット）へ戻る */
  onBack: () => void;
  /** 元の教材へ戻る。教材の文脈が無い会話では渡さない */
  onOpenLesson?: () => void;
  /** 画像添付のファイル選択を開く */
  onRequestImage: () => void;
  /** 参照情報パネルの開閉。デスクトップ以外では渡さない */
  onToggleReference?: () => void;
  referenceOpen?: boolean;
}

export function SkillModeHeader({
  skillId,
  image,
  onBack,
  onOpenLesson,
  onRequestImage,
  onToggleReference,
  referenceOpen = false,
}: SkillModeHeaderProps) {
  const meta = AI_SKILL_META[skillId];
  const Icon = AI_SKILL_ICON[meta.icon];
  const needsImage = meta.needsImage && !image;

  return (
    <div>
      <div className="flex items-center" style={{ gap: 9 }}>
        <button
          type="button"
          onClick={onBack}
          className="wc-ai-chip inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            gap: 4,
            height: 28,
            padding: '0 10px 0 8px',
            border: `1px solid ${color.border}`,
            borderRadius: 8,
            background: color.surface,
            color: color.textMuted,
            fontFamily: 'inherit',
            fontSize: 10.5,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={12} /> AIコーチ
        </button>

        <span
          aria-hidden
          className="grid place-items-center flex-shrink-0"
          style={{ width: 26, height: 26, borderRadius: 8, background: color.primarySoft, color: color.primary }}
        >
          <Icon size={14} />
        </span>
        <strong style={{ fontSize: 13, fontWeight: 900, color: color.text, whiteSpace: 'nowrap' }}>
          {meta.label}
        </strong>

        <div style={{ flex: 1 }} />

        {onOpenLesson && (
          <button
            type="button"
            onClick={onOpenLesson}
            className="wc-ai-chip inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              gap: 4,
              height: 28,
              padding: '0 10px',
              border: `1px solid ${color.primaryBorder}`,
              borderRadius: 8,
              background: color.surface,
              color: color.primary,
              fontFamily: 'inherit',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <BookOpen size={12} /> 教材へ戻る
          </button>
        )}

        {onToggleReference && (
          <button
            type="button"
            onClick={onToggleReference}
            aria-pressed={referenceOpen}
            aria-label="参照情報の表示を切り替える"
            title="参照情報"
            className="wc-ai-icon-btn grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 28,
              height: 28,
              border: `1px solid ${referenceOpen ? color.primaryBorder : color.borderStrong}`,
              borderRadius: 8,
              background: referenceOpen ? color.primarySoft : color.surface,
              color: referenceOpen ? color.primary : color.iconMuted,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <PanelRight size={13} />
          </button>
        )}
      </div>

      <p style={{ margin: '7px 0 0', fontSize: 11.5, lineHeight: 1.7, color: color.textSecondary }}>
        {meta.modeLead}
      </p>

      {/* 必要な入力。押すまで何も起きないので、先に何を渡すかだけを示す */}
      {needsImage && (
        <div
          className="flex items-center"
          style={{
            gap: 10,
            marginTop: 10,
            padding: '11px 12px',
            border: `1px dashed ${color.primaryDashed}`,
            borderRadius: 12,
            background: color.hoverBgTint,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: color.text }}>
              添削する画像を選んでください
            </strong>
            <span style={{ fontSize: 10.5, color: color.textMuted }}>
              {meta.inputHint}。貼り付け（Ctrl+V）でも添付できます。
            </span>
          </div>
          <button
            type="button"
            onClick={onRequestImage}
            className="wc-ai-send inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              gap: 5,
              height: 30,
              padding: '0 12px',
              border: 0,
              borderRadius: 9,
              background: color.primary,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ImagePlus size={12} /> PNG・JPGを選択
          </button>
        </div>
      )}
    </div>
  );
}

export default SkillModeHeader;
