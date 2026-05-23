import React from 'react';
import { DataType } from '../../types/admin';

interface DataTypeSelectorProps {
  selectedType: DataType;
  onTypeChange: (type: DataType) => void;
}

const dataTypeOptions: Array<{ value: DataType; label: string; description: string }> = [
  {
    value: 'users',
    label: 'ユーザー',
    description: 'ユーザープロフィール・コースアクセス履歴'
  },
  {
    value: 'courses',
    label: 'ロードマップ',
    description: '学習ロードマップの一括登録・更新'
  },
  {
    value: 'enrollments',
    label: 'ロードマップステップ',
    description: 'ロードマップに紐づくコース情報'
  },
  {
    value: 'categories',
    label: 'カテゴリ',
    description: '（未実装）'
  }
];

export const DataTypeSelector: React.FC<DataTypeSelectorProps> = ({
  selectedType,
  onTypeChange
}) => {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>
        データタイプを選択
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {dataTypeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onTypeChange(option.value)}
            style={{
              padding: '16px',
              border: `2px solid ${selectedType === option.value ? '#1976d2' : '#e0e0e0'}`,
              borderRadius: '8px',
              backgroundColor: selectedType === option.value ? '#e3f2fd' : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseOver={(e) => {
              if (selectedType !== option.value) {
                e.currentTarget.style.borderColor = '#bdbdbd';
              }
            }}
            onMouseOut={(e) => {
              if (selectedType !== option.value) {
                e.currentTarget.style.borderColor = '#e0e0e0';
              }
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '4px', color: '#212121' }}>
              {option.label}
            </div>
            <div style={{ fontSize: '12px', color: '#757575' }}>
              {option.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
