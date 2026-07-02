import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

export interface DevGithubActionsStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly githubRepo: string;
  readonly bucket: s3.IBucket;
  readonly distribution: cloudfront.IDistribution;
  /**
   * 既存の GitHub OIDC プロバイダー ARN。
   * 省略時: 新規作成。既存がある場合は
   *   --context oidcProviderArn=arn:aws:iam::822824391912:oidc-provider/token.actions.githubusercontent.com
   */
  readonly oidcProviderArn?: string;
}

export class DevGithubActionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DevGithubActionsStackProps) {
    super(scope, id, props);

    const { envName, githubRepo, bucket, distribution, oidcProviderArn } = props;

    const provider = oidcProviderArn
      ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'GithubOidcProvider', oidcProviderArn)
      : new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
          url: 'https://token.actions.githubusercontent.com',
          clientIds: ['sts.amazonaws.com'],
        });

    // dev/** push のデプロイ + delete イベント（master sub）のクリーンアップ を同一ロールで処理
    const principal = new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
      StringEquals: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
      },
      StringLike: {
        'token.actions.githubusercontent.com:sub': [
          `repo:${githubRepo}:ref:refs/heads/dev/*`,
          // delete イベントは default branch (master) の sub で届く
          `repo:${githubRepo}:ref:refs/heads/master`,
        ],
      },
    });

    const role = new iam.Role(this, 'DevPreviewDeployRole', {
      roleName: `${envName}-dev-GitHubActions-Preview`,
      assumedBy: principal,
      description: 'GitHub Actions: dev/** preview deploy & cleanup',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject', 's3:DeleteObject', 's3:GetObject', 's3:ListBucket'],
      resources: [bucket.bucketArn, `${bucket.bucketArn}/branches/*`],
    }));

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation'],
      resources: [`arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`],
    }));

    new cdk.CfnOutput(this, 'DevPreviewRoleArn', {
      value: role.roleArn,
      description: 'GitHub Secret: AWS_DEV_PREVIEW_ROLE_ARN に設定',
      exportName: `${envName}-dev-PreviewRoleArn`,
    });
  }
}
