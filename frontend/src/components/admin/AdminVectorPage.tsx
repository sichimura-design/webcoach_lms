import React from 'react';
import { VectorDataSection } from './VectorDataSection';

export const AdminVectorPage: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-brand-text">
        Vectorデータ設定
      </h2>
      <p className="text-sm mb-6 text-brand-muted">
        教材コンテンツをFAISSベクトルDBに登録します。AIコーチ機能の検索精度向上に使用されます。
      </p>
      <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E8E0DA' }}>
        <VectorDataSection />
      </div>
    </div>
  );
};
