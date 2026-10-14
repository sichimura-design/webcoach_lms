/**
 * S3 Adapter
 * Abstracts AWS S3 operations
 */

const { PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { getS3Client, getCloudFrontClient } = require('../config/clients');
const { config } = require('../config/environment');

// 教材の置き場所。受講画面がiframeで読むHTMLと、その画像・CSS等
const MATERIALS_PREFIX = 'materials/';
// 教材のキー一覧の使い回し時間。コンテンツUPでファイルを選ぶたびに全件(約千件)を取り直さないため
const MATERIALS_KEYS_TTL_MS = 5 * 60 * 1000;

function isMaterialsKey(s3Key) {
  return s3Key.startsWith(MATERIALS_PREFIX);
}

function isHtmlKey(s3Key) {
  return /\.html?$/i.test(s3Key);
}

class S3Adapter {
  constructor() {
    this.client = getS3Client();
    this.bucketName = config.s3BucketName;
    this.cloudFrontDomain = config.cloudFrontDomain;
    this.distributionId = config.cloudFrontDistributionId;
    this.materialsKeysCache = null; // { keys: string[], expiresAt: number }
  }

  /**
   * Upload file to S3
   * 教材(materials/)は差し替えがすぐ見えるよう no-cache で置き、上書き時はそのファイルのキャッシュも消す
   */
  async uploadFile(file, s3Key) {
    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME が設定されていません');
    }

    const materials = isMaterialsKey(s3Key);
    // ブラウザが送るMIMEは text/html だけでcharsetが無いので、HTMLはUTF-8を明示する
    const contentType = isHtmlKey(s3Key) ? 'text/html; charset=utf-8' : file.mimetype;
    const overwritten = await this.exists(s3Key);

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: contentType,
      ...(materials ? { CacheControl: 'no-cache' } : {}),
    }));

    const url = this.cloudFrontDomain
      ? `https://${this.cloudFrontDomain}/${s3Key}`
      : `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;

    console.log(`[S3 Upload] Success: s3://${this.bucketName}/${s3Key} (overwritten=${overwritten})`);
    if (materials && !overwritten && this.materialsKeysCache) {
      this.materialsKeysCache.keys.push(s3Key);
    }

    // キャッシュ削除の失敗でアップロード自体は失敗扱いにしない（画面で「反映に時間がかかる」と出す）
    const invalidated = materials && overwritten ? await this.invalidate(s3Key) : false;

    return {
      success: true,
      s3Key,
      url,
      overwritten,
      invalidated,
    };
  }

  /**
   * Check whether an object already exists (上書きか新規かを画面に出すため)
   */
  async exists(s3Key) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: s3Key }));
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * materials/ 配下で、ファイル名が name と同じものを探す（コンテンツUPの保存先の初期値に使う）
   * 教材HTMLは materials/<領域>/html/<ID>.html にあり、手元のファイル名だけでは領域が分からないため
   */
  async findMaterialsByName(name) {
    const keys = await this._listMaterialsKeys();
    return keys.filter(key => key.slice(key.lastIndexOf('/') + 1) === name);
  }

  async _listMaterialsKeys() {
    if (this.materialsKeysCache && this.materialsKeysCache.expiresAt > Date.now()) {
      return this.materialsKeysCache.keys;
    }
    const keys = [];
    let token;
    do {
      const res = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: MATERIALS_PREFIX,
        ContinuationToken: token,
      }));
      for (const obj of res.Contents || []) keys.push(obj.Key);
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    this.materialsKeysCache = { keys, expiresAt: Date.now() + MATERIALS_KEYS_TTL_MS };
    return keys;
  }

  /**
   * Invalidate CloudFront cache for one key. Returns false when not configured or failed.
   */
  async invalidate(s3Key) {
    if (!this.distributionId) {
      return false;
    }
    try {
      await getCloudFrontClient().send(new CreateInvalidationCommand({
        DistributionId: this.distributionId,
        InvalidationBatch: {
          CallerReference: `s3-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          Paths: { Quantity: 1, Items: [`/${s3Key}`] },
        },
      }));
      return true;
    } catch (error) {
      console.error(`[S3 Upload] CloudFront invalidation failed for /${s3Key}:`, error.message);
      return false;
    }
  }

  /**
   * Check if bucket is configured
   */
  isBucketConfigured() {
    return !!this.bucketName;
  }

  /**
   * Get CloudFront URL for S3 key
   */
  getCloudFrontUrl(s3Key) {
    if (!this.cloudFrontDomain) {
      return null;
    }
    return `https://${this.cloudFrontDomain}/${s3Key}`;
  }
}

// Create singleton instance
const s3Adapter = new S3Adapter();

module.exports = s3Adapter;
