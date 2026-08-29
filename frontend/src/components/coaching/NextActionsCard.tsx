/**
 * タイムライン「次回まで」のアクションカード。
 * デザイン『コーチング トップ 3案.dc.html』案1C。
 *
 * 2つのモードを持つ:
 *   表示 … 行クリックで完了/未完了を即トグル（1行1アクション）
 *   編集 … 文言の書き換え・削除・追加をまとめて保存
 *
 * 🔴 表示モードのトグルを「即保存」にしたのは1Cの指定。チェックを付けるたびに
 *    保存ボタンを押させると、日々の「終わった」を記録する動作として重すぎる。
 *    一方で文言の書き換えは1文字ごとに保存すると打鍵途中の文言が正になるので、
 *    そちらは従来どおり編集モード＋まとめて保存のまま。
 */
import React, { useState } from 'react';
import { Check, Pencil, Plus } from 'lucide-react';
import { C, CARD, INPUT } from './design1c';
import type { CoachingGoalApi, CoachingGoalUpdateItem } from '../../types/mypage';

/** 表示モードで最初に見せる件数。これを超えたぶんは折りたたむ */
const VISIBLE_LIMIT = 5;

interface NextActionsCardProps {
  goals: CoachingGoalApi[];
  editing: boolean;
  draft: CoachingGoalUpdateItem[];
  saving: boolean;
  /** 表示モードでの即時トグル */
  onToggle: (no: number) => void;
  onStartEdit: () => void;
  onCommit: () => void;
  onPatch: (index: number, next: Partial<CoachingGoalUpdateItem>) => void;
  onRemove: (index: number) => void;
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
  onPatch,
  onRemove,
  onAdd,
}: NextActionsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [newText, setNewText] = useState('');

  const done = goals.filter((g) => g.is_completed === 1).length;
  const hasMore = !editing && goals.length > VISIBLE_LIMIT;
  const visible = hasMore && !expanded ? goals.slice(0, VISIBLE_LIMIT) : goals;

  const submitNew = () => {
    const text = newText.trim();
    if (!text) return;
    onAdd(text);
    setNewText('');
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
          <button
            type="button"
            className="cg-btn-primary"
            onClick={onCommit}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: C.brand,
              border: `1px solid ${C.brand}`,
              color: '#fff',
              borderRadius: 9,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.6 : 1,
              boxShadow: '0 3px 8px -4px rgba(220,12,49,.5)',
            }}
          >
            <Check size={13} strokeWidth={2.5} />
            {saving ? '保存しています…' : '編集を終える'}
          </button>
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
          {draft.map((g, i) => (
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
                style={{ ...INPUT, flex: 1, fontSize: 13 }}
              />
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label="このアクションを削除"
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
          ))}

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
                  <span
                    title="クリックで未完了に戻す"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: C.ok,
                      background: C.okSoft,
                      borderRadius: 9999,
                      padding: '4px 11px',
                      flex: 'none',
                    }}
                  >
                    完了
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
