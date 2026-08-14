import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { StudyStatsSummary } from '../../types/studyActivity';
import { splitMinutesHM } from '../../utils/studyStats';

/**
 * マイページ最上部。日付・挨拶・積み上げた数字を1行にまとめる。
 *
 * claude.ai/design『マイページ 3d.dc.html』準拠。
 *
 * 🔴 カードに載せない。地色の上に直接置く。
 *    以前の UserSummary は白カードの帯だったが、このデザインでは
 *    「最初のカードは続きを学ぶヒーロー」という優先順位にしているため、
 *    ここに枠を付けると主役が2つになる（DESIGN.md §1「祝う要素は1画面に1つ」と同じ考え方）。
 *
 * 🔴 数字の置き場はここ1箇所。詳しい内訳は /study-log に任せる
 *    （かつて今週の学習時間が複数カードに重複していた反省）。
 */
interface MypageGreetingProps {
  /** 表示名（プロフィールのニックネーム） */
  name: string;
  stats: StudyStatsSummary | null;
  loading: boolean;
  /** 修了レッスン数（コースの進捗率からの推定値） */
  completedLessons: number;
}

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** 「2026年8月14日（金）」。toLocaleDateString だと曜日の括弧が半角になるので自前で組む */
function formatTodayJa(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_JA[d.getDay()]}）`;
}

/**
 * 統計1項目。ラベルは小さく、数値は Inter の太字で。
 * 数値と単位のサイズを分けるのは DESIGN.md §3「数値と単位はサイズを分ける」より。
 */
function Stat({ label, parts }: { label: string; parts: { value: string; unit: string }[] }) {
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 11.5, color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
      <span className="dc-num" style={{ fontWeight: 800, fontSize: 16, color: 'var(--dc-text)', whiteSpace: 'nowrap' }}>
        {parts.map((p, i) => (
          <span key={i}>
            {p.value}
            {p.unit && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--dc-text-muted)' }}>{p.unit}</span>}
          </span>
        ))}
      </span>
    </span>
  );
}

function Divider() {
  return <span aria-hidden="true" style={{ width: 1, height: 20, background: 'var(--dc-border-strong)', flex: 'none' }} />;
}

function MypageGreeting({ name, stats, loading, completedLessons }: MypageGreetingProps) {
  const navigate = useNavigate();
  const loadingParts = [{ value: '…', unit: '' }];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap',
        marginBottom: 22,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: 'var(--dc-text-muted)', marginBottom: 4 }}>{formatTodayJa(new Date())}</div>
        <h1 style={{ margin: 0, fontSize: 27, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--dc-text)' }}>
          {name || 'ゲスト'}さん、こんにちは
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Stat label="今週" parts={loading ? loadingParts : splitMinutesHM(stats?.week.minutes ?? 0)} />
        <Divider />
        <Stat label="累計" parts={loading ? loadingParts : splitMinutesHM(stats?.allTime.minutes ?? 0)} />
        <Divider />
        <Stat label="修了レッスン" parts={loading ? loadingParts : [{ value: String(completedLessons), unit: '' }]} />
        <button
          type="button"
          onClick={() => navigate('/study-log')}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            border: 0,
            background: 'transparent',
            padding: 0,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--dc-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          学習記録を見る
          <ChevronRight size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export default MypageGreeting;
