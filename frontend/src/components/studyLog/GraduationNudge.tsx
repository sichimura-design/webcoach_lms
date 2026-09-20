import { MessageCircle } from 'lucide-react';

/**
 * 卒業予定日が近づいたときだけ出す相談の導線（/study-log）。
 * ============================================================
 * 🔴 常設しない。出す条件は呼び出し側（StudyLogPage）が持ち、
 *    既定では描画されない。基本の画面に警告カードを置かないための構造。
 *
 * 🔴 「このペースだと卒業が難しい」と断定しない。
 *    学習ペースから卒業の可否を推定して見せるのは、
 *    ・そもそも学習時間だけで判断できない
 *    ・当たっていても、まだ間に合う人の手を止める
 *    の2点で害が大きい。事実（残り日数）と、できること（相談先）だけを出す。
 *
 * 🔴 大きな警告カードにしない。赤い塗りや警告アイコンを使わず、
 *    薄い地の帯1本に留める。上のヘッダーと目標バーの見た目を崩さない位置に置く。
 * ============================================================
 */
interface GraduationNudgeProps {
  /** 卒業予定日までの残り日数（呼び出し側で 45 日以内に絞ってから渡す） */
  daysLeft: number;
  /** 相談先。既定はカスタマーサポート */
  onConsult?: () => void;
}

export function GraduationNudge({ daysLeft, onConsult }: GraduationNudgeProps) {
  return (
    <section
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 16px',
        borderRadius: 'var(--dc-radius-md)',
        background: 'var(--dc-gold-surface)',
        border: '1px solid var(--dc-gold-border)',
      }}
      aria-label="卒業予定日が近づいています"
    >
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          flex: 'none',
          borderRadius: 9999,
          background: 'var(--dc-surface)',
          color: 'var(--dc-gold-text)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <MessageCircle size={15} strokeWidth={1.75} />
      </span>

      <p
        style={{
          margin: 0,
          flex: 1,
          minWidth: 240,
          fontSize: 'var(--dc-fs-body)',
          color: 'var(--dc-text-body)',
          lineHeight: 'var(--dc-lh-ui)',
        }}
      >
        <span className="dc-num" style={{ fontWeight: 700, color: 'var(--dc-gold-text)' }}>
          卒業予定まであと{daysLeft}日
        </span>
        {' '}です。学習時間や進め方について相談できます。
      </p>

      {onConsult && (
        <button
          type="button"
          onClick={onConsult}
          className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            flex: 'none',
            minHeight: 34,
            padding: '0 14px',
            borderRadius: 9999,
            border: '1px solid var(--dc-gold-border)',
            background: 'var(--dc-surface)',
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-body)',
            fontWeight: 700,
            color: 'var(--dc-text-body)',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          カスタマーサポートLINEに相談する
        </button>
      )}
    </section>
  );
}

export default GraduationNudge;
