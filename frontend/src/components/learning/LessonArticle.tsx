import { RefObject, useEffect } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock, List, Sparkles } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { LessonDoc } from '../../types/lesson';
import { MATERIAL_FORMAT_LABEL } from '../../constants/learningTaxonomy';
import type { LearningType } from '../../constants/learningTaxonomy';
import LessonBlockView from './LessonBlockView';
import LessonImageZoom from './LessonImageZoom';
import MoodleFallbackBlock from './MoodleFallbackBlock';
import { ClipAnchor, applyClipMarks } from './clipHighlight';
import { groupByHeading } from './lessonSections';
import { resolveExternalUrl } from './moodleContent';

/**
 * 中央：レッスン本文（教材の並び）。画面の主役。
 *
 * 本文カラムには最大幅を設ける（横に長い文章は読みにくいため）。
 * 図解・課題の教材は LessonBlockView 側で本文より広く出せるようにしてある。
 */
/**
 * 次のレッスンカードに添える実データ。
 * デザイン 2a はここに1〜2行の説明文を置いているが、LessonLink は
 * lessonId と title しか持たない。説明文を作文するのは論外なので、
 * 目次（LessonOutline）から取れる所要時間と学習タイプを代わりに出す。
 */
export interface NextLessonMeta {
  minutes?: number;
  learningType?: LearningType;
}

interface LessonArticleProps {
  doc: LessonDoc;
  articleRef: RefObject<HTMLDivElement>;
  clips: ClipAnchor[];
  flashBlockId: string | null;
  videoUrl: string | null;
  isCompleted: boolean;
  completing: boolean;
  /** 次のレッスンの所要時間・学習タイプ。目次が取れないときは undefined */
  nextMeta?: NextLessonMeta;
  onComplete: () => void;
  onUndoComplete: () => void;
  onNavigate: (lessonId: number) => void;
  onBackToCourse: () => void;
}

/** 「前のレッスンへ」「内容をプレビュー」など並列アクションの Neutral Outline ボタン */
const outlineButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 40,
  padding: '0 16px',
  border: `1px solid ${color.borderNeutral}`,
  borderRadius: radius.nav,
  background: color.surface,
  color: color.textStrong,
  fontFamily: 'inherit',
  ...font.buttonSm,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** 「次のレッスンへ」の Primary ボタン（完了後の主動線） */
const primarySmButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 40,
  padding: '0 20px',
  border: 'none',
  borderRadius: radius.nav,
  background: color.primary,
  color: color.textOnPrimary,
  fontFamily: 'inherit',
  ...font.buttonSm,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/**
 * 次のレッスンのサムネイル位置。カードの比率をデザイン 2a に合わせる役。
 *
 * 🔴 2a は灰色のバーを積んだプレースホルダを置いているが、そのまま写さない。
 *    あれは「実際にはサムネイル画像が入る」ことを示すモック用の代替表現で、
 *    LessonDoc に画像が無いこのアプリで出すと、いつまでも解決しない
 *    スケルトン（読み込み中）に見えてしまう。
 *    代わりに「レッスン」を表すアイコンのタイルにして、意図的な絵だと分かる形にする。
 *    サムネイル画像が取れるようになったらここを <img> に差し替える。
 */
function NextThumb() {
  return (
    <div
      aria-hidden
      className="grid place-items-center"
      style={{
        width: 148,
        height: 92,
        flex: 'none',
        background: color.hoverBgTint,
        border: `1px solid ${color.primaryBorderSoft}`,
        borderRadius: radius.sm,
      }}
    >
      <BookOpen size={26} strokeWidth={1.5} style={{ color: color.primaryBorder }} />
    </div>
  );
}

/**
 * 「次のレッスン」カード。未完了（終了カードの下）と完了済み（達成カードの中）の
 * 両方で使う。中身は同じで、次へ進むボタンの強さと入れ子かどうかだけが違う。
 *
 * 最後のレッスンには次が無いので、同じ器のまま「コースの目次へ」に差し替える。
 * デザイン 2a にその状態は無いが、器を変えると終点の見た目が2種類になる。
 */
