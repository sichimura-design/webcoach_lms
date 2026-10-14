import React, { useState, useRef, useEffect } from 'react';
import { bffClient } from '../../services/bffClient';

interface PendingFile {
  id: string;
  file: File;
  s3Key: string;
  keyError: string | null;
  /** 同じパスに既にファイルがあるか。null は確認中・未確認 */
  exists: boolean | null;
}

interface UploadedFile {
  filename: string;
  s3Key: string;
  url: string;
  uploadedAt: Date;
  overwritten?: boolean;
  invalidated?: boolean;
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

function validateS3Key(key: string, file: File): string | null {
  if (!key.trim()) {
    return isHtml(file) ? '差し替えたい教材のURLを貼り付けてください' : 'S3パスを入力してください';
  }
  if (/[^\x00-\x7F]/.test(key)) {
    return 'S3パスに日本語・全角文字は使用できません';
  }
  return null;
}

const MATERIALS_PREFIX = 'materials/';

/**
 * 入力をS3パスにそろえる。教材のURL(https://study.webcoach.jp/materials/...)を貼り付けた場合はパス部分だけにする。
 * 手元のファイル名が違っても、貼り付けたURLのファイルを上書きできるようにするため
 */
function normalizeKey(input: string): string {
  let key = input.trim();
  if (/^https?:\/\//i.test(key)) {
    try {
      key = decodeURIComponent(new URL(key).pathname);
    } catch {
      // URLとして読めなければそのまま検証に回す
    }
  }
  return key.replace(/^\/+/, '');
}

/**
 * 保存先の初期値。HTMLは差し替える教材のURLを貼ってもらうため空にする
 * （教材は materials/<領域>/html/<ID>.html にあり、手元のファイル名からは決まらない）
 */
function buildDefaultKey(file: File): string {
  return isHtml(file) ? '' : `course-images/${file.name}`;
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
        keyError: validateS3Key(key, file),
        exists: null,
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
      prev.map(f => f.id === id ? { ...f, s3Key: value, keyError: validateS3Key(value, f.file), exists: null } : f)
    );
  };

  // URLを貼り付けたらパスに直す（入力中に書き換えると打ちにくいので、欄を離れたとき）
  const handleKeyBlur = (id: string) => {
    setPendingFiles(prev =>
      prev.map(f => {
        if (f.id !== id) return f;
        const key = normalizeKey(f.s3Key);
        return key === f.s3Key ? f : { ...f, s3Key: key, keyError: validateS3Key(key, f.file), exists: null };
      })
    );
  };

  // 保存先に既にファイルがあるか（上書き＝差し替えになるか）を確認する
  const uncheckedKeys = pendingFiles
    .filter(f => f.exists === null && !f.keyError)
    .map(f => `${f.id}\n${normalizeKey(f.s3Key)}`)
    .join('|');
  useEffect(() => {
    if (!uncheckedKeys) return;
    const timer = setTimeout(() => {
      uncheckedKeys.split('|').forEach(async entry => {
        const [id, key] = entry.split('\n');
        try {
          const exists = await bffClient.s3ObjectExists(key);
          setPendingFiles(prev =>
            prev.map(f => f.id === id && normalizeKey(f.s3Key) === key ? { ...f, exists } : f)
          );
        } catch {
          // 確認できなくてもアップロードはできる。表示は「確認中」のまま
        }
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [uncheckedKeys]);

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
        const result = await bffClient.uploadToS3(file, normalizeKey(s3Key));
        succeeded.push({
          filename: file.name,
          s3Key: result.s3Key,
          url: result.url,
          uploadedAt: new Date(),
          overwritten: result.overwritten,
          invalidated: result.invalidated,
        });
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
        画像・HTMLをS3にアップロード
      </h3>
      <div style={{ fontSize: '13px', color: '#616161', marginBottom: '16px', lineHeight: 1.7 }}>
        教材ページを差し替えるときは、ファイルを選んだあと保存先の欄に
        <strong>差し替えたい教材のURL</strong>（https://study.webcoach.jp/materials/…）を貼り付けてください。
        手元のファイル名が違っても、そのURLのファイルが上書きされます。
      </div>

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
          ファイルをドラッグ&ドロップ（複数可）
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
          color: '#D60934',
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
                <div style={{ fontSize: '12px', color: '#757575', marginBottom: '4px' }}>
                  保存先（S3パス、または差し替える教材のURL）
                </div>
                <input
                  type="text"
                  value={pf.s3Key}
                  onChange={e => handleKeyChange(pf.id, e.target.value)}
                  onBlur={() => handleKeyBlur(pf.id)}
                  disabled={isUploading}
                  placeholder="例: https://study.webcoach.jp/materials/tutorial/html/guide.html"
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
                {pf.keyError ? (
                  <div style={{ fontSize: '12px', color: '#D60934', marginTop: '4px' }}>{pf.keyError}</div>
                ) : (
                  <KeyStatus file={pf} />
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
                      {f.overwritten !== undefined && (f.overwritten ? '・既存ファイルを上書き' : '・新規作成')}
                    </div>
                    {f.overwritten && f.s3Key.startsWith(MATERIALS_PREFIX) && !f.invalidated && (
                      <div style={{ fontSize: '12px', color: '#b26a00', marginTop: '2px' }}>
                        配信のキャッシュを消せませんでした。受講画面に反映されるまで時間がかかる場合があります。
                      </div>
                    )}
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

/** 保存先の下に「上書き(差し替え)か新規か」を出す */
const KeyStatus: React.FC<{ file: PendingFile }> = ({ file }) => {
  const key = normalizeKey(file.s3Key);
  const html = isHtml(file.file);
  const style = (color: string): React.CSSProperties => ({ fontSize: '12px', color, marginTop: '4px', lineHeight: 1.6 });

  if (html && !key.startsWith(MATERIALS_PREFIX)) {
    return (
      <div style={style('#b26a00')}>
        教材として表示するHTMLは materials/ 以下に置きます。教材を差し替える場合は、その教材のURLを貼り付けてください。
      </div>
    );
  }
  if (file.exists === null) {
    return <div style={style('#9e9e9e')}>保存先を確認中…</div>;
  }
  if (file.exists) {
    return <div style={style('#388e3c')}>既存のファイルを上書きします（差し替え）</div>;
  }
  if (key.startsWith(MATERIALS_PREFIX)) {
    return (
      <div style={style('#b26a00')}>
        この場所にはまだファイルがありません。新しいファイルとして保存され、今ある教材は変わりません。
        差し替えのつもりなら、URLが合っているか確認してください。
      </div>
    );
  }
  return <div style={style('#757575')}>新しいファイルとして保存します</div>;
};
