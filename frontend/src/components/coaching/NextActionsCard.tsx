/**
 * タイムライン「次回まで」のアクションカード。
 * デザイン『コーチング トップ 3案.dc.html』案1C。
 *
 * 2つのモードを持つ:
 *   表示 … 行クリックで完了/未完了を即トグル（1行1アクション）
 *   編集 … 文言の書き換え・削除・追加を下書きに溜め、「変更を保存」で確定
 *
 * 🔴 表示モードのトグルを「即保存」にしたのは1Cの指定。チェックを付けるたびに
 *    保存ボタンを押させると、日々の「終わった」を記録する動作として重すぎる。
 *    一方で文言の書き換えは1文字ごとに保存すると打鍵途中の文言が正になるので、
 *    そちらは従来どおり編集モード＋まとめて保存のまま。
 *
 * 🔴 × は「その場で消す」ではなく「削除予定にする」。行は打ち消し線で残り、
 *    「戻す」で復活する。間違って消したものが戻せないのが怖い、というレビュー指摘。
 *    戻す手段は3段構え:
 *      1. 行の「戻す」          … 1件ずつ取り消す
 *      2. 「編集をやめる」      … 編集に入る前の状態へ丸ごと戻す
 *      3. 保存前の確認ダイアログ … 何が消えるかを一覧で見せる（最後の関門）
 */
import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, RotateCcw } from 'lucide-react';
import { C, CARD, INPUT } from './design1c';
import ConfirmDialog from './ConfirmDialog';
import type { CoachingGoalApi, CoachingGoalUpdateItem } from '../../types/mypage';

/** 表示モードで最初に見せる件数。これを超えたぶんは折りたたむ */
const VISIBLE_LIMIT = 5;

/**
 * 編集モードの下書き1行。
 * removed / isNew は保存されない画面上の状態で、確定時に落とす。
 */
export interface GoalDraftRow extends CoachingGoalUpdateItem {
  /** 削除予定（まだ消していない） */
  removed?: boolean;
  /** この編集セッションで追加された行。取り消しても失われる保存済みデータが無い */
  isNew?: boolean;
}

interface NextActionsCardProps {
  goals: CoachingGoalApi[];
  editing: boolean;
  draft: GoalDraftRow[];
  saving: boolean;
  /** 表示モードでの即時トグル */
  onToggle: (no: number) => void;
  onStartEdit: () => void;
  onCommit: () => void;
  /** 編集を破棄して表示モードへ戻す */
  onCancel: () => void;
  onPatch: (index: number, next: Partial<CoachingGoalUpdateItem>) => void;
  /** 削除予定にする（この時点ではまだ消えない） */
  onRemove: (index: number) => void;
  /** 削除予定を取り消す */
  onRestore: (index: number) => void;
  onAdd: (description: string) => void;
}

function CheckCircle({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        borderRadius: 9999,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: done ? C.ok : C.surface,
        border: done ? 'none' : `1.5px solid ${C.checkIdle}`,
        boxSizing: 'border-box',
      }}
    >
      <Check size={11} strokeWidth={3.5} color={done ? '#fff' : C.checkIdle} />
    </span>
  );
}

