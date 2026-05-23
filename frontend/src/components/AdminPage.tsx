import React, { useState } from 'react';
import { DataType, UploadHistory as UploadHistoryType, UploadResult as UploadResultType } from '../types/admin';
import { DataTypeSelector } from './admin/DataTypeSelector';
import { CsvUploader } from './admin/CsvUploader';
import { UploadResult } from './admin/UploadResult';
import { UploadHistory } from './admin/UploadHistory';
import { S3ImageUploader } from './admin/S3ImageUploader';
import { VectorDataSection } from './admin/VectorDataSection';
import { bffClient } from '../services/bffClient';

type AdminTab = 'csv' | 's3' | 'vector';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('csv');
  const [selectedDataType, setSelectedDataType] = useState<DataType>('users');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResultType | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryType[]>([]);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadResult(null);

    try {
      // CSVファイルを読み込む
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        throw new Error('CSVファイルが空です');
      }

      // ヘッダー行を取得
      const headers = lines[0].split(',').map(h => h.trim());

      // データ行をパース
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const record: Record<string, string> = {};

        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });

        records.push(record);
      }

      console.log(`[AdminPage] Parsed ${records.length} records from CSV`);

      // BFF経由でFastAPIにリクエスト
      const result = await bffClient.updateDatabase({ data_type: selectedDataType, records });

      const uploadResult: UploadResultType = {
        success: result.success,
        recordsProcessed: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
        message: result.message,
        errors: result.errors?.map((e: any) => ({
          row: e.row,
          message: e.message
        }))
      };

      setUploadResult(uploadResult);

      // 履歴に追加
      const newHistoryItem: UploadHistoryType = {
        id: Date.now().toString(),
        dataType: selectedDataType,
        filename: file.name,
        uploadedAt: new Date(),
        status: uploadResult.success ? 'success' : 'failed',
        recordsProcessed: uploadResult.recordsProcessed,
        recordsFailed: uploadResult.recordsFailed,
        errorMessage: uploadResult.success ? undefined : uploadResult.message
      };

      setUploadHistory(prev => [newHistoryItem, ...prev]);

    } catch (error) {
      console.error('[AdminPage] Upload error:', error);
      const errorResult: UploadResultType = {
        success: false,
        recordsProcessed: 0,
        recordsFailed: 0,
        message: error instanceof Error ? error.message : 'アップロード中にエラーが発生しました'
      };
      setUploadResult(errorResult);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6" style={{ backgroundColor: '#fafafa', minHeight: '100vh' }}>
      <div className="p-4 sm:p-8" style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#212121', marginBottom: '8px' }}>
            管理画面
          </h1>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '28px', borderBottom: '2px solid #f0f0f0' }}>
          {([
            { key: 'csv',    label: 'CSVアップロード' },
            { key: 's3',     label: '画像アップロード' },
            { key: 'vector', label: 'Vectorデータ設定' },
          ] as { key: AdminTab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderBottom: `3px solid ${activeTab === tab.key ? '#e86d78' : 'transparent'}`,
                backgroundColor: 'transparent',
                fontSize: '14px',
                fontWeight: activeTab === tab.key ? '700' : '400',
                color: activeTab === tab.key ? '#e86d78' : '#757575',
                cursor: 'pointer',
                marginBottom: '-2px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CSVアップロードタブ */}
        {activeTab === 'csv' && (
          <>
            <DataTypeSelector
              selectedType={selectedDataType}
              onTypeChange={setSelectedDataType}
            />
            <UploadResult
              result={uploadResult}
              onClose={() => setUploadResult(null)}
            />
            <CsvUploader
              onUpload={handleUpload}
              isUploading={isUploading}
            />
            <UploadHistory history={uploadHistory} />
          </>
        )}

        {/* 画像アップロードタブ */}
        {activeTab === 's3' && <S3ImageUploader />}

        {/* Vectorデータ設定タブ */}
        {activeTab === 'vector' && <VectorDataSection />}
      </div>
    </div>
  );
};
