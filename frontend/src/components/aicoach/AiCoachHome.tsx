import { useRef, useState, type CSSProperties } from 'react';
import { ChevronRight, ArrowUp, Info, Plus, MessageSquare, Sparkles, X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import {
  AiSkillId,
  AI_SKILL_META,
  ConcreteAiSkillId,
  FEATURED_AI_SKILLS,
} from '../../types/aiSkill';
import { AiCoachSession } from '../../types/aiCoach';
import { AiSkillRecommendation } from '../../utils/aiSkillRecommend';
import SkillSelector from '../learning/SkillSelector';
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

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: color.pageBg }}>
      <div className="wc-page" style={{ '--wc-page-max': '940px', '--wc-page-top': '38px', '--wc-page-bottom': '56px' } as CSSProperties}>
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
              boxShadow: '0 8px 22px rgba(214,9,52,.10)',
            }}
          >
            <Sparkles size={24} />
          </span>
          <h1 style={{ ...font.pageTitle, fontSize: 32, margin: 0, color: color.text }}>
            今日は何をお手伝いしましょうか？
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
            AIコーチが、学習・制作・キャリアに関するお悩みをサポートします。
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
              aria-label="画像を添付する"
              title="画像を添付する"
              className="grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                width: 34,
                height: 34,
                border: `1px solid ${color.border}`,
                borderRadius: 10,
                background: color.surface,
                color: color.textMuted,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Plus size={16} />
            </button>
            {/* 「AI選択できる？」への答え。既定は自動で、ここから明示的に選べる */}
            <SkillSelector value={skillId} onChange={setSkillId} />
            <span style={{ fontSize: 10, color: color.textFaint }}>Ctrl+Enter で送信</span>
            <div style={{ flex: 1 }} />
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

        {/* 「AI選択できる？」の答えを、選ばなかった人にも見えるところに置く */}
        <div
          className="flex items-center justify-center"
          style={{ gap: 6, marginTop: 12, fontSize: 11.5, color: color.textFaint }}
        >
          <Info size={13} />
          相談内容に応じて、最適なAIが自動で選ばれます
        </div>

        {/* ── 続きから ── */}
        {recentSessions.length > 0 && (
          <div className="flex flex-wrap items-center" style={{ gap: 7, marginTop: 18 }}>
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

        {/* ── よく使う機能へのショートカット ──
            以前はここから下に「よく使う → おすすめ → すべて（カテゴリ別）」の
            3段のカードギャラリーが続き、「ただアプリが並んでいるだけ」になっていた。
            探す行為は「AIサポート機能一覧」に分けて、ホームは相談を書くことに専念させる。
            ここに残すのは、名前を見れば分かる数件の近道だけ。 */}
        <div className="ai-home-quicklinks">
          {featuredOrder(recentSkills)
            .slice(0, 5)
            .map((id) => {
              const meta = AI_SKILL_META[id];
              const Icon = AI_SKILL_ICON[meta.icon];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectSkill(id)}
                  className="inline-flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    gap: 8,
                    minWidth: 0,
                    padding: '10px 6px',
                    border: 0,
                    background: 'transparent',
                    color: color.textBody,
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={15} style={{ color: color.primary, flexShrink: 0 }} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {meta.shortLabel}
                  </span>
                  <ChevronRight size={13} style={{ color: color.textFaint, flexShrink: 0 }} />
                </button>
              );
            })}
        </div>

        {/* ── いま学んでいる教材からそのまま聞く ──
            おすすめカードを3枚並べる代わりに、根拠が一番強い1本だけを帯にした。
            「なぜ自分に出たか」が「いま学習中だから」で説明しきれる形にしている。 */}
        {recommendations.length > 0 && (
          <div
            className="flex items-center"
            style={{
              gap: 16,
              flexWrap: 'wrap',
              marginTop: 22,
              padding: '14px 18px',
              border: `1px solid ${color.border}`,
              borderRadius: 14,
              background: color.surface,
            }}
          >
            <span
              aria-hidden
              className="grid place-items-center flex-shrink-0"
              style={{ width: 34, height: 34, borderRadius: '50%', background: color.primarySoft, color: color.primary }}
            >
              <MonitorIcon />
            </span>
            <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: 13, fontWeight: 700, color: color.text }}>
              {recommendations[0].title}
            </span>
            <span aria-hidden style={{ width: 1, height: 24, background: color.divider }} />
            <button
              type="button"
              onClick={() => onSelectSkill(recommendations[0].skillId, recommendations[0].seedInput)}
              className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                gap: 6,
                border: 0,
                background: 'transparent',
                color: color.primary,
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {recommendations[0].reason}
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 教材を指すアイコン。lucide の Monitor 相当を最小構成で置く */
function MonitorIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
      <path d="M8.5 20.5h7M12 17v3.5" />
    </svg>
  );
}

/** 最近使った機能をショートカットの先頭へ寄せる */
function featuredOrder(recentSkills: ConcreteAiSkillId[]): ConcreteAiSkillId[] {
  const recent = recentSkills.filter((id) => FEATURED_AI_SKILLS.includes(id));
  return [...recent, ...FEATURED_AI_SKILLS.filter((id) => !recent.includes(id))].slice(
    0,
    FEATURED_AI_SKILLS.length
  );
}

export default AiCoachHome;
