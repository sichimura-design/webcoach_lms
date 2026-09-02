import { useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, HelpCircle, History, ImagePlus, Sparkles, X } from 'lucide-react';
import {
  AiSkillId,
  AI_SKILL_CATEGORY_LABEL,
  AI_SKILL_CATEGORY_ORDER,
  AI_SKILL_META,
  ConcreteAiSkillId,
  skillsInCategory,
} from '../../types/aiSkill';
import SkillPlusMenu from '../learning/SkillPlusMenu';
import { AI_SKILL_ICON } from './aiSkillIcons';

/**
 * AI専用ページのホーム状態（要件§「画面は3つの状態に分ける」1）。
 *
 * claude.ai/design『AIコーチ 3案』の案 1a「センター集中型 — 問いかけが主役の
 * ゼロ状態＋機能グリッド」をそのまま実装している。上から:
 *   ヒーロー → 大きな入力欄 → できること帯 → AIアプリ全件（カテゴリ別）
 * 狙いは2種類の入り方を両方成立させること:
 *   ・やりたいことをそのまま書く人 → 上の入力欄からAIコーチが受ける
 *   ・機能を見て選びたい人         → 下のグリッドから直接選ぶ
 * どちらから入っても同じAIワークスペースの中で続くので、
 * カードを押しても別ページ・別タブへは飛ばさない（要件§「AIアプリを選択した後の画面」）。
 * 🔴 これは「起動の導線」の話。カード下の「詳しく見る」だけは説明を読むための
 *    別導線で、子ページ /ai-coach/apps/:appId へ飛ぶ（起動はしない）。
 *
 * 1a に合わせて外したもの:
 *   ・「続きから」チップ … 履歴と役割が重なる。右上の「履歴」に寄せた
 *   ・おすすめ帯         … ゼロ状態から要素を減らし、問いかけを主役にする
 *   ・ショートカット行   … カードグリッドが役割を引き取った
 *
 * 1a から変えたもの:
 *   ・6枚＋「全てのAIアプリを見る」→ **全11件をここに出す**。
 *     アプリは11個しかないので、一覧を別ページに分けると7個目以降が
 *     存在に気づかれず、使うのに1ステップ余計にかかるだけだった。
 *     11枚を素で並べると壁になるのでカテゴリ（学習／制作／キャリア／そのほか）で束ね、
 *     「こんなときに」を各カードに添えて、名前だけで選ばせないようにしている。
 *
 * 色は index.css の --dc-* （.wc-warm）を使う。webcoachTheme の pageBg は
 * ピンク寄りの #FDFCFC で、1a の暖色クリーム #FBF8F4 とは別系統のため。
 * 赤は 1a の #DC0C31 ではなく既存のブランド赤 --dc-primary (#D60934) に寄せている
 * （画面ごとに赤が分裂するのを避ける。目視差はほぼ無い）。
 */
interface AiCoachHomeProps {
  /** 自由入力の送信。skillId が 'auto' でなければそのモードで始める */
  onSubmit: (text: string, image: string | null, skillId: AiSkillId) => void;
  /** 機能を直接選んだ。その機能のモードで新しいセッションを開く */
  onSelectSkill: (skillId: ConcreteAiSkillId) => void;
  /** 「ヘルプ・使い方」→ AIコーチの使い方パネル */
  onOpenHowTo: () => void;
  /** 「履歴」→ 会話履歴の開閉 */
  onToggleHistory: () => void;
}

/** コンポーザーの幅。1a の 760px */
const CENTER_WIDTH = 760;

