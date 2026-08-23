import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { useStudySession } from '../../hooks/useStudySession';
import { useStudyStats } from '../../hooks/useStudyStats';
import { StudyFinishDraft } from '../../types/studyActivity';
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

  // 🔴 記録前の今週累計をマウント時に固定する。
  //    記録すると再取得が走って今週の値に今回分が含まれるため、
  //    そのまま足すと「今週の累計」が二重計上される。
  const [baseWeekMinutes, setBaseWeekMinutes] = useState<number | null>(null);
  const [recordedMinutes, setRecordedMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (baseWeekMinutes !== null || !stats) return;
    setBaseWeekMinutes(stats.week.minutes);
  }, [stats, baseWeekMinutes]);

  return (
    <FinishSessionModal
      draft={draft}
      weekTotalMinutes={(baseWeekMinutes ?? 0) + (recordedMinutes ?? draft.actualMinutes)}
      streakDays={stats?.streak.currentDays}
      onRecord={async (patch) => {
        setRecordedMinutes(patch.actualMinutes ?? draft.actualMinutes);
        await commitFinish(patch);
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
