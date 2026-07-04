import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class DevSpaStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: cdk.StackProps & { envName: string }) {
    super(scope, id, props);

    const { envName } = props;

    this.bucket = new s3.Bucket(this, 'SpaBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // /branches/{slug}/* のパスに拡張子がなければ {slug}/index.html に書き換え
    const spaRoutingFn = new cloudfront.Function(this, 'SpaRoutingFn', {
      functionName: `${envName}-dev-spa-routing`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var uri = event.request.uri;
  var match = uri.match(/^(\\/branches\\/[^\\/]+)(\\/.*)?$/);
  if (match) {
    var rest = match[2] || '/';
    if (!/\\.[^\\/]+$/.test(rest)) {
      event.request.uri = match[1] + '/index.html';
    }
  }
  return event.request;
}
      `.trim()),
    });

    const bffOrigin = new origins.HttpOrigin('ec2-52-194-117-196.ap-northeast-1.compute.amazonaws.com', {
      httpPort: 3001,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{
          function: spaRoutingFn,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: bffOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      // dev 用: 北米・欧州のみ（最安値）。日本からは多少遅延するが許容範囲
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      description: 'Dev preview base URL (https://{domain}/branches/{slug}/)',
      exportName: `${envName}-dev-CloudFrontDomain`,
    });
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      exportName: `${envName}-dev-DistributionId`,
    });
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      exportName: `${envName}-dev-BucketName`,
    });
  }
}
