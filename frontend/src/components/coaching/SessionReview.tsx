/**
 * AIコーチングノート画面。
 *
 * セクション順（仕様§12）:
 *   今回のまとめ → 前回からの進捗 → コーチからのフィードバック → 決まったこと
 *   → 次回までの目標 → 次回までのタスク → 次回確認すること
 *
 * 文字起こしと録音は常時表示せず末尾の折りたたみに置く。
 * 学習管理システムとして重要なのは記録そのものではなく、次にやることが残ることなので。
 *
 * AIが生成した内容はそのまま確定させない（§13）。受講生が確認・修正してから
 * 「この内容で確定」を押した分だけ学習目標に反映する。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Info, Sparkles } from 'lucide-react';
import bffClient from '../../services/bffClient';
import { useToast } from '../../contexts/ToastContext';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { formatTimecode, speakerLabel } from '../../utils/parseTranscript';
import { RECORDING_SOURCE_LABEL } from '../../types/coaching';
import type {
  AudioRetention,
  CoachingSessionDetail,
  Evidenced,
  GoalCandidate,
  SpeakerRole,
  TranscriptSegment,
} from '../../types/coaching';

interface SessionReviewProps {
  session: CoachingSessionDetail;
  userId: number | undefined;
  onReflected: (updated: CoachingSessionDetail) => void;
  onDeleted: () => void;
}

/** 「未設定」「確認が必要」の強調色 */
const NEEDS_INPUT = '#B26A00';
const NEEDS_INPUT_BG = '#FFF6E5';

function formatDueDate(iso: string | null): string {
  if (!iso) return '未設定';
  const [, m, d] = iso.split('-');
  return `${Number(m)}月${Number(d)}日`;
}

