import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
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
  const dir = path.join(os.tmpdir(), 'uat-moodle-content-auth');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.js'), code);
  return dir;
}

export interface UatSpaStackProps extends cdk.StackProps {
  readonly envName: string;
}

export class UatSpaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: UatSpaStackProps) {
    super(scope, id, props);

    // --context contentTokenSecret=<secret> で渡す
    // 省略時は開発用デフォルト（本番環境では必ず指定すること）
    const contentTokenSecret: string =
      this.node.tryGetContext('contentTokenSecret') ?? 'uat-secret-change-me';

    const bucket = new s3.Bucket(this, 'SpaBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Lambda@Edge: コンテンツ認証（html-content/*, course-images/* を保護）
    const authFunction = new cloudfront.experimental.EdgeFunction(
      this,
      'ContentAuthFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(buildContentAuthAsset(contentTokenSecret)),
        description: `Lambda@Edge: content auth for ${props.envName}`,
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

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
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
    });

    new s3deploy.BucketDeployment(this, 'SpaDeployment', {
      sources: [s3deploy.Source.asset('../frontend/build')],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront ドメイン (UAT フロントエンド URL)',
      exportName: `${props.envName}-CloudFrontDomain`,
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      exportName: `${props.envName}-SpaBucketName`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      exportName: `${props.envName}-DistributionId`,
    });
  }
}
