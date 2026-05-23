import React, { useState, useRef } from 'react';
import { UploadResult as UploadResultType } from '../../types/admin';
import { UploadResult } from './UploadResult';
import { bffClient } from '../../services/bffClient';
import { Button } from '../../components/ui/button';

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsvValue).join(',');
}

export const AdminCognitoUsersPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResultType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]?.name.endsWith('.csv')) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]?.name.endsWith('.csv')) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadResult(null);

    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) throw new Error('CSVファイルが空です');

      const headers = lines[0].split(',').map(h => h.trim());
      const FLAG_COLS = new Set(['updateFlag', 'deleteFlag']);
      const SKIP_COLS = new Set(['groupUpdateFlag']);
      const records = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const record: Record<string, string | number> = {};
        headers.forEach((header, index) => {
          if (SKIP_COLS.has(header)) return;
          const val = values[index] || '';
          record[header] = FLAG_COLS.has(header) ? Number(val) : val;
        });
        records.push(record);
      }

      const result = await bffClient.createCognitoUsers(records);
      setUploadResult({
        success: result.success,
        recordsProcessed: result.recordsProcessed,
        recordsFailed: result.recordsFailed,
        message: result.message,
        errors: result.errors,
      });
    } catch (error) {
      setUploadResult({
        success: false,
        recordsProcessed: 0,
        recordsFailed: 0,
        message: error instanceof Error ? error.message : 'エラーが発生しました',
      });
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerCsvDownload = (content: string, filename: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const csv = [
      'username,email,group,updateFlag,deleteFlag',
      'user001,user001@example.com,,0,0',
      'user002,user002@example.com,admin,0,0',
      'user003,user003@example.com,admin,1,0',
    ].join('\n');
    triggerCsvDownload(csv, 'cognito_users_template.csv');
  };

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    try {
      const users = await bffClient.getCognitoUsers();
      const today = new Date().toISOString().split('T')[0];
      const header = 'username,email,group,updateFlag,deleteFlag';
      const rows = users.map((u: any) => toCsvRow([
        u.username ?? u.Username ?? '',
        u.email ?? u.attributes?.email ?? '',
        u.group ?? u.groups?.join(';') ?? '',
        0,
        0,
      ]));
      triggerCsvDownload([header, ...rows].join('\n'), `all_cognito_users_${today}.csv`);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1
          className="text-2xl font-bold mb-2 text-brand-text"
        >
          Cognitoユーザー登録
        </h1>
        <p className="text-sm text-brand-muted">
          CSVファイルからCognitoユーザーを一括作成・削除します。作成時は仮パスワードがメールで送信されます。
        </p>
      </div>

      <div
        className="rounded-3xl p-6 sm:p-8"
        style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {/* CSV format guide */}
        <div className="mb-6 p-4 rounded-xl bg-brand-bg" style={{ border: '1px solid #E8E0DA' }}>
          <h3 className="text-sm font-bold mb-2 text-brand-text">CSVフォーマット</h3>
          <div className="text-xs mb-3 text-brand-muted">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E8E0DA]">
                  <th className="text-left py-1 pr-4">カラム</th>
                  <th className="text-left py-1 pr-4">必須</th>
                  <th className="text-left py-1">説明</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#E8E0DA]">
                  <td className="py-1 pr-4 font-mono">username</td>
                  <td className="py-1 pr-4">必須</td>
                  <td className="py-1">ログインユーザー名</td>
                </tr>
                <tr className="border-b border-[#E8E0DA]">
                  <td className="py-1 pr-4 font-mono">email</td>
                  <td className="py-1 pr-4">必須</td>
                  <td className="py-1">メールアドレス（仮パスワード送信先）</td>
                </tr>
                <tr className="border-b border-[#E8E0DA]">
                  <td className="py-1 pr-4 font-mono">group</td>
                  <td className="py-1 pr-4">任意</td>
                  <td className="py-1">Cognitoグループ（例: admin）</td>
                </tr>
                <tr className="border-b border-[#E8E0DA]">
                  <td className="py-1 pr-4 font-mono">updateFlag</td>
                  <td className="py-1 pr-4">任意</td>
                  <td className="py-1">1 の場合、既存ユーザーの情報を更新する</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-mono">deleteFlag</td>
                  <td className="py-1 pr-4">任意</td>
                  <td className="py-1">1 の場合、該当ユーザーを削除する（email・username必須）</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleDownloadTemplate}
              variant="brand-outline"
              size="pill-sm"
            >
              📥 テンプレート
            </Button>
            <Button
              onClick={handleDownloadAll}
              disabled={isDownloadingAll}
              variant="brand-outline"
              size="pill-sm"
              className="text-green-700 border-green-600 hover:bg-green-50"
            >
              {isDownloadingAll ? '取得中...' : '📤 全件ダウンロード'}
            </Button>
          </div>
        </div>

        <UploadResult result={uploadResult} onClose={() => setUploadResult(null)} />

        {/* Upload area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer transition-all rounded-xl text-center ${!dragActive ? 'bg-brand-bg' : ''}`}
          style={{
            border: `2px dashed ${dragActive ? '#E86D78' : '#C2B9B3'}`,
            padding: '32px',
            backgroundColor: dragActive ? '#FFF5F5' : undefined,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
          {selectedFile ? (
            <div>
              <div className="text-base font-semibold mb-1 text-brand-text">
                {selectedFile.name}
              </div>
              <div className="text-xs text-brand-muted">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </div>
            </div>
          ) : (
            <div>
              <div className="text-base mb-1 text-brand-text">
                CSVファイルをドラッグ&ドロップ
              </div>
              <div className="text-sm text-brand-muted">
                または クリックしてファイルを選択
              </div>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="mt-4 flex gap-3 justify-center">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              variant="brand-gradient"
              size="pill"
              style={{ background: isUploading ? '#C2B9B3' : undefined }}
            >
              {isUploading ? '処理中...' : '実行'}
            </Button>
            <button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              disabled={isUploading}
              className="px-6 py-2.5 rounded-full text-sm font-medium border transition-colors text-brand-muted"
              style={{ borderColor: '#C2B9B3' }}
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
