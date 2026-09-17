import { useLocation } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStudySession } from '../../hooks/useStudySession';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { categoryOfPath } from '../../utils/studyCategory';

/**
 * マイページの「学習時間を記録する」。挨拶のすぐ下に置く。
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
 * 🔴 記録中は操作を出さない。止める・終えるはサイドバーの
 *    SidebarStudyTimer（教材ページは LessonMiniTimer）が持つ。
 *    ここに2つ目の操作を置くと、開始も終了も入口が2箇所になる。
 * ============================================================
 */
function StartRecordingButton() {
  const location = useLocation();
  const { user } = useAuth();
  const session = useStudyTimerStore((s) => s.session);
  const s = useStudySession(user?.userid);

  // 記録中は「記録中である」ことだけ伝える。操作はサイドバー側が持つ
  if (session) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          marginTop: 14,
          fontSize: 'var(--dc-fs-caption)',
          color: 'var(--dc-text-muted)',
        }}
      >
        <Timer size={14} strokeWidth={2} aria-hidden />
        学習時間を記録中
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => s.start({ mode: 'freeform', category: categoryOfPath(location.pathname) })}
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
  );
}

export default StartRecordingButton;
