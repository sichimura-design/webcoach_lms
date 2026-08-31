import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Checkbox } from '../ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { color as wc, radius, shadow, t } from '../../theme/webcoachTheme';
import LessonBlockView from '../learning/LessonBlockView';
import type { LessonBlock, LessonBlockKind } from '../../types/lesson';
import { LESSON_BLOCK_KIND_LABEL } from '../../types/lesson';

/**
 * トークン・共通部品カタログ（モック時のみ /dev/catalog で到達）。
 *
 * 何のための画面か:
 *   「ボタンが4系統ある」「同じカードなのに影が3種類ある」といった横断のばらつきは、
 *   34画面を巡らなくても、部品を横に並べれば1画面で全部見える。
 *   UI/UXレビュー（frontend/docs/ui-review/）の1〜4日目「横串」で使う。
 *
 * この画面のルール:
 *   🔴 ここは「実装をそのまま並べて見比べる」ための画面なので、意図的に
 *      複数のトークン系統を混ぜて書いている。**他の画面の書き方の参考にしないこと。**
 *   🔴 部品を追加・変更したら、ここにも並べる。ここが最新でないと横串レビューが空振りする。
 *
 * --dc-* は :root ではなく .mypage-3d / .wc-warm スコープに定義されている
 * （index.css）。そのためこのページ全体を .wc-warm で包み、可変スケール
 * （--dc-fs-* / --dc-sp-*）を見る節だけ .mypage-3d を重ねている。
 */

/** 役割が同じなのに系統ごとに値が違う可能性のある組み合わせ。値は実行時に読む。 */
const ROLE_PAIRS: { role: string; cssVar: string; wcValue: string; wcName: string }[] = [
  { role: 'ブランド primary', cssVar: '--dc-primary', wcValue: wc.primary, wcName: 'color.primary' },
  { role: 'ブランド hover', cssVar: '--dc-primary-hover', wcValue: wc.primaryHover, wcName: 'color.primaryHover' },
  { role: 'ページ背景', cssVar: '--dc-bg', wcValue: wc.pageBg, wcName: 'color.pageBg' },
  { role: 'カード面', cssVar: '--dc-surface', wcValue: wc.surface, wcName: 'color.surface' },
  { role: 'カード枠', cssVar: '--dc-border', wcValue: wc.border, wcName: 'color.border' },
  { role: '本文（最も濃い）', cssVar: '--dc-text', wcValue: wc.text, wcName: 'color.text' },
  { role: '本文', cssVar: '--dc-text-body', wcValue: wc.textBody, wcName: 'color.textBody' },
  { role: '弱い文字', cssVar: '--dc-text-muted', wcValue: wc.textMuted, wcName: 'color.textMuted' },
  { role: '成功', cssVar: '--dc-success', wcValue: wc.success, wcName: 'color.success' },
  { role: '成功の面', cssVar: '--dc-success-surface', wcValue: wc.successSurface, wcName: 'color.successSurface' },
];

/** --dc-* の色トークン。グループはレビュー時に見る順。 */
const DC_COLOR_GROUPS: { group: string; vars: string[] }[] = [
  { group: 'ブランド', vars: ['--dc-primary', '--dc-primary-hover', '--dc-tint-50', '--dc-soft-100', '--dc-soft-200', '--dc-badge-pink'] },
  { group: '面', vars: ['--dc-bg', '--dc-surface', '--dc-sunken', '--dc-neutral-surface'] },
  { group: '文字', vars: ['--dc-text', '--dc-text-body', '--dc-text-muted', '--dc-text-subtle', '--dc-chevron'] },
  { group: '罫・枠', vars: ['--dc-border', '--dc-border-strong', '--dc-rule'] },
  { group: 'アクセント', vars: ['--dc-ai', '--dc-gold', '--dc-gold-text', '--dc-gold-surface', '--dc-gold-border', '--dc-label-warm'] },
  { group: '状態', vars: ['--dc-success', '--dc-success-surface', '--dc-idle-surface', '--dc-idle-border', '--dc-idle-text', '--dc-idle-dash'] },
];

