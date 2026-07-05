import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * コンテンツ認証トークンが埋め込まれた Lambda@Edge コードを生成し、
 * アセットディレクトリのパスを返す。
 *
 * シークレットは CDK deploy 時に context で渡す:
 *   cdk deploy -c contentTokenSecret=$(openssl rand -hex 32)
 *
 * 同じシークレットを BFF の環境変数 CONTENT_TOKEN_SECRET にも設定すること。
 */
function buildContentAuthAsset(secret: string): string {
    const template = fs.readFileSync(
        path.join(__dirname, '../lambda/content-auth/index.js'),
        'utf8'
    );
    const code = template.replace('__CONTENT_TOKEN_SECRET__', secret);
    const dir = path.join(os.tmpdir(), 'moodle-content-auth');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.js'), code);
    return dir;
}

/**
 * Standalone S3 + CloudFront stack for SPA frontend deployment.
 * No dependencies on other stacks (VPC, EC2, RDS etc.).
 *
 * コンテンツパス (html-content/*, course-images/*) には Lambda@Edge で
 * 認証チェックを行う。フロントエンドは BFF から取得した cf_access Cookie を
 * document.cookie にセットすること。
 */
export class SpaFrontendStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // CDK context からシークレットを取得（本番は必ず指定すること）
        const contentTokenSecret: string =
            this.node.tryGetContext('contentTokenSecret') ?? 'dev-secret-change-me-in-production';

        const bucket = new s3.Bucket(this, 'SpaFrontendBucket', {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
        });

        // Lambda@Edge 関数（us-east-1 に自動デプロイされる）
        const authFunction = new cloudfront.experimental.EdgeFunction(
            this,
            'ContentAuthFunction',
            {
                runtime: lambda.Runtime.NODEJS_20_X,
                handler: 'index.handler',
                code: lambda.Code.fromAsset(buildContentAuthAsset(contentTokenSecret)),
                description: 'Lambda@Edge: CloudFront content authentication',
            }
        );

        // 他環境（dev プレビュー等）の SPA から fetch() でコンテンツ存在確認する際に
        // ブラウザの CORS チェックをパスできるようにする（Lambda@Edge のトークン認証自体は別で効く）
        const contentCorsPolicy = new cloudfront.ResponseHeadersPolicy(this, 'ContentCorsPolicy', {
            corsBehavior: {
                accessControlAllowOrigins: [
                    'https://uat.webcoach.jp',
                    'https://dmn2v7nl0g3fq.cloudfront.net', // dev プレビュー環境
                ],
                accessControlAllowMethods: ['GET', 'HEAD'],
                accessControlAllowHeaders: ['*'],
                accessControlAllowCredentials: false,
                originOverride: true,
            },
        });

        const contentAuthBehavior: cloudfront.BehaviorOptions = {
            origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            // 認証チェックが入るためキャッシュ無効（Cookie をキーに含めるとキャッシュ効率が下がるため無効化）
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
            responseHeadersPolicy: contentCorsPolicy,
            edgeLambdas: [
                {
                    functionVersion: authFunction.currentVersion,
                    eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
                },
            ],
        };

        const certificate = acm.Certificate.fromCertificateArn(
            this,
            'UatCertificate',
            'arn:aws:acm:us-east-1:822824391912:certificate/84a85379-4866-4ed9-8480-1a7ea7e7e7d7'
        );

        const distribution = new cloudfront.Distribution(this, 'SpaDistribution', {
            domainNames: ['uat.webcoach.jp'],
            certificate,
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            // 教材コンテンツパスに認証を適用
            additionalBehaviors: {
                'html-content/*': contentAuthBehavior,
                'course-images/*': contentAuthBehavior,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],
        });

        new s3deploy.BucketDeployment(this, 'SpaDeployment', {
            sources: [s3deploy.Source.asset('../frontend/build')],
            destinationBucket: bucket,
            distribution,
            distributionPaths: ['/*'],
        });

        new CfnOutput(this, 'CloudFrontDomainName', {
            value: distribution.distributionDomainName,
            description: 'CloudFront distribution domain name',
        });

        new CfnOutput(this, 'BucketName', {
            value: bucket.bucketName,
            description: 'S3 bucket name (SPA + content)',
        });
    }
}
