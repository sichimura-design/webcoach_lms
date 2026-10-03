import React from 'react';
import { VectorDataSection } from './VectorDataSection';

export const AdminVectorPage: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-brand-text">
        Vectorデータ設定
      </h2>
      <p className="text-sm mb-6 text-brand-muted">
        AIコーチが教材の内容をもとに答えるための、教材の検索用データを登録します。
      </p>
      <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E8E0DA' }}>
        <VectorDataSection />
      </div>
    </div>
  );
};
