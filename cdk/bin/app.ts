import { App } from 'aws-cdk-lib'
import {S3CloudFrontStack} from '../lib/s3-cloudfront-stack'

const app = new App()
new S3CloudFrontStack(app, 'sample', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: 'ap-northeast-1'
    },
})