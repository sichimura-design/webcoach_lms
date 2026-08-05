import { AlertTriangle, Copy, PenLine } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import {
  AiSkillFinding,
  AiSkillResponse,
  AiSkillVerdict,
  AI_SKILL_VERDICT_LABEL,
} from '../../types/aiSkill';

/**
 * 専門モードの実行結果（項目別添削・文章改善案）。
 *
 * AIコーチの通常回答（結論／根拠／当てはめ／次にやること）と描き分ける理由:
 *   専門モードは「項目ごとに見て、直して、もう一度見る」作業のための表示なので、
 *   1本の文章より項目の並びの方が手が動く。観点ごとに教材の根拠へ飛べることが要点。
 */
interface SkillResultViewProps {
  result: AiSkillResponse;
  onJumpToBlock: (blockId: string) => void;
  /**
   * この会話に教材の文脈があるか。
   * AI専用ページで教材と関係なく始めた相談では、そもそも参照する教材が無い。
   * そこで「教材に記述がありませんでした」を出すと、約束していないことを謝る形になる。
   */
  hasMaterialContext?: boolean;
}

/** 判定の色。既存の意味色（成功／注意）に合わせる */
const VERDICT_STYLE: Record<AiSkillVerdict, { bg: string; border: string; text: string }> = {
  good: { bg: '#E4F3EC', border: '#C6E5D5', text: '#246145' },
  improve: { bg: '#FFF6E5', border: '#F0DDB8', text: '#8A5A10' },
  critical: { bg: '#FDECEE', border: '#F3C3C9', text: '#A11228' },
};

function FindingRow({
  finding,
  onJumpToBlock,
  hasMaterialContext,
}: {
  finding: AiSkillFinding;
  onJumpToBlock: (blockId: string) => void;
  hasMaterialContext: boolean;
}) {
  const tone = VERDICT_STYLE[finding.verdict];
  return (
    <div
      style={{
        marginTop: 8,
        padding: '9px 10px',
        border: `1px solid ${color.border}`,
        borderRadius: 9,
        background: color.surface,
      }}
    >
      <div className="flex items-center" style={{ gap: 6, marginBottom: 4 }}>
        <strong style={{ fontSize: 11, fontWeight: 800, color: color.text }}>{finding.label}</strong>
        <span
          style={{
            padding: '2px 7px',
            borderRadius: 999,
            background: tone.bg,
            border: `1px solid ${tone.border}`,
            color: tone.text,
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          {AI_SKILL_VERDICT_LABEL[finding.verdict]}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.75, color: color.textBody }}>
        {finding.comment}
      </p>

      {finding.basis ? (
        <div style={{ marginTop: 6 }}>
          <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.7, color: color.textSecondary }}>
            {finding.basis}
          </p>
          {finding.blockId && (
            <button
              type="button"
              onClick={() => onJumpToBlock(finding.blockId as string)}
              title="この教材箇所へ移動"
              style={{
                marginTop: 5,
                border: `1px solid ${color.primaryBorder}`,
                borderRadius: 999,
                background: color.hoverBgTint,
                color: color.primary,
                padding: '3px 8px',
                fontSize: 9.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              教材で確認する
            </button>
          )}
        </div>
      ) : (
        hasMaterialContext && (
          <div style={{ marginTop: 5, fontSize: 9.5, color: color.textFaint }}>
            この観点は教材に直接の記述がないため、一般的な見方として扱ってください。
          </div>
        )
      )}
    </div>
  );
}

export function SkillResultView({
  result,
  onJumpToBlock,
  hasMaterialContext = true,
}: SkillResultViewProps) {
  return (
    <>
      {!result.groundedInMaterial && hasMaterialContext && (
        <div
          className="flex items-start"
          style={{
            gap: 6,
            marginBottom: 8,
            padding: '8px 9px',
            borderRadius: 8,
            background: '#FFF8E6',
            border: '1px solid #F0DCA6',
            fontSize: 10.5,
            lineHeight: 1.7,
            color: '#7A6320',
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>この教材には該当する記述が見つかりませんでした。以下は一般的な見方です。</span>
        </div>
      )}

      <strong
        style={{ display: 'block', marginBottom: 6, ...font.label, fontWeight: 800, color: color.text }}
      >
        全体講評
      </strong>
      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.75, color: color.textBody }}>
        {result.summary}
      </p>

      {result.findings.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ display: 'block', fontSize: 10, fontWeight: 800, color: color.text }}>
            項目別
          </strong>
          {result.findings.map((finding) => (
            <FindingRow
              key={finding.label}
              finding={finding}
              onJumpToBlock={onJumpToBlock}
              hasMaterialContext={hasMaterialContext}
            />
          ))}
        </div>
      )}

      {result.revision && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 11px',
            borderRadius: 9,
            background: color.pageBg,
            border: `1px solid ${color.border}`,
          }}
        >
          <div className="flex items-center" style={{ gap: 5, marginBottom: 5 }}>
            <PenLine size={12} style={{ color: color.primary }} />
            <strong style={{ fontSize: 10, fontWeight: 800, color: color.text }}>修正案</strong>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(result.revision as string)}
              className="inline-flex items-center"
              style={{
                marginLeft: 'auto',
                gap: 4,
                height: 24,
                padding: '0 8px',
                border: `1px solid ${color.border}`,
                borderRadius: 7,
                background: color.surface,
                color: color.textMuted,
                fontSize: 9.5,
                cursor: 'pointer',
              }}
            >
              <Copy size={10} /> コピー
            </button>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              lineHeight: 1.85,
              color: color.textBody,
              whiteSpace: 'pre-wrap',
            }}
          >
            {result.revision}
          </p>
        </div>
      )}

      <div
        style={{
          marginTop: 9,
          padding: '9px 10px',
          borderRadius: 9,
          background: color.pageBg,
        }}
      >
        <strong style={{ display: 'block', marginBottom: 4, fontSize: 10, fontWeight: 800, color: color.text }}>
          次にやること
        </strong>
        <span style={{ fontSize: 11.5, lineHeight: 1.75, color: color.textBody }}>{result.next}</span>
      </div>

      {result.sources.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: 5, marginTop: 8 }}>
          <span style={{ fontSize: 9.5, color: color.textFaint, alignSelf: 'center' }}>
            参照した教材箇所
          </span>
          {result.sources.map((source) => (
            <button
              key={source.blockId}
              type="button"
              onClick={() => onJumpToBlock(source.blockId)}
              title="この教材箇所へ移動"
              style={{
                border: `1px solid ${color.primaryBorder}`,
                borderRadius: 999,
                background: color.hoverBgTint,
                color: color.primary,
                padding: '4px 8px',
                fontSize: 9.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {source.heading}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default SkillResultView;
