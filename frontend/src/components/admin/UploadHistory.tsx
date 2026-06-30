import React from 'react';
import { UploadHistory as UploadHistoryType } from '../../types/admin';

interface UploadHistoryProps {
  history: UploadHistoryType[];
}

const statusColors = {
  success: { bg: '#e8f5e9', text: '#2e7d32', icon: '✅' },
  failed: { bg: '#ffebee', text: '#c62828', icon: '❌' },
  processing: { bg: '#fff3e0', text: '#e65100', icon: '⏳' }
};

const dataTypeLabels: Record<string, string> = {
  'moodle-courses': 'Moodleコース',
  users: 'ユーザー',
  courses: 'コース',
  enrollments: '受講登録',
  categories: 'カテゴリ',
  'coach-mapping': 'コーチ割り当て',
};

export const UploadHistory: React.FC<UploadHistoryProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
          アップロード履歴
        </h3>
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: '#fafafa',
            borderRadius: '8px',
            color: '#9e9e9e'
          }}
        >
          アップロード履歴はありません
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
        アップロード履歴
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: '#fff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#616161' }}>
                ステータス
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#616161' }}>
                データタイプ
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#616161' }}>
                ファイル名
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#616161' }}>
                処理件数
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#616161' }}>
                失敗件数
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#616161' }}>
                アップロード日時
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => {
              const statusStyle = statusColors[item.status];
              return (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: '1px solid #f5f5f5'
                  }}
                >
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.text,
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      <span>{statusStyle.icon}</span>
                      {item.status === 'success' && '成功'}
                      {item.status === 'failed' && '失敗'}
                      {item.status === 'processing' && '処理中'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#424242' }}>
                    {dataTypeLabels[item.dataType]}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#424242' }}>
                    {item.filename}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#424242' }}>
                    {item.recordsProcessed}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: item.recordsFailed > 0 ? '#d32f2f' : '#424242' }}>
                    {item.recordsFailed}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#757575' }}>
                    {new Date(item.uploadedAt).toLocaleString('ja-JP')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
