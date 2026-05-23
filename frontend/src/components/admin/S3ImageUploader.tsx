import React, { useState, useRef } from 'react';
import { bffClient } from '../../services/bffClient';

interface PendingFile {
  id: string;
  file: File;
  s3Key: string;
  keyError: string | null;
}

interface UploadedFile {
  filename: string;
  s3Key: string;
  url: string;
  uploadedAt: Date;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
const ACCEPTED_TYPES = [...IMAGE_TYPES, 'text/html'];

function isHtml(file: File) {
  return file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm');
}

function validateFile(file: File): string | null {
  const type = file.type || (isHtml(file) ? 'text/html' : '');
  if (!ACCEPTED_TYPES.includes(type) && !isHtml(file)) {
    return 'PNG / JPG / GIF / WebP / SVG / HTML のみアップロード可能です';
  }
  if (file.size > 10 * 1024 * 1024) {
    return 'ファイルサイズは10MB以下にしてください';
  }
  return null;
}

function validateS3Key(key: string): string | null {
  if (!key.trim()) return 'S3パスを入力してください';
  if (/[^\x00-\x7F]/.test(key)) {
    return 'S3パスに日本語・全角文字は使用できません';
  }
  return null;
}

function buildDefaultKey(file: File): string {
  const prefix = isHtml(file) ? 'html-content' : 'course-images';
  return `${prefix}/${file.name}`;
}

export const S3ImageUploader: React.FC = () => {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newPending: PendingFile[] = [];
    const errors: string[] = [];

    for (const file of arr) {
      const err = validateFile(file);
      if (err) {
        errors.push(`${file.name}: ${err}`);
        continue;
      }
      const key = buildDefaultKey(file);
      newPending.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        s3Key: key,
        keyError: validateS3Key(key),
      });
    }

    if (errors.length > 0) setDropError(errors.join('\n'));
    else setDropError(null);

    if (newPending.length > 0) {
      setPendingFiles(prev => [...prev, ...newPending]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleKeyChange = (id: string, value: string) => {
    setPendingFiles(prev =>
      prev.map(f => f.id === id ? { ...f, s3Key: value, keyError: validateS3Key(value) } : f)
    );
  };

  const handleRemove = (id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUploadAll = async () => {
    if (pendingFiles.length === 0) return;
    setIsUploading(true);
    setDropError(null);

    const succeeded: UploadedFile[] = [];
    const failed: string[] = [];

    for (let i = 0; i < pendingFiles.length; i++) {
      const { file, s3Key } = pendingFiles[i];
      setUploadingIndex(i);
      try {
        const result = await bffClient.uploadToS3(file, s3Key.trim());
        succeeded.push({ filename: file.name, s3Key: result.s3Key, url: result.url, uploadedAt: new Date() });
      } catch (err: any) {
        failed.push(`${file.name}: ${err.response?.data?.detail || 'アップロード失敗'}`);
      }
    }

    setUploadingIndex(null);
    setIsUploading(false);
    setUploadedFiles(prev => [...succeeded, ...prev]);
    setPendingFiles([]);
    if (failed.length > 0) setDropError(failed.join('\n'));
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const hasKeyError = pendingFiles.some(f => f.keyError !== null);

  return (
    <div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        画像をS3にアップロード
      </h3>

      {/* ドロップエリア */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragActive ? '#e86d78' : '#bdbdbd'}`,
          borderRadius: '8px',
          padding: '32px',
          textAlign: 'center',
          backgroundColor: dragActive ? '#fdf0ed' : '#fafafa',
          cursor: 'pointer',
          transition: 'all 0.2s',
          marginBottom: '16px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={[...ACCEPTED_TYPES, '.html', '.htm'].join(',')}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🖼️</div>
        <div style={{ fontSize: '16px', color: '#212121', marginBottom: '8px' }}>
          画像をドラッグ&ドロップ（複数可）
        </div>
        <div style={{ fontSize: '13px', color: '#757575' }}>
          または クリックしてファイルを選択（PNG / JPG / GIF / WebP / SVG / HTML）
        </div>
      </div>

      {/* エラー */}
      {dropError && (
        <div style={{
          padding: '10px 14px',
          backgroundColor: '#fdecea',
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          color: '#c62828',
          fontSize: '13px',
          marginBottom: '16px',
          whiteSpace: 'pre-line',
        }}>
          {dropError}
        </div>
      )}

      {/* 待機ファイル一覧 */}
      {pendingFiles.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#424242', marginBottom: '10px' }}>
            アップロード予定 ({pendingFiles.length}件)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingFiles.map((pf, i) => (
              <div
                key={pf.id}
                style={{
                  padding: '12px 16px',
                  backgroundColor: uploadingIndex === i ? '#fff8e1' : '#f5f5f5',
                  border: `1px solid ${uploadingIndex === i ? '#ffe082' : '#e0e0e0'}`,
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#212121' }}>
                    {uploadingIndex === i ? '⏳ ' : ''}{pf.file.name}
                    <span style={{ fontWeight: 400, color: '#9e9e9e', marginLeft: '8px' }}>
                      ({(pf.file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  {!isUploading && (
                    <button
                      onClick={() => handleRemove(pf.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bdbdbd', fontSize: '18px', lineHeight: 1 }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={pf.s3Key}
                  onChange={e => handleKeyChange(pf.id, e.target.value)}
                  disabled={isUploading}
                  placeholder="例: course-images/lesson01/fig1.png"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: `1px solid ${pf.keyError ? '#f5c6cb' : '#bdbdbd'}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    backgroundColor: isUploading ? '#f5f5f5' : '#fff',
                  }}
                />
                {pf.keyError && (
                  <div style={{ fontSize: '12px', color: '#c62828', marginTop: '4px' }}>{pf.keyError}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={handleUploadAll}
              disabled={isUploading || hasKeyError}
              style={{
                padding: '12px 24px',
                backgroundColor: isUploading || hasKeyError ? '#bdbdbd' : '#e86d78',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isUploading || hasKeyError ? 'not-allowed' : 'pointer',
              }}
            >
              {isUploading
                ? `アップロード中... (${(uploadingIndex ?? 0) + 1}/${pendingFiles.length})`
                : `${pendingFiles.length}件をアップロード`}
            </button>
            {!isUploading && (
              <button
                onClick={() => { setPendingFiles([]); setDropError(null); }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#fff',
                  color: '#757575',
                  border: '1px solid #bdbdbd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                すべてキャンセル
              </button>
            )}
          </div>
        </div>
      )}

      {/* アップロード済み */}
      {uploadedFiles.length > 0 && (
        <div>
          <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px', color: '#424242' }}>
            アップロード済み
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {uploadedFiles.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#f1f8e9',
                  border: '1px solid #c8e6c9',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#212121', marginBottom: '2px' }}>
                      {f.filename}
                    </div>
                    <div style={{ fontSize: '12px', color: '#388e3c', wordBreak: 'break-all', marginBottom: '2px' }}>
                      {f.url}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9e9e9e' }}>
                      {f.uploadedAt.toLocaleString('ja-JP')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopyUrl(f.url)}
                    style={{
                      flexShrink: 0,
                      padding: '6px 12px',
                      backgroundColor: copiedUrl === f.url ? '#388e3c' : '#fff',
                      color: copiedUrl === f.url ? '#fff' : '#388e3c',
                      border: '1px solid #a5d6a7',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                  >
                    {copiedUrl === f.url ? 'コピーしました！' : 'URLをコピー'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
