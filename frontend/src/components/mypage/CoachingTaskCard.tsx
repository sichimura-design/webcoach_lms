import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { PlanItem, useNextCoachingPlan } from '../../hooks/useNextCoachingPlan';
import { formatMinutesHM } from '../../utils/studyStats';

/**
 * 次回コーチングまでの目標（マイページ右上）。
 * claude.ai/design『トップページ 3案』8a 準拠。
 *
 * 中身はコーチング記録で「確定」した目標そのもの（useNextCoachingPlan）。
 * 5a で外していた mypage/NextCoachingPlan.tsx の後継だが、見た目が別物なので
 * 差し替えではなく別ファイルにしてある（5a に戻すときは向こうを import し直す）。
 *
 * 🔴 ここでできるのは「チェックの付け外し」だけ。文言の追加・修正・削除に加えて、
 *    **並べ替えもコーチング（/coaching）の編集モード**に置く
 *    （coaching/NextGoalsCard.tsx）。トップページに編集UIを持つと、
 *    同じデータの入口が2つになって、どちらが正か分からなくなる。
 *    ここに ↑↓ を戻さないこと。
 *
 * 🔴 CTAは持たせない。マイページ唯一の Primary CTA は ResumeStudyCard の
 *    「続きから学習する」（DESIGN.md §15-5）。ここは見出し右のテキストリンクに留める。
 */
interface CoachingTaskCardProps {
  userId: number | undefined;
}

/*
 * 一覧の高さについて（見た目は index.css の .mypage-task-listbox / .mypage-task-list）。
 * ============================================================
 * 🔴 件数でカードの丈を変えない。このカードは左の ResumeStudyCard と同じ行に並んでいて
 *    （.mypage-8a-grid は align-items:stretch）、行が増えるとこのカードだけ背が伸びて
 *    左側に大きな空白ができる。目標は coachingGoalsStore の reflectCandidates が
 *    確定のたびに追記するので、4件以上は普通に起きる。
 *    そこで一覧は position:absolute で浮かせて高さに効かないようにし、溢れたぶんは
 *    カードの中でスクロールさせる。件数を切らないので全件ここで見られる。
 * 🔴 1カラム（〜1023px）では逆に中スクロールをやめて全件そのまま並べる。
 *    隣に丈を合わせる相手がおらず、ページのスクロールで足りるため。
 * ============================================================
 */

const CARD_STYLE: CSSProperties = {
  flex: 1,
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
  display: 'flex',
  flexDirection: 'column',
};

interface TaskRowProps {
  item: PlanItem;
  onToggle: () => void;
  disabled: boolean;
}

function TaskRow({ item, onToggle, disabled }: TaskRowProps) {
  const done = item.completed;
  return (
    <div
      className="mypage-task-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        border: `1px solid ${done ? 'var(--dc-soft-200)' : 'var(--dc-border)'}`,
        background: done ? 'var(--dc-soft-100)' : 'transparent',
        borderRadius: 14,
        padding: '15px 12px 15px 16px',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={done}
        aria-label={`${item.text}を${done ? '未完了に戻す' : '完了にする'}`}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          width: 24,
          height: 24,
          flex: 'none',
          borderRadius: 9999,
          padding: 0,
          display: 'grid',
          placeItems: 'center',
          background: done ? 'var(--dc-primary)' : 'transparent',
          border: done ? 0 : '2px solid var(--dc-idle-dash)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {done && <Check size={13} strokeWidth={2.5} color="#fff" />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* タスク名は「次に何をするか」そのものなので lead(16px)。
            完了済みは取り消し線で役目が終わっているので weight を一段落とす。 */}
        <div
          style={{
            fontSize: 'var(--dc-fs-lead)',
            fontWeight: done ? 500 : 600,
            color: done ? '#B08A8F' : 'var(--dc-text)',
            textDecoration: done ? 'line-through' : 'none',
            lineHeight: 'var(--dc-lh-ui)',
          }}
        >
          {item.text}
        </div>
        {!done && item.estimatedMinutes != null && item.estimatedMinutes > 0 && (
          <div style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)', marginTop: 3 }}>
            目安 {formatMinutesHM(item.estimatedMinutes)}
          </div>
        )}
      </div>

      {/* 🔴 ここにあった並べ替えの ↑↓ は撤去した。トップページに並べ替えは要らない
             （＝順番を決めるのは編集する場面の作業）。移設先は
             coaching/NextGoalsCard.tsx の編集モード。戻さないこと。 */}
    </div>
  );
}

