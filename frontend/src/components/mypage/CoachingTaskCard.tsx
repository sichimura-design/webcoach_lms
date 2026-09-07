import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
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
 * 🔴 ここでできるのは「チェックの付け外し」と「並べ替え」だけ。文言の追加・修正・削除は
 *    コーチング（/coaching）に置く。トップページに編集UIを持つと、
 *    同じデータの入口が2つになって、どちらが正か分からなくなる。
 *    （並べ替えを許すのは、どれから手を付けるかは受講生が決めることだから。
 *      並び順は no の振り直しでそのまま保存される＝useNextCoachingPlan.toApi）
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
  index: number;
  total: number;
  onToggle: () => void;
  /** 1つ上／下へ動かす。端では呼ばれない（ボタンを disabled にしてある） */
  onMove: (to: number) => void;
  disabled: boolean;
}

function TaskRow({ item, index, total, onToggle, onMove, disabled }: TaskRowProps) {
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

      {/* 並べ替え。行に触れる（hover / フォーカス）と出る。
          🔴 ドラッグにしない。一覧はカードの中でスクロールするので、掴んだまま
             端まで送っても中身が送られず、見えていない位置へは動かせない。
             ↑↓ ならスクロール中でも・タッチでも・キーボードでも同じ操作になる。 */}
      <div className="mypage-task-move" style={{ display: 'flex', flexDirection: 'column', flex: 'none' }}>
        <button
          type="button"
          data-move={`${item.text}|up`}
          className="mypage-task-move-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          disabled={disabled || index === 0}
          aria-label={`${item.text}を1つ上へ`}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          data-move={`${item.text}|down`}
          className="mypage-task-move-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          disabled={disabled || index >= total - 1}
          aria-label={`${item.text}を1つ下へ`}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown size={14} />
        </button>
      </div>
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
  // 画面に出す並び。並べ替えは保存の返りを待たずに反映する（待つと行が遅れて動く）
  const [rows, setRows] = useState<PlanItem[]>([]);
  // true の間は items が入れ替わっても undoneFirst をかけ直さない
  const keepOrderRef = useRef(false);
  // 並べ替え後に押し直せるよう、同じボタンへフォーカスを戻すための目印
  const refocusRef = useRef<string | null>(null);
  // 保存の返りを rows に入れ終わった合図。フォーカス戻しはこれを待つ
  const [settled, setSettled] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  /*
   * 並びの決め方。
   * ============================================================
   * 🔴 未完了を上へ寄せるのは「開いたとき」だけ。完了済みが並んだ日に
   *    「いまやること」が下に埋もれるのを防ぐため（スクロールすれば全件見えるが、
   *    最初の1画面に出ているかどうかは別）。
   * 🔴 逆に、開いている間は勝手に並べ替えない。チェックを付けた瞬間に行が飛ぶと、
   *    手で並べ替えた順が消えるし、続けて隣の行を押せない。
   *    保存（チェック・並べ替え）の返りは keepOrderRef で素通しする。
   * ============================================================
   */
  useEffect(() => {
    setRows(keepOrderRef.current ? items : undoneFirst(items));
    keepOrderRef.current = false;
    setSettled((n) => n + 1);
  }, [items]);

  /* 動かした行のボタンへフォーカスを戻す。↑↓ を続けて押せるようにするのと、
     スクロールで見えなくなった行を focus で追いかけるのを兼ねる。
     🔴 当てるのは settled（保存の返りを rows に入れた後）の1回だけ。依存に
        pending / saving を足すと、保存が返った直後・rows を入れ替える前に一度
        走ってしまう。そのあと no の振り直しで key が変わり、React が同じ key の
        古い行のDOMを使い回すので、フォーカスだけ位置に取り残されて別のタスクの
        ボタンに乗る（実際それで Enter が隣の行を動かした）。 */
  useEffect(() => {
    const key = refocusRef.current;
    if (!key) return;
    refocusRef.current = null;
    listRef.current?.querySelector<HTMLButtonElement>(`[data-move="${CSS.escape(key)}"]`)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

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

  /** index の行を to の位置へ動かして保存する。並び順＝保存順（no は保存時に振り直される） */
  const move = async (index: number, to: number) => {
    if (pending || saving) return;
    if (to < 0 || to >= rows.length || to === index) return;
    const before = rows;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    setRows(next);
    refocusRef.current = `${moved.text}|${to > index ? 'down' : 'up'}`;
    setPending(true);
    keepOrderRef.current = true;
    const ok = await save(next);
    if (!ok) {
      // 保存できなければ見た目も戻す。動いたままだとリロードで元に戻って驚く
      keepOrderRef.current = false;
      refocusRef.current = null; // items が動かない＝settled が来ないので置き去りにしない
      setRows(before);
    }
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
          次回コーチングまでの目標
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
        <div className="mypage-task-list" ref={listRef}>
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
            rows.map((it, i) => (
              <TaskRow
                key={it.no}
                item={it}
                index={i}
                total={rows.length}
                onToggle={() => toggle(it)}
                onMove={(to) => move(i, to)}
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
        コーチング記録で確定した目標です。↑↓ で並べ替え、編集は「コーチング」から。
      </div>
    </section>
  );
}

export default CoachingTaskCard;
