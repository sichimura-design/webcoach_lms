import React from 'react';
import { S3ImageUploader } from './S3ImageUploader';

export const AdminImageUploadPage: React.FC = () => {
  return (
    <div>
      <h2
        className="text-2xl font-bold mb-6 text-brand-text"
      >
        コンテンツアップロード
      </h2>
      <p className="text-sm mb-6 text-brand-muted">
        画像・HTMLファイルをS3にアップロードします。HTMLはMoodleに <strong>mod/url</strong> としてURLを登録すると、教材ページとしてiframe表示されます。
      </p>
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: '1px solid #E8E0DA' }}
      >
        <S3ImageUploader />
      </div>
    </div>
  );
};
