import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface S3StackProps extends cdk.StackProps {
  readonly envName: string;
}

export class S3Stack extends cdk.Stack {
  public readonly frontendBucket: s3.Bucket;
  public readonly moodleStorageBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    const { envName } = props;

    // Frontend static files bucket (for CloudFront origin)
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${envName}-moodle-spa-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: envName !== 'prod',
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          maxAge: 3600,
        },
      ],
    });

    // Moodle file storage bucket
    this.moodleStorageBucket = new s3.Bucket(this, 'MoodleStorageBucket', {
      bucketName: `${envName}-moodle-storage-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Always retain Moodle data
      lifecycleRules: [
        {
          id: 'TransitionToIA',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'Frontend S3 Bucket Name',
      exportName: `${envName}-FrontendBucketName`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketArn', {
      value: this.frontendBucket.bucketArn,
      description: 'Frontend S3 Bucket ARN',
      exportName: `${envName}-FrontendBucketArn`,
    });

    new cdk.CfnOutput(this, 'MoodleStorageBucketName', {
      value: this.moodleStorageBucket.bucketName,
      description: 'Moodle Storage S3 Bucket Name',
      exportName: `${envName}-MoodleStorageBucketName`,
    });

    new cdk.CfnOutput(this, 'MoodleStorageBucketArn', {
      value: this.moodleStorageBucket.bucketArn,
      description: 'Moodle Storage S3 Bucket ARN',
      exportName: `${envName}-MoodleStorageBucketArn`,
    });
  }
}
