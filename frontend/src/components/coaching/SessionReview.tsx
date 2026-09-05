/**
 * コーチング記録（1回分）の表示。
 *
 * カード構成:
 *   見出し「コーチング記録（M/D）」
 *   → ①今回のまとめ（会話の要点まで含む）
 *   → ②次回までにやること（チェックリスト）
 *   → ③自分のメモ（マイノート）
 *   → ④文字起こし・記録の管理（折りたたみ）
 *
 * 🔴 この画面は「読む場所」であって「直す場所」ではない。
 *    以前はここに 期限・完了条件の入力、項目の追加/削除、「この内容で確定」まで
 *    載っていて、1回分の記録を読み返すだけなのに操作の選択肢が多すぎた。
 *    学習目標への反映と編集は /coaching の NextActionsCard が持っているので、
 *    ここには持ち込まないこと。
 *
 * 🔴 ①の小見出し（「前回からの進捗」など）は固定文言にしない。
 *    何が話されたかは回によって違うので、見出しは summary.highlights として
 *    AIが回ごとに付ける。旧4項目しか無い記録は下の conversationBlocks で補う。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
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
  SummaryHighlight,
  TranscriptSegment,
} from '../../types/coaching';
import type { NoteSummary } from '../../types/notes';

interface SessionReviewProps {
  session: CoachingSessionDetail;
  onDeleted: () => void;
}

/** 記録の見出しに出す日付。「コーチング記録（7/20）」の括弧の中 */
function formatRecordDate(iso: string): string {
  const [, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${Number(m)}/${Number(d)}`;
}

export function SessionReview({ session, onDeleted }: SessionReviewProps) {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<CoachingSessionDetail>(session);
  const [goals, setGoals] = useState<GoalCandidate[]>(session.summary?.goals ?? []);
  const [tasks, setTasks] = useState<GoalCandidate[]>(session.summary?.tasks ?? []);
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const segmentRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    setDetail(session);
    setGoals(session.summary?.goals ?? []);
    setTasks(session.summary?.tasks ?? []);
  }, [session]);

  /** この回に取ったノート。「自分のメモ」はマイノート側を正典にする */
  useEffect(() => {
    let alive = true;
    setNotes(null);
    bffClient
      .listNotes({ coachingSessionId: session.id })
      .then((list) => { if (alive) setNotes(list); })
      .catch(() => { if (alive) setNotes([]); });
    return () => { alive = false; };
  }, [session.id]);

  const summary = detail.summary;

  /*
   * 表示上は目標とタスクを1リストにする（読む側にとって「次回までにやること」は1つの束で、
   * どちらに分類されたかは関心が無い）。state を goals / tasks に分けたままなのは、
   * persist がその形で送るのと、チェックを戻すときに元の配列へ書き戻すため。
   */
  const actionItems = useMemo(
    () => [
      ...goals.map((item) => ({ kind: 'goal' as const, item })),
      ...tasks.map((item) => ({ kind: 'task' as const, item })),
    ],
    [goals, tasks],
  );
  const reflected = useMemo(() => new Set(detail.reflectedGoalIds), [detail.reflectedGoalIds]);

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

  /** チェック＝やり終えた印。ここでできる編集はこれだけ */
  const toggleDone = (kind: 'goal' | 'task', item: GoalCandidate, done: boolean) => {
    const nextState: GoalCandidate['state'] = done
      ? 'completed'
      : reflected.has(item.id)
        ? 'student_confirmed'
        : 'ai_suggested';
    const apply = (prev: GoalCandidate[]) =>
      prev.map((g) => (g.id === item.id ? { ...g, state: nextState } : g));

    const nextGoals = kind === 'goal' ? apply(goals) : goals;
    const nextTasks = kind === 'task' ? apply(tasks) : tasks;
    setGoals(nextGoals);
    setTasks(nextTasks);
    void persist({ goals: nextGoals, tasks: nextTasks });
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

  const recordTitle = `コーチング記録（${formatRecordDate(detail.date)}）`;

  if (!summary) {
    return (
      <section style={{ ...t.card, padding: 24 }}>
        <h1 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 10px', fontSize: 22 }}>{recordTitle}</h1>
        <p style={{ ...font.meta, color: color.textMuted, margin: 0 }}>
          この記録にはまだAIの整理結果がありません。
        </p>
      </section>
    );
  }

  const sectionCard = { ...t.card, padding: 24 } as React.CSSProperties;

  /** 末尾の折りたたみ見出し */
  const disclosureSummary: React.CSSProperties = {
    ...font.rowTitle,
    color: color.textStrong,
    cursor: 'pointer',
    padding: '14px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  /*
   * 会話の要点。AIが付けた見出し（highlights）をそのまま使う。
   * 旧形式の記録（実BFFなど highlights を返さないもの）だけ、固定4項目から組み立てる。
   */
  const conversationBlocks: SummaryHighlight[] =
    summary.highlights && summary.highlights.length > 0
      ? summary.highlights
      : [
          { heading: '前回からの進捗', items: summary.progressSinceLast },
          { heading: 'コーチからのアドバイス', items: summary.coachFeedback },
          { heading: '決まったこと', items: summary.decisions },
          {
            heading: '次回に持ち越すこと',
            items: summary.nextSessionAgenda.map((title) => ({ title, sourceSegmentIds: [] })),
          },
        ].filter((b) => b.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ---- 見出し ---- */}
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3, color: color.text }}>
          {recordTitle}
        </h1>
        <p style={{ ...font.caption, color: color.textSubtle, margin: '6px 0 0' }}>
          {detail.coach}
          {detail.importedFrom === 'auto'
            ? ' ・ 自動取得'
            : detail.source && ` ・ ${RECORDING_SOURCE_LABEL[detail.source]}から作成`}
          {' ・ AIが整理'}
        </p>
      </div>

      {/* ---- ① 今回のまとめ（会話の要点まで1枚に） ---- */}
      <section style={sectionCard}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>今回のまとめ</h2>
        <p style={{ ...font.listItem, color: color.textBody, lineHeight: 1.9, margin: '14px 0 0' }}>
          {summary.sessionSummary}
        </p>

        {conversationBlocks.map((block, i) => (
          <div
            key={block.heading}
            style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: `1px solid ${color.border}`,
            }}
          >
            <h3 style={{ ...font.rowTitle, color: color.textStrong, margin: '0 0 10px' }}>{block.heading}</h3>
            {renderEvidenced(block.items)}
          </div>
        ))}
      </section>

      {/* ---- ② 次回までにやること ---- */}
      <section style={sectionCard}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 14px' }}>
          次回までにやること{actionItems.length > 0 && `（${actionItems.length}件）`}
        </h2>

        {actionItems.length === 0 ? (
          <p style={{ ...font.meta, color: color.textMuted, margin: 0 }}>
            この会話からは、次回までの目標・タスクが見つかりませんでした。
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {actionItems.map(({ kind, item }) => {
              const done = item.state === 'completed';
              return (
                <li key={item.id}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) => toggleDone(kind, item, e.target.checked)}
                      style={{ marginTop: 4, accentColor: color.primary, flex: '0 0 auto' }}
                    />
                    <span
                      style={{
                        ...font.listItem,
                        color: done ? color.textMuted : color.textBody,
                        lineHeight: 1.8,
                        textDecoration: done ? 'line-through' : 'none',
                      }}
                    >
                      {item.title || '（未入力の項目）'}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {/* 中身を直したり学習目標に反映したりするのはコーチングページ側の役目 */}
        <p style={{ ...font.caption, color: color.textMuted, margin: '14px 0 0', lineHeight: 1.9 }}>
          内容の修正や学習目標への反映は{' '}
          <button
            type="button"
            onClick={() => navigate('/coaching')}
            style={{ ...font.link, color: color.primary, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            コーチングページ
          </button>
          {' '}から行えます。
        </p>
      </section>

      {/* ---- ③ 自分のメモ（マイノート） ---- */}
      <section style={sectionCard}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 10px' }}>自分のメモ</h2>

        {notes === null ? (
          <p style={{ ...font.meta, color: color.textMuted, margin: 0 }}>読み込み中…</p>
        ) : notes.length === 0 ? (
          <p style={{ ...font.meta, color: color.textMuted, margin: 0, lineHeight: 1.9 }}>
            この回のノートはまだありません。
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/notes?note=${note.id}`)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.md,
                    background: color.surface,
                    padding: '12px 14px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ ...font.rowTitle, color: color.textStrong, display: 'block' }}>{note.title}</span>
                  {note.excerpt && (
                    <span
                      style={{
                        ...font.caption,
                        color: color.textMuted,
                        display: 'block',
                        marginTop: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {note.excerpt}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 書くのも直すのもマイノート側。ここに編集欄を戻さないこと */}
        <button
          type="button"
          onClick={() => navigate('/notes')}
          style={{
            ...font.link,
            color: color.primary,
            background: 'none',
            border: 'none',
            padding: 0,
            marginTop: 14,
            cursor: 'pointer',
          }}
        >
          マイノートで書く・編集する →
        </button>
      </section>

      {/* ---- ④ 文字起こし（と記録の管理） ---- */}
      <section style={{ ...t.card, padding: '4px 24px 10px' }}>
        <details
          open={transcriptOpen}
          onToggle={(e) => setTranscriptOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary style={disclosureSummary}>
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

        {/*
          🔴 「整理に使った情報」の折りたたみはここから外した（読む妨げになるだけだった）。
             残したのは音声保存期間と削除で、これを消すと記録を消す手段がUIから無くなる。
        */}
        <details style={{ borderTop: `1px solid ${color.border}` }}>
          <summary style={{ ...disclosureSummary, ...font.caption, color: color.textMuted }}>
            <ChevronDown className="w-4 h-4" />
            記録の管理
          </summary>
          <div style={{ paddingBottom: 18 }}>
            {/* 音声が無い記録では選ぶものが無い。無効のラジオを並べても意味が無いので出さない */}
            {detail.hasAudio ? (
              <>
                <p style={{ ...font.caption, color: color.textMuted, margin: '0 0 12px' }}>音声の保存期間</p>
                {(
                  [
                    ['keep_30d', '音声を30日間保存する'],
                    ['delete_after_summary', '要約が終わったら音声を削除する'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name={`retention-${detail.id}`}
                      checked={detail.audioRetention === value}
                      onChange={() => persist({ audioRetention: value as AudioRetention })}
                      style={{ accentColor: color.primary }}
                    />
                    <span style={{ ...font.meta, color: color.textBody }}>{label}</span>
                  </label>
                ))}
              </>
            ) : (
              <p style={{ ...font.meta, color: color.textMuted, margin: 0 }}>
                この記録には音声データがありません。文字起こしのみ保存されています。
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
          </div>
        </details>
      </section>
    </div>
  );
}

export default SessionReview;
