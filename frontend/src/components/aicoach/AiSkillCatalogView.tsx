import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronRight, Search, Send, Sparkles } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import {
  AI_SKILL_CATEGORY_LABEL,
  AI_SKILL_CATEGORY_ORDER,
  AI_SKILL_META,
  AiSkillCategory,
  CONCRETE_AI_SKILLS,
  ConcreteAiSkillId,
} from '../../types/aiSkill';
import { AI_SKILL_ICON } from './aiSkillIcons';

/**
 * AIサポート機能一覧（/ai-coach の catalog 状態）。
 *
 * 以前はこの一覧がホームの下半分に「よく使う → おすすめ → すべて（カテゴリ別）」の
 * 3段で常時置かれていた。「ただアプリが並んでいるだけ」という指摘の通り、
 * 相談を書きに来た人にも一覧が押し付けられ、
 * 機能を探しに来た人には3段のどこを見ればいいか分からない状態だった。
 *
 * ホームは「相談を書く」に専念させ、探す行為はこの画面に分けた。
 * 探すための道具は 検索 と カテゴリ の2つだけに絞り、
 * カードには「こんなときに」を必ず添える。機能名だけでは選べないため。
 */
interface AiSkillCatalogViewProps {
  onSelectSkill: (skillId: ConcreteAiSkillId) => void;
  /** どれを使えばいいか分からない人の逃げ道。ホームの自由入力に戻す */
  onAskFreely: () => void;
}

type CategoryFilter = AiSkillCategory | 'all';

export function AiSkillCatalogView({ onSelectSkill, onAskFreely }: AiSkillCatalogViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONCRETE_AI_SKILLS.filter((id) => {
      const meta = AI_SKILL_META[id];
      if (filter !== 'all' && meta.category !== filter) return false;
      if (!q) return true;
      // 「やりたいことを入力して探す」なので、名前だけでなく
      // 説明・こんなときに・入力の手がかりまで含めて当てる
      return [meta.label, meta.shortLabel, meta.description, meta.useCase, meta.inputHint]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [query, filter]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: color.pageBg }}>
      <div className="wc-page" style={{ '--wc-page-max': '980px', '--wc-page-top': '40px', '--wc-page-bottom': '56px' } as CSSProperties}>
        <div className="flex flex-col items-center" style={{ gap: 10, textAlign: 'center' }}>
          <span
            aria-hidden
            className="grid place-items-center"
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: color.primarySoft,
              color: color.primary,
            }}
          >
            <Sparkles size={23} />
          </span>
          <h1 style={{ ...font.pageTitle, margin: 0, color: color.text }}>AIサポート機能一覧</h1>
          <p style={{ margin: 0, fontSize: 13, color: color.textMuted, lineHeight: 1.8 }}>
            利用できるすべてのサポート機能を確認できます。やりたいことに合わせて、最適なサポートを選びましょう。
          </p>
        </div>

        {/* 探す道具はこの2つだけ。増やすと「どれで絞るか」を選ばせることになる */}
        <div
          className="flex items-center"
          style={{
            gap: 12,
            margin: '26px 0 16px',
            padding: '0 20px',
            height: 54,
            border: `1px solid ${color.primaryBorderSoft}`,
            borderRadius: 999,
            background: color.surface,
          }}
        >
          <Search size={18} style={{ color: color.textSubtle, flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="やりたいことを入力して探す"
            aria-label="AI機能を検索する"
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 14,
              color: color.text,
            }}
          />
        </div>

        <div className="flex flex-wrap justify-center" style={{ gap: 8, marginBottom: 24 }}>
          {(['all', ...AI_SKILL_CATEGORY_ORDER] as CategoryFilter[]).map((key) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={active}
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  height: 34,
                  padding: '0 20px',
                  border: `1px solid ${active ? color.primaryBorder : color.border}`,
                  borderRadius: 999,
                  background: active ? color.primarySoft : color.surface,
                  color: active ? color.primary : color.textMuted,
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {key === 'all' ? 'すべて' : AI_SKILL_CATEGORY_LABEL[key]}
              </button>
            );
          })}
        </div>

        {results.length === 0 ? (
          <p
            style={{
              ...font.meta,
              color: color.textMuted,
              textAlign: 'center',
              padding: '40px 0',
              lineHeight: 1.9,
            }}
          >
            「{query}」に当てはまる機能は見つかりませんでした。
            <br />
            言葉を変えて探すか、下の「AIに相談する」からそのまま聞いてみてください。
          </p>
        ) : (
          <div className="ai-catalog-grid">
            {results.map((id) => {
              const meta = AI_SKILL_META[id];
              const Icon = AI_SKILL_ICON[meta.icon];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectSkill(id)}
                  className="group flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    height: '100%',
                    padding: '20px 20px 16px',
                    border: `1px solid ${color.border}`,
                    borderRadius: 16,
                    background: color.surface,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span className="flex items-center" style={{ gap: 11, width: '100%' }}>
                    <span
                      aria-hidden
                      className="grid place-items-center flex-shrink-0"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: color.primarySoft,
                        color: color.primary,
                      }}
                    >
                      <Icon size={17} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 900, color: color.text }}>
                      {meta.shortLabel}
                    </span>
                    <ChevronRight size={15} style={{ color: color.textFaint, flexShrink: 0 }} />
                  </span>

                  <span
                    style={{
                      display: 'block',
                      margin: '12px 0 0',
                      fontSize: 12,
                      lineHeight: 1.85,
                      color: color.textSecondary,
                    }}
                  >
                    {meta.description}
                  </span>

                  {/* 名前と説明だけでは選べない。「自分がいまその状況か」で選ばせる */}
                  <span
                    style={{
                      display: 'block',
                      marginTop: 'auto',
                      paddingTop: 14,
                      borderTop: `1px solid ${color.border}`,
                      fontSize: 11,
                      lineHeight: 1.75,
                      color: color.textMuted,
                    }}
                  >
                    <span style={{ color: color.primary, fontWeight: 700 }}>こんなときに：</span>
                    {meta.useCase}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 選べなかった人を行き止まりにしない */}
        <div
          className="flex items-center"
          style={{
            gap: 20,
            flexWrap: 'wrap',
            marginTop: 28,
            padding: '22px 26px',
            borderRadius: 16,
            background: color.hoverBgTint,
            border: `1px solid ${color.primaryBorderSoft}`,
          }}
        >
          <span
            aria-hidden
            className="grid place-items-center flex-shrink-0"
            style={{ width: 44, height: 44, borderRadius: '50%', background: color.primarySoft, color: color.primary }}
          >
            <Sparkles size={20} />
          </span>
          <div style={{ flex: '1 1 280px', minWidth: 240 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: color.text }}>
              どの機能を使えばいいかわからないときは、AIコーチに直接相談できます
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: color.textMuted, lineHeight: 1.8 }}>
              あなたの状況をヒアリングして、最適なサポートをご提案します。
            </p>
          </div>
          <button
            type="button"
            onClick={onAskFreely}
            className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              gap: 9,
              height: 46,
              padding: '0 26px',
              border: 0,
              borderRadius: 999,
              background: color.primary,
              color: color.textOnPrimary,
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Send size={16} /> AIに相談する
          </button>
        </div>
      </div>
    </div>
  );
}

export default AiSkillCatalogView;
