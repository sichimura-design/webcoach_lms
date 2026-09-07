/**
 * マイページ上段グリッド（.mypage-8a-grid）の左上。日付と挨拶だけを置く。
 * 右隣は目標宣言カード（mypage/GoalDeclarationCard.tsx）。
 *
 * claude.ai/design『トップページ 3案』5a 準拠。
 *
 * 🔴 カードに載せない。地色の上に直接置く。
 *
 * 🔴 h1 は title(20px)。display(28〜32px) に戻さないこと。右に目標カードが
 *    入って左は画面の半分ほどしかなく、display だと「〇〇さん、こんにちは」が
 *    2行に折り返して右のカードとの丈が合わなくなる。
 *
 * 🔴 下余白を持たない。間隔は .mypage-8a-grid の gap が持つ。
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
    <div>
      {/* 日付は「読めなくても操作に影響しない」補足なので caption(12px) */}
      <div style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)', marginBottom: 6 }}>
        {formatTodayJa(new Date())}
      </div>
      {/* 🔴 見出しの隣に装飾（8a のきらめき）を置いていたが撤去した。意味を持たない
             飾りなので、戻さないこと。囲みの flex も星のためだけにあったので畳んである。 */}
      <h1
        style={{
          margin: 0,
          fontSize: 'var(--dc-fs-title)',
          lineHeight: 'var(--dc-lh-heading)',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--dc-text)',
        }}
      >
        {name || 'ゲスト'}さん、こんにちは
      </h1>
    </div>
  );
}

export default MypageGreeting;
