import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function buildContentAuthAsset(secret: string): string {
  const template = fs.readFileSync(
    path.join(__dirname, '../lambda/content-auth/index.js'),
    'utf8'
  );
  const code = template.replace('__CONTENT_TOKEN_SECRET__', secret);
  const dir = path.join(os.tmpdir(), 'prod-moodle-content-auth');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.js'), code);
  return dir;
}

export interface ProdSpaStackProps extends cdk.StackProps {
  readonly envName: string;
  /**
   * 本番ドメイン名 (例: webcoach.jp)。
   * 指定時は certificateArn も必須。省略時は CloudFront デフォルトドメインを使用。
   */
  readonly domainName?: string;
  /**
   * us-east-1 の ACM 証明書 ARN。domainName 指定時に必須。
   */
  readonly certificateArn?: string;
}

export class ProdSpaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProdSpaStackProps) {
    super(scope, id, props);

    const { envName, domainName, certificateArn } = props;

    const contentTokenSecret: string =
      this.node.tryGetContext('contentTokenSecret') ?? 'prod-secret-REPLACE_ME';

    const bucket = new s3.Bucket(this, 'SpaBucket', {
      // 本番: バケットを誤削除から保護
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
    });

    // Lambda@Edge: コンテンツ認証 (html-content/*, course-images/* を保護)
    const authFunction = new cloudfront.experimental.EdgeFunction(
      this,
      'ContentAuthFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(buildContentAuthAsset(contentTokenSecret)),
        description: `Lambda@Edge: content auth for ${envName}`,
      }
    );

    const contentAuthBehavior: cloudfront.BehaviorOptions = {
      origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
      edgeLambdas: [
        {
          functionVersion: authFunction.currentVersion,
          eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
        },
      ],
    };

    const distributionProps: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        'html-content/*': contentAuthBehavior,
        'course-images/*': contentAuthBehavior,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
      // 本番: グローバルエッジロケーションを利用
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      ...(domainName && certificateArn
        ? {
            domainNames: [domainName],
            certificate: acm.Certificate.fromCertificateArn(this, 'Cert', certificateArn),
          }
        : {}),
    };

    const distribution = new cloudfront.Distribution(this, 'Distribution', distributionProps);

    new s3deploy.BucketDeployment(this, 'SpaDeployment', {
      sources: [s3deploy.Source.asset('../frontend/build')],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront ドメイン',
      exportName: `${envName}-CloudFrontDomain`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      exportName: `${envName}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      exportName: `${envName}-SpaBucketName`,
    });
  }
}
