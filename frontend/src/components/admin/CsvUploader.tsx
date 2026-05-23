import React, { useState, useRef } from 'react';
import { Button } from '../ui/button';

interface CsvUploaderProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

export const CsvUploader: React.FC<CsvUploaderProps> = ({ onUpload, isUploading }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
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

  const handleUploadClick = async () => {
    if (selectedFile) {
      await onUpload(selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
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
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
        {selectedFile ? (
          <div>
            <div className="text-base font-semibold mb-1 text-brand-text">{selectedFile.name}</div>
            <div className="text-xs text-brand-muted">{(selectedFile.size / 1024).toFixed(2)} KB</div>
          </div>
        ) : (
          <div>
            <div className="text-base mb-1 text-brand-text">CSVファイルをドラッグ&ドロップ</div>
            <div className="text-sm text-brand-muted">または クリックしてファイルを選択</div>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="mt-4 flex gap-3 justify-center">
          <Button
            onClick={handleUploadClick}
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
  );
};
