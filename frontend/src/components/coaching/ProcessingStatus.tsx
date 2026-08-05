/**
 * コーチング終了後、AIノートを生成している間の進捗表示。
 * セッション詳細を1秒間隔でポーリングし、状態の遷移を段階リストで見せる。
 *
 * 本番では 録画取得 → 文字起こし → 要約 がそれぞれ別ワーカーで走るため、
 * 「どこまで進んだか」「どこで失敗したか」が分かる表示になっている必要がある。
 */
import React, { useEffect, useRef, useState } from 'react';
import bffClient from '../../services/bffClient';
import { color, font, t } from '../../theme/webcoachTheme';
import type { CoachingSessionDetail, RecordingSource, SessionStatus } from '../../types/coaching';

/** 文字起こしが既に手元にある経路では transcribing 工程が出てこない */
function stepsFor(source: RecordingSource | null): Array<{ status: SessionStatus; label: string }> {
  const needsTranscription = source === 'auto_recording' || source === 'uploaded_audio';
  return [
    {
      status: 'uploading',
      label: source === 'auto_recording' ? '録画データを取得しました' : '記録を保存しました',
    },
    ...(needsTranscription ? [{ status: 'transcribing' as SessionStatus, label: '文字起こしを作成しました' }] : []),
    { status: 'summarizing', label: 'AIが内容を整理しています' },
    { status: 'review_required', label: '目標を確認できます' },
  ];
}

const ORDER: SessionStatus[] = [
  'draft',
  'recording',
  'uploading',
  'transcribing',
  'summarizing',
  'review_required',
  'published',
];

interface ProcessingStatusProps {
  session: CoachingSessionDetail;
  /** 生成が終わって確認できる状態になったら呼ぶ */
  onDone: (session: CoachingSessionDetail) => void;
  /** 失敗して手動取り込みに倒すとき */
  onFallback: (session: CoachingSessionDetail) => void;
}

export function ProcessingStatus({ session, onDone, onFallback }: ProcessingStatusProps) {
  const [current, setCurrent] = useState<CoachingSessionDetail>(session);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setCurrent(session);
    if (session.status === 'failed') return undefined;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const latest = await bffClient.getCoachingSession(session.id);
        if (cancelled) return;
        setCurrent(latest);
        if (latest.status === 'review_required' || latest.status === 'published' || latest.status === 'failed') {
          clearInterval(timer);
          if (latest.status !== 'failed') onDoneRef.current(latest);
        }
      } catch {
        /* 一時的な失敗はポーリング継続で吸収する */
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session]);

  if (current.status === 'failed') {
    return (
      <section style={{ ...t.card, padding: 24 }}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 8px' }}>
          記録を取得できませんでした
        </h2>
        <p style={{ ...font.meta, color: color.textBody, margin: '0 0 18px', lineHeight: 1.9 }}>
          {current.error || '処理中にエラーが発生しました。'}
        </p>
        <button
          type="button"
          style={{ ...t.primaryButton, display: 'inline-flex' }}
          onClick={() => onFallback(current)}
        >
          記録を手動で取り込む
        </button>
      </section>
    );
  }

  const steps = stepsFor(current.source);
  const currentIndex = ORDER.indexOf(current.status);

  return (
    <section style={{ ...t.card, padding: 24 }}>
      <h2 style={{ ...font.sectionTitle, color: color.text, margin: '0 0 4px' }}>
        AIコーチングノートを作成しています
      </h2>
      <p style={{ ...font.meta, color: color.textMuted, margin: '0 0 18px', lineHeight: 1.8 }}>
        コーチング内容から、要約・決定事項・次回までのタスクを整理しています。
      </p>

      <div style={{ height: 6, background: color.trackBg, borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
        <div
          style={{
            height: '100%',
            width: `${current.progress}%`,
            background: color.primary,
            borderRadius: 999,
            transition: 'width 400ms ease',
          }}
        />
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step) => {
          const stepIndex = ORDER.indexOf(step.status);
          const done = stepIndex < currentIndex;
          const active = stepIndex === currentIndex;
          return (
            <li key={step.status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  flex: '0 0 18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 900,
                  color: done || active ? '#fff' : 'transparent',
                  background: done || active ? color.primary : 'transparent',
                  border: done || active ? 'none' : `2px solid ${color.borderNeutral}`,
                  boxSizing: 'border-box',
                  animation: active ? 'coaching-pulse 1.2s ease-in-out infinite' : undefined,
                }}
              >
                {done ? '✓' : active ? '●' : ''}
              </span>
              <span
                style={{
                  ...font.listItem,
                  color: done ? color.textMuted : active ? color.text : color.textFaint,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      <style>{'@keyframes coaching-pulse{0%,100%{opacity:1}50%{opacity:.45}}'}</style>
    </section>
  );
}

export default ProcessingStatus;
