import { color, font, radius } from '../../theme/webcoachTheme';

/**
 * 学習記録の打診ポップ。
 * ============================================================
 * 🔴 画面中央＋暗幕。「記録しますか？」は答えを1つ選ぶ場面なので、
 *    隅に小さく出すと気づかれないまま学習が始まり、記録が残らない。
 *    （下からせり上がる形 → 中央 → 暗幕あり、とレビューで2段階変わっている）
 * 🔴 暗幕クリックでは閉じない。逃げ道は2つのボタンだけにする。
 *    「記録せず始める」はその日ずっと打診を止める選択で、
 *    背景を押しただけでそれが起きると取り返しがつかない。
 * 🔴 選択肢は2つあるが、対等には見せない。既定は「記録する」で、
 *    記録しない側は小さなテキストに落とす（secondaryEmphasis='quiet'）。
 *    ほぼ全員が記録するのだから、同じ大きさのボタンを2つ並べて
 *    毎回選ばせるのは判断を増やすだけになる。
 *    ただし放置確認のように、どちらも正当な選択のときは 'normal' で対等に見せる。
 * 🔴 z-index は 85。アプリで最も手前の層（教材の選択ツールバー80）より上に置く。
 *    最初は 55 にしていたが、教材ページの右下FAB(60)と選択ツールバー(80)が
 *    暗幕を貫通して明るく残り、押せてしまっていた。答えを選ぶ間は
 *    他のものが押せないのが正しい。
 *    学習終了カード(70)とは同時に出ない（打診はセッションが無いとき、
 *    放置確認は「ここで終了する」で自分が閉じてからカードが出る）。
 * ============================================================
 */

interface StudySessionPromptProps {
  title: string;
  /** 教材名など、何についての記録かを1行で。無ければ出さない */
  subject?: string | null;
  primaryLabel: string;
  secondaryLabel: string;
  /**
   * 副ボタンの見せ方。
   * 'quiet'  … ほぼ選ばれない逃げ道（学習開始の打診）。小さいテキストに落とす
   * 'normal' … どちらも正当な選択（放置確認の「ここで終了する」）
   */
  secondaryEmphasis?: 'quiet' | 'normal';
  onPrimary: () => void;
  onSecondary: () => void;
}

export function StudySessionPrompt({
  title,
  subject,
  primaryLabel,
  secondaryLabel,
  secondaryEmphasis = 'quiet',
  onPrimary,
  onSecondary,
}: StudySessionPromptProps) {
  const quiet = secondaryEmphasis === 'quiet';
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center" style={{ padding: 16 }}>
      {/* 暗幕。クリックでは閉じない（上のコメント参照）ので pointer-events は素通しにしない */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)', animation: 'wcFadeIn 0.18s ease-out' }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full"
        style={{
          maxWidth: 380,
          background: color.surface,
          border: `1px solid ${color.border}`,
          borderRadius: radius.card,
          boxShadow: '0 24px 60px -12px rgba(0,0,0,.28)',
          padding: '22px 24px 18px',
          fontFamily: font.family,
          animation: 'fadeInUp 0.18s ease-out',
        }}
      >
        <div style={{ ...font.cardTitle, color: color.text, lineHeight: 1.6 }}>{title}</div>
        {subject && (
          <div
            style={{ ...font.meta, color: color.textMuted, marginTop: 8, lineHeight: 1.7 }}
            title={subject}
          >
            {subject}
          </div>
        )}

        <button
          type="button"
          onClick={onPrimary}
          autoFocus
          className="w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            marginTop: 20,
            height: 50,
            border: 0,
            borderRadius: radius.md,
            background: color.primary,
            color: color.textOnPrimary,
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 20px -8px rgba(214,9,52,.5)',
          }}
        >
          {primaryLabel}
        </button>

        <button
          type="button"
          onClick={onSecondary}
          className="w-full hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            marginTop: quiet ? 10 : 8,
            height: quiet ? 28 : 42,
            border: quiet ? 0 : `1px solid ${color.borderSoft}`,
            borderRadius: quiet ? radius.sm : radius.md,
            background: 'transparent',
            color: quiet ? color.textSubtle : color.textBody,
            fontFamily: 'inherit',
            fontSize: quiet ? 12 : 13.5,
            fontWeight: quiet ? 500 : 700,
            cursor: 'pointer',
          }}
        >
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}

export default StudySessionPrompt;
