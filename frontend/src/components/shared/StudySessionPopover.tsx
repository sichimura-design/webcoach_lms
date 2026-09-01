import { useState, type CSSProperties } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { STUDY_CATEGORY_LABEL, StudySegmentTotal } from '../../types/studyActivity';
import { displaySegments, formatHMS, formatMinutesHM } from '../../utils/studyStats';

/**
 * 記録中のセッションの中身と操作（経過時間・カテゴリ内訳・一時停止/再開・終了・破棄）。
 *
 * もとは StudySessionIndicator（画面に浮かぶドラッグ可能なピル）の中にあった。
 * ピルをサイドバーの定位置へ移した（SidebarStudyTimer）ときに、
 * 「押したら出る中身」だけをここへ切り出している。置き場所が増えても
 * 操作と文言は1箇所で持つ。
 *
 * 🔴 位置は呼び出し側が style で決める（サイドバーのレール／展開パネル／SPの帯で
 *    開く向きが違う）。ここは幅と中身だけを持つ。
 */
export const POPOVER_W = 260;

interface StudySessionPopoverProps {
  /** 経過秒 */
  elapsedSeconds: number;
  running: boolean;
  /** いま何をしている時間か（教材名など） */
  subject?: string | null;
  segments: StudySegmentTotal[];
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  /** 記録せずにやめる。この学習ぶんは残らない */
  onDiscard: () => void;
  /** 閉じる（終了・破棄を押したときに呼び出し側の open を畳む） */
  onClose: () => void;
  /** 開く向き。absolute の指定をそのまま渡す */
  style?: CSSProperties;
}

export function StudySessionPopover({
  elapsedSeconds,
  running,
  subject,
  segments,
  onPause,
  onResume,
  onFinish,
  onDiscard,
  onClose,
  style,
}: StudySessionPopoverProps) {
  /** 破棄は取り消せないので、同じ場所で1回確認する（別モーダルは出さない） */
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const minutes = Math.floor(elapsedSeconds / 60);
  const breakdown = displaySegments(segments, minutes);

  return (
    <div
      role="dialog"
      aria-label="学習セッション"
      style={{
        position: 'absolute',
        zIndex: 60,
        width: POPOVER_W,
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        boxShadow: shadow.hero,
        padding: '16px 18px',
        fontFamily: font.family,
        animation: 'fadeInUp 0.16s ease-out',
        ...style,
      }}
    >
      {subject && (
        <div className="truncate" style={{ ...font.rowTitle, color: color.text }} title={subject}>
          {subject}
        </div>
      )}
      <div
        className="dc-num"
        style={{ fontSize: 26, fontWeight: 800, color: color.text, marginTop: subject ? 6 : 0 }}
      >
        {formatHMS(elapsedSeconds)}
      </div>

      {/* 内訳は2行以上あるときだけ。1行なら上の経過時間と同じことになる */}
      {breakdown.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {breakdown.map((s) => (
            <div
              key={s.category}
              className="flex items-center justify-between"
              style={{ ...font.caption, color: color.textMuted }}
            >
              <span>{STUDY_CATEGORY_LABEL[s.category]}</span>
              <span className="dc-num">{formatMinutesHM(s.minutes)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          onClick={running ? onPause : onResume}
          className="flex-1 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            gap: 6,
            height: 38,
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
          onClick={() => { onClose(); onFinish(); }}
          className="flex-1 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            gap: 6,
            height: 38,
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
      </div>

      {/*
        記録せずにやめる。誤操作で始めた／中断して実質学習していなかったセッションを
        終わらせる唯一の手段（集中ブースを廃止したとき、それまで唯一の入口だった
        放置セッションの「破棄」バナーも一緒に無くなっている）。
        🔴 取り消せないので同じ場所で1回確認する。別モーダルは出さない。
        🔴 確認では「記録を続ける」を主役にする。ここまで測った時間を捨てるのは
           戻せない操作なので、既定の視線を安全側に置く。
      */}
      <div style={{ marginTop: 10, borderTop: `1px solid ${color.border}`, paddingTop: 10 }}>
        {confirmDiscard ? (
          <>
            <div style={{ ...font.caption, color: color.textMuted, lineHeight: 1.6 }}>
              ここまでの {formatMinutesHM(minutes)} は残りません
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmDiscard(false)}
                className="flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  height: 34,
                  border: 0,
                  borderRadius: radius.sm,
                  background: color.primary,
                  color: color.textOnPrimary,
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                記録を続ける
              </button>
              <button
                type="button"
                onClick={() => { setConfirmDiscard(false); onClose(); onDiscard(); }}
                className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{ border: 0, background: 'transparent', color: color.textSubtle, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: 0, flexShrink: 0 }}
              >
                破棄する
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDiscard(true)}
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ border: 0, background: 'transparent', color: color.textSubtle, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            記録せずにやめる
          </button>
        )}
      </div>
    </div>
  );
}

export default StudySessionPopover;