function NextUpCard({
  doc,
  nextMeta,
  onNavigate,
  onBackToCourse,
  nextEmphasis,
  nested,
}: {
  doc: LessonDoc;
  nextMeta?: NextLessonMeta;
  onNavigate: (lessonId: number) => void;
  onBackToCourse: () => void;
  /** 次へ進むボタンの強さ。完了前は主動線にしない */
  nextEmphasis: 'outline' | 'primary';
  /** 達成カードの中に入れるとき。影を落として角丸を1段下げる */
  nested?: boolean;
}) {
  const next = doc.next;
  const nextStyle = nextEmphasis === 'primary' ? primarySmButton : outlineButton;
  const nextIconColor = nextEmphasis === 'primary' ? color.textOnPrimary : color.textStrong;

  // 🔴 学習タイプ（演習／基礎知識…）はここに出さない。選ぶ判断に使われていなかったので
  //    アプリ全体で表示をやめた。残すのは目次から取れる実データだけ。
  const metaBits = [nextMeta?.minutes ? `読了目安 ${nextMeta.minutes}分` : null].filter(Boolean);

  return (
    <div
      className="flex items-center"
      style={{
        gap: 20,
        textAlign: 'left',
        padding: 20,
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: nested ? radius.nav : radius.lg,
        boxShadow: nested ? 'none' : shadow.soft,
        flexWrap: 'wrap',
      }}
    >
      <NextThumb />

      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="flex items-center" style={{ gap: 6, ...font.chip, color: color.textMuted, marginBottom: 6 }}>
          {next ? <BookOpen size={13} /> : <List size={13} />}
          {next ? '次のレッスン' : 'このコースの最後のレッスンです'}
        </div>

        <div style={{ ...font.cardTitle, fontSize: 15.5, color: color.text, marginBottom: 4, lineHeight: 1.5 }}>
          {next ? next.title : doc.courseName}
        </div>

        {/* 説明文の代わりに、目次から取れる実データだけを出す（作文はしない） */}
        {next && metaBits.length > 0 && (
          <div style={{ ...font.caption, color: color.textMuted, marginBottom: 12 }}>
            {metaBits.join(' ・ ')}
          </div>
        )}

        <div className="flex items-center" style={{ gap: 12, flexWrap: 'wrap', marginTop: metaBits.length ? 0 : 12 }}>
          {doc.prev && (
            <button
              type="button"
              onClick={() => onNavigate(doc.prev!.lessonId)}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={outlineButton}
            >
              <ArrowLeft size={14} />
              前のレッスンへ
            </button>
          )}

          {next ? (
            <button
              type="button"
              onClick={() => onNavigate(next.lessonId)}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={nextStyle}
            >
              {nextEmphasis === 'primary' ? '次のレッスンへ' : '内容をプレビュー'}
              <ArrowRight size={14} color={nextIconColor} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onBackToCourse}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={nextStyle}
            >
              コースの目次へ
              <ArrowRight size={14} color={nextIconColor} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LessonArticle({
  doc,
  articleRef,
  clips,
  flashBlockId,
  videoUrl,
  isCompleted,
  completing,
  nextMeta,
  onComplete,
  onUndoComplete,
  onNavigate,
  onBackToCourse,
}: LessonArticleProps) {
  const isFallback = doc.source === 'moodle-fallback';

  // 保存済みクリップを本文へ当て直す。ブロックが差し替わるたびに再適用する。
  useEffect(() => {
    const container = articleRef.current;
    if (!container || isFallback) return;
    applyClipMarks(container, clips);
  }, [articleRef, clips, doc.lessonId, isFallback]);

  // 章立ては structured 教材のときだけ。moodle-fallback は iframe の中身なので触らない
  const sections = isFallback ? [] : groupByHeading(doc.blocks);

  return (
    <article
      /* 移行教材は元サイトのCSSを持っている。その CSS は .wc-lesson-scope の内側だけに
         効くよう書き換えてあるので、この枠を付けて初めて元の見た目になる。
         移行教材以外（doc.css が無い）には付けないので、既存の教材は影響を受けない。 */
      className={doc.css ? 'wc-lesson-scope' : undefined}
      style={{
        /*
         * 読み幅は CSS 変数で決める。サポートパネルが横に並んだときだけ
         * 狭める（1040 → 880）ので、その分岐は index.css 側に置いている。
         * JSで幅を測ると境界で跳ねるうえ、パネルの開閉ごとに再レンダリングになる。
         *
         * 🔴 ここに左右パディングは持たせない。この幅を「白いカードの外寸」
         *    そのものにしたいので（デザイン 2a の maxWidth 880/1040 と同値）、
         *    狭い画面用のガターは main 側が持つ。
         *    このプロジェクトは box-sizing のグローバル指定が無いため、
         *    パディングを足すと外寸が変数の値と一致しなくなる。
         */
        width: 'min(100%, var(--wc-reading-max, 900px))',
        margin: '40px auto 120px',
      }}
    >
      {/* 白いカードに載せる（デザイン案 2a）。
          一度は「本文だけが画面に残ったのに枠で囲うと紙の中の紙になる」として
          外していたが、2a はサイドパネルと横に並ぶ構成なので、
          本文がどこまでかを面で示したほうが読む場所が定まる。
          枠なしで端から端まで白くする案は別案 3a にあたる。 */}
      {/* 教材が持っていた CSS。枠に閉じ込めてあるので LMS 側の画面には漏れない。 */}
      {doc.css && <style>{doc.css}</style>}
      <div
        style={{
          background: color.surface,
          border: `1px solid ${color.border}`,
          borderRadius: radius.card,
          boxShadow: shadow.card,
          padding: 'clamp(24px, 4vw, 48px)',
        }}
      >
        {/* ── ヘッダー：タイトル・リード ──
            🔴 タイトルの上に学習タイプ（演習／基礎知識…）の eyebrow を出していたが撤去した。
               受講生が読むのはレッスン名で、分類名は選ぶ判断に使われていなかった。 */}
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(24px, 3.4vw, 38px)',
              fontWeight: 900,
              lineHeight: 1.35,
              letterSpacing: '-.02em',
              color: color.text,
            }}
          >
            {doc.title}
          </h1>

          {/* タイトル下の短い赤線。ここから本文が始まる合図 */}
          <span
            aria-hidden
            style={{ display: 'block', width: 48, height: 3, borderRadius: 2, background: color.primary, margin: '18px auto 0' }}
          />

          {doc.lead && (
            <p
              style={{
                margin: '20px auto 0',
                maxWidth: 640,
                color: color.textMuted,
                fontSize: 14,
                lineHeight: 2,
              }}
            >
              {doc.lead}
            </p>
          )}

          <div
            className="flex items-center justify-center flex-wrap"
            style={{ gap: 14, marginTop: 18, ...font.caption, color: color.textFaint }}
          >
            {doc.materialFormat && <span>{MATERIAL_FORMAT_LABEL[doc.materialFormat]}教材</span>}
            {doc.estimatedMinutes > 0 && (
              <span className="inline-flex items-center" style={{ gap: 4 }}>
                <Clock size={12} /> 読了目安 {doc.estimatedMinutes}分
              </span>
            )}
          </div>
        </header>

        {/* できるようになること。参照デザインの「チェックしてみよう」と同じ組み方で、
            読み始める前に到達点を見せる */}
        {doc.goals.length > 0 && (
          <div
            style={{
              padding: '20px 24px',
              border: `1px solid ${color.primaryBorderSoft}`,
              borderRadius: radius.md,
              background: color.hoverBgTint,
              marginBottom: 36,
            }}
          >
            <div className="flex items-center" style={{ gap: 8, ...font.chip, color: color.primary, marginBottom: 14 }}>
              <Check size={14} /> このレッスンでできるようになること
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 22px' }}>
              {doc.goals.map((goal) => (
                <div key={goal} className="flex items-start" style={{ gap: 9, fontSize: 12.5, lineHeight: 1.8, color: color.textBody }}>
                  <Check size={14} style={{ color: color.primary, flexShrink: 0, marginTop: 3 }} />
                  <span>{goal}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 本文 ──
            LessonImageZoom は本文の画像クリックを拾って拡大表示に差し替える。
            🔴 articleRef の div 自体は包み替えない。ハイライトの復元・選択ツールバー・
               ?block= の深リンク・読書位置の監視がこの div と data-block-id を見ているので、
               外側に1枚足すだけにしてある。 */}
        <LessonImageZoom>
        <div ref={articleRef} data-lesson-article>
          {!isFallback && (
            <div
              className="flex items-center"
              /* 🔴 白カードの中に入ったので、地色は白から淡いピンクへ。
                 白地に白いカードだと枠線だけの見た目になり、帯として読めない */
              style={{
                gap: 8,
                marginBottom: 26,
                padding: '9px 14px',
                borderRadius: radius.nav,
                background: color.hoverBgTint,
                border: `1px solid ${color.primaryBorderSoft}`,
                ...font.caption,
                color: color.textMuted,
              }}
            >
              <Sparkles size={13} style={{ color: color.primary, flexShrink: 0 }} />
              分からない文章はドラッグで選択すると、解説・AIへの質問・クリップができます。右下からAI・メモも開けます
            </div>
          )}

          {isFallback ? (
            <MoodleFallbackBlock
              html={doc.fallbackHtml ?? ''}
              contentType={doc.fallbackModname}
              title={doc.title}
              videoUrl={videoUrl}
              externalUrl={resolveExternalUrl({
                id: doc.lessonId,
                name: doc.title,
                modname: 'url',
                content: doc.fallbackHtml,
              })}
            />
          ) : (
            sections.map((section) => (
              /* 🔴 このラッパーには data-block-id を付けない。
                 選択・クリップ復元・ジャンプ・読書位置の監視がその属性で
                 ブロックを引いているので、章の箱が混ざると誤検出する。 */
              <section key={`sec-${section.index}`} style={{ marginBottom: 8 }}>
                {section.heading && (
                  <div className="flex items-center" style={{ gap: 14, margin: '38px 0 16px' }}>
                    <span
                      aria-hidden
                      className="grid place-items-center flex-shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: color.primary,
                        color: color.textOnPrimary,
                        fontSize: 13,
                        fontWeight: 900,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {String(section.index).padStart(2, '0')}
                    </span>
                    {/* 章見出しは本文中の h2（22px）より一段上。ここが本文の最上位の区切り */}
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.45, letterSpacing: '-.015em', color: color.text }}>
                      {section.heading}
                    </h2>
                  </div>
                )}
                {section.blocks.map((block) => (
                  <LessonBlockView key={block.id} block={block} flashing={flashBlockId === block.id} />
                ))}
              </section>
            ))
          )}

          {/* ── 次にやること ── */}
          {doc.nextAction && (
            <section
              style={{
                marginTop: 30,
                padding: '18px 20px',
                border: `1px solid ${color.primaryBorderSoft}`,
                borderRadius: radius.md,
                background: color.primarySoft,
              }}
            >
              <strong style={{ ...font.rowTitle, color: color.text, display: 'block', marginBottom: 6 }}>
                次にやること
              </strong>
              <p style={{ margin: 0, ...font.label, color: color.textBody, lineHeight: 1.85 }}>{doc.nextAction}</p>
            </section>
          )}

          {/* ── レッスンの終点（デザイン案 2a）──
              以前はここが「前のレッスン｜完了して次へ進む」の1本の帯だった。
              罫線1本の上にボタンが2つ並ぶだけなので、長い本文を読み切った終点だと
              分からず、完了が「ページの下にあるボタン」に見えていた。
              2a は終点を2つの面で組む:
                未完了 … ゴールドの「ここまでで終了です」カード ＋ 次のレッスンカード
                完了済 … 緑の達成カード（その中に次のレッスンカードを入れる）
              §DESIGN.md「達成を必ず祝う」「1画面のPrimary CTAは1つ」に沿う形。 */}
          <footer style={{ marginTop: 40 }}>
            {!isCompleted && (
              <>
                {/* 完了を促すゴールドカード。この画面の Primary CTA はこの1つだけ */}
                <div
                  style={{
                    background: color.goalBg,
                    border: `1px solid ${color.goalBorder}`,
                    borderRadius: radius.lg,
                    padding: 'clamp(24px, 3vw, 32px)',
                    textAlign: 'center',
                    marginBottom: 24,
                  }}
                >
                  <h3 style={{ margin: '0 0 10px', fontSize: 19, fontWeight: 900, lineHeight: 1.5, color: color.text }}>
                    ここまでで「{doc.title}」は終了です
                  </h3>
                  <span
                    aria-hidden
                    style={{
                      display: 'block', width: 40, height: 3, borderRadius: 999,
                      background: color.primary, margin: '0 auto 16px',
                    }}
                  />
                  <p style={{ margin: '0 0 20px', ...font.label, lineHeight: 1.9, color: color.textMuted }}>
                    内容を確認できたら、このレッスンを完了しましょう。
                    <br />
                    完了すると学習進捗に反映されます。
                  </p>
                  <button
                    type="button"
                    onClick={onComplete}
                    disabled={completing}
                    className="inline-flex items-center disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      gap: 8, minHeight: 46, padding: '0 28px', border: 'none', borderRadius: radius.nav,
                      background: color.primary, color: color.textOnPrimary,
                      fontFamily: 'inherit', ...font.bodyLarge,
                      boxShadow: shadow.primaryButton,
                      cursor: completing ? 'default' : 'pointer',
                    }}
                  >
                    <Check size={16} strokeWidth={2.5} />
                    {completing ? '送信中…' : 'このレッスンを完了する'}
                  </button>
                </div>

                {/* 次に何が待っているかを見せる。完了前は主動線にしないので
                    Primary ではなく Neutral Outline に落とす */}
                <NextUpCard
                  doc={doc}
                  nextMeta={nextMeta}
                  onNavigate={onNavigate}
                  onBackToCourse={onBackToCourse}
                  nextEmphasis="outline"
                />
              </>
            )}

            {isCompleted && (
              <>
                <div
                  style={{
                    background: color.successSurface,
                    border: `1px solid ${color.success}`,
                    borderRadius: radius.lg,
                    padding: 'clamp(24px, 3vw, 32px)',
                    textAlign: 'center',
                  }}
                >
                  <div className="inline-flex items-center" style={{ gap: 12, marginBottom: 10 }}>
                    <span
                      aria-hidden
                      className="grid place-items-center"
                      style={{ width: 32, height: 32, borderRadius: '50%', background: color.success, flexShrink: 0 }}
                    >
                      <Check size={18} strokeWidth={2.5} color={color.textOnPrimary} />
                    </span>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, lineHeight: 1.4, color: color.text }}>
                      「{doc.title}」を完了しました
                    </h3>
                  </div>
                  <span
                    aria-hidden
                    style={{
                      display: 'block', width: 40, height: 3, borderRadius: 999,
                      background: color.success, margin: '0 auto 16px',
                    }}
                  />
                  <p style={{ margin: '0 0 24px', ...font.label, lineHeight: 1.9, color: color.textBody }}>
                    {doc.next
                      ? 'よく頑張りました！この調子で、次のレッスンに進みましょう。'
                      : 'よく頑張りました！これでこのコースのレッスンはすべて終わりです。'}
                  </p>
                  {/* 達成カードの中に次の一手を入れる（2a の組み方）。
                      祝う面と次へ進む面を分けると、演出が2つ並んで安っぽくなる */}
                  <NextUpCard
                    doc={doc}
                    nextMeta={nextMeta}
                    onNavigate={onNavigate}
                    onBackToCourse={onBackToCourse}
                    nextEmphasis="primary"
                    nested
                  />
                </div>

                {/* 完了の取り消し。デザインには無いが既にある操作なので消さない。
                    祝う面の外に、最も静かな見せ方で置く */}
                <div className="flex justify-center" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={onUndoComplete}
                    className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{
                      background: 'none', border: 'none', padding: '4px 8px',
                      ...font.caption, color: color.textSubtle,
                      textDecoration: 'underline', cursor: 'pointer',
                    }}
                  >
                    完了を取り消す
                  </button>
                </div>
              </>
            )}
          </footer>
        </div>
        </LessonImageZoom>
      </div>
    </article>
  );
}

export default LessonArticle;