export function SessionReview({ session, userId, onReflected, onDeleted }: SessionReviewProps) {
  const { showToast } = useToast();

  const [detail, setDetail] = useState<CoachingSessionDetail>(session);
  const [goals, setGoals] = useState<GoalCandidate[]>(session.summary?.goals ?? []);
  const [tasks, setTasks] = useState<GoalCandidate[]>(session.summary?.tasks ?? []);
  const [memo, setMemo] = useState(session.studentMemo);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warnNeedsReview, setWarnNeedsReview] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const segmentRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    setDetail(session);
    setGoals(session.summary?.goals ?? []);
    setTasks(session.summary?.tasks ?? []);
    setMemo(session.studentMemo);
  }, [session]);

  const summary = detail.summary;
  const reflected = useMemo(() => new Set(detail.reflectedGoalIds), [detail.reflectedGoalIds]);
  const allItems = useMemo(() => [...goals, ...tasks], [goals, tasks]);
  const selectable = allItems.filter((g) => !reflected.has(g.id));
  const selectedItems = selectable.filter((g) => g.selected);
  const allReflected = selectable.length === 0 && allItems.length > 0;

  // --- 保存 -----------------------------------------------------------------

  const persist = useCallback(
    async (patch: Parameters<typeof bffClient.updateCoachingSession>[1]) => {
      try {
        const updated = await bffClient.updateCoachingSession(detail.id, patch);
        setDetail(updated);
      } catch {
        showToast('変更を保存できませんでした', 'error');
      }
    },
    [detail.id, showToast],
  );

  const patchItem = (kind: 'goal' | 'task', id: string, changes: Partial<GoalCandidate>) => {
    const setter = kind === 'goal' ? setGoals : setTasks;
    setter((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        const next = { ...g, ...changes };
        // 期限と完了条件が両方埋まったら「要確認」を解除する
        next.needsReview = !next.dueDate || !next.successCriteria;
        return next;
      }),
    );
  };

  const addItem = (kind: 'goal' | 'task') => {
    const setter = kind === 'goal' ? setGoals : setTasks;
    setter((prev) => [
      ...prev,
      {
        id: `${kind}_manual_${Date.now()}`,
        title: '',
        successCriteria: null,
        dueDate: null,
        estimatedMinutes: null,
        priority: 'normal',
        sourceSegmentIds: [],
        needsReview: true,
        state: 'ai_suggested',
        selected: true,
      },
    ]);
    setEditing(true);
  };

  // --- 根拠発言へジャンプ ---------------------------------------------------

  const jumpToSegment = (segmentIds: string[]) => {
    const target = segmentIds[0];
    if (!target) return;
    setTranscriptOpen(true);
    setHighlightId(target);
    // details が開いてDOMが生えるのを待ってからスクロールする
    window.setTimeout(() => {
      segmentRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  };

  const renderEvidenced = (items: Evidenced[]) => (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span aria-hidden style={{ color: color.primary, lineHeight: 1.8, flex: '0 0 auto' }}>・</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ ...font.listItem, color: color.textBody, lineHeight: 1.8 }}>{item.title}</span>
            {item.sourceSegmentIds.length > 0 && (
              <button
                type="button"
                onClick={() => jumpToSegment(item.sourceSegmentIds)}
                style={{
                  ...font.link,
                  color: color.primary,
                  background: 'none',
                  border: 'none',
                  padding: '0 0 0 8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                この会話を見る
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );

  // --- 話者ラベルの一括変更 -------------------------------------------------

  const assignSpeakerRole = (speakerId: string, role: SpeakerRole) => {
    const next: TranscriptSegment[] = detail.segments.map((s) =>
      s.speakerId === speakerId ? { ...s, speakerRole: role } : s,
    );
    setDetail((d) => ({ ...d, segments: next }));
    void persist({ segments: next });
  };

  const speakerIds = useMemo(
    () => Array.from(new Set(detail.segments.map((s) => s.speakerId))),
    [detail.segments],
  );

  // --- 確定 -----------------------------------------------------------------

  const confirm = async () => {
    if (!userId || selectedItems.length === 0 || saving) return;

    if (selectedItems.some((g) => g.needsReview || !g.title.trim())) {
      // 会話で決まっていない期限・完了条件はAIに補完させていないので、ここで受講生に埋めてもらう
      setWarnNeedsReview(true);
      setEditing(true);
      showToast('期限と完了条件が未入力の項目があります', 'error');
      return;
    }
    setWarnNeedsReview(false);
    setSaving(true);

    try {
      await bffClient.updateCoachingSession(detail.id, { goals, tasks, studentMemo: memo });

      // 既存の学習目標に「追記」する（全件上書きすると既存の目標が消える）
      const current = await bffClient.getNextCoachingGoals(userId);
      const maxNo = current.reduce((max, g) => Math.max(max, g.no), 0);
      const merged = [
        ...current.map((g) => ({
          no: g.no,
          description: g.description,
          is_completed: g.is_completed,
          progress: g.progress,
        })),
        ...selectedItems.map((g, i) => ({
          no: maxNo + i + 1,
          description: g.dueDate ? `${g.title}（${formatDueDate(g.dueDate)}まで）` : g.title,
          is_completed: 0 as 0 | 1,
          progress: 0,
        })),
      ];
      await bffClient.updateNextCoachingGoals(userId, merged);

      const updated = await bffClient.confirmCoachingGoals(
        detail.id,
        selectedItems.map((g) => g.id),
      );
      setDetail(updated);
      setGoals(updated.summary?.goals ?? goals);
      setTasks(updated.summary?.tasks ?? tasks);
      setEditing(false);
      showToast(`${selectedItems.length}件を学習タスクに反映しました`, 'success');
      onReflected(updated);
    } catch {
      showToast('確定できませんでした', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeSession = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('この記録を削除しますか？ 音声と文字起こしも削除されます。')) return;
    try {
      await bffClient.deleteCoachingSession(detail.id);
      showToast('記録を削除しました', 'success');
      onDeleted();
    } catch {
      showToast('削除できませんでした', 'error');
    }
  };

  if (!summary) {
    return (
      <section style={{ ...t.card, padding: 24 }}>
        <p style={{ ...font.meta, color: color.textMuted, margin: 0 }}>
          この記録にはまだAIの整理結果がありません。
        </p>
      </section>
    );
  }

  // --- 目標・タスクのカード -------------------------------------------------

  const renderItemCard = (kind: 'goal' | 'task', item: GoalCandidate, index: number) => {
    const isReflected = reflected.has(item.id);
    const flagged = warnNeedsReview && item.selected && !isReflected && item.needsReview;
    const readOnly = isReflected || !editing;

    return (
      <div
        key={item.id}
        style={{
          border: `1px solid ${flagged ? NEEDS_INPUT : color.border}`,
          borderRadius: radius.md,
          padding: 16,
          background: isReflected ? color.pageBg : color.surface,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <input
            type="checkbox"
            checked={isReflected || item.selected}
            disabled={isReflected}
            onChange={(e) => patchItem(kind, item.id, { selected: e.target.checked })}
            style={{ marginTop: 5, accentColor: color.primary, flex: '0 0 auto' }}
            aria-label={`${index + 1}件目を選択`}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            {readOnly ? (
              <p
                style={{
                  ...font.listItem,
                  fontWeight: 700,
                  color: isReflected ? color.textMuted : color.text,
                  margin: 0,
                  textDecoration: isReflected ? 'line-through' : 'none',
                }}
              >
                {item.title || '（未入力）'}
              </p>
            ) : (
              <input
                type="text"
                value={item.title}
                placeholder={kind === 'goal' ? '目標を入力' : 'タスクを入力'}
                onChange={(e) => patchItem(kind, item.id, { title: e.target.value })}
                onBlur={() => persist({ goals, tasks })}
                style={{
                  width: '100%',
                  border: 'none',
                  borderBottom: `1px solid ${color.border}`,
                  background: 'transparent',
                  padding: '2px 0 6px',
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: color.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            )}

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ ...font.caption, color: item.dueDate ? color.textSubtle : NEEDS_INPUT }}>
                  期限{!item.dueDate && '（未設定）'}
                </span>
                {readOnly ? (
                  <span style={{ ...font.meta, color: item.dueDate ? color.textBody : NEEDS_INPUT }}>
                    {formatDueDate(item.dueDate)}
                  </span>
                ) : (
                  <input
                    type="date"
                    value={item.dueDate ?? ''}
                    onChange={(e) => patchItem(kind, item.id, { dueDate: e.target.value || null })}
                    onBlur={() => persist({ goals, tasks })}
                    style={{
                      border: `1px solid ${item.dueDate ? color.border : NEEDS_INPUT}`,
                      background: item.dueDate ? color.surface : NEEDS_INPUT_BG,
                      borderRadius: radius.sm,
                      padding: '6px 10px',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      color: color.text,
                      outline: 'none',
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 240px', minWidth: 0 }}>
                <span style={{ ...font.caption, color: item.successCriteria ? color.textSubtle : NEEDS_INPUT }}>
                  完了条件{!item.successCriteria && '（確認が必要）'}
                </span>
                {readOnly ? (
                  <span style={{ ...font.meta, color: item.successCriteria ? color.textBody : NEEDS_INPUT }}>
                    {item.successCriteria ?? '確認が必要'}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={item.successCriteria ?? ''}
                    placeholder="どうなったら完了か"
                    onChange={(e) => patchItem(kind, item.id, { successCriteria: e.target.value || null })}
                    onBlur={() => persist({ goals, tasks })}
                    style={{
                      border: `1px solid ${item.successCriteria ? color.border : NEEDS_INPUT}`,
                      background: item.successCriteria ? color.surface : NEEDS_INPUT_BG,
                      borderRadius: radius.sm,
                      padding: '6px 10px',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      color: color.text,
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {isReflected && (
                <span style={{ ...t.chip, background: '#E4F3EC', color: '#2F7F5B' }}>学習タスクに反映済み</span>
              )}
              {item.sourceSegmentIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => jumpToSegment(item.sourceSegmentIds)}
                  style={{
                    ...font.link,
                    color: color.primary,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  この{kind === 'goal' ? '目標' : 'タスク'}が決まった会話を見る
                </button>
              )}
              {editing && !isReflected && (
                <button
                  type="button"
                  onClick={() => {
                    const setter = kind === 'goal' ? setGoals : setTasks;
                    setter((prev) => {
                      const next = prev.filter((g) => g.id !== item.id);
                      void persist(kind === 'goal' ? { goals: next } : { tasks: next });
                      return next;
                    });
                  }}
                  style={{
                    ...font.link,
                    color: color.textSubtle,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  削除
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const sectionCard = { ...t.card, padding: 24 } as React.CSSProperties;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ---- 今回のまとめ ---- */}
      <section style={sectionCard}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>今回のまとめ</h2>
          <span style={{ ...font.caption, color: color.textSubtle }}>
            {detail.date}
            {detail.importedFrom === 'auto'
              ? ' ・ 自動取得'
              : detail.source && ` ・ ${RECORDING_SOURCE_LABEL[detail.source]}から作成`}
          </span>
        </div>
        <p style={{ ...font.listItem, color: color.textBody, lineHeight: 1.9, margin: '14px 0 0' }}>
          {summary.sessionSummary}
        </p>
      </section>

      {/* ---- 前回からの進捗 ---- */}
      {summary.progressSinceLast.length > 0 && (
        <section style={sectionCard}>
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 14px' }}>前回からの進捗</h2>
          {renderEvidenced(summary.progressSinceLast)}
        </section>
      )}

      {/* ---- コーチからのフィードバック ---- */}
      {summary.coachFeedback.length > 0 && (
        <section style={sectionCard}>
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 14px' }}>コーチからのフィードバック</h2>
          {renderEvidenced(summary.coachFeedback)}
        </section>
      )}

      {/* ---- 決まったこと ---- */}
      {summary.decisions.length > 0 && (
        <section style={sectionCard}>
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 14px' }}>決まったこと</h2>
          {renderEvidenced(summary.decisions)}
        </section>
      )}

      {/* ---- 次回までの目標 ---- */}
      <section style={sectionCard}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 14px' }}>次回までの目標</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {goals.map((g, i) => renderItemCard('goal', g, i))}
        </div>
        {editing && (
          <button type="button" onClick={() => addItem('goal')} style={{ ...t.ghostButton, marginTop: 12 }}>
            ＋ 目標を追加
          </button>
        )}
      </section>

      {/* ---- 次回までのタスク ---- */}
      <section style={sectionCard}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 14px' }}>次回までのタスク</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tasks.map((g, i) => renderItemCard('task', g, i))}
        </div>
        {editing && (
          <button type="button" onClick={() => addItem('task')} style={{ ...t.ghostButton, marginTop: 12 }}>
            ＋ タスクを追加
          </button>
        )}
      </section>

      {/* ---- 次回確認すること ---- */}
      {summary.nextSessionAgenda.length > 0 && (
        <section style={sectionCard}>
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 14px' }}>次回確認すること</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {summary.nextSessionAgenda.map((a, i) => (
              <li key={i} style={{ ...font.listItem, color: color.textBody, display: 'flex', gap: 10, lineHeight: 1.8 }}>
                <span aria-hidden style={{ color: color.primary }}>・</span>
                {a}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- 確認・確定 ---- */}
      <section style={{ ...sectionCard, border: `1px solid ${color.primaryBorder}`, background: color.primaryTint }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <Sparkles className="w-4 h-4" style={{ color: color.primary, flexShrink: 0, marginTop: 3 }} />
          <div>
            <p style={{ ...font.rowTitle, color: color.text, margin: 0 }}>AIが今回の内容を整理しました</p>
            <p style={{ ...font.caption, color: color.textBody, margin: '4px 0 0', lineHeight: 1.9 }}>
              内容に誤りがないか確認してください。確定すると、選んだ目標とタスクが学習タスクに反映されます。
            </p>
          </div>
        </div>

        {warnNeedsReview && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              background: NEEDS_INPUT_BG,
              border: `1px solid #F0DDB8`,
              borderRadius: radius.md,
              padding: '12px 14px',
              marginBottom: 14,
            }}
          >
            <AlertTriangle className="w-4 h-4" style={{ color: NEEDS_INPUT, flexShrink: 0, marginTop: 2 }} />
            <p style={{ ...font.caption, color: '#8A5A10', margin: 0, lineHeight: 1.9 }}>
              会話から読み取れなかった項目があります。期限と完了条件を入力してから確定してください。
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            style={{ ...t.ghostButton, width: 'auto', background: color.surface }}
          >
            {editing ? '編集を終える' : '内容を編集'}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={allReflected || selectedItems.length === 0 || saving}
            style={{
              ...t.primaryButton,
              padding: '14px 24px',
              opacity: allReflected || selectedItems.length === 0 || saving ? 0.5 : 1,
              cursor: allReflected || selectedItems.length === 0 || saving ? 'not-allowed' : 'pointer',
            }}
          >
            {allReflected
              ? 'すべて反映済みです'
              : saving
                ? '確定しています…'
                : `この内容で確定（${selectedItems.length}件）`}
          </button>
        </div>
      </section>

      {/* ---- 自分のメモ ---- */}
      <section style={sectionCard}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 10px' }}>自分のメモ</h2>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={() => persist({ studentMemo: memo })}
          rows={4}
          placeholder="気づいたこと、あとで見返したいことを自由に書けます（自動保存されます）"
          style={{
            width: '100%',
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            padding: 14,
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1.8,
            color: color.text,
            background: color.surface,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </section>

      {/* ---- 参照した情報 ---- */}
      {summary.referencedContext.length > 0 && (
        <section style={{ ...t.card, padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Info className="w-4 h-4" style={{ color: color.textSubtle }} />
            <h2 style={{ ...font.rowTitle, color: color.textStrong, margin: 0 }}>整理に使った情報</h2>
          </div>
          <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 10px', lineHeight: 1.8 }}>
            会話だけでなく、あなたの学習状況も踏まえて整理しています。
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {summary.referencedContext.map((c) => (
              <span key={c} style={{ ...t.chip, background: color.pageBg, color: color.textMuted }}>
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ---- 文字起こし（折りたたみ） ---- */}
      <section style={{ ...t.card, padding: '6px 24px' }}>
        <details open={transcriptOpen} onToggle={(e) => setTranscriptOpen((e.target as HTMLDetailsElement).open)}>
          <summary
            style={{
              ...font.rowTitle,
              color: color.textStrong,
              cursor: 'pointer',
              padding: '16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ChevronDown className="w-4 h-4" />
            文字起こしを見る（{detail.segments.length}件の発言）
          </summary>

          {speakerIds.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingBottom: 14 }}>
              {speakerIds.map((sid) => {
                const role = detail.segments.find((s) => s.speakerId === sid)?.speakerRole ?? 'unknown';
                return (
                  <label key={sid} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ ...font.caption, color: color.textSubtle }}>
                      {sid === 'unknown' ? '話者不明' : `話者${sid.replace('speaker_', '')}`}
                    </span>
                    <select
                      value={role}
                      onChange={(e) => assignSpeakerRole(sid, e.target.value as SpeakerRole)}
                      style={{
                        border: `1px solid ${color.border}`,
                        borderRadius: radius.sm,
                        padding: '4px 8px',
                        fontFamily: 'inherit',
                        fontSize: 12.5,
                        color: color.text,
                        background: color.surface,
                      }}
                    >
                      <option value="unknown">未設定</option>
                      <option value="coach">コーチ</option>
                      <option value="student">自分</option>
                    </select>
                  </label>
                );
              })}
            </div>
          )}

          <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {detail.segments.map((seg) => (
              <li
                key={seg.id}
                ref={(el) => {
                  segmentRefs.current[seg.id] = el;
                }}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: radius.sm,
                  background: highlightId === seg.id ? color.primarySoft : 'transparent',
                  border: `1px solid ${highlightId === seg.id ? color.primaryBorder : 'transparent'}`,
                  transition: 'background 240ms ease',
                }}
              >
                <span style={{ ...font.caption, color: color.textFaint, flex: '0 0 44px', paddingTop: 2 }}>
                  {formatTimecode(seg.startMs)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      ...font.caption,
                      fontWeight: 700,
                      color: seg.speakerRole === 'coach' ? color.primary : color.textSecondary,
                      display: 'block',
                      marginBottom: 2,
                    }}
                  >
                    {speakerLabel(seg.speakerId, seg.speakerRole)}
                  </span>
                  <span style={{ ...font.meta, color: color.textBody, lineHeight: 1.8 }}>{seg.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* ---- 記録の管理 ---- */}
      <section style={sectionCard}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 12px' }}>記録の管理</h2>
        <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 12px' }}>音声の保存期間</p>
        {(
          [
            ['keep_30d', '音声を30日間保存する'],
            ['delete_after_summary', '要約が終わったら音声を削除する'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="radio"
              name={`retention-${detail.id}`}
              checked={detail.audioRetention === value}
              disabled={!detail.hasAudio && value === 'keep_30d'}
              onChange={() => persist({ audioRetention: value as AudioRetention })}
              style={{ accentColor: color.primary }}
            />
            <span style={{ ...font.meta, color: color.textBody }}>{label}</span>
          </label>
        ))}
        {!detail.hasAudio && (
          <p style={{ ...font.caption, color: color.textSubtle, margin: '4px 0 0' }}>
            この記録には音声データがありません。
          </p>
        )}

        <button
          type="button"
          onClick={removeSession}
          style={{
            ...font.link,
            color: color.textSubtle,
            background: 'none',
            border: 'none',
            padding: 0,
            marginTop: 18,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          この記録を削除する
        </button>
      </section>
    </div>
  );
}

export default SessionReview;
