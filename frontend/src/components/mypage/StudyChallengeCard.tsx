import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { useStudyRanking } from '../../hooks/useRankings';
import { StudyRankingEntry } from '../../types/focusBooth';
import { Course } from '../../types/mypage';
import { formatMinutesHM } from '../../utils/studyStats';
import { lessonProgressFromPercent } from '../../utils/lessonProgress';
import { LEARNING_HIERARCHY } from '../../constants/learningTaxonomy';

function splitLesson(currentLesson: string | undefined): { no: string | null; name: string | null } {
  if (!currentLesson) return { no: null, name: null };
  const m = currentLesson.match(/^\s*((?:Lesson|LESSON|レッスン)\s*\d+)[\s:：.．-]*(.*)$/);
  if (!m || !m[2]) return { no: null, name: currentLesson };
  return { no: m[1], name: m[2] };
}

/**
 * 学習時間チャレンジ（マイページ右上）。claude.ai/design『トップページ 3案』5a 準拠。
 *
 * 「あと30分で5位」という**すぐ届く差**だけを見せて、その場で学習に戻れるようにするカード。
 * ランキング全体（順位表）は下の PeerRankingCard の役目で、ここは差分と行動だけを持つ。
 *
 * 🔴 マイページで唯一の Primary CTA（塗りつぶしの赤ボタン）は
 *    このカードの「続きから学習する」1つだけ（DESIGN.md §15-5）。
 *    他のカードのCTAはアウトラインかテキストリンクに留めること。
 *
 * 🔴 順位・差分は MSW（サーバ役）が確定させた entries から読むだけ。ここで並べ替えない。
 * 🔴 他の受講者は仮名のみ。実名・実写真は出さない。
 */
interface StudyChallengeCardProps {
  userId?: number;
  /** 表示名。「モックさん（あなた）」の形にするため */
  userName?: string;
  /** 「続きから学習する」の対象。無い場合はコース一覧への導線に差し替える */
  course?: Course;
  onOpenLesson: () => void;
  onOpenCurriculum: () => void;
}

/** 3列プログレスの1スロット。slots[0] は必ず自分 */
interface Slot {
  entry: StudyRankingEntry;
  /** 自分との差（分）。自分の行は null */
  diffMinutes: number | null;
}

/** 進み具合は「4 / 9」で出す。総レッスン数が取れないコースだけ％に落とす */
function ProgressBar({ value, totalLessons }: { value: number; totalLessons?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const lessons = lessonProgressFromPercent(pct, totalLessons);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: 600, color: 'var(--dc-text-body)', flex: 'none' }}>
        <span className="dc-num">{lessons ? lessons.short : `${pct}%`}</span>
        {lessons && <span style={{ color: 'var(--dc-text-muted)' }}> {LEARNING_HIERARCHY.lesson}</span>}
      </span>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={lessons?.full}
        aria-label="レッスンの進捗"
        style={{ flex: 1, height: 6, borderRadius: 9999, background: '#F0EAE1', overflow: 'hidden' }}
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
    </div>
  );
}