export function AiCoachHome({
  onSubmit,
  onSelectSkill,
  onOpenHowTo,
  onToggleHistory,
}: AiCoachHomeProps) {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [skillId, setSkillId] = useState<AiSkillId>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--dc-bg)' }}>
      {/* 1a はコンテンツ幅いっぱい（padding 20px 40px 48px）で6枚を3列に並べる。
          --wc-page-x を既定の clamp(20px,5vw,64px) から 40px に落として合わせ、
          4Kでカードが伸び切らないよう max だけ持たせている。 */}
      {/* wc-ai-enter … 開いた瞬間にヒーロー→入力欄→一覧の順で入る（index.css）。
          「AIコーチが起動した」ことが動きで分かるようにするためのもの。 */}
      <div
        className="wc-page wc-ai-enter"
        style={
          {
            '--wc-page-max': '1180px',
            '--wc-page-x': '40px',
            '--wc-page-top': '20px',
            '--wc-page-bottom': '48px',
          } as CSSProperties
        }
      >
        {/* ── 右上。上部バーを外した分、ここが使い方と履歴の入口になる ── */}
        <div className="flex items-center justify-end" style={{ gap: 10 }}>
          <button type="button" onClick={onOpenHowTo} className={CHIP_CLASS} style={chipStyle}>
            <HelpCircle size={15} style={{ color: 'var(--dc-text-muted)', flexShrink: 0 }} />
            ヘルプ・使い方
          </button>
          {/* 1a には無いが、ホームから過去の相談へ辿る道が他に無くなるので置く */}
          <button type="button" onClick={onToggleHistory} className={CHIP_CLASS} style={chipStyle}>
            <History size={15} style={{ color: 'var(--dc-text-muted)', flexShrink: 0 }} />
            履歴
          </button>
        </div>

        {/* ── ヒーロー ── */}
        <div
          className="flex flex-col items-center"
          style={{ textAlign: 'center', marginTop: 16 }}
        >
          <span
            aria-hidden
            className="grid place-items-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--dc-soft-100)',
              color: 'var(--dc-primary)',
            }}
          >
            <Sparkles size={28} />
          </span>
          <h1
            style={{
              margin: '16px 0 0',
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--dc-text)',
            }}
          >
            今日は何をお手伝いしましょうか？
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--dc-text-muted)' }}>
            AIコーチが、学習・制作・キャリアに関するお悩みをサポートします。
          </p>
        </div>

        {/* ── 大きな入力欄（AIコーチ兼ルーター）── */}
        {/* 🔴 overflow:hidden を付けないこと。
            ツール行の SkillPlusMenu は position:absolute のリストを下へ開くので、
            ここで切ると「おまかせ」の選択肢がカードに食われて数pxしか見えなくなる。
            角丸からの飛び出しは textarea 側を透明＋上だけ角丸にして防いでいる。 */}
        <div
          style={{
            maxWidth: CENTER_WIDTH,
            margin: '28px auto 0',
            border: '1px solid var(--dc-border)',
            borderRadius: 'var(--dc-radius-xl)',
            background: 'var(--dc-surface)',
            boxShadow: 'var(--dc-shadow-card)',
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
            aria-label="AIコーチへの相談内容"
            placeholder="例：バナーの配色を見てほしい／案件の応募文を書きたい"
            style={{
              display: 'block',
              width: '100%',
              minHeight: 52,
              maxHeight: 220,
              resize: 'vertical',
              border: 0,
              // カードの角丸から白い角が飛び出さないように、地は透かして上だけ丸める
              borderRadius: 'var(--dc-radius-xl) var(--dc-radius-xl) 0 0',
              background: 'transparent',
              padding: '20px 20px 4px',
              color: 'var(--dc-text)',
              outline: 'none',
              fontSize: 15,
              lineHeight: 1.7,
              fontFamily: 'inherit',
            }}
          />

          {image && (
            <div
              className="flex items-center"
              style={{
                gap: 9,
                margin: '0 20px 6px',
                padding: 8,
                border: '1px solid var(--dc-border)',
                borderRadius: 11,
                background: 'var(--dc-bg)',
              }}
            >
              <img
                src={image}
                alt="添付画像のプレビュー"
                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }}
              />
              <span style={{ flex: 1, fontSize: 11.5, color: 'var(--dc-text-subtle)' }}>
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
                  border: '1px solid var(--dc-border)',
                  borderRadius: 7,
                  background: 'var(--dc-surface)',
                  color: 'var(--dc-text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex items-center" style={{ gap: 12, padding: '0 20px 12px', height: 40 }}>
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
              className="wc-ai-icon-btn grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                width: 32,
                height: 32,
                border: '1px solid var(--dc-border-strong)',
                borderRadius: '50%',
                background: 'var(--dc-surface)',
                color: 'var(--dc-text-muted)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <ImagePlus size={15} />
            </button>
            {/* 「AI選択できる？」への答え。既定は自動で、ここから明示的に選べる。
                ここは入力欄がページ上部にあるので、リストは下へ開かせる。 */}
            <SkillPlusMenu value={skillId} onChange={setSkillId} direction="down" />
            <span style={{ fontSize: 12, color: 'var(--dc-text-subtle)' }}>Ctrl+Enter で送信</span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              aria-label="AIコーチに送信"
              className="wc-ai-send grid place-items-center disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                width: 44,
                height: 44,
                border: 0,
                borderRadius: '50%',
                background: 'var(--dc-primary)',
                color: '#fff',
                cursor: canSubmit ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>

        {/* 🔴 入力欄の下にあった説明2つは撤去した。戻さないこと。
               ・「相談内容に応じて、最適なAIが自動で選ばれます」
               ・「できること」帯（ノートをもとに復習／制作物の添削／…）
               どちらも下のカード一覧が実物で示しているので、
               ゼロ状態の文字量を増やすだけになっていた。 */}

        {/* ── AIアプリでできること ──
            機能を見て選びたい人の入口。並びは AI_SKILL_META の宣言順（固定）で、
            「最近使った順」に並べ替えない。毎回場所が変わると覚えられないため。 */}
        <h3 style={{ margin: '36px 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--dc-text)' }}>
          AIアプリでできること
        </h3>

        {AI_SKILL_CATEGORY_ORDER.map((category) => (
          <section key={category} style={{ marginTop: 24 }}>
            <h4
              style={{
                margin: '0 0 12px',
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: 'var(--dc-text-muted)',
              }}
            >
              {AI_SKILL_CATEGORY_LABEL[category]}
            </h4>
            <div className="ai-home-apps">{skillsInCategory(category).map(renderCard)}</div>
          </section>
        ))}
      </div>
    </div>
  );

  /**
   * アプリ1枚。サムネイル → 名前 → 短い説明 → 「詳しく見る」の縦組み。
   *
   * 🔴 器は <div>。カード全体を <button> にすると、中に置く「詳しく見る」が
   *    button の入れ子（不正なHTML／キーボード操作が壊れる）になる。
   *    代わりに「本体ボタン（押すと始まる）」と「詳しく見る」の2つを並べ、
   *    押した先が違うことをホバーの地色で見せる。
   * 🔴 本体ボタンは1クリックでそのモードに入る。ここを2クリック（説明を読んでから始める）に
   *    しないこと。アプリを選ぶ人はカードの絵と名前だけで選んでいる。
   * 🔴 長い手順や対話例はここに載せない。カードに収まらないので子ページ
   *    （/ai-coach/apps/:appId）が受け持つ。
   */
  function renderCard(id: ConcreteAiSkillId) {
    const meta = AI_SKILL_META[id];
    const Icon = AI_SKILL_ICON[meta.icon];

    return (
      <div
        key={id}
        className="ai-home-app-card"
        style={{
          border: '1px solid var(--dc-border)',
          borderRadius: 'var(--dc-radius-lg)',
          background: 'var(--dc-surface)',
          boxShadow: 'var(--dc-shadow-card)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => onSelectSkill(id)}
          className="ai-home-app-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            padding: 0,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span className="ai-home-app-thumb">
            {meta.thumbnail ? (
              <img src={`${process.env.PUBLIC_URL}/${meta.thumbnail}`} alt="" />
            ) : (
              // 画像が未登録のアプリ。枠を空けずにアイコンで埋める
              <span
                aria-hidden
                className="grid place-items-center"
                style={{ width: '100%', height: '100%', color: 'var(--dc-primary)' }}
              >
                <Icon size={32} strokeWidth={1.5} />
              </span>
            )}
          </span>

          <span style={{ display: 'block', padding: '12px 16px 14px' }}>
            <span
              className="truncate"
              style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--dc-text)' }}
            >
              {meta.shortLabel}
            </span>
            <span
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
                marginTop: 4,
                fontSize: 12,
                lineHeight: 1.7,
                color: 'var(--dc-text-muted)',
              }}
            >
              {meta.description}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate(`/ai-coach/apps/${id}`)}
          className="ai-home-app-doc text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            border: 0,
            borderTop: '1px solid var(--dc-border)',
            background: 'transparent',
            padding: '10px 16px',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--dc-primary)',
            cursor: 'pointer',
          }}
        >
          詳しく見る →
        </button>
      </div>
    );
  }
}

/** 右上のチップ（ヘルプ・履歴）。1a の h34 / r12 / 12.5px */
// 押した手応え（transition と active の沈み込み）はAIコーチ全体で揃えている。
// 背景色だけは既存の #FDF7F3 を保つため .wc-ai-chip ではなく Tailwind のまま。
const CHIP_CLASS =
  'inline-flex items-center transition-colors duration-150 hover:bg-[#FDF7F3] active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]';

const chipStyle: CSSProperties = {
  gap: 6,
  height: 34,
  padding: '0 14px',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-md)',
  background: 'var(--dc-surface)',
  color: 'var(--dc-text)',
  fontFamily: 'inherit',
  fontSize: 12.5,
  fontWeight: 500,
  cursor: 'pointer',
  flexShrink: 0,
};

export default AiCoachHome;
