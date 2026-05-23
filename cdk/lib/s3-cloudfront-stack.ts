import {Stack, StackProps, RemovalPolicy} from 'aws-cdk-lib'
import {Construct} from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'

export class S3CloudFrontStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope,id,props)
        const bucket = new s3.Bucket(this, 'MoodleSampleBucket', {
            removalPolicy: RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });
        new s3deploy.BucketDeployment(this,'MoodleSPADeploy', {
            sources: [s3deploy.Source.asset('../frontend/build')],
            destinationBucket: bucket
        })
        new cloudfront.Distribution(this, 'MoodleSampleDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(bucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            defaultRootObject: 'index.html',
        });
    };
}