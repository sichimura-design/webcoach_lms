import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStudySession } from '../../hooks/useStudySession';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { useRecentCourseStore } from '../../store/recentCourseStore';
import { STUDY_CATEGORY_LABEL } from '../../types/studyActivity';
import { categoryOfPath, courseIdOfPath, isLessonPath, isStudyEntryPath } from '../../utils/studyCategory';
import { toLocalDateKey } from '../../utils/studyStats';
import StudySessionIndicator, { StudySessionStartPill } from './StudySessionIndicator';
import StudySessionPrompt from './StudySessionPrompt';

/**
 * 学習セッションの司令塔。App直下に1つだけ常駐する。
 * ============================================================
 * 狙いは「ユーザーが記録をつけようと思わなくても記録が貯まる」こと。そのために
 * ここが4つの仕事をまとめて持つ。
 *
 *   1. 打診    … 学習を始めるページに着いたら「記録しますか？」を1回だけ出す
 *   2. 自動分類 … セッション中にページが変わったら、区間のカテゴリを差し替える
 *   3. 放置検知 … 最後の操作から30分動きが無ければ、計測を切って確認する
 *   4. 常設表示 … 記録中であることを小さく出す（操作は押されたときだけ）
 *
 * 🔴 なぜ1コンポーネントに寄せたか: この4つは同じ1つの状態機械（いま打診中か／
 *    計測中か／放置確認中か）の別の顔なので、別コンポーネントに散らすと
 *    「打診ポップと放置ポップが同時に出る」ような組み合わせを取りこぼす。
 *
 * 🔴 AppRoutes の外に置く。ルート遷移でアンマウントされると計測もポップも消える。
 *    scale 方式のページの中に置くと position:fixed がビューポート基準にならない、
 *    という StudySessionFinishHost.tsx と同じ理由もある。
 * ============================================================
 */

/** 操作の観測をこの間隔までに間引く（1クリックごとに localStorage を叩かない） */
const ACTIVE_THROTTLE_MS = 10_000;

