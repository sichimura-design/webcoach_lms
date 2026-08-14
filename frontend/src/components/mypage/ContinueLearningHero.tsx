import { useState } from 'react';
import { Course } from '../../types/mypage';

/**
 * マイページ左カラムの主役。「いま再開できるもの」を1つだけ出す。
 * claude.ai/design『マイページ 3d.dc.html』準拠。
 *
 * このページで塗りつぶしの赤ボタンを置くのはここだけ（DESIGN.md §15-5「Primary CTA は1画面1つ」）。
 * 他のカードのCTAはアウトラインかテキストリンクに留めること。
 *
 * 🔴 カードの見た目は画像そのもの。左42%が地色に近いテキスト領域、右がデスクの写真、
 *    という1枚絵（public/images/home/continue-bg.png）の上に文字を重ねている。
 *    写真の上に文字は乗らないので、暗いオーバーレイは敷かない。
 *
 * 🔴 ArrowRightIcon の export は消さない。
 *    GuildLobbyCard / PeopleActivityCard / StatsStrip / NextCoachingPlan が import している。
 */
interface ContinueLearningHeroProps {
  course: Course;
  /** 続きから学習する（没入型レッスンへ） */
  onOpen: () => void;
  /** レッスン全体を見る（コース目次へ） */
  onOpenCurriculum: () => void;
}

function ArrowRightIcon({ size = 15, stroke = '#FFFFFF' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * ヒーロー画像
 * ============================================================
 * public/images/home/continue-bg.png は design プロジェクトの assets/continue-bg.png
 * （2003×602 / RGBA / 3.327:1）。**文字が焼き込まれていない背景専用ファイル**で、
 * 左およそ半分が地色、右がデスクの写真。テキストはこの上に HTML で重ねる。
 *
 * 🔴 uploads/ にある「ChatGPT Image ….png」（2065×762）と間違えないこと。
 *    あちらはレッスン名・進捗バー・ボタンまで絵として焼き込まれた原画で、
 *    敷くと HTML のテキストと二重に出る。実際に一度それで踏んでいる。
 *    見分け方: 2065×762 なら原画、2003×602 なら背景専用。
 *
 * 🔴 写真側に文字は乗らないので、DESIGN.md §11 の暗いオーバーレイは敷かない。
 * ============================================================
 */
const HERO_RATIO = '2003 / 602';
/** 画像の地色（実測 #FBF6F2）。読み込み前後で地色が変わらないよう下地に敷く */
const HERO_CREAM = '#FBF6F2';

/** 線形の進捗バー。デザインは高さ8px・トラック Primary Soft 200 */
function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, alignSelf: 'stretch', maxWidth: 260, marginBottom: 14 }}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="レッスンの進捗"
        style={{ flex: 1, height: 8, borderRadius: 9999, background: 'var(--dc-soft-200)', overflow: 'hidden' }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 9999,
            background: 'var(--dc-primary)',
            transition: 'width 600ms var(--dc-ease)',
          }}
        />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--dc-text)', flex: 'none', whiteSpace: 'nowrap' }}>
        進捗{pct}%
      </span>
    </div>
  );
}

/**
 * currentLesson は「Lesson 4 バナー制作の基礎」のように連番と単元名がひと続きで来る。
 * 連番は上の小さな行（コース名と並べる）、単元名を大きな見出しに分けて組む。
 * この形でない値（自由記述など）は分けずに見出しへ回す。
 */
function splitLesson(currentLesson: string | undefined): { no: string | null; name: string | null } {
  if (!currentLesson) return { no: null, name: null };
  const m = currentLesson.match(/^\s*((?:Lesson|LESSON|レッスン)\s*\d+)[\s:：.．-]*(.*)$/);
  if (!m || !m[2]) return { no: null, name: currentLesson };
  return { no: m[1], name: m[2] };
}

function ContinueLearningHero({ course, onOpen, onOpenCurriculum }: ContinueLearningHeroProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const { no, name } = splitLesson(course.currentLesson);
  const heading = name || course.title;

  // 「はじめてのWebデザイン・Lesson 4」。見出しが単元名のときだけコース名を添える
  const meta = [heading !== course.title ? course.title : null, no, course.currentChapter]
    .filter(Boolean)
    .join('・');

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--dc-radius-xl)',
        overflow: 'hidden',
        border: '1px solid var(--dc-border)',
        boxShadow: 'var(--dc-shadow-card)',
        aspectRatio: HERO_RATIO,
        // 画像が読めないときもこの地色のカードとして成立する（縦横比は保つ）
        background: HERO_CREAM,
      }}
    >
      {!imageFailed && (
        <img
          src={`${process.env.PUBLIC_URL}/images/home/continue-bg.png`}
          alt="デスクでバナー制作を学習している様子"
          onError={() => setImageFailed(true)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          left: '4.6%',
          top: '50%',
          transform: 'translateY(-50%)',
          // 画像の地色は左およそ半分。48% までなら写真に文字が乗らない
          width: '48%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {meta && (
          <div style={{ fontSize: 12, color: 'var(--dc-text-muted)', marginBottom: 6 }}>{meta}</div>
        )}

        {/*
          🔴 デザインは white-space:nowrap だが、単元名はコース次第で長くなる。
             はみ出して写真に重なるより、2行までで畳むほうが崩れない。
        */}
        <h2
          style={{
            margin: '0 0 10px',
            fontSize: 22,
            lineHeight: 1.3,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--dc-text)',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}
        >
          {heading}
        </h2>

        <ProgressBar value={course.progress ?? 0} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onOpen}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--dc-primary)',
              color: '#fff',
              border: 0,
              borderRadius: 'var(--dc-radius-md)',
              padding: '9px 15px',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 200ms var(--dc-ease)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--dc-primary-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--dc-primary)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            続きから学習する
          </button>

          <button
            type="button"
            onClick={onOpenCurriculum}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              background: 'var(--dc-surface)',
              color: 'var(--dc-primary)',
              border: '1px solid var(--dc-primary)',
              borderRadius: 'var(--dc-radius-md)',
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 200ms var(--dc-ease)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--dc-tint-50)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--dc-surface)'; }}
          >
            レッスン全体を見る
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContinueLearningHero;
export { ArrowRightIcon };
