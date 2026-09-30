/**
 * マイページ上段グリッド（.mypage-8a-grid）の左上。日付・挨拶と、
 * 「学習時間を記録する」（mypage/StartRecordingButton.tsx）を置く。
 * 右隣は「あなたの目標」カード（mypage/GoalDeclarationCard.tsx）。
 *
 * claude.ai/design『トップページ 3案』5a 準拠。
 *
 * 🔴 カードに載せない。地色の上に直接置く。
 *
 * 🔴 h1 は他ページと同じ pageTitleStyle（display / 28〜32px）。
 *    かつてここだけ title(20px) にしていた（折り返しを嫌ったため）が、画面を
 *    移ったときに見出しの大きさが変わるほうが問題だと判断して揃えた。
 *    title に戻さないこと。折り返しは以下で吸収してある:
 *    - .mypage-8a-grid は 1.15fr / 1fr で、1440px 幅なら左カラムは約 665px。
 *      display の下限 28px なら「〇〇さん、こんにちは」は1行に収まる
 *    - 長い表示名で2行になっても align-items:stretch で右の目標カードが
 *      追従するので、丈のズレにはならない
 *    幅が足りなくなったら サイズを下げるのではなく
 *    構造（折り返し許容・min-width:0）で塞ぐ。
 *
 * 🔴 下余白を持たない。間隔は .mypage-8a-grid の gap が持つ。
 *
 * 🔴 かつてここに「今週・累計・修了レッスン」のKPIを横並びで持たせていたが、
 *    5a でその3つは「学習記録」カード（mypage/StudyRecordCard.tsx）へ移した。
 *    数字の置き場を2箇所にしないこと。同じ値をここに戻さない。
 */
import { pageTitleStyle } from '../../theme/pageTitle';
import StartRecordingButton from './StartRecordingButton';

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
      <h1 style={{ ...pageTitleStyle, color: 'var(--dc-text)' }}>
        {name || 'ゲスト'}さん、こんにちは
      </h1>
      {/* 🔴 挨拶の下の空きはこれで埋める。右の目標カードのほうが背が高く、
             align-items:stretch のぶんここに40〜50pxの白が残っていた。
             縦中央寄せで散らすより、自分から記録を始める入口を置くほうが
             その面積の使い道として良い（StartRecordingButton の🔴）。 */}
      <StartRecordingButton />
    </div>
  );
}

export default MypageGreeting;
