import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { useStudySession, waitForPendingEnd } from '../../hooks/useStudySession';
import { useStudyStats } from '../../hooks/useStudyStats';
import { bffClient } from '../../services/bffClient';
import { StudyFinishDraft } from '../../types/studyActivity';
import { createNoteFromStudyRecord } from '../../utils/studyRecordNote';
import FinishSessionModal from '../focus/FinishSessionModal';

/**
 * 学習終了カードを App 直下に常駐させるためのホスト。
 *
 * 🔴 なぜ画面側ではなくここに置くか:
 *   1. 終了の入口が3つある（右上のセッションインジケータ／教材ページのミニタイマー／
 *      放置検知の「ここで終了する」）。ここに1つ置けば、呼び出し側は
 *      prepareFinish() を叩くだけになる。
 *   2. transform: scale() を使っているページ（学習記録・マイノート・学習する）の中に
 *      置くと、scale された要素が containing block を作るので、内側の position: fixed が
 *      ビューポート基準にならず縮小・位置ズレする。App直下ならこの罠を構造的に回避できる。
 *   3. StudySessionHost と同じく AppRoutes の外なので、ルート遷移でアンマウントされない。
 */

/**
 * 実際にカードを描く側。下書きがあるときだけマウントされる
 * （常時マウントすると useStudyStats が全ページで走ってしまうため、ここで区切る）。
 */
function FinishCard({
  draft,
  userId,
  onClosed,
}: {
  draft: StudyFinishDraft;
  userId: number | undefined;
  onClosed: () => void;
}) {
  const { commitFinish } = useStudySession(userId);
  const { stats } = useStudyStats(userId);
  const { showToast } = useToast();
  const navigate = useNavigate();

  /*
   * 今週の累計のうち、この回を除いた分。カードは「これ + 入力中の学習時間」を出す。
   * 🔴 サーバーの今週の値は study_session_ended が届いた時点でこの回を（訂正前の
   *    実測で）含む。一時停止してから終了した回は確実に、そうでなくても end の送信と
   *    取得の順番しだいで含まれるので、そのまま足すと二重計上になる。end を待ってから
   *    取り直し、この回の実測分を引く（サーバーは区間ごとに分へ丸めるので±1分程度ずれうる）。
   * 🔴 マウント時に1回だけ決める。記録すると再取得が走り、訂正後のこの回が含まれるため。
   */
  const [weekBaseMinutes, setWeekBaseMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const measuredMinutes = Math.round(draft.measuredSeconds / 60);
    waitForPendingEnd()
      .then(() => bffClient.getStudyStatsSummary(userId, 7))
      .then((summary) => {
        if (!cancelled) setWeekBaseMinutes(Math.max(0, summary.week.minutes - measuredMinutes));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // 下書きが変わったとき（＝別の回）だけ取り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, draft.activityId]);

  return (
    <FinishSessionModal
      draft={draft}
      weekBaseMinutes={weekBaseMinutes ?? 0}
      streakDays={stats?.streak.currentDays}
      onRecord={async (patch, options) => {
        await commitFinish(patch);

        // 🔴 記録の保存が済んだあとに作る。ここで失敗しても学習記録は成立して
        //    いるので、記録自体を失敗扱いにしない（トーストで伝えるだけ）。
        if (!options?.keepInMyNotes) return;
        try {
          const noteId = await createNoteFromStudyRecord({
            localDate: draft.snapshot.localDate,
            minutes: patch.actualMinutes ?? draft.actualMinutes,
            course: patch.snapshot?.course ?? null,
            goalText: draft.goalText,
            contentNote: patch.contentNote ?? '',
            memo: patch.memo ?? '',
            achievement: patch.achievement ?? null,
          });
          showToast('マイノートに残しました', 'success', {
            action: { label: 'マイノートを見る', onClick: () => navigate(`/notes?note=${noteId}`) },
          });
        } catch {
          showToast('学習記録は残りましたが、マイノートに残せませんでした', 'error');
        }
      }}
      onDismiss={onClosed}
    />
  );
}

export function StudySessionFinishHost() {
  const { user } = useAuth();
  const finishDraft = useStudyTimerStore((s) => s.finishDraft);
  const setFinishDraft = useStudyTimerStore((s) => s.setFinishDraft);

  // 🔴 ストアの下書きを自分の state に写して持つ。
  //    記録すると commitFinish がストアの finishDraft を null にするので、
  //    ストアを直接見ていると「記録しました」を出す前にカードが消えてしまう。
  const [active, setActive] = useState<StudyFinishDraft | null>(null);

  useEffect(() => {
    if (finishDraft) setActive(finishDraft);
  }, [finishDraft]);

  if (!active) return null;

  return (
    <FinishCard
      draft={active}
      userId={user?.userid}
      onClosed={() => {
        setActive(null);
        // 記録せずに閉じた場合はここで下書きも捨てる（セッションは一時停止のまま残る）
        setFinishDraft(null);
      }}
    />
  );
}

export default StudySessionFinishHost;
