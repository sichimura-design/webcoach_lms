import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play } from 'lucide-react';
import { Course } from '../../types/mypage';
import { lessonProgressFromPercent } from '../../utils/lessonProgress';
import { formatMinutesHM } from '../../utils/studyStats';
import { splitLesson } from './ContinueLearningHero';

/**
 * 続きから学習（マイページ左上）。claude.ai/design『トップページ 3案』8a 準拠。
 *
 * 5a では学習の再開動線を StudyChallengeCard（ランキングのカード）の中に畳んでいたが、
 * 8a で独立したカードに戻した。ランキングを外したので、再開が他の情報に埋もれない。
 *
 * 🔴 このカードの「続きから学習する」がマイページ唯一の Primary CTA（DESIGN.md §15-5）。
 *    他のカードのボタンはアウトラインかテキストリンクに留めること。
 *
 * 🔴 進捗は「％」ではなく「5 / 11 レッスン」で見せる（utils/lessonProgress.ts）。
 *    デザイン 8a の表記は「5/11 パート」だが、単位は constants/learningTaxonomy.ts の
 *    正式名称（レッスン）に寄せる。アプリ全体で語彙を1つに保つため。
 */
interface ResumeStudyCardProps {
  /** 続きから学ぶコース。受講中のコースが無いときは undefined */
  course?: Course;
  /** 続きから学習する（没入型レッスンへ） */
  onOpenLesson: () => void;
  /** レッスンを選び直す（コース目次へ） */
  onOpenCurriculum: () => void;
}

const CARD_STYLE: CSSProperties = {
  flex: 1,
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
  display: 'flex',
  flexDirection: 'column',
};

export function ResumeStudyCard({ course, onOpenLesson, onOpenCurriculum }: ResumeStudyCardProps) {
  const navigate = useNavigate();
  const { no, name } = splitLesson(course?.currentLesson);
  const lessons = lessonProgressFromPercent(course?.progress, course?.totalLessons);
  const pct = Math.min(100, Math.max(0, course?.progress ?? 0));

  return (
    <section style={CARD_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span
          style={{
            width: 'var(--dc-sz-badge)',
            height: 'var(--dc-sz-badge)',
            flex: 'none',
            borderRadius: 9999,
            background: 'var(--dc-soft-100)',
            color: 'var(--dc-primary)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Play size={15} fill="currentColor" strokeWidth={0} />
        </span>
        <h2 style={{ margin: 0, fontSize: 'var(--dc-fs-title)', fontWeight: 700, color: 'var(--dc-text)' }}>
          続きから学習
        </h2>
      </div>

      {course ? (
        <>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 18 }}>
            <div
              style={{
                width: 150,
                height: 100,
                flex: 'none',
                borderRadius: 'var(--dc-radius-md)',
                overflow: 'hidden',
                background: 'var(--dc-badge-pink)',
              }}
            >
              {course.thumbnailUrl && (
                <img
                  src={course.thumbnailUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 'var(--dc-fs-xs)',
                  color: 'var(--dc-text-subtle)',
                  marginBottom: 6,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {course.title}
              </div>
              <div style={{ fontSize: 'var(--dc-fs-md)', fontWeight: 800, color: 'var(--dc-text)', lineHeight: 1.5 }}>
                {no && (
                  <>
                    <span className="dc-num">{no}</span>
                    <br />
                  </>
                )}
                {name || course.title}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: 'var(--dc-fs-xs)',
              marginBottom: 8,
            }}
          >
            <span className="dc-num" style={{ fontWeight: 800, color: 'var(--dc-text)' }}>
              {lessons ? (
                <>
                  {lessons.done}
                  <span style={{ fontWeight: 600, color: 'var(--dc-text-subtle)' }}>
                    /{lessons.total} レッスン
                  </span>
                </>
              ) : (
                <>
                  {Math.round(pct)}
                  <span style={{ fontWeight: 600, color: 'var(--dc-text-subtle)' }}>％ 完了</span>
                </>
              )}
            </span>
            {course.remainingMinutes != null && course.remainingMinutes > 0 && (
              <span style={{ color: 'var(--dc-text-subtle)' }}>
                残り 約{formatMinutesHM(course.remainingMinutes)}で完了できます
              </span>
            )}
          </div>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-valuetext={lessons ? lessons.full : `${Math.round(pct)}％完了`}
            style={{
              height: 7,
              borderRadius: 9999,
              background: 'var(--dc-progress-track)',
              overflow: 'hidden',
              marginBottom: 20,
            }}
          >
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 9999, background: 'var(--dc-primary)' }} />
          </div>

          <button
            type="button"
            onClick={onOpenLesson}
            className="dc-cta-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              height: 52,
              borderRadius: 14,
              border: 0,
              background: 'var(--dc-primary)',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-15)',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 10px 22px -10px rgba(160,8,36,.55)',
              marginBottom: 10,
            }}
          >
            続きから学習する
            <ArrowRight size={16} strokeWidth={2.25} />
          </button>

          <button
            type="button"
            onClick={onOpenCurriculum}
            className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 46,
              borderRadius: 14,
              background: 'var(--dc-surface)',
              border: '1px solid var(--dc-border-strong)',
              color: 'var(--dc-text-body)',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-14)',
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 'auto',
            }}
          >
            レッスンを選び直す
          </button>
        </>
      ) : (
        // 受講中のコースが無いときは「続きから」が成立しないので、選ぶところから始めてもらう
        <>
          <div
            style={{
              flex: 1,
              fontSize: 'var(--dc-fs-base)',
              color: 'var(--dc-text-body)',
              lineHeight: 1.9,
              marginBottom: 20,
            }}
          >
            まだ受講中のコースがありません。学習コンテンツから最初の1つを選びましょう。
          </div>
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="dc-cta-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              height: 52,
              borderRadius: 14,
              border: 0,
              background: 'var(--dc-primary)',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-15)',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 10px 22px -10px rgba(160,8,36,.55)',
              marginTop: 'auto',
            }}
          >
            学習コンテンツを見る
            <ArrowRight size={16} strokeWidth={2.25} />
          </button>
        </>
      )}
    </section>
  );
}

export default ResumeStudyCard;
