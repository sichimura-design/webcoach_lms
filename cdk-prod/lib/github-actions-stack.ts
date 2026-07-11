import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface ProdGithubActionsStackProps extends cdk.StackProps {
  readonly envName: string;
  /**
   * GitHub リポジトリ (例: "your-org/moodle-spa")
   * --context githubRepo=your-org/moodle-spa で渡す
   */
  readonly githubRepo: string;
  /** webcoach-lms ECR リポジトリ */
  readonly repository: ecr.IRepository;
  /**
   * SPA S3 バケット名 (prod-SpaStack の CfnOutput: prod-SpaBucketName)
   * --context spaBucketName=prod-spadistribution-xxxx で渡す
   */
  readonly spaBucketName: string;
  /**
   * CloudFront Distribution ID (prod-SpaStack の CfnOutput: prod-DistributionId)
   * --context distributionId=EXXXXXXXXXXXX で渡す
   */
  readonly distributionId: string;
}

export class ProdGithubActionsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProdGithubActionsStackProps) {
    super(scope, id, props);

    const { envName, githubRepo, repository, spaBucketName, distributionId } = props;

    // GitHub OIDC プロバイダー (アカウントに 1 つだけ作成)
    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const masterBranchPrincipal = new iam.WebIdentityPrincipal(
      provider.openIdConnectProviderArn,
      {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          // master ブランチからの push のみ Assume 可能
          'token.actions.githubusercontent.com:sub': `repo:${githubRepo}:ref:refs/heads/master`,
        },
      }
    );

    // ============================================================
    // フロントエンドデプロイロール
    // ============================================================
    const frontendRole = new iam.Role(this, 'FrontendDeployRole', {
      roleName: `${envName}-GitHubActions-Frontend-Deploy`,
      assumedBy: masterBranchPrincipal,
      description: 'GitHub Actions: S3 sync + CloudFront invalidation',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // S3: SPA バケットへの読み書き
    frontendRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:PutObject',
        's3:DeleteObject',
        's3:GetObject',
        's3:ListBucket',
      ],
      resources: [
        `arn:aws:s3:::${spaBucketName}`,
        `arn:aws:s3:::${spaBucketName}/*`,
      ],
    }));

    // CloudFront: キャッシュ無効化
    frontendRole.addToPolicy(new iam.PolicyStatement({
      actions: ['cloudfront:CreateInvalidation'],
      resources: [
        `arn:aws:cloudfront::${this.account}:distribution/${distributionId}`,
      ],
    }));

    // ============================================================
    // バックエンドデプロイロール
    // ============================================================
    const backendRole = new iam.Role(this, 'BackendDeployRole', {
      roleName: `${envName}-GitHubActions-Backend-Deploy`,
      assumedBy: masterBranchPrincipal,
      description: 'GitHub Actions: ECR push + ECS force new deployment',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // ECR: 認証トークン取得 (resource: * が必須)
    backendRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));

    // ECR: webcoach-lms リポジトリへの push
    backendRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
        'ecr:PutImage',
      ],
      resources: [repository.repositoryArn],
    }));

    // ECS: force new deployment で新イメージを反映
    backendRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecs:DescribeServices',
        'ecs:UpdateService',
      ],
      resources: [
        `arn:aws:ecs:${this.region}:${this.account}:service/${envName}-lms-cluster/${envName}-lms-service`,
      ],
    }));

    // ============================================================
    // Outputs — GitHub Secrets に登録する値
    // ============================================================
    new cdk.CfnOutput(this, 'FrontendDeployRoleArn', {
      value: frontendRole.roleArn,
      description: 'GitHub Secret: AWS_FRONTEND_DEPLOY_ROLE_ARN に設定',
      exportName: `${envName}-FrontendDeployRoleArn`,
    });

    new cdk.CfnOutput(this, 'BackendDeployRoleArn', {
      value: backendRole.roleArn,
      description: 'GitHub Secret: AWS_BACKEND_DEPLOY_ROLE_ARN に設定',
      exportName: `${envName}-BackendDeployRoleArn`,
    });
  }
}