export function StudyChallengeCard({
  userId,
  userName,
  course,
  onOpenLesson,
  onOpenCurriculum,
}: StudyChallengeCardProps) {
  const navigate = useNavigate();
  const { ranking, loading, failed } = useStudyRanking(userId, 'week');

  const me = ranking?.me;
  const entries = ranking?.entries ?? [];

  // 自分より上の2人（=追う相手）。1位のときは追う相手がいないので、
  // 下の2人を並べて「リード」の見せ方に切り替える。
  const chasing = me ? entries.filter((e) => e.rank < me.rank).slice(-2).reverse() : [];
  const behind = me ? entries.filter((e) => e.rank > me.rank).slice(0, 2) : [];
  const isLeading = !!me && chasing.length === 0;
  const neighbours = isLeading ? behind : chasing;

  const slots: Slot[] = me
    ? [
        { entry: me, diffMinutes: null },
        ...neighbours.map((e) => ({ entry: e, diffMinutes: Math.abs(e.minutes - me.minutes) })),
      ]
    : [];

  // 見出し（あと◯分で◯位！）。1位のときは煽らずに事実だけを出す。
  const target = isLeading ? null : chasing[0];
  const gap = target && me ? Math.max(1, target.minutes - me.minutes) : 0;

  const { no, name } = splitLesson(course?.currentLesson);
  const lessonName = name || course?.title || '';

  return (
    <section
      style={{
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: 'var(--dc-shadow-card)',
        padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span
          style={{
            width: 'var(--dc-sz-badge)',
            height: 'var(--dc-sz-badge)',
            flex: 'none',
            borderRadius: 9999,
            background: 'var(--dc-gold-surface)',
            color: 'var(--dc-gold)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Trophy size={16} strokeWidth={1.75} />
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--dc-fs-lead)',
            fontWeight: 700,
            color: 'var(--dc-text)',
            lineHeight: 'var(--dc-lh-heading)',
          }}
        >
          学習時間チャレンジ
        </h2>
      </div>

      {failed ? (
        <div
          style={{
            fontSize: 'var(--dc-fs-body)',
            color: 'var(--dc-text-muted)',
            lineHeight: 'var(--dc-lh-prose)',
            padding: '8px 0 18px',
          }}
        >
          ランキングを取得できませんでした。
        </div>
      ) : loading || !me ? (
        <div style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-subtle)', padding: '28px 0 40px', textAlign: 'center' }}>
          読み込んでいます…
        </div>
      ) : (
        <>
          {/* 見出し。数字だけ特大にして「あと少し」であることを一目で読ませる */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: 2,
              flexWrap: 'wrap',
              marginBottom: 30,
            }}
          >
            {isLeading ? (
              <>
                <span className="dc-num" style={{ fontSize: 'var(--dc-fs-hero-xs)', fontWeight: 700, color: 'var(--dc-primary)', lineHeight: 1, letterSpacing: '-.02em' }}>
                  1
                </span>
                <span style={{ fontSize: 'var(--dc-fs-title)', fontWeight: 700, color: 'var(--dc-text)' }}>位をキープ中！</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 'var(--dc-fs-title)', fontWeight: 700, color: 'var(--dc-text)' }}>あと</span>
                <span className="dc-num" style={{ fontSize: 'var(--dc-fs-hero-xs)', fontWeight: 700, color: 'var(--dc-primary)', lineHeight: 1, letterSpacing: '-.02em', padding: '0 4px' }}>
                  {gap}
                </span>
                <span style={{ fontSize: 'var(--dc-fs-title)', fontWeight: 700, color: 'var(--dc-primary)', marginRight: 6 }}>分</span>
                <span style={{ fontSize: 'var(--dc-fs-title)', fontWeight: 700, color: 'var(--dc-text)' }}>で</span>
                <span className="dc-num" style={{ fontSize: 'var(--dc-fs-hero-xs)', fontWeight: 700, color: 'var(--dc-primary)', lineHeight: 1, letterSpacing: '-.02em', padding: '0 4px' }}>
                  {target!.rank}
                </span>
                <span style={{ fontSize: 'var(--dc-fs-title)', fontWeight: 700, color: 'var(--dc-text)' }}>位！</span>
              </>
            )}
          </div>

          {/* 順位のものさし。自分の位置を左端に置いて、右へ行くほど上位（または下位） */}
          <div style={{ margin: '0 8px' }}>
            <div
              className="dc-num"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`,
                textAlign: 'center',
                fontSize: 'var(--dc-fs-body)',
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              {slots.map((s, i) => (
                <span
                  key={s.entry.rank}
                  style={{
                    color:
                      i === 0 ? 'var(--dc-primary)' : i === 1 ? 'var(--dc-text-body)' : 'var(--dc-text-subtle)',
                  }}
                >
                  {s.entry.rank}位
                </span>
              ))}
            </div>

            <div
              aria-hidden="true"
              style={{ position: 'relative', height: 6, borderRadius: 9999, background: '#F0EAE1', marginBottom: 18 }}
            >
              {slots.map((s, i) => {
                const left = ((i + 0.5) / slots.length) * 100;
                if (i === 0) {
                  return (
                    <span key={s.entry.rank}>
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${left}%`,
                          borderRadius: 9999,
                          background: 'var(--dc-primary)',
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          top: '50%',
                          transform: 'translate(-50%,-50%)',
                          width: 20,
                          height: 20,
                          borderRadius: 9999,
                          background: '#fff',
                          border: '5px solid var(--dc-primary)',
                          boxSizing: 'border-box',
                          boxShadow: '0 2px 6px rgba(0,0,0,.16)',
                        }}
                      />
                    </span>
                  );
                }
                return (
                  <span
                    key={s.entry.rank}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      top: '50%',
                      transform: 'translate(-50%,-50%)',
                      width: 14,
                      height: 14,
                      borderRadius: 9999,
                      background: '#fff',
                      border: `3px solid ${i === 1 ? '#C9BFB0' : '#E5DED3'}`,
                      boxSizing: 'border-box',
                    }}
                  />
                );
              })}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`,
                textAlign: 'center',
                alignItems: 'start',
                gap: 8,
              }}
            >
              {slots.map((s, i) => (
                <div key={s.entry.rank} style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--dc-fs-body)',
                      fontWeight: i === 0 ? 700 : 600,
                      color: i === 0 ? 'var(--dc-primary)' : i === 1 ? 'var(--dc-text)' : 'var(--dc-text-body)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.entry.isMe
                      ? userName
                        ? `${userName}さん（あなた）`
                        : 'あなた'
                      : `${s.entry.nickname}さん`}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      marginTop: 5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      className="dc-num"
                      style={{ fontSize: 'var(--dc-fs-caption)', color: i === 2 ? 'var(--dc-text-subtle)' : 'var(--dc-text-muted)' }}
                    >
                      {formatMinutesHM(s.entry.minutes)}
                    </span>
                    {s.diffMinutes !== null && (
                      <span
                        className="dc-num"
                        style={{
                          fontSize: 'var(--dc-fs-caption)',
                          fontWeight: 700,
                          borderRadius: 9999,
                          padding: '3px 8px',
                          whiteSpace: 'nowrap',
                          background: '#fff',
                          border: `1px solid ${i === 1 && !isLeading ? 'var(--dc-soft-200)' : '#E5DED3'}`,
                          color: i === 1 && !isLeading ? 'var(--dc-primary)' : 'var(--dc-text-muted)',
                        }}
                      >
                        {isLeading ? `${formatMinutesHM(s.diffMinutes)}リード` : `あと${formatMinutesHM(s.diffMinutes)}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ height: 1, background: '#F2EDE5', margin: '28px 0 22px' }} />

      {/* 差を埋める手段をその場に置く。ここがマイページ唯一の Primary CTA */}
      <div
        style={{
          background: 'var(--dc-bg)',
          border: '1px solid #F2EDE5',
          borderRadius: 14,
          padding: '20px 22px',
        }}
      >
        <div style={{ fontSize: 'var(--dc-fs-body)', fontWeight: 500, color: 'var(--dc-text-muted)', marginBottom: 12 }}>
          学習して記録を伸ばそう
        </div>

        {course ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                {no && (
                  <span className="dc-num" style={{ fontSize: 'var(--dc-fs-body)', fontWeight: 700, color: 'var(--dc-text)' }}>
                    {no}
                  </span>
                )}
                <span style={{ fontSize: 'var(--dc-fs-lead)', fontWeight: 600, color: 'var(--dc-text-body)' }}>{lessonName}</span>
              </div>
              <ProgressBar value={course.progress ?? 0} totalLessons={course.totalLessons} />
            </div>

            <div style={{ display: 'flex', gap: 10, flex: 'none', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onOpenLesson}
                className="dc-cta-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 'var(--dc-sz-btn)',
                  padding: '0 16px',
                  borderRadius: 10,
                  border: 0,
                  background: 'var(--dc-primary)',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: 'var(--dc-fs-lead)',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                続きから学習する
              </button>
              <button
                type="button"
                onClick={onOpenCurriculum}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 'var(--dc-sz-btn)',
                  padding: '0 14px',
                  borderRadius: 10,
                  background: '#fff',
                  border: '1px solid #E5DED3',
                  color: 'var(--dc-text-body)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--dc-fs-body)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                レッスンを選び直す
              </button>
            </div>
          </div>
        ) : (
          // 受講中のコースが無いときは「続きから」が成立しないので、選ぶところから始めてもらう
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)', lineHeight: 'var(--dc-lh-prose)' }}>
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
                height: 'var(--dc-sz-btn)',
                padding: '0 16px',
                borderRadius: 10,
                border: 0,
                background: 'var(--dc-primary)',
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 'var(--dc-fs-lead)',
                fontWeight: 700,
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              学習コンテンツを見る
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default StudyChallengeCard;