/**
 * タイポグラフィスケール（.mypage-3d スコープ）。実効pxは実行時に測る。
 * 大きい順。20px以下は固定px・28px以上だけ可変（frontend/docs/typography.md）。
 * 🔴 レビューでは「12px未満が出ていないこと」をこの節で確定させる。
 */
const DC_FONT_VARS = [
  '--dc-fs-hero', '--dc-fs-hero-sm', '--dc-fs-hero-xs', '--dc-fs-display',
  '--dc-fs-title', '--dc-fs-lead', '--dc-fs-body', '--dc-fs-caption',
];

/** 各トークンの役割。名前だけでは「どこに使うか」が決まらないので併記する。 */
const DC_FONT_ROLES: Record<string, string> = {
  '--dc-fs-hero': '可変 / ストリークの日数（1桁）',
  '--dc-fs-hero-sm': '可変 / ストリークの日数（2桁）',
  '--dc-fs-hero-xs': '可変 / ストリークの日数（3桁）・「あと41分」',
  '--dc-fs-display': '可変 / h1・KPI の数値',
  '--dc-fs-title': '固定 / コンテンツ名（レッスン名・上位者名）',
  '--dc-fs-lead': '固定 / CTA・タスク名・カード見出し h2・数値の単位',
  '--dc-fs-body': '固定 / UI標準（タブ・説明文・サブ情報）',
  '--dc-fs-caption': '固定 / 補足専用（日時・目安・曜日・脚注）',
};

/** 行間。サイズと対で見たいので同じ節に並べる。 */
const DC_LH_VARS = ['--dc-lh-hero', '--dc-lh-heading', '--dc-lh-ui', '--dc-lh-prose'];
const DC_SPACE_VARS = [
  '--dc-sp-page-x', '--dc-sp-page-y', '--dc-sp-gap', '--dc-sp-card-y', '--dc-sp-card-x',
  '--dc-sz-badge', '--dc-sz-btn', '--dc-sz-cell',
];

const UI_BUTTON_VARIANTS = [
  'default', 'destructive', 'outline', 'secondary', 'ghost', 'link',
  'brand-gradient', 'brand', 'brand-ghost', 'brand-outline', 'brand-muted',
] as const;

const UI_BUTTON_SIZES = ['default', 'sm', 'lg', 'pill', 'pill-sm', 'pill-lg'] as const;

/** 教材ブロックの見本。実際の移行教材と同じ形（html は素のHTML）。 */
const SAMPLE_BLOCKS: LessonBlock[] = (
  ['text', 'figure', 'video', 'example', 'callout', 'task', 'summary', 'quiz'] as LessonBlockKind[]
).map((kind, i) => ({
  id: `sample-${kind}`,
  heading: i === 0 ? '見本の小見出し' : '',
  kind,
  html:
    kind === 'quiz'
      ? ''
      : `<p>この段落は <code>kind: ${kind}</code> のブロックです。囲み枠とラベルは JSX 側（LessonBlockView）が付けます。<strong>強調</strong>と<a href="#">リンク</a>を含みます。</p>`,
  plain: `kind: ${kind} の見本`,
  ...(kind === 'quiz'
    ? {
        quiz: {
          question: '確認問題の見本です。正しいものを選んでください。',
          choices: [
            { text: '正しい選択肢', correct: true, explain: '正解です。' },
            { text: '誤っている選択肢', correct: false, explain: 'ここが違います。' },
          ],
        },
      }
    : {}),
}));

/** 見出し（節） */
function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 56, scrollMarginTop: 24 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: 'var(--dc-text)',
          margin: '0 0 6px',
          paddingBottom: 8,
          borderBottom: '2px solid var(--dc-primary)',
        }}
      >
        {title}
      </h2>
      {note && (
        <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--dc-text-muted)', margin: '10px 0 20px' }}>{note}</p>
      )}
      {children}
    </section>
  );
}

/** 並べて比べるための小見出し */
function Sub({ children }: { children: ReactNode }) {
  return (
    <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--dc-text-body)', margin: '26px 0 12px' }}>{children}</h3>
  );
}

