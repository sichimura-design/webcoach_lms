import React, { useState } from 'react';
import { UploadResult as UploadResultType } from '../../types/admin';

interface UploadResultProps {
  result: UploadResultType | null;
  onClose: () => void;
}

export const UploadResult: React.FC<UploadResultProps> = ({ result, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!result) return null;

  const handleCopyErrors = async () => {
    if (!result.errors || result.errors.length === 0) return;
    const text = result.errors
      .map((e) => `行 ${e.row}: ${e.message}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div
        style={{
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: result.success ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${result.success ? '#4caf50' : '#f44336'}`
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: result.success ? '#2e7d32' : '#c62828',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '24px' }}>{result.success ? '✅' : '❌'}</span>
              {result.success ? 'アップロード成功' : 'アップロード失敗'}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', color: '#424242', marginBottom: '8px' }}>
                <strong>処理件数:</strong> {result.recordsProcessed} 件
              </div>
              {result.recordsFailed > 0 && (
                <div style={{ fontSize: '14px', color: '#d32f2f', marginBottom: '8px' }}>
                  <strong>失敗件数:</strong> {result.recordsFailed} 件
                </div>
              )}
              {result.message && (
                <div style={{ fontSize: '14px', color: '#616161', marginTop: '8px' }}>
                  {result.message}
                </div>
              )}
            </div>

            {result.errors && result.errors.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#212121' }}>
                    エラー詳細:
                  </div>
                  <button
                    onClick={handleCopyErrors}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      backgroundColor: copied ? '#e8f5e9' : '#fff',
                      color: copied ? '#2e7d32' : '#757575',
                      border: `1px solid ${copied ? '#4caf50' : '#bdbdbd'}`,
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {copied ? '✓ コピー済み' : '📋 コピー'}
                  </button>
                </div>
                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    overflowX: 'auto',
                    backgroundColor: '#fff',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0'
                  }}
                >
                  {result.errors.map((error, index) => (
                    <div
                      key={index}
                      style={{
                        fontSize: '13px',
                        color: '#424242',
                        padding: '6px 0',
                        borderBottom: index < result.errors!.length - 1 ? '1px solid #f5f5f5' : 'none'
                      }}
                    >
                      <strong>行 {error.row}:</strong> {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              marginLeft: '16px',
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#757575',
              lineHeight: 1
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#424242';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = '#757575';
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
