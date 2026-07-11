#!/usr/bin/env node
/**
 * 本番環境 CDK エントリポイント
 *
 * ─── アカウント情報 ───────────────────────────────────────────────
 *   本番アカウント: 840513866884
 *   プロファイル  : PowerUserAccess-840513866884
 *
 * ─── 初回のみ: CDK Bootstrap ─────────────────────────────────────
 *   本番アカウントに CDK ブートストラップが必要（初回のみ）。
 *
 *   # ap-northeast-1
 *   export AWS_PROFILE=PowerUserAccess-840513866884
 *   export CDK_DEFAULT_ACCOUNT=840513866884
 *   export CDK_DEFAULT_REGION=ap-northeast-1
 *   ./node_modules/.bin/cdk bootstrap aws://840513866884/ap-northeast-1
 *
 *   # us-east-1 (Lambda@Edge 用)
 *   ./node_modules/.bin/cdk bootstrap aws://840513866884/us-east-1
 *
 * ─── 全スタック一括デプロイ ───────────────────────────────────────
 *   cd cdk-prod
 *   export AWS_PROFILE=PowerUserAccess-840513866884
 *   export CDK_DEFAULT_ACCOUNT=840513866884
 *   export CDK_DEFAULT_REGION=ap-northeast-1
 *
 *   npm install
 *   ./node_modules/.bin/cdk deploy --all \
 *     --context contentTokenSecret=$(openssl rand -hex 32) \
 *     --context cognitoUserPoolId=ap-northeast-1_xxxx \
 *     --context cognitoClientId=xxxx \
 *     --context cognitoClientSecret=xxxx \
 *     --context anthropicApiKey=sk-ant-xxxx \
 *     --context moodleSiteUrl=https://webcoach.jp \
 *     --require-approval never
 *
 * ─── カスタムドメイン付き SPA デプロイ（証明書取得後）────────────
 *   ./node_modules/.bin/cdk deploy prod-SpaStack \
 *     --context contentTokenSecret=<secret> \
 *     --context domainName=webcoach.jp \
 *     --context certificateArn=arn:aws:acm:us-east-1:840513866884:certificate/xxxx
 *
 * ─── ALB に HTTPS を追加する場合 ─────────────────────────────────
 *   --context albCertificateArn=arn:aws:acm:ap-northeast-1:840513866884:certificate/xxxx
 *
 * ─── 差分確認（デプロイ前に必ず実施）───────────────────────────────
 *   ./node_modules/.bin/cdk diff --all
 *
 * ─── スタック構成 ───────────────────────────────────────────────
 *   prod-VpcStack       VPC (Multi-AZ, NAT×2)
 *   prod-EcrStack       ECR リポジトリ (RETAIN)
 *   prod-AlbStack       ALB + 空のターゲットグループ (ECS未接続)
 *   prod-BackendStack   RDS(Multi-AZ) + EFS + ECS EC2 (ALBのTGへアタッチ)
 *   prod-SpaStack       S3 + CloudFront + Lambda@Edge (us-east-1)
 *
 * VpcStack / AlbStack は bin/prod-infra-app.ts でも同じ lib
 * クラスから定義されている（スタック名も同一）。先に
 * `npm run deploy:infra` でこの2つだけを立ち上げ、ALBのDNS名を確保して
 * から docker push → BackendStack という順番でも進められる。
 * EcrStack は deploy:infra には含まれない
 * （既にデプロイ済みかつ prod-GithubActionsStack から Export 参照されているため）。
 * ECR未デプロイの場合は先に `cdk deploy prod-EcrStack` を単独実行すること。
 *
 * ─── デプロイフロー ─────────────────────────────────────────────
 *   1. cdk deploy prod-VpcStack prod-EcrStack prod-AlbStack
 *      (または npm run deploy:infra で VpcStack/AlbStackのみ)
 *   2. docker build & push → prod アカウント ECR (840513866884)
 *      aws ecr get-login-password --region ap-northeast-1 \
 *        --profile PowerUserAccess-840513866884 \
 *        | docker login --username AWS --password-stdin \
 *          840513866884.dkr.ecr.ap-northeast-1.amazonaws.com
 *   3. cdk deploy prod-BackendStack --context desiredCount=0
 *   4. docker push 後に desiredCount=2 で再デプロイ
 *   5. Route53 / DNS で ALB (prod-AlbStack の AlbDnsName 出力) に独自ドメインを向ける
 *   6. cdk deploy prod-BackendStack --context moodleSiteUrl=https://webcoach.jp
 *   7. cd frontend && npm run build
 *   8. cdk deploy prod-SpaStack
 *
 * ─── 注意 ───────────────────────────────────────────────────────
 *   - RDS は deletionProtection=true / RemovalPolicy.RETAIN のため
 *     cdk destroy しても削除されない。手動で削除保護を外す必要がある。
 *   - contentTokenSecret は BFF の CONTENT_TOKEN_SECRET と同じ値を使う
 *   - SPA デプロイ前に `cd frontend && npm run build` が必要
 *   - 本番証明書 (webcoach.jp) は 840513866884 アカウントの us-east-1 で発行が必要
 *   - SES 送信元アドレスは --context sesFromEmail=noreply@webcoach.jp で指定
 *     デプロイ後に SES コンソールで検証メールを確認すること
 *   - SES がサンドボックスの場合、本番アクセスのリクエストが別途必要
 */

