#!/usr/bin/env node
/**
 * UAT RDS 単体デプロイ用 CDK エントリポイント
 *
 * dev-moodle-vpc (vpc-078369fe5efc5e688) を使い回して RDS だけ立ち上げる。
 * VPC Quota の上限に達しているため新規 VPC は作成しない。
 *
 * ─── デプロイ ────────────────────────────────────────────────────
 *   cd cdk-uat
 *   ./node_modules/.bin/cdk deploy --all \
 *     --app 'npx ts-node --prefer-ts-exts test/rds-app.ts' \
 *     --profile PowerUserAccess-822824391912 \
 *     --require-approval never
 *
 * ─── diff 確認 ───────────────────────────────────────────────────
 *   ./node_modules/.bin/cdk diff --all \
 *     --app 'npx ts-node --prefer-ts-exts test/rds-app.ts' \
 *     --profile PowerUserAccess-822824391912
 *
 * ─── 削除 ────────────────────────────────────────────────────────
 *   ./node_modules/.bin/cdk destroy --all \
 *     --app 'npx ts-node --prefer-ts-exts test/rds-app.ts' \
 *     --profile PowerUserAccess-822824391912
 */
export {};
