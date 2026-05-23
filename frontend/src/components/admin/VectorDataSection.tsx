import React, { useState, useEffect } from 'react';
import { bffClient } from '../../services/bffClient';

type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

const sectionBoxStyle: React.CSSProperties = {
  border: '1px solid #f0f0f0',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '24px',
  backgroundColor: '#fafafa',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '700',
  color: '#212121',
  marginBottom: '16px',
};

const buttonStyle = (status: ApiStatus): React.CSSProperties => ({
  padding: '10px 24px',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '700',
  cursor: status === 'loading' ? 'not-allowed' : 'pointer',
  background: status === 'loading'
    ? '#bdbdbd'
    : 'linear-gradient(135deg, #E86D78, #FA9262)',
  color: '#fff',
  opacity: status === 'loading' ? 0.7 : 1,
});

const statusBoxStyle = (status: ApiStatus): React.CSSProperties => ({
  marginTop: '12px',
  padding: '12px 16px',
  borderRadius: '8px',
  fontSize: '13px',
  display: status === 'idle' ? 'none' : 'block',
  backgroundColor: status === 'success' ? '#e8f5e9' : status === 'error' ? '#fdecea' : '#e3f2fd',
  color: status === 'success' ? '#2e7d32' : status === 'error' ? '#c62828' : '#1565c0',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
});

const IngestSection: React.FC<{
  title: string;
  buttonLabel: string;
  onSubmit: () => Promise<any>;
}> = ({ title, buttonLabel, onSubmit }) => {
  const [status, setStatus] = useState<ApiStatus>('idle');
  const [message, setMessage] = useState('');

  // ブラウザ離脱（リロード・タブ閉じ）への警告
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (status === 'loading') e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  const handleSubmit = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const data = await onSubmit();
      setStatus('success');
      const lines: string[] = [];
      if (data?.message) lines.push(data.message);
      if (data?.files_processed != null) lines.push(`処理ファイル数: ${data.files_processed}`);
      if (data?.documents_added != null) lines.push(`登録ドキュメント数: ${data.documents_added}`);
      if (data?.faiss_total_vectors != null) lines.push(`ベクトルDB総数: ${data.faiss_total_vectors}`);
      if (data?.errors) lines.push(`エラー: ${JSON.stringify(data.errors)}`);
      setMessage(lines.join('\n') || '完了しました');
    } catch (err: any) {
      setStatus('error');
      const data = err?.response?.data;
      setMessage(
        typeof data === 'object' && data !== null
          ? (data.message ?? data.error ?? JSON.stringify(data, null, 2))
          : (err instanceof Error ? err.message : '通信エラーが発生しました')
      );
    }
  };

  return (
    <div style={sectionBoxStyle}>
      <div style={sectionTitleStyle}>{title}</div>
      <button style={buttonStyle(status)} onClick={handleSubmit} disabled={status === 'loading'}>
        {status === 'loading' ? '登録中...' : buttonLabel}
      </button>
      <div style={statusBoxStyle(status)}>
        {status === 'loading' ? 'APIを呼び出しています...' : message}
      </div>
    </div>
  );
};

export const VectorDataSection: React.FC = () => {
  return (
    <div>
      <IngestSection
        title="当日追加した教材を登録"
        buttonLabel="当日の教材を登録"
        onSubmit={() => bffClient.faissIngestToday()}
      />
      <IngestSection
        title="全教材を登録"
        buttonLabel="全教材を登録"
        onSubmit={() => bffClient.faissIngestAll()}
      />
    </div>
  );
};
