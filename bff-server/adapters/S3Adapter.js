/**
 * S3 Adapter
 * Abstracts AWS S3 operations
 */

const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client } = require('../config/clients');
const { config } = require('../config/environment');

class S3Adapter {
  constructor() {
    this.client = getS3Client();
    this.bucketName = config.s3BucketName;
    this.cloudFrontDomain = config.cloudFrontDomain;
  }

  /**
   * Upload file to S3
   */
  async uploadFile(file, s3Key) {
    if (!this.bucketName) {
      throw new Error('S3_BUCKET_NAME が設定されていません');
    }

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const url = this.cloudFrontDomain
      ? `https://${this.cloudFrontDomain}/${s3Key}`
      : `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;

    console.log(`[S3 Upload] Success: s3://${this.bucketName}/${s3Key}`);

    return {
      success: true,
      s3Key,
      url
    };
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
