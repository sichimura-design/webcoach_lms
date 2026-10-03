import React, { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '../../services/bffClient';
import { getUserMessage } from '../../utils/errorMessage';
import type { MaterialIndexRebuildStatus } from '../../types/materialIndex';
import { color, font, radius } from '../../theme/webcoachTheme';

const POLL_INTERVAL_MS = 3000;

const PHASE_LABEL: Record<string, string> = {
  starting: '開始しています',
  listing: 'Moodleから教材の一覧を取得しています',
  fetching: '教材ページを取得しています',
  indexing: '索引を保存しています',
};

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '10px 24px',
  border: 'none',
  borderRadius: radius.sm,
  ...font.label,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? color.borderNeutral : color.primary,
  color: color.textOnPrimary,
});

const STATUS_TONE = {
  info: { background: color.hoverBg, color: color.textBody },
  success: { background: color.successSurface, color: color.success },
  error: { background: color.primarySoft, color: color.primary },
};

const statusBoxStyle = (tone: keyof typeof STATUS_TONE): React.CSSProperties => ({
  marginTop: 12,
  padding: '12px 16px',
  borderRadius: radius.sm,
  ...font.meta,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  ...STATUS_TONE[tone],
});

function describeRunning(job: MaterialIndexRebuildStatus): string {
  const phase = PHASE_LABEL[job.phase ?? 'starting'] ?? '処理しています';
  if (job.phase === 'fetching' && job.total_pages) {
    return `${phase}（${job.fetched_pages ?? 0} / ${job.total_pages} ページ）`;
  }
  return phase;
}

function describeResult(job: MaterialIndexRebuildStatus): string {
  const r = job.result;
  if (!r) return '完了しました';
  const lines = [
    `完了しました（登録した教材: ${r.files_processed}件 / 検索用の区切り: ${r.documents_added}件）`,
  ];
  if (r.errors?.length) {
    lines.push(`取得できなかった教材が${r.errors.length}件あります:`);
    lines.push(...r.errors.slice(0, 10));
    if (r.errors.length > 10) lines.push(`ほか${r.errors.length - 10}件`);
  }
  return lines.join('\n');
}

/**
 * AIコーチの教材検索用の索引を、Moodleの各コースに登録された教材から作り直す。
 * 時間がかかるので開始だけして、完了までは進み具合を問い合わせて表示する。
 */
export const VectorDataSection: React.FC = () => {
  const [job, setJob] = useState<MaterialIndexRebuildStatus | null>(null);
  const [requestError, setRequestError] = useState('');
  const timerRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    try {
      const next = await bffClient.getFaissIngestStatus();
      setJob(next);
      if (next.status === 'running') {
        timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (err) {
      // 一時的な失敗では止めず、次の問い合わせで回復させる
      console.error('Failed to get material index status:', err);
      timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
    }
  }, []);

  // 画面を開き直したときも、実行中なら進み具合の表示を続ける
  useEffect(() => {
    poll();
    return stopPolling;
  }, [poll]);

  const running = job?.status === 'running';

  const handleStart = async () => {
    setRequestError('');
    stopPolling();
    try {
      setJob(await bffClient.faissIngestAll());
      timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
    } catch (err) {
      console.error('Failed to start material index rebuild:', err);
      setRequestError(getUserMessage(err, '教材の登録を開始できませんでした'));
      poll();
    }
  };

  let statusBox: React.ReactNode = null;
  if (requestError) {
    statusBox = <div style={statusBoxStyle('error')}>{requestError}</div>;
  } else if (job?.status === 'running') {
    statusBox = <div style={statusBoxStyle('info')}>{describeRunning(job)}</div>;
  } else if (job?.status === 'succeeded') {
    statusBox = <div style={statusBoxStyle(job.result?.errors?.length ? 'info' : 'success')}>{describeResult(job)}</div>;
  } else if (job?.status === 'failed') {
    statusBox = <div style={statusBoxStyle('error')}>{`登録に失敗しました: ${job.error ?? ''}`}</div>;
  }

  return (
    <div style={{ fontFamily: font.family }}>
      <div style={{ ...font.rowTitle, color: color.textStrong, marginBottom: 8 }}>全教材を登録</div>
      <p style={{ ...font.meta, color: color.textSecondary, margin: '0 0 16px' }}>
        Moodleの各コースに登録されている教材を読み込み、コースごとに検索できるよう登録し直します。
        今の登録内容はすべて置き換わります。数分かかることがあり、この画面を閉じても処理は続きます。
      </p>
      <button style={buttonStyle(running)} onClick={handleStart} disabled={running}>
        {running ? '登録中...' : '全教材を登録'}
      </button>
      {statusBox}
    </div>
  );
};