/** 注意書き */
function Warn({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--dc-soft-100)',
        border: '1px solid var(--dc-soft-200)',
        borderLeft: '4px solid var(--dc-primary)',
        borderRadius: 8,
        padding: '12px 16px',
        fontSize: 13,
        lineHeight: 1.75,
        color: 'var(--dc-text-body)',
        margin: '12px 0 20px',
      }}
    >
      {children}
    </div>
  );
}

const cellStyle: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--dc-rule)',
  fontSize: 12.5,
  textAlign: 'left',
  verticalAlign: 'middle',
};

function Swatch({ value, size = 34 }: { value: string; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 8,
        background: value || 'transparent',
        border: '1px solid var(--dc-border-strong)',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
}

export default function DevCatalogPage() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [scalePx, setScalePx] = useState<Record<string, string>>({});
  const [width, setWidth] = useState(window.innerWidth);

  // CSS変数の実値と、可変スケールの実効pxを測る。幅を変えるたびに測り直す。
  useEffect(() => {
    const measure = () => {
      setWidth(window.innerWidth);

      if (scopeRef.current) {
        const cs = getComputedStyle(scopeRef.current);
        const next: Record<string, string> = {};
        const all = [...DC_COLOR_GROUPS.flatMap((g) => g.vars), ...ROLE_PAIRS.map((p) => p.cssVar)];
        for (const v of all) next[v] = cs.getPropertyValue(v).trim();
        setVars(next);
      }

      if (scaleRef.current) {
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.visibility = 'hidden';
        scaleRef.current.appendChild(el);
        const next: Record<string, string> = {};
        for (const v of [...DC_FONT_VARS, ...DC_SPACE_VARS]) {
          // clamp() の実効値は font-size に載せて計測するのが最も確実。
          el.style.fontSize = `var(${v})`;
          next[v] = getComputedStyle(el).fontSize;
        }
        scaleRef.current.removeChild(el);
        setScalePx(next);
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const band =
    width >= 1800 ? '1920px 帯（等倍）' : width >= 1420 ? '1520px 帯（表示倍率125%相当・最も崩れる）' : width >= 700 ? 'タブレット帯（レビュー対象外）' : '390px 帯（スマホ）';

  const norm = (v: string) => v.trim().toLowerCase();

  return (
    <div
      ref={scopeRef}
      className="wc-warm"
      style={{
        minHeight: '100vh',
        background: 'var(--dc-bg)',
        color: 'var(--dc-text-body)',
        fontFamily: "'Noto Sans JP', system-ui, sans-serif",
        padding: '32px clamp(20px, 2.53vw, 48px) 80px',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* ── ヘッダー ───────────────────────────── */}
        <p style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: '1.6px', color: 'var(--dc-label-warm)', margin: '0 0 8px' }}>
          DEV ONLY — モック時のみ到達
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--dc-text)', margin: '0 0 12px' }}>
          トークン・部品カタログ
        </h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--dc-text-muted)', margin: '0 0 20px' }}>
          横断のばらつき（A分類）を1画面で見つけるための比較台。
          運用は <code>frontend/docs/ui-review/README.md</code> を参照。
          <br />
          <strong>ブラウザ幅を 1920 → 1520 → 390 と変えながら見てください。</strong>
          1520px は Windows の表示倍率125%に相当し、最も崩れる幅です。
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--dc-surface)',
            border: '1px solid var(--dc-border)',
            borderRadius: 'var(--dc-radius-md)',
            boxShadow: 'var(--dc-shadow-card)',
            padding: '12px 18px',
            marginBottom: 28,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--dc-text-muted)' }}>いまの表示幅</span>
          <strong style={{ fontSize: 22, fontWeight: 900, color: 'var(--dc-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {width}px
          </strong>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--dc-text-body)' }}>{band}</span>
        </div>

        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
          {[
            ['tokens', '1. 色トークン'],
            ['conflict', '2. 系統の食い違い'],
            ['scale', '3. 可変スケール'],
            ['buttons', '4. ボタン4系統'],
            ['cards', '5. カード4系統'],
            ['parts', '6. その他の部品'],
            ['lesson', '7. 教材ブロック'],
            ['missing', '8. 不在の部品'],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: 'var(--dc-primary)',
                background: 'var(--dc-soft-100)',
                border: '1px solid var(--dc-soft-200)',
                borderRadius: 999,
                padding: '6px 14px',
                textDecoration: 'none',
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* ── 1. 色トークン ───────────────────────── */}
        <Section
          id="tokens"
          title="1. 色トークン（--dc-*）"
          note="最新世代のトークン。値は実行時に getComputedStyle で読んでいるので、index.css を直すとここも変わる。"
        >
          {DC_COLOR_GROUPS.map((g) => (
            <div key={g.group}>
              <Sub>{g.group}</Sub>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {g.vars.map((v) => (
                  <div
                    key={v}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'var(--dc-surface)',
                      border: '1px solid var(--dc-border)',
                      borderRadius: 10,
                      padding: '8px 12px 8px 8px',
                      minWidth: 240,
                    }}
                  >
                    <Swatch value={vars[v] || ''} />
                    <span style={{ lineHeight: 1.45 }}>
                      <code style={{ fontSize: 11.5, color: 'var(--dc-text-body)', display: 'block' }}>{v}</code>
                      <code style={{ fontSize: 11, color: 'var(--dc-text-subtle)' }}>{vars[v] || '（未定義）'}</code>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Sub>影と角丸</Sub>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {[
              ['--dc-shadow-card', '--dc-radius-md'],
              ['--dc-shadow-float', '--dc-radius-lg'],
              ['--dc-shadow-primary-soft', '--dc-radius-xl'],
            ].map(([sh, rad]) => (
              <div
                key={sh}
                style={{
                  background: 'var(--dc-surface)',
                  border: '1px solid var(--dc-border)',
                  borderRadius: `var(${rad})`,
                  boxShadow: `var(${sh})`,
                  padding: '20px 22px',
                  minWidth: 250,
                }}
              >
                <code style={{ fontSize: 11.5, display: 'block', color: 'var(--dc-text-body)' }}>{sh}</code>
                <code style={{ fontSize: 11.5, color: 'var(--dc-text-subtle)' }}>{rad}</code>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 2. 系統の食い違い ────────────────────── */}
        <Section
          id="conflict"
          title="2. 系統の食い違い（同じ役割・違う値）"
          note="--dc-*（最新）と webcoachTheme.ts（現最大勢力・65ファイル）で、同じ役割に別の値が入っている箇所。判定は実行時の比較。"
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720, background: 'var(--dc-surface)', border: '1px solid var(--dc-border)', borderRadius: 10 }}>
              <thead>
                <tr>
                  {['役割', '--dc-*', 'webcoachTheme', '判定'].map((h) => (
                    <th key={h} style={{ ...cellStyle, fontWeight: 800, color: 'var(--dc-text)', background: 'var(--dc-sunken)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_PAIRS.map((p) => {
                  const dcValue = vars[p.cssVar] || '';
                  const same = dcValue !== '' && norm(dcValue) === norm(p.wcValue);
                  return (
                    <tr key={p.cssVar}>
                      <td style={{ ...cellStyle, fontWeight: 700 }}>{p.role}</td>
                      <td style={cellStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Swatch value={dcValue} size={22} />
                          <code style={{ fontSize: 11.5 }}>{p.cssVar}<br />{dcValue || '（未定義）'}</code>
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Swatch value={p.wcValue} size={22} />
                          <code style={{ fontSize: 11.5 }}>{p.wcName}<br />{p.wcValue}</code>
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <strong style={{ fontSize: 12, color: same ? 'var(--dc-success)' : 'var(--dc-primary)' }}>
                          {same ? '一致' : '✕ 不一致'}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.8, color: 'var(--dc-text-muted)', marginTop: 14 }}>
            ブランド赤は統一済み。**残っている食い違いは面・枠・文字のニュートラル**で、
            画面をまたぐと背景と文字の濃さがわずかに変わる。どちらを正にするかは
            <code>frontend/docs/ui-rules.md</code>（未作成）で決める。
          </p>
        </Section>

        {/* ── 3. 可変スケール ─────────────────────── */}
        <Section
          id="scale"
          title="3. タイポグラフィと可変スケール"
          note="フォントは20px以下が固定px（12px未満を作らないため）、28px以上だけ可変。余白・寸法は全部可変で、基準幅1900pxで最大値・幅に比例して縮む（係数は「最大値 × 100 / 1900 = vw」）。実効pxは実行時に測っているので、ブラウザ幅を変えると可変ぶんだけが動く。"
        >
          <div ref={scaleRef} className="mypage-3d" style={{ position: 'relative' }}>
            <Sub>フォントサイズ（8種）</Sub>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DC_FONT_VARS.map((v) => (
                <div
                  key={v}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 14,
                    padding: '6px 12px',
                    background: 'var(--dc-surface)',
                    border: '1px solid var(--dc-border)',
                    borderRadius: 8,
                  }}
                >
                  <code style={{ fontSize: 11, color: 'var(--dc-text-subtle)', width: 130, flexShrink: 0 }}>{v}</code>
                  <code
                    style={{
                      fontSize: 11,
                      color: 'var(--dc-primary)',
                      width: 56,
                      flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {scalePx[v] || '—'}
                  </code>
                  <span style={{ fontSize: 11, color: 'var(--dc-text-subtle)', width: 240, flexShrink: 0 }}>
                    {DC_FONT_ROLES[v]}
                  </span>
                  <span style={{ fontSize: `var(${v})`, color: 'var(--dc-text)', fontWeight: 700, lineHeight: 1.3 }}>
                    学習時間 1,234 分
                  </span>
                </div>
              ))}
            </div>

            <Sub>行間（4種）</Sub>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DC_LH_VARS.map((v) => (
                <div
                  key={v}
                  style={{
                    display: 'flex',
                    gap: 14,
                    padding: '6px 12px',
                    background: 'var(--dc-surface)',
                    border: '1px solid var(--dc-border)',
                    borderRadius: 8,
                  }}
                >
                  <code style={{ fontSize: 11, color: 'var(--dc-text-subtle)', width: 130, flexShrink: 0 }}>{v}</code>
                  <span
                    style={{
                      fontSize: 'var(--dc-fs-body)',
                      lineHeight: `var(${v})`,
                      color: 'var(--dc-text-body)',
                      maxWidth: 420,
                    }}
                  >
                    日本語は英語より行間を広めに取る。2行以上になる説明文を 1.3 台で組むと窮屈に見えるので、
                    このくらいの長さで折り返したときの詰まり具合を見る。
                  </span>
                </div>
              ))}
            </div>

            <Sub>余白・寸法（8種）</Sub>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DC_SPACE_VARS.map((v) => (
                <div
                  key={v}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '6px 12px',
                    background: 'var(--dc-surface)',
                    border: '1px solid var(--dc-border)',
                    borderRadius: 8,
                  }}
                >
                  <code style={{ fontSize: 11, color: 'var(--dc-text-subtle)', width: 150, flexShrink: 0 }}>{v}</code>
                  <code
                    style={{ fontSize: 11, color: 'var(--dc-primary)', width: 62, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {scalePx[v] || '—'}
                  </code>
                  <span style={{ display: 'block', height: 12, width: `var(${v})`, background: 'var(--dc-primary)', borderRadius: 3 }} />
                </div>
              ))}
            </div>
          </div>

          <Warn>
            この可変スケールは <code>.mypage-3d</code> スコープにしか定義されていないため、
            マイページ・学習記録以外の画面からは使えません。
            <code>/learning-plan</code>・<code>/learning-plan/setup</code>・<code>/connect/:token</code> は
            幅対応が入っていない状態です（画面台帳の「レスポンシブ方式」列が「（固定）」）。
          </Warn>
        </Section>

        {/* ── 4. ボタン ──────────────────────────── */}
        <Section
          id="buttons"
          title="4. ボタン（4系統が併存）"
          note="同じ「押す場所」に4つの実装系統がある。横に並べると、色・角丸・高さ・影のどれも揃っていないことが見える。"
        >
          <Warn>
            <strong>🔴 これが共通部品に寄せられていない根本原因です。</strong>
            <code>ui/button</code> の "brand" 系 variant は<strong>すべて旧ピンク／アンバーの値</strong>を指しています
            —<code>brand.DEFAULT</code> = <code>#FF5A7A</code>（ビビッドピンク）、
            <code>brand-gradient</code> = アンバー→ピンク、
            shadcn の <code>--primary</code> = <code>hsl(348 100% 68%)</code>（ピンク）。
            統一済みのブランド赤 <code>#D60934</code> は別系統の <code>dash.*</code> にあります。
            <br />
            つまり <strong>いま <code>ui/button</code> を使うと旧ピンクが出るので、新しい画面は使えず生 <code>&lt;button&gt;</code> に戻っている</strong>。
            共通部品へ寄せる前に <code>tailwind.config.js</code> と <code>index.css</code> の
            <code>--primary</code> を直す必要があります（下の1段目と2段目を見比べてください）。
          </Warn>

          <Sub>系統① ui/button — variant 11種（size=default）</Sub>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            {UI_BUTTON_VARIANTS.map((v) => (
              <span key={v} style={{ textAlign: 'center' }}>
                <Button variant={v}>ボタン</Button>
                <code style={{ display: 'block', fontSize: 10.5, color: 'var(--dc-text-subtle)', marginTop: 4 }}>{v}</code>
              </span>
            ))}
          </div>

          <Sub>系統① ui/button — size 6種（variant=brand-gradient）</Sub>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            {UI_BUTTON_SIZES.map((s) => (
              <span key={s} style={{ textAlign: 'center' }}>
                <Button variant="brand-gradient" size={s}>
                  ボタン
                </Button>
                <code style={{ display: 'block', fontSize: 10.5, color: 'var(--dc-text-subtle)', marginTop: 4 }}>{s}</code>
              </span>
            ))}
          </div>

          <Sub>系統② webcoachTheme の複合スタイル（現最大勢力・65ファイル）</Sub>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <span style={{ textAlign: 'center' }}>
              <button type="button" style={t.primaryButton}>
                続きからはじめる
              </button>
              <code style={{ display: 'block', fontSize: 10.5, color: 'var(--dc-text-subtle)', marginTop: 4 }}>
                t.primaryButton（角丸12・影あり）
              </code>
            </span>
            <span style={{ textAlign: 'center' }}>
              <button type="button" style={t.outlineButton}>
                学習記録を見る
              </button>
              <code style={{ display: 'block', fontSize: 10.5, color: 'var(--dc-text-subtle)', marginTop: 4 }}>
                t.outlineButton（角丸999＝ピル）
              </code>
            </span>
            <span style={{ textAlign: 'center', minWidth: 200 }}>
              <button type="button" style={t.ghostButton}>
                すべて見る
              </button>
              <code style={{ display: 'block', fontSize: 10.5, color: 'var(--dc-text-subtle)', marginTop: 4 }}>
                t.ghostButton（角丸14・幅100%）
              </code>
            </span>
            <span style={{ textAlign: 'center' }}>
              <span style={t.chip}>いまここ</span>
              <code style={{ display: 'block', fontSize: 10.5, color: 'var(--dc-text-subtle)', marginTop: 4 }}>t.chip</code>
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--dc-text-muted)', marginTop: 10, lineHeight: 1.8 }}>
            ここだけでも <strong>主ボタンは角丸12、副ボタンはピル（999）</strong>と形が揃っていません。
            どちらを正にするかを決める必要があります。
          </p>

          <Sub>系統③ --dc-* を参照した直書き（マイページ・学習記録などの新しい画面）</Sub>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <button
              type="button"
              style={{
                background: 'var(--dc-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '10px 22px',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: 'var(--dc-shadow-primary-soft)',
                fontFamily: 'inherit',
              }}
            >
              主ボタン（ピル）
            </button>
            <button
              type="button"
              style={{
                background: 'var(--dc-surface)',
                color: 'var(--dc-primary)',
                border: '1px solid var(--dc-soft-200)',
                borderRadius: 999,
                padding: '10px 22px',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              副ボタン
            </button>
            <button
              type="button"
              style={{
                background: 'transparent',
                color: 'var(--dc-text-muted)',
                border: 'none',
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              テキストボタン
            </button>
          </div>

          <Sub>系統④ 生 &lt;button&gt;（全体で322箇所）</Sub>
          <p style={{ fontSize: 12.5, color: 'var(--dc-text-muted)', lineHeight: 1.8 }}>
            画面ごとに色・角丸・パディングを直書きしている実装。多い順に
            <code>/coaching</code> 56、<code>/course/:id</code> 41、<code>/ai-coach</code> 28、<code>/notes</code> 26。
            代表例を並べる意味が薄いほど値がばらけているので、
            <strong>横串レビューでは実画面（Dev Preview）を並べて見てください。</strong>
          </p>
        </Section>

        {/* ── 5. カード ──────────────────────────── */}
        <Section
          id="cards"
          title="5. カード（4系統が併存）"
          note="影・角丸・枠線がそれぞれ違う。同じ画面に2系統が同居していないかを確認する。"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            <div style={{ ...t.card, padding: 22 }}>
              <strong style={{ fontSize: 15, fontWeight: 900, color: wc.text, display: 'block', marginBottom: 6 }}>
                t.card
              </strong>
              <code style={{ fontSize: 11, color: wc.textMuted, lineHeight: 1.7, display: 'block' }}>
                角丸 {radius.card} / 枠 {wc.border}
                <br />
                影 {shadow.card}
              </code>
            </div>

            <div style={{ ...t.softCard, padding: 22 }}>
              <strong style={{ fontSize: 15, fontWeight: 900, color: wc.text, display: 'block', marginBottom: 6 }}>
                t.softCard
              </strong>
              <code style={{ fontSize: 11, color: wc.textMuted, lineHeight: 1.7, display: 'block' }}>
                角丸 {radius.hero} / 枠 rgba赤12%
                <br />
                影 {shadow.cardWide}
              </code>
            </div>

            <div
              style={{
                background: 'var(--dc-surface)',
                border: '1px solid var(--dc-border)',
                borderRadius: 'var(--dc-radius-lg)',
                boxShadow: 'var(--dc-shadow-card)',
                padding: 22,
              }}
            >
              <strong style={{ fontSize: 15, fontWeight: 900, color: 'var(--dc-text)', display: 'block', marginBottom: 6 }}>
                --dc-* 直書き
              </strong>
              <code style={{ fontSize: 11, color: 'var(--dc-text-muted)', lineHeight: 1.7, display: 'block' }}>
                角丸 var(--dc-radius-lg)
                <br />
                影 var(--dc-shadow-card)
              </code>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>ui/card</CardTitle>
              </CardHeader>
              <CardContent>
                <code style={{ fontSize: 11, lineHeight: 1.7, display: 'block' }}>
                  shadcn 既定（Tailwind の border / card 変数を参照）。採用12ファイル
                </code>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ── 6. その他の部品 ─────────────────────── */}
        <Section id="parts" title="6. その他の共通部品（ui/*）" note="10部品あるが採用率が低い。tabs は import 0 = どこからも使われていない。">
          <Sub>ui/badge（variant 4種）— variant=default は上と同じピンク</Sub>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['default', 'secondary', 'destructive', 'outline'] as const).map((v) => (
              <span key={v} style={{ textAlign: 'center' }}>
                <Badge variant={v}>バッジ</Badge>
                <code style={{ display: 'block', fontSize: 10.5, color: 'var(--dc-text-subtle)', marginTop: 4 }}>{v}</code>
              </span>
            ))}
          </div>

          <Sub>ui/progress（採用9ファイル）</Sub>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
            {[15, 50, 88].map((n) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Progress value={n} />
                <code style={{ fontSize: 11, color: 'var(--dc-text-subtle)', width: 34 }}>{n}%</code>
              </div>
            ))}
          </div>

          <Sub>ui/checkbox（採用4ファイル）</Sub>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Checkbox /> 未チェック
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <Checkbox defaultChecked /> チェック済み
            </label>
          </div>

          <Sub>ui/tabs（import 0 — 使うか消すかを決める）</Sub>
          <Tabs defaultValue="a">
            <TabsList>
              <TabsTrigger value="a">タブA</TabsTrigger>
              <TabsTrigger value="b">タブB</TabsTrigger>
            </TabsList>
            <TabsContent value="a">
              <p style={{ fontSize: 13, color: 'var(--dc-text-muted)' }}>タブAの中身</p>
            </TabsContent>
            <TabsContent value="b">
              <p style={{ fontSize: 13, color: 'var(--dc-text-muted)' }}>タブBの中身</p>
            </TabsContent>
          </Tabs>
        </Section>

        {/* ── 7. 教材ブロック ─────────────────────── */}
        <Section
          id="lesson"
          title="7. 教材ブロック（kind 8種）"
          note="移行教材の本文はこの8種に分類して描画される。囲み枠とラベル（💡ポイント / ✓ チェックしてみよう / 📝 まとめ）は JSX 側が付ける。C分類の指摘はここを見る。"
        >
          {/* wc-lesson-prose は LessonBlockView が内部で付けるので、ここでは付けない（二重適用になる） */}
          <div style={{ background: 'var(--dc-surface)', border: '1px solid var(--dc-border)', borderRadius: 'var(--dc-radius-lg)', padding: 'clamp(18px, 1.8vw, 32px)' }}>
            {SAMPLE_BLOCKS.map((b) => (
              <div key={b.id} style={{ marginBottom: 22 }}>
                <code style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--dc-label-warm)', letterSpacing: '1px', display: 'block', marginBottom: 6 }}>
                  kind: {b.kind}（{LESSON_BLOCK_KIND_LABEL[b.kind]}）
                </code>
                <LessonBlockView block={b} flashing={false} />
              </div>
            ))}
          </div>

          <Warn>
            移行教材の本文HTMLには Clipkit 由来の class が残っています
            （<code>point-box</code> <code>notice-box</code> <code>check-box</code> <code>decoration-01</code>{' '}
            <code>lightbox</code> <code>image-large</code> <code>style-card</code> など）。
            <strong>これらに対応する CSS は現在1行もありません</strong>
            （効いているのは <code>index.css</code> の <code>.wc-lesson-prose</code> だけ）。
            そのため囲みが素の div として出ます。class 単位で「kind化 / CSS当て / 落とす」を決めるのが C分類の作業です。
          </Warn>
        </Section>

        {/* ── 8. 不在の部品 ──────────────────────── */}
        <Section id="missing" title="8. 不在の部品（作れば「1箇所直せば効く」形になる）" note="ここに並べるものが無い＝共通部品が存在しない。画面ごとに独自実装が散っている。">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {[
              ['Modal / Dialog', '画面ごとに独自実装。MeetingLinkModal(429行) / ConsentModal / FinishSessionModal(557行) / AISummaryDialog(MUI) / GlobalAiCoachDrawer。フォーカストラップと aria-modal も未統一。未使用の ui/sheet.tsx を土台にできる'],
              ['PageShell', 'AppHeader と各ページが maxWidth・余白を個別に組んでいる。余白の後追い修正が繰り返される直接原因'],
              ['EmptyState', '0件表示の「絵・文言・次の行動」の3点が画面ごとに違う。shared/ に MUI 実装が死蔵（import 1）'],
              ['LoadingState / ErrorState', 'ルートガードのスピナーが routes/index.tsx に3箇所コピペされ、色は #E86D78（サーモン）でブランド赤と別'],
              ['Table', '管理画面12画面がそれぞれ手書き。生hex が集中している場所と一致する'],
              ['Skeleton', '読み込み中のレイアウト保持が無く、描画時に要素が飛ぶ'],
            ].map(([name, why]) => (
              <div
                key={name}
                style={{
                  background: 'var(--dc-surface)',
                  border: '1px dashed var(--dc-border-strong)',
                  borderRadius: 'var(--dc-radius-md)',
                  padding: '16px 18px',
                }}
              >
                <strong style={{ fontSize: 14, fontWeight: 900, color: 'var(--dc-text)', display: 'block', marginBottom: 6 }}>
                  {name}
                </strong>
                <span style={{ fontSize: 12, lineHeight: 1.75, color: 'var(--dc-text-muted)' }}>{why}</span>
              </div>
            ))}
          </div>
        </Section>

        <p style={{ fontSize: 12, color: 'var(--dc-text-subtle)', textAlign: 'center', marginTop: 40 }}>
          部品を追加・変更したらこのページにも並べてください。ここが最新でないと横串レビューが空振りします。
        </p>
      </div>
    </div>
  );
}