/** 未完了を上へ寄せる。それぞれの中の順序（＝保存されている順）は崩さない */
function undoneFirst(list: PlanItem[]): PlanItem[] {
  return [...list.filter((it) => !it.completed), ...list.filter((it) => it.completed)];
}

export function CoachingTaskCard({ userId }: CoachingTaskCardProps) {
  const navigate = useNavigate();
  const { items, loading, saving, save } = useNextCoachingPlan(userId);
  // 連打で複数の保存が飛ぶのを防ぐ。どの行を押したかはボタンの見た目に出さない
  const [pending, setPending] = useState(false);
  // 画面に出す並び。チェックの結果は保存の返りを待たずに反映する
  const [rows, setRows] = useState<PlanItem[]>([]);
  // true の間は items が入れ替わっても undoneFirst をかけ直さない
  const keepOrderRef = useRef(false);

  /*
   * 並びの決め方。
   * ============================================================
   * 🔴 未完了を上へ寄せるのは「開いたとき」だけ。完了済みが並んだ日に
   *    「いまやること」が下に埋もれるのを防ぐため（スクロールすれば全件見えるが、
   *    最初の1画面に出ているかどうかは別）。
   * 🔴 逆に、開いている間は勝手に並べ替えない。チェックを付けた瞬間に行が飛ぶと、
   *    続けて隣の行を押せない。チェックの保存の返りは keepOrderRef で素通しする。
   *    並べ替えの ↑↓ は撤去したが、**この keepOrderRef は消さないこと**。
   *    チェックでも使っていて、外すと押すたびに行が飛ぶ。
   * ============================================================
   */
  useEffect(() => {
    setRows(keepOrderRef.current ? items : undoneFirst(items));
    keepOrderRef.current = false;
  }, [items]);

  const toggle = async (target: PlanItem) => {
    if (pending || saving) return;
    setPending(true);
    keepOrderRef.current = true;
    await save(
      rows.map((it) =>
        it.no === target.no
          ? { ...it, completed: !it.completed, progress: it.completed ? 0 : 100 }
          : it
      )
    );
    setPending(false);
  };

  return (
    <section style={CARD_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h2
          style={{
            margin: 0,
            flex: 1,
            fontSize: 'var(--dc-fs-lead)',
            fontWeight: 700,
            color: 'var(--dc-text)',
            lineHeight: 'var(--dc-lh-heading)',
          }}
        >
          次回コーチングまでのTODO
        </h2>
        <button
          type="button"
          onClick={() => navigate('/coaching')}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            border: 0,
            background: 'transparent',
            padding: 0,
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-body)',
            fontWeight: 600,
            color: 'var(--dc-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          編集する ›
        </button>
      </div>

      {/* 外枠は高さを決めるだけ。中身（.mypage-task-list）は浮かせてあるので、
          何件あってもカードの丈は変わらない（LIST_MIN_H の 🔴 を読むこと） */}
      <div className="mypage-task-listbox">
        <div className="mypage-task-list">
          {loading ? (
            <div style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-subtle)', padding: '8px 0' }}>
              読み込んでいます…
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{
                fontSize: 'var(--dc-fs-body)',
                color: 'var(--dc-text-muted)',
                lineHeight: 'var(--dc-lh-prose)',
                padding: '8px 0',
              }}
            >
              まだ目標がありません。コーチング記録を確定すると、決まった目標がここに入ります。
            </div>
          ) : (
            rows.map((it) => (
              <TaskRow
                key={it.no}
                item={it}
                onToggle={() => toggle(it)}
                disabled={pending || saving}
              />
            ))
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 'var(--dc-fs-caption)',
          color: 'var(--dc-text-subtle)',
          marginTop: 14,
          lineHeight: 'var(--dc-lh-ui)',
        }}
      >
        コーチング記録で確定した目標です。編集や並べ替えは「コーチング」から。
      </div>
    </section>
  );
}

export default CoachingTaskCard;
