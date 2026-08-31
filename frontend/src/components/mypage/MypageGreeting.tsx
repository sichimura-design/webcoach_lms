/**
 * マイページ最上部。日付と挨拶だけを置く。
 *
 * claude.ai/design『トップページ 3案』5a 準拠。
 *
 * 🔴 カードに載せない。地色の上に直接置く。
 *
 * 🔴 かつてここに「今週・累計・修了レッスン」のKPIを横並びで持たせていたが、
 *    5a でその3つは「学習記録」カード（mypage/StudyRecordCard.tsx）へ移した。
 *    数字の置き場を2箇所にしないこと。同じ値をここに戻さない。
 */
interface MypageGreetingProps {
  /** 表示名（プロフィールのニックネーム） */
  name: string;
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** 「2026年8月14日（金）」。toLocaleDateString だと曜日の括弧が半角になるので自前で組む */
function formatTodayJa(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_JA[d.getDay()]}）`;
}

function MypageGreeting({ name }: MypageGreetingProps) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ fontSize: 'var(--dc-fs-sm)', color: 'var(--dc-text-muted)', marginBottom: 6 }}>
        {formatTodayJa(new Date())}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 'var(--dc-fs-xl)',
            lineHeight: 1.3,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            color: 'var(--dc-text)',
          }}
        >
          {name || 'ゲスト'}さん、こんにちは
        </h1>
        {/* 8a のきらめき。装飾なので読み上げ対象から外す */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--dc-primary)" opacity=".8" aria-hidden="true" style={{ flex: 'none' }}>
          <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z" />
          <path d="M19 15l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6-2.6-.9 2.6-.9z" opacity=".6" />
        </svg>
      </div>
    </div>
  );
}

export default MypageGreeting;
