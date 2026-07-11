#!/usr/bin/env node
/**
 * 本番環境 CDK エントリポイント（インフラ一式のみ: VPC + ALB）
 *
 * ALB の DNS 名を先に確保できる状態を作るための構成。
 * RDS / ECS / SPA / Cognito 等は含まない（prod-app.ts 側で管理）。
 *
 * ECR (prod-EcrStack) はここには含めない。
 * 既に prod-app.ts 経由でデプロイ済みで prod-GithubActionsStack から
 * Export を参照されているため、ここに含めると「参照元が無い」と CDK が
 * 誤判定して Export 削除 → CloudFormation に拒否される
 * (`Cannot delete export ... as it is in use by prod-GithubActionsStack`)。
 *
 * ─── デプロイ ─────────────────────────────────────────────────────
 *   cd cdk-prod
 *   export AWS_PROFILE=PowerUserAccess-840513866884
 *   export CDK_DEFAULT_ACCOUNT=840513866884
 *   export CDK_DEFAULT_REGION=ap-northeast-1
 *
 *   npm run deploy:infra
 *   # または
 *   ./node_modules/.bin/cdk deploy --all \
 *     --app "npx ts-node --prefer-ts-exts bin/prod-infra-app.ts"
 *
 * ─── ALB に HTTPS を追加する場合 ─────────────────────────────────
 *   --context albCertificateArn=arn:aws:acm:ap-northeast-1:840513866884:certificate/xxxx
 *
 * ─── スタック構成 ───────────────────────────────────────────────
 *   prod-VpcStack   VPC (Multi-AZ, NAT×2)
 *   prod-AlbStack   ALB + 空のターゲットグループ (ECS未接続)
 *
 * これらは prod-app.ts でも同じ lib クラスから定義されており、
 * スタック名も同一（prod-VpcStack / prod-AlbStack）。
 * 先にこちらでデプロイしておけば、後で prod-app.ts --all を実行しても
 * 差分なしとして扱われ、残りのスタック（Backend/Spa等）だけが追加デプロイされる。
 * prod-BackendStack のデプロイ時に ECS サービスがこのターゲットグループへアタッチされる。
 */

import * as cdk from 'aws-cdk-lib';
import { ProdVpcStack } from '../lib/vpc-stack';
import { ProdAlbStack } from '../lib/alb-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('env') ?? 'prod';
const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';

if (!awsAccount) {
  throw new Error(
    'CDK_DEFAULT_ACCOUNT が未設定です。\n' +
    '  export AWS_PROFILE=PowerUserAccess-840513866884 を設定してください。'
  );
}

const env: cdk.Environment = { account: awsAccount, region: awsRegion };

const tags = {
  Project: 'moodle-spa',
  Environment: envName,
  ManagedBy: 'cdk-prod',
};

const vpcStack = new ProdVpcStack(app, `${envName}-VpcStack`, {
  env, tags, envName,
});

const albStack = new ProdAlbStack(app, `${envName}-AlbStack`, {
  env, tags, envName,
  vpc: vpcStack.vpc,
  albCertificateArn: app.node.tryGetContext('albCertificateArn'),
});
albStack.addDependency(vpcStack);

app.synth();
