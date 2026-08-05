import { useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, ImagePlus, MessageSquare, Sparkles, X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import {
  AiSkillId,
  AiSkillCategory,
  AI_SKILL_CATEGORY_LABEL,
  AI_SKILL_CATEGORY_ORDER,
  AI_SKILL_META,
  ConcreteAiSkillId,
  FEATURED_AI_SKILLS,
  skillsInCategory,
} from '../../types/aiSkill';
import { AiCoachSession } from '../../types/aiCoach';
import { AiSkillRecommendation } from '../../utils/aiSkillRecommend';
import SkillSelector from '../learning/SkillSelector';
import AiSkillCard from './AiSkillCard';
import { AI_SKILL_ICON } from './aiSkillIcons';

/**
 * AI専用ページのホーム状態（要件§「画面は3つの状態に分ける」1）。
 *
 * 上に大きな入力欄、下に目的別のAI機能一覧を置く。狙いは2種類の入り方を
 * 両方成立させること:
 *   ・やりたいことをそのまま書く人 → 上の入力欄からAIコーチが受ける
 *   ・機能を見て選びたい人         → 下の一覧から直接選ぶ
 * どちらから入っても同じAIワークスペースの中で続くので、
 * カードを押しても別ページ・別タブへは飛ばさない（要件§「AIアプリを選択した後の画面」）。
 *
 * 一覧は「よく使う → あなたにおすすめ → すべて（カテゴリ別）」の3段。
 * 全機能を同じ大きさで並べると、結局どれを使うか判断できなくなるため。
 */
interface AiCoachHomeProps {
  /** 自由入力の送信。skillId が 'auto' でなければそのモードで始める */
  onSubmit: (text: string, image: string | null, skillId: AiSkillId) => void;
  /**
   * 機能を直接選んだ。その機能のモードで新しいセッションを開く。
   * seedInput があれば入力欄に下書きとして入れる（おすすめ経由のとき）。
   */
  onSelectSkill: (skillId: ConcreteAiSkillId, seedInput?: string) => void;
  /** 学習状況から作ったおすすめ（最大3件） */
  recommendations: AiSkillRecommendation[];
  /** 最近使った機能。よく使うAIの前に出す */
  recentSkills: ConcreteAiSkillId[];
  /** 続きから開ける直近の相談 */
  recentSessions: AiCoachSession[];
  onOpenSession: (id: string) => void;
}

type CategoryFilter = AiSkillCategory | 'all';

export function AiCoachHome({
  onSubmit,
  onSelectSkill,
  recommendations,
  recentSkills,
  recentSessions,
  onOpenSession,
}: AiCoachHomeProps) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [skillId, setSkillId] = useState<AiSkillId>('auto');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const canSubmit = !!text.trim() || !!image;
  const submit = () => {
    if (!canSubmit) return;
    onSubmit(text.trim(), image, skillId);
    setText('');
    setImage(null);
  };

  const categories = useMemo(
    () => (filter === 'all' ? AI_SKILL_CATEGORY_ORDER : [filter]),
    [filter]
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: color.pageBg }}>
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '38px 24px 56px' }}>
        {/* ── 見出し ── */}
        <div className="flex flex-col items-center" style={{ gap: 10, textAlign: 'center' }}>
          <span
            aria-hidden
            className="grid place-items-center"
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: color.primarySoft,
              color: color.primary,
              boxShadow: '0 8px 22px rgba(224,33,58,.10)',
            }}
          >
            <Sparkles size={24} />
          </span>
          <h1 style={{ ...font.pageTitle, margin: 0, color: color.text }}>
            今日は何をサポートしましょうか？
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
            AIコーチが、学習・制作・キャリアの困りごとを一緒に片付けます。
          </p>
        </div>

        {/* ── 大きな入力欄（AIコーチ兼ルーター）── */}
        <div
          style={{
            marginTop: 24,
            border: `1px solid ${color.borderStrong}`,
            borderRadius: 18,
            background: color.surface,
            boxShadow: '0 10px 30px rgba(190,60,70,.06)',
            overflow: 'hidden',
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
                i.type.startsWith('image/')
              );
              const file = item?.getAsFile();
              if (file) {
                e.preventDefault();
                attachImage(file);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="AIに相談する…（例：バナーの配色を見てほしい／案件の応募文を書きたい）"
            style={{
              width: '100%',
              minHeight: 92,
              maxHeight: 220,
              resize: 'vertical',
              border: 0,
              padding: '18px 20px 6px',
              color: color.text,
              outline: 'none',
              fontSize: 13.5,
              lineHeight: 1.7,
              fontFamily: 'inherit',
            }}
          />

          {image && (
            <div
              className="flex items-center"
              style={{
                gap: 9,
                margin: '0 16px 6px',
                padding: 8,
                border: `1px solid ${color.border}`,
                borderRadius: 11,
                background: color.pageBg,
              }}
            >
              <img
                src={image}
                alt="添付画像のプレビュー"
                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }}
              />
              <span style={{ flex: 1, fontSize: 11, color: color.textSubtle }}>
                画像を添付しました。内容に応じて制作物添削を提案します。
              </span>
              <button
                type="button"
                onClick={() => setImage(null)}
                aria-label="画像を削除"
                style={{
                  width: 26,
                  height: 26,
                  display: 'grid',
                  placeItems: 'center',
                  border: `1px solid ${color.border}`,
                  borderRadius: 7,
                  background: color.surface,
                  color: color.iconMuted,
                  cursor: 'pointer',
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex items-center" style={{ gap: 9, padding: '4px 14px 14px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) attachImage(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center"
              style={{
                gap: 5,
                height: 32,
                padding: '0 11px',
                border: `1px solid ${color.border}`,
                borderRadius: 9,
                background: color.surface,
                color: color.textMuted,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <ImagePlus size={14} /> 画像
            </button>
            <span style={{ fontSize: 10, color: color.textFaint }}>
              画像の貼り付けにも対応 / Ctrl+Enter で送信
            </span>
            <div style={{ flex: 1 }} />
            <SkillSelector value={skillId} onChange={setSkillId} />
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              aria-label="AIコーチに送信"
              className="grid place-items-center disabled:opacity-40"
              style={{
                width: 36,
                height: 36,
                border: 0,
                borderRadius: '50%',
                background: color.primary,
                color: '#fff',
                cursor: canSubmit ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              <ArrowUp size={17} />
            </button>
          </div>
        </div>

        {/* ── 続きから ── */}
        {recentSessions.length > 0 && (
          <div className="flex flex-wrap items-center" style={{ gap: 7, marginTop: 14 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: color.textFaint }}>続きから</span>
            {recentSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onOpenSession(session.id)}
                className="inline-flex items-center"
                style={{
                  gap: 5,
                  maxWidth: 260,
                  height: 28,
                  padding: '0 11px',
                  border: `1px solid ${color.border}`,
                  borderRadius: 999,
                  background: color.surface,
                  color: color.textBody,
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <MessageSquare size={11} style={{ color: color.textFaint, flexShrink: 0 }} />
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {session.title}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── よく使うAI ── */}
        <SectionTitle
          title="よく使うAI"
          lead="迷ったらここから。押すと、この画面のままそのモードに切り替わります。"
          style={{ marginTop: 34 }}
        />
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {featuredOrder(recentSkills).map((id) => (
            <AiSkillCard key={id} skillId={id} variant="compact" onSelect={onSelectSkill} />
          ))}
        </div>

        {/* ── あなたにおすすめ ── */}
        {recommendations.length > 0 && (
          <>
            <SectionTitle
              title="あなたにおすすめ"
              lead="いま取り組んでいるコースと進捗から選びました。"
              style={{ marginTop: 34 }}
            />
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${recommendations.length}, minmax(0, 1fr))`, gap: 12 }}
            >
              {recommendations.map((rec) => (
                <RecommendationCard
                  key={`${rec.skillId}-${rec.title}`}
                  recommendation={rec}
                  onSelect={onSelectSkill}
                />
              ))}
            </div>
          </>
        )}

        {/* ── すべてのAI機能 ── */}
        <SectionTitle
          title="すべてのAI機能"
          lead="目的で分けています。名前ではなく「何ができるか」で選んでください。"
          style={{ marginTop: 34 }}
        />
        <div className="flex flex-wrap" style={{ gap: 7, marginBottom: 16 }}>
          {(['all', ...AI_SKILL_CATEGORY_ORDER] as CategoryFilter[]).map((key) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={active}
                style={{
                  height: 30,
                  padding: '0 14px',
                  border: `1px solid ${active ? color.primaryBorder : color.border}`,
                  borderRadius: 999,
                  background: active ? color.primarySoft : color.surface,
                  color: active ? color.primary : color.textMuted,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {key === 'all' ? 'すべて' : AI_SKILL_CATEGORY_LABEL[key]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col" style={{ gap: 22 }}>
          {categories.map((category) => (
            <section key={category}>
              <div className="flex items-center" style={{ gap: 9, marginBottom: 10 }}>
                <span
                  aria-hidden
                  style={{ width: 4, height: 16, borderRadius: 2, background: color.primary }}
                />
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 900, color: color.text }}>
                  {AI_SKILL_CATEGORY_LABEL[category]}
                </h3>
                <span style={{ fontSize: 10.5, color: color.textFaint }}>
                  {skillsInCategory(category).length} 件
                </span>
              </div>
              <div
                className="grid"
                style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}
              >
                {skillsInCategory(category).map((id) => (
                  <AiSkillCard key={id} skillId={id} onSelect={onSelectSkill} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 最近使った機能を「よく使うAI」の先頭へ寄せる（並びは6件のまま） */
function featuredOrder(recentSkills: ConcreteAiSkillId[]): ConcreteAiSkillId[] {
  const recent = recentSkills.filter((id) => FEATURED_AI_SKILLS.includes(id));
  return [...recent, ...FEATURED_AI_SKILLS.filter((id) => !recent.includes(id))].slice(
    0,
    FEATURED_AI_SKILLS.length
  );
}

function SectionTitle({
  title,
  lead,
  style,
}: {
  title: string;
  lead: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 900, color: color.text }}>{title}</h2>
      <p style={{ margin: '4px 0 0', fontSize: 11.5, color: color.textMuted }}>{lead}</p>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  onSelect,
}: {
  recommendation: AiSkillRecommendation;
  onSelect: (skillId: ConcreteAiSkillId, seedInput?: string) => void;
}) {
  const meta = AI_SKILL_META[recommendation.skillId];
  const Icon = AI_SKILL_ICON[meta.icon];
  return (
    <button
      type="button"
      onClick={() => onSelect(recommendation.skillId, recommendation.seedInput)}
      className="group flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        gap: 8,
        height: '100%',
        padding: '16px 17px',
        border: `1px solid ${color.primaryBorderSoft}`,
        borderRadius: 16,
        background: color.hoverBgTint,
        cursor: 'pointer',
      }}
    >
      <div className="flex items-center" style={{ gap: 9, width: '100%' }}>
        <span
          aria-hidden
          className="grid place-items-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: color.surface,
            color: color.primary,
            border: `1px solid ${color.primaryBorder}`,
          }}
        >
          <Icon size={16} />
        </span>
        <span
          style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800, color: color.text, lineHeight: 1.45 }}
        >
          {recommendation.title}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 11, lineHeight: 1.75, color: color.textSecondary }}>
        {recommendation.reason}
      </p>
      <div
        className="flex items-center"
        style={{ gap: 5, marginTop: 'auto', paddingTop: 6, fontSize: 10.5, fontWeight: 800, color: color.primary }}
      >
        {meta.shortLabel}で開く
        <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

export default AiCoachHome;