function StudySessionHost() {
  const location = useLocation();
  const { user } = useAuth();
  const s = useStudySession(user?.userid);

  const promptDeclinedOn = useStudyTimerStore((x) => x.promptDeclinedOn);
  const declinePromptToday = useStudyTimerStore((x) => x.declinePromptToday);
  const markActive = useStudyTimerStore((x) => x.markActive);
  const recentEntries = useRecentCourseStore((x) => x.entries);

  /** 打診を出しているパス。null なら出していない */
  const [promptFor, setPromptFor] = useState<string | null>(null);
  /** 放置確認を出しているセッション。二重に出さないため activityId で持つ */
  const [idleFor, setIdleFor] = useState<string | null>(null);

  const category = categoryOfPath(location.pathname);
  const hasSession = !!s.session;
  const activityId = s.session?.activityId;

  /*
   * いま開いている教材。レッスン本文ページなら、useLessonDoc が開くたびに
   * touch している recentCourseStore から拾う。ここでコースを取り直すために
   * API を叩くと、ページを開くだけで余計なリクエストが増える。
   */
  const lessonCourse = (() => {
    if (!isLessonPath(location.pathname)) return null;
    const id = courseIdOfPath(location.pathname);
    return recentEntries.find((e) => e.courseId === id) ?? null;
  })();

  // ---- 2. 自動分類 --------------------------------------------------------
  /*
   * 🔴 初回マウントでは markActive() を呼ばない。
   *    ここで呼ぶと、タブを開いたまま数時間放置してからリロードした人の
   *    「最後に操作した時刻」が復元直後に今へ書き換わり、放置検知が
   *    永久に発火しなくなる（＝離席していた数時間が学習時間に混ざる）。
   *    ページ遷移はユーザーの操作なので2回目以降は記録する。
   */
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!hasSession) return;
    s.switchCategory(category);
    if (mountedRef.current) markActive();
    else mountedRef.current = true;
    // s は毎レンダー新しいオブジェクトなので依存に入れない（入れると毎秒発火する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, hasSession, activityId, location.pathname]);

  // ---- 3. 放置検知の材料: 操作の観測 --------------------------------------
  const lastMarkRef = useRef(0);
  useEffect(() => {
    if (!hasSession) return;
    const bump = () => {
      const now = Date.now();
      if (now - lastMarkRef.current < ACTIVE_THROTTLE_MS) return;
      lastMarkRef.current = now;
      markActive();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') bump(); };
    document.addEventListener('pointerdown', bump);
    document.addEventListener('keydown', bump);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('pointerdown', bump);
      document.removeEventListener('keydown', bump);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hasSession, markActive]);

  // ---- 3. 放置検知の判定 --------------------------------------------------
  // s.idle は elapsedSeconds の毎秒更新の中で再評価されるので、別のタイマーは要らない。
  useEffect(() => {
    if (!s.idle || !activityId) return;
    if (idleFor === activityId) return;
    // 先に計測を切る。確認している間もカウントが進むと、放置ぶんが記録に混ざる。
    s.trimToLastActive();
    setIdleFor(activityId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.idle, activityId, idleFor]);

  useEffect(() => {
    if (!hasSession) setIdleFor(null);
  }, [hasSession]);

  // ---- 1. 打診 ------------------------------------------------------------
  /*
   * 一度決着をつけたパスを覚えておく。
   * 🔴 これが無いと、同じ教材ページで学習を終了した直後にまた
   *    「記録しますか？」が出る（セッションが消えた＝打診の条件が揃うため）。
   *    終わったばかりの人にもう一度聞くのは、いちばんやってはいけない割り込み。
   *    別のページへ移れば聞き直す（新しい行動を始めたことになるので）。
   */
  const handledPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasSession) {
      // 記録中に見ていたページは「決着済み」にする。終了直後の再打診を防ぐ。
      handledPathRef.current = location.pathname;
      setPromptFor(null);
      return;
    }
    if (!isStudyEntryPath(location.pathname)) { setPromptFor(null); return; }
    if (handledPathRef.current === location.pathname) { setPromptFor(null); return; }
    if (promptDeclinedOn === toLocalDateKey(new Date())) { setPromptFor(null); return; }
    setPromptFor(location.pathname);
  }, [location.pathname, hasSession, promptDeclinedOn]);

  const startHere = useCallback(() => {
    s.start({
      mode: 'freeform',
      category,
      courseId: lessonCourse?.courseId,
      courseTitle: lessonCourse?.courseTitle,
      lessonId: lessonCourse?.lessonId,
      lessonTitle: lessonCourse?.lessonTitle,
      progressPercentAtStart: lessonCourse?.progressPercent,
    });
    setPromptFor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, lessonCourse]);

  // ---- 表示 ---------------------------------------------------------------
  // 教材ページは LessonTopBar のミニタイマーが計測中の表示を担うので、二重に出さない。
  const onLessonPage = isLessonPath(location.pathname);

  /*
   * 常設ピルを出す条件。
   *
   * 🔴 計測中はどのページでも出す。止め忘れに気づけなくなるため。
   * 🔴 一時停止中は「学習を始めるページ」に着いたときだけ出す。
   *    一時停止は計測していない状態なので常設する理由が無いのに、以前は
   *    マイページや学習記録を見ているあいだも「一時停止中 36分」が
   *    視界に残り続けていた（レビュー指摘）。再開したいのは次に学習を
   *    始める瞬間だけなので、その瞬間に戻ってくる形にする。
   * 🔴 判定は打診と同じ isStudyEntryPath を使う。「学習を始める場所」の
   *    定義をアプリ内に二重に持たない（utils/studyCategory.ts）。
   */
  const showIndicator =
    !!s.session && !onLessonPage && (s.running || isStudyEntryPath(location.pathname));

  const subject = s.session?.lessonTitle
    ? `${s.session.courseTitle ?? ''} / ${s.session.lessonTitle}`
    : s.session?.courseTitle || STUDY_CATEGORY_LABEL[category];

  // 打診を断った日は、そこから記録を始める手段が無くなってしまうので入口を出す
  const declinedToday = !hasSession && promptDeclinedOn === toLocalDateKey(new Date());

  return (
    <>
      {showIndicator && s.session && (
        <StudySessionIndicator
          elapsedSeconds={s.elapsedSeconds}
          running={s.running}
          subject={subject}
          segments={s.segmentTotals}
          onPause={s.pause}
          onResume={s.resume}
          onFinish={s.prepareFinish}
          onDiscard={s.discard}
        />
      )}

      {declinedToday && !onLessonPage && <StudySessionStartPill onStart={startHere} />}

      {/* 放置確認は打診より優先する（計測中に打診は出ないので実際には排他） */}
      {s.session && idleFor === activityId ? (
        <StudySessionPrompt
          title="学習を続けていますか？"
          subject="最後の操作から30分ほど経っています。離れていた時間は記録に入れません。"
          primaryLabel="続けて記録する"
          secondaryLabel="ここで終了する"
          // 放置確認はどちらも正当な選択なので、副ボタンを弱めない
          secondaryEmphasis="normal"
          onPrimary={() => { s.resume(); setIdleFor(null); }}
          onSecondary={() => { setIdleFor(null); s.prepareFinish(); }}
        />
      ) : (
        promptFor && (
          <StudySessionPrompt
            title={PROMPT_TITLE[category] ?? PROMPT_TITLE.other}
            subject={lessonCourse ? (lessonCourse.lessonTitle ?? lessonCourse.courseTitle) : null}
            primaryLabel="記録して始める"
            // 🔴 「記録せず始める」ではなく、実際の効果どおりの文言にする。
            //    これを押すとその日はもう打診されない（＝その日は記録しない）ので、
            //    その場かぎりの選択だと誤解させないようにしている。
            secondaryLabel="今日は記録しない"
            onPrimary={startHere}
            onSecondary={() => {
              declinePromptToday();
              handledPathRef.current = location.pathname;
              setPromptFor(null);
            }}
          />
        )
      )}
    </>
  );
}

/** 何をしに来たかによって言い方を変える。同じ文でも「自分に向けられた」感が変わる */
const PROMPT_TITLE: Record<string, string> = {
  material: '学習時間を記録しますか？',
  ai: 'AIコーチとの相談時間を記録しますか？',
  coaching: 'コーチングの時間を記録しますか？',
  review: 'ふりかえりの時間を記録しますか？',
  other: '学習時間を記録しますか？',
};

export default StudySessionHost;