import * as cdk from 'aws-cdk-lib';
import { ProdVpcStack } from '../lib/vpc-stack';
import { ProdEcrStack } from '../lib/ecr-stack';
import { ProdAlbStack } from '../lib/alb-stack';
import { ProdBackendStack } from '../lib/backend-stack';
import { ProdSpaStack } from '../lib/spa-stack';
import { ProdCognitoStack } from '../lib/cognito-stack';
import { ProdGithubActionsStack } from '../lib/github-actions-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? 'prod';
const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';

if (!awsAccount) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT が未設定です。\n' +
    '  export AWS_PROFILE=PowerUserAccess-822824391912 を設定してください。'
  );
}

const env: cdk.Environment = { account: awsAccount, region: awsRegion };

const tags = {
  Project: 'moodle-spa',
  Environment: envName,
  ManagedBy: 'cdk-prod',
};

// ============================================================
// Stack 1: Cognito + SES (認証 / メール送信)
// ============================================================
const cognitoStack = new ProdCognitoStack(app, `${envName}-CognitoStack`, {
  env, tags, envName,
  moodleDomain: app.node.tryGetContext('moodleDomain') ?? 'webcoach.jp',
  // SES 送信元アドレス。指定するとCognitoがSES経由でメールを送信する。
  // --context sesFromEmail=noreply@webcoach.jp
  // --context sesFromDomain=webcoach.jp  (ドメイン検証する場合)
  sesFromEmail: app.node.tryGetContext('sesFromEmail'),
  sesFromDomain: app.node.tryGetContext('sesFromDomain'),
});

// ============================================================
// Stack 3: VPC (NAT×2 で HA 構成)
// ============================================================
const vpcStack = new ProdVpcStack(app, `${envName}-VpcStack`, {
  env, tags, envName,
});

// ============================================================
// Stack 4: ECR リポジトリ (RETAIN — 本番イメージを保護)
// ============================================================
const ecrStack = new ProdEcrStack(app, `${envName}-EcrStack`, {
  env, tags, envName,
});

// ============================================================
// Stack 4.5: ALB (ECS より先に DNS 名を確保する)
// ============================================================
const albStack = new ProdAlbStack(app, `${envName}-AlbStack`, {
  env, tags, envName,
  vpc: vpcStack.vpc,
  // HTTPS 対応: ap-northeast-1 の証明書 ARN を渡す
  albCertificateArn: app.node.tryGetContext('albCertificateArn'),
});
albStack.addDependency(vpcStack);

// ============================================================
// Stack 5: バックエンド (RDS Multi-AZ + EFS + ECS)
// ECS サービスは albStack が用意したターゲットグループにアタッチされる
// ============================================================
const backendStack = new ProdBackendStack(app, `${envName}-BackendStack`, {
  env, tags, envName,
  vpc: vpcStack.vpc,
  repository: ecrStack.repository,
  albSecurityGroup: albStack.albSecurityGroup,
  targetGroupArn: albStack.targetGroup.targetGroupArn,
  cognitoUserPoolId: app.node.tryGetContext('cognitoUserPoolId'),
  cognitoClientId: app.node.tryGetContext('cognitoClientId'),
  cognitoClientSecret: app.node.tryGetContext('cognitoClientSecret'),
  anthropicApiKey: app.node.tryGetContext('anthropicApiKey'),
  moodleSiteUrl: app.node.tryGetContext('moodleSiteUrl'),
  // 初回デプロイ: ECR にイメージがない場合は 0 にする
  desiredCount: Number(app.node.tryGetContext('desiredCount') ?? '2'),
});
backendStack.addDependency(albStack);

// ============================================================
// Stack 6: SPA (S3 + CloudFront + Lambda@Edge)
// Lambda@Edge は us-east-1 に強制されるため env を上書き
// ============================================================
new ProdSpaStack(app, `${envName}-SpaStack`, {
  env: { account: awsAccount, region: 'us-east-1' },
  tags,
  envName,
  // 本番証明書取得後に context で渡す
  domainName: app.node.tryGetContext('domainName'),
  certificateArn: app.node.tryGetContext('certificateArn'),
});

// ============================================================
// Stack 7: GitHub Actions OIDC ロール (フロントエンド + バックエンド)
//
// 初回デプロイ手順:
//   1. prod-SpaStack をデプロイして CloudFormation Outputs を確認
//      aws cloudformation describe-stacks --stack-name prod-SpaStack \
//        --region us-east-1 --query 'Stacks[0].Outputs'
//   2. 以下の context を渡してデプロイ
//      ./node_modules/.bin/cdk deploy prod-GithubActionsStack \
//        --context githubRepo=YOUR_ORG/moodle-spa \
//        --context spaBucketName=<prod-SpaBucketName の値> \
//        --context distributionId=<prod-DistributionId の値>
//   3. Outputs の RoleArn を GitHub Secrets に登録
// ============================================================
const githubActionsStack = new ProdGithubActionsStack(app, `${envName}-GithubActionsStack`, {
  env, tags, envName,
  githubRepo: app.node.tryGetContext('githubRepo') ?? 'REPLACE_ME/moodle-spa',
  repository: ecrStack.repository,
  spaBucketName: app.node.tryGetContext('spaBucketName') ?? 'REPLACE_ME',
  distributionId: app.node.tryGetContext('distributionId') ?? 'REPLACE_ME',
});
githubActionsStack.addDependency(ecrStack);

// 依存関係の明示
backendStack.addDependency(vpcStack);
backendStack.addDependency(ecrStack);

app.synth();
