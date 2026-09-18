import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Pause, Play, Square, Timer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStudySession } from '../../hooks/useStudySession';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { categoryOfPath } from '../../utils/studyCategory';
import { color, radius } from '../../theme/webcoachTheme';
import { formatMMSS } from '../../utils/studyStats';
import StudySessionPrompt from '../shared/StudySessionPrompt';

/**
 * マイページの「学習時間を記録する」と、記録中の操作。
 * ============================================================
 * 🔴 これは自分から記録を始めるための唯一の入口。
 *    記録の入口はもともと打診ポップだけで、同じカテゴリで
 *    PROMPT_DECLINE_LIMIT（3回）断るとその日はもう打診されない
 *    （store/studyTimerStore.ts）。断り続けた人が記録できなくなるので、
 *    打診に依存しない入口をここに1つ置いた。
 *
 * 🔴 画面に浮かぶピルには戻さないこと。かつて StudySessionHost に
 *    「⏱ 学習時間を記録する」の常設ピルがあったが、断った日は一日中
 *    画面に残って邪魔だという理由で撤去されている。マイページの定位置に
 *    1つ置くのはそのやり直しではなく、置き場所を固定した代替。
 *
 * 🔴 カテゴリはユーザーに選ばせない（utils/studyCategory.ts の🔴）。
 *    この画面の categoryOfPath は 'other'＝「その他の学習時間」で、
 *    アプリの外で手を動かしている時間を拾うのがこの入口の役目。
 *    教材を読んでいた時間に混ぜないため、ここで 'material' に
 *    すり替えたりしないこと。ラベルも「学習時間」に留める。
 *
 * 🔴 開始したその場で止められるようにする。
 *    かつてここは記録中「⏱ 学習時間を記録中」のテキストだけを出し、
 *    止める・終えるはサイドバーの SidebarStudyTimer に任せていた。
 *    ところがレール（72px）のそれは無印の40pxの丸に「● 12」が出るだけで、
 *    ここを押した本人が「急に記録が始まって止め方がどこにも無い」状態に
 *    なっていた。開始の入口がここにある以上、停止の入口も同じ場所に要る。
 *    ただし**破棄（記録せずにやめる）はここに置かない**。取り消せない操作なので、
 *    引き続き StudySessionPopover の中（2段階確認つき）に留める。
 *
 * 🔴 開始前に確認を1枚挟む。押した瞬間に計測が始まると
 *    「押したつもりがない／何が始まったのか分からない」が起きる。
 *    確認は共通の StudySessionPrompt を使い、**createPortal で body に出す**。
 *    あれは position:fixed で、App.tsx が AnimatePresence で AppRoutes を
 *    包んでいるため、ページ内から素で描くと transform の containing block に
 *    捕まって位置がずれうる（App.tsx が同じ理由でホストをルート外に置いている）。
 * ============================================================
 */
function StartRecordingButton() {
  const location = useLocation();
  const { user } = useAuth();
  const session = useStudyTimerStore((s) => s.session);
  const s = useStudySession(user?.userid);
  const [confirming, setConfirming] = useState(false);

  // 記録中はその場で止められるようにする（上の🔴参照）
  if (session) {
    const running = s.running;
    return (
      <div
        style={{
          marginTop: 14,
          display: 'inline-flex',
          flexDirection: 'column',
          gap: 10,
          minWidth: 248,
          padding: '12px 14px',
          // 稼働中/停止中はカード全体の色で見せる（LessonMiniTimer と同じ作法）
          border: `1px solid ${running ? color.primaryBorder : color.borderNeutral}`,
          borderRadius: radius.md,
          background: running ? color.primaryTint : color.stepFutureBg,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* 稼働中だけ赤く点る。停止中は色を落として「止まっている」と分かるようにする */}
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              flexShrink: 0,
              background: running ? color.primary : color.textFaint,
            }}
          />
          <span style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: 700, color: color.textBody }}>
            {running ? '学習中' : '一時停止中'}
          </span>
          <span
            className="dc-num"
            style={{
              marginLeft: 'auto',
              fontSize: 15,
              fontWeight: 700,
              color: running ? color.primary : color.textSubtle,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMMSS(s.elapsedSeconds)}
          </span>
        </span>

        {/* 一時停止／終了。ラベル付きの2択なので StudySessionPopover と同じ組み方にする */}
        <span style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={running ? s.pause : s.resume}
            className="flex-1 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              gap: 6,
              height: 36,
              border: `1px solid ${color.borderSoft}`,
              borderRadius: radius.sm,
              background: color.surface,
              color: color.textBody,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {running ? <Pause size={14} /> : <Play size={14} />}
            {running ? '一時停止' : '再開'}
          </button>
          <button
            type="button"
            onClick={s.prepareFinish}
            className="flex-1 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              gap: 6,
              height: 36,
              border: 0,
              borderRadius: radius.sm,
              background: color.primary,
              color: color.textOnPrimary,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Square size={13} />
            終了
          </button>
        </span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          marginTop: 14,
          minHeight: 'var(--dc-sz-btn)',
          padding: '0 18px',
          borderRadius: 9999,
          border: '1px solid var(--dc-border-strong)',
          background: 'var(--dc-surface)',
          fontFamily: 'inherit',
          fontSize: 'var(--dc-fs-body)',
          fontWeight: 700,
          color: 'var(--dc-text-body)',
          cursor: 'pointer',
        }}
      >
        <Timer size={15} strokeWidth={2} aria-hidden />
        学習時間を記録する
      </button>

      {confirming &&
        createPortal(
          <StudySessionPrompt
            title="学習時間の記録を始めますか？"
            subject="終了するまで時間を数えます"
            primaryLabel="記録を始める"
            /* 自分で押したうえでの確認なので、打診ポップの 'quiet' と違い
               「やめる」も対等に見せる（どちらも正当な選択） */
            secondaryLabel="やめる"
            secondaryEmphasis="normal"
            onPrimary={() => {
              setConfirming(false);
              s.start({ mode: 'freeform', category: categoryOfPath(location.pathname) });
            }}
            onSecondary={() => setConfirming(false)}
          />,
          document.body
        )}
    </>
  );
}

export default StartRecordingButton;