export function NextActionsCard({
  goals,
  editing,
  draft,
  saving,
  onToggle,
  onStartEdit,
  onCommit,
  onCancel,
  onPatch,
  onRemove,
  onRestore,
  onAdd,
}: NextActionsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [newText, setNewText] = useState('');
  /** 出している確認ダイアログ。save = 削除を含む保存、discard = 編集の破棄 */
  const [confirming, setConfirming] = useState<'save' | 'discard' | null>(null);

  const done = goals.filter((g) => g.is_completed === 1).length;
  const hasMore = !editing && goals.length > VISIBLE_LIMIT;
  const visible = hasMore && !expanded ? goals.slice(0, VISIBLE_LIMIT) : goals;

  const submitNew = () => {
    const text = newText.trim();
    if (!text) return;
    onAdd(text);
    setNewText('');
  };

  // --- 下書きと保存済みの差分 -------------------------------------------------
  //
  // 「何が変わるのか」をボタンの手前で言うために、削除・追加・修正を数える。
  // no は保存済みの行を突き合わせる鍵（追加行は no:0 で入ってくる）。

  const originalByNo = useMemo(() => new Map(goals.map((g) => [g.no, g.description])), [goals]);

  /** 削除予定のうち、保存済み＝本当に失われるもの */
  const pendingRemoval = draft.filter((g) => g.removed && !g.isNew);
  const addedCount = draft.filter((g) => g.isNew && !g.removed).length;
  const editedCount = draft.filter(
    (g) => !g.isNew && !g.removed && g.description.trim() !== (originalByNo.get(g.no) ?? '').trim(),
  ).length;
  /** 文言が空のまま残っている行。保存すると黙って消えるので先に止める */
  const hasEmpty = draft.some((g) => !g.removed && g.description.trim() === '');
  const changeCount = pendingRemoval.length + addedCount + editedCount;

  const changeSummary = [
    pendingRemoval.length > 0 && `削除${pendingRemoval.length}件`,
    addedCount > 0 && `追加${addedCount}件`,
    editedCount > 0 && `修正${editedCount}件`,
  ]
    .filter(Boolean)
    .join('・');

  const canSave = changeCount > 0 && !hasEmpty && !saving;

  /** 削除を含むときだけ確認を挟む。文言の直しだけなら押した通りに保存する */
  const requestCommit = () => {
    if (!canSave) return;
    if (pendingRemoval.length > 0) {
      setConfirming('save');
      return;
    }
    onCommit();
  };

  const requestCancel = () => {
    if (changeCount > 0) {
      setConfirming('discard');
      return;
    }
    onCancel();
  };

  return (
    <section style={{ ...CARD, padding: '16px 24px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.ink, flex: 1, minWidth: 0 }}>
          次回までのアクション
        </h3>
        {goals.length > 0 && (
          <span style={{ fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
            {done} / {goals.length} 完了
          </span>
        )}
        {editing ? (
          /* 🔴 保存/やめるはカード下端に置いた。編集した直下に確定ボタンが来るほうが
                「ここまでが下書き」と分かる。ヘッダは状態表示だけ持つ。 */
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: C.brandInk,
              background: C.brandSoft,
              borderRadius: 9999,
              padding: '4px 11px',
              flex: 'none',
            }}
          >
            編集中（まだ保存されていません）
          </span>
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: C.surface,
              border: `1px solid ${C.brand}`,
              color: C.brand,
              borderRadius: 9,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
            className="cg-dash"
          >
            <Pencil size={13} strokeWidth={1.75} />
            リストを編集
          </button>
        )}
      </div>

      {/* ---- 編集モード ---- */}
      {editing ? (
        <>
          {draft.map((g, i) =>
            g.removed ? (
              /* ---- 削除予定（まだ消えていない） ---- */
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 46,
                  padding: '6px 4px',
                  borderTop: `1px solid ${C.line}`,
                  background: C.brandFaint,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 120,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: C.faint,
                    textDecoration: 'line-through',
                    wordBreak: 'break-word',
                  }}
                >
                  {g.description.trim() || '（未入力）'}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: C.brandInk,
                    background: C.brandSoft,
                    borderRadius: 9999,
                    padding: '3px 10px',
                    flex: 'none',
                  }}
                >
                  削除予定
                </span>
                <button
                  type="button"
                  className="cg-btn-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  onClick={() => onRestore(i)}
                  aria-label={`「${g.description.trim() || '未入力のアクション'}」の削除を取り消す`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    height: 28,
                    padding: '0 11px',
                    borderRadius: 9999,
                    border: `1px solid ${C.borderInput}`,
                    background: C.surface,
                    color: C.ink,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    flex: 'none',
                  }}
                >
                  <RotateCcw size={12} strokeWidth={2.25} />
                  戻す
                </button>
              </div>
            ) : (
              /* ---- 通常の編集行 ---- */
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 46,
                  padding: '0 4px',
                  borderTop: `1px solid ${C.line}`,
                }}
              >
                <input
                  value={g.description}
                  onChange={(e) => onPatch(i, { description: e.target.value })}
                  placeholder="例）バナーを1つ完成させる"
                  aria-label={`アクション ${i + 1}`}
                  style={{
                    ...INPUT,
                    flex: 1,
                    fontSize: 13,
                    borderColor: g.description.trim() === '' ? C.brand : C.borderInput,
                  }}
                />
                <button
                  type="button"
                  className="cg-btn-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  onClick={() => onRemove(i)}
                  title="削除予定にする（保存するまで戻せます）"
                  aria-label={`「${g.description.trim() || `アクション ${i + 1}`}」を削除予定にする`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9999,
                    border: `1px solid ${C.borderInput}`,
                    background: C.surface,
                    color: C.brandInk,
                    fontSize: 14,
                    cursor: 'pointer',
                    flex: 'none',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ),
          )}

          <div style={{ display: 'flex', gap: 8, padding: '10px 4px 4px', borderTop: `1px solid ${C.line}` }}>
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNew();
              }}
              placeholder="アクションを追加…"
              aria-label="アクションを追加"
              style={{ ...INPUT, flex: 1, height: 36, fontSize: 13 }}
            />
            <button
              type="button"
              className="cg-btn-primary"
              onClick={submitNew}
              style={{
                background: C.brand,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '0 16px',
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
                flex: 'none',
              }}
            >
              追加
            </button>
          </div>

          {/* ---- 確定バー ---- */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <p
              role="status"
              style={{ margin: 0, flex: 1, minWidth: 190, fontSize: 12, lineHeight: 1.7, color: hasEmpty ? C.brandInk : C.muted }}
            >
              {hasEmpty
                ? '未入力の行があります。文言を入れるか、× で削除予定にしてください。'
                : changeCount === 0
                  ? 'まだ変更はありません。書き換え・追加・削除は保存するまで反映されません。'
                  : `${changeSummary}。「変更を保存」を押すまで反映されません。`}
            </p>
            <button
              type="button"
              className="cg-btn-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              onClick={requestCancel}
              disabled={saving}
              style={{
                background: C.surface,
                border: `1px solid ${C.borderInput}`,
                borderRadius: 9,
                padding: '8px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: 'inherit',
                color: C.ink,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
                flex: 'none',
              }}
            >
              編集をやめる
            </button>
            <button
              type="button"
              className="cg-btn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              onClick={requestCommit}
              disabled={!canSave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: C.brand,
                border: `1px solid ${C.brand}`,
                color: '#fff',
                borderRadius: 9,
                padding: '8px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: canSave ? 'pointer' : 'default',
                opacity: canSave ? 1 : 0.5,
                boxShadow: '0 3px 8px -4px rgba(220,12,49,.5)',
                flex: 'none',
              }}
            >
              <Check size={13} strokeWidth={2.5} />
              {saving ? '保存しています…' : changeSummary ? `変更を保存（${changeSummary}）` : '変更を保存'}
            </button>
          </div>

          {confirming === 'save' && (
            <ConfirmDialog
              title={`${pendingRemoval.length}件のアクションを削除して保存します`}
              description="削除したアクションはあとから戻せません。残しておく場合は「やめる」を押し、行の「戻す」で削除を取り消してください。"
              items={pendingRemoval.map((g) => g.description.trim() || '（未入力）')}
              confirmLabel="削除して保存"
              busy={saving}
              onConfirm={() => {
                setConfirming(null);
                onCommit();
              }}
              onCancel={() => setConfirming(null)}
            />
          )}

          {confirming === 'discard' && (
            <ConfirmDialog
              title="編集内容を破棄しますか？"
              description={`保存していない変更（${changeSummary}）は失われ、編集を始める前の状態に戻ります。`}
              confirmLabel="破棄する"
              cancelLabel="編集を続ける"
              onConfirm={() => {
                setConfirming(null);
                onCancel();
              }}
              onCancel={() => setConfirming(null)}
            />
          )}
        </>
      ) : goals.length === 0 ? (
        /* ---- 空 ---- */
        <p style={{ margin: 0, padding: '10px 2px 4px', fontSize: 13, color: C.muted, lineHeight: 1.9, borderTop: `1px solid ${C.line}` }}>
          まだアクションがありません。コーチングが終わると、AIが目標とタスクを整理します。
          いま決めたいことがあれば「リストを編集」から自分でも書けます。
        </p>
      ) : (
        /* ---- 表示モード ---- */
        <>
          {visible.map((g) => {
            const isDone = g.is_completed === 1;
            return (
              <div
                key={g.no}
                className="cg-row focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                role="button"
                tabIndex={0}
                aria-pressed={isDone}
                onClick={() => onToggle(g.no)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle(g.no);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 42,
                  padding: '0 10px',
                  borderTop: `1px solid ${C.line}`,
                  cursor: 'pointer',
                }}
              >
                <CheckCircle done={isDone} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.ink, lineHeight: 1.6, padding: '8px 0' }}>
                  {g.description}
                </span>
                {isDone ? (
                  /* 🔴 「完了」と「未完了に戻す」を同じグリッドセルに重ねて置く。
                        行にホバー/フォーカスすると入れ替わる（CSS は .cg-undopill）。
                        重ねるのは幅を広い方で固定するため。片方だけ描くと
                        文字数の差でピルの幅が変わり、行が横に伸び縮みして落ち着かない。 */
                  <span
                    className="cg-undopill"
                    title="クリックで未完了に戻す"
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: C.ok,
                      background: C.okSoft,
                      // 未完了側の「完了にする」ピルと同じ外寸にして、
                      // トグルしても行の高さが動かないようにする
                      border: '1px solid transparent',
                      borderRadius: 9999,
                      padding: '4px 11px',
                      flex: 'none',
                    }}
                  >
                    <span style={{ gridArea: '1 / 1' }}>完了</span>
                    {/* 見た目の入れ替えなので、読み上げは「完了」だけに任せる
                        （操作可能なことは行の aria-pressed が伝えている） */}
                    <span
                      aria-hidden
                      className="flex items-center"
                      style={{ gridArea: '1 / 1', gap: 4, whiteSpace: 'nowrap' }}
                    >
                      <RotateCcw size={11} strokeWidth={2.5} />
                      未完了に戻す
                    </span>
                  </span>
                ) : (
                  <span
                    className="cg-donebtn"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: C.ok,
                      border: `1px solid ${C.okBorder}`,
                      background: C.surface,
                      borderRadius: 9999,
                      padding: '4px 11px',
                      flex: 'none',
                    }}
                  >
                    完了にする
                  </span>
                )}
                <button
                  type="button"
                  className="cg-pencil"
                  title="このリストを編集"
                  aria-label="このリストを編集"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 26,
                    height: 26,
                    borderRadius: 9999,
                    flex: 'none',
                    cursor: 'pointer',
                    color: C.pencil,
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                  }}
                >
                  <Pencil size={13} strokeWidth={1.75} />
                </button>
              </div>
            );
          })}

          {hasMore && (
            <button
              type="button"
              className="cg-row"
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                height: 38,
                borderTop: `1px solid ${C.line}`,
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                background: 'transparent',
                fontSize: 12.5,
                fontWeight: 700,
                color: C.brand,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {expanded ? '閉じる' : `もっと見る（残り${goals.length - VISIBLE_LIMIT}件）`}
            </button>
          )}

          <button
            type="button"
            className="cg-dash"
            onClick={onStartEdit}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              width: '100%',
              height: 40,
              marginTop: 6,
              border: `1.5px dashed ${C.borderInput}`,
              borderRadius: 10,
              background: 'transparent',
              fontSize: 12.5,
              fontWeight: 700,
              color: C.muted,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <Plus size={13} strokeWidth={2.5} />
            アクションを追加・編集する
          </button>
        </>
      )}
    </section>
  );
}

export default NextActionsCard;
