#!/usr/bin/env node
"use strict";
/**
 * UAT 環境 CDK エントリポイント
 *
 * ─── 全スタック一括デプロイ ───────────────────────────────────────
 *   cd cdk-uat
 *   npm install
 *   ./node_modules/.bin/cdk deploy --all \
 *     --context contentTokenSecret=$(openssl rand -hex 32) \
 *     --context cognitoUserPoolId=ap-northeast-1_xxxx \
 *     --context cognitoClientId=xxxx \
 *     --context cognitoClientSecret=xxxx \
 *     --context anthropicApiKey=sk-ant-xxxx \
 *     --profile PowerUserAccess-822824391912 \
 *     --require-approval never
 *
 * ─── 差分確認（デプロイ前に必ず実施）───────────────────────────────
 *   ./node_modules/.bin/cdk diff --all \
 *     --profile PowerUserAccess-822824391912
 *
 * ─── 個別スタック更新（例: イメージ更新後に ECS のみ再デプロイ）────
 *   ./node_modules/.bin/cdk deploy uat-BackendStack \
 *     --profile PowerUserAccess-822824391912 \
 *     --require-approval never
 *
 * ─── 全削除（UAT 環境を破棄する場合）──────────────────────────────
 *   ./node_modules/.bin/cdk destroy --all \
 *     --profile PowerUserAccess-822824391912
 *
 * ─── スタック構成 ───────────────────────────────────────────────
 *   uat-VpcStack       VPC (Multi-AZ, NAT×1)
 *   uat-EcrStack       ECR リポジトリ (nginx / bff / api / moodle)
 *   uat-BackendStack   RDS + EFS + ECS Fargate + ALB (セットで管理)
 *   uat-SpaStack       S3 + CloudFront + Lambda@Edge (us-east-1)
 *
 * ─── デプロイフロー ─────────────────────────────────────────────
 *   1. cdk deploy --all  (ECR 作成)
 *   2. docker build & push → ECR
 *   3. cdk deploy uat-BackendStack  (ECS が ECR イメージを参照)
 *   4. cdk deploy uat-SpaStack  (フロントエンドビルド後)
 *
 * ─── 注意 ───────────────────────────────────────────────────────
 *   - Cognito / Anthropic の値を context で渡さない場合、
 *     デプロイ後に Secrets Manager で手動更新し ECS を再起動すること
 *   - contentTokenSecret は BFF の CONTENT_TOKEN_SECRET と同じ値を使う
 *   - SPA デプロイ前に `cd frontend && npm run build` が必要
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const cdk = __importStar(require("aws-cdk-lib"));
const vpc_stack_1 = require("../lib/vpc-stack");
const ecr_stack_1 = require("../lib/ecr-stack");
const backend_stack_1 = require("../lib/backend-stack");
const spa_stack_1 = require("../lib/spa-stack");
const app = new cdk.App();
const envName = app.node.tryGetContext('env') ?? 'uat';
const awsAccount = process.env.CDK_DEFAULT_ACCOUNT;
const awsRegion = process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1';
if (!awsAccount) {
    throw new Error('CDK_DEFAULT_ACCOUNT が未設定です。\n' +
        '  export AWS_PROFILE=PowerUserAccess-822824391912 を実行するか、\n' +
        '  CDK_DEFAULT_ACCOUNT=<account_id> を環境変数に設定してください。');
}
const env = { account: awsAccount, region: awsRegion };
const tags = {
    Project: 'moodle-spa',
    Environment: envName,
    ManagedBy: 'cdk-uat',
};
// ============================================================
// Stack 1: VPC
// ============================================================
const vpcStack = new vpc_stack_1.UatVpcStack(app, `${envName}-VpcStack`, {
    env, tags, envName,
});
// ============================================================
// Stack 2: ECR リポジトリ
// 先にデプロイして docker push 可能な状態にする
// ============================================================
const ecrStack = new ecr_stack_1.UatEcrStack(app, `${envName}-EcrStack`, {
    env, tags, envName,
});
// ============================================================
// Stack 3: バックエンド (RDS + EFS + ECS Fargate + ALB)
// ============================================================
const backendStack = new backend_stack_1.UatBackendStack(app, `${envName}-BackendStack`, {
    env, tags, envName,
    vpc: vpcStack.vpc,
    nginxRepo: ecrStack.nginxRepo,
    bffRepo: ecrStack.bffRepo,
    apiRepo: ecrStack.apiRepo,
    moodleRepo: ecrStack.moodleRepo,
    // context で渡す。省略時は Secrets Manager で後から手動更新可能。
    cognitoUserPoolId: app.node.tryGetContext('cognitoUserPoolId'),
    cognitoClientId: app.node.tryGetContext('cognitoClientId'),
    cognitoClientSecret: app.node.tryGetContext('cognitoClientSecret'),
    anthropicApiKey: app.node.tryGetContext('anthropicApiKey'),
    moodleSiteUrl: app.node.tryGetContext('moodleSiteUrl'),
    // SSH キーペア名（省略時は SSM Session Manager のみ）
    keyPairName: app.node.tryGetContext('keyPairName'),
    // 初回デプロイ: ECR にイメージがない場合は 0 にする
    desiredCount: Number(app.node.tryGetContext('desiredCount') ?? '1'),
});
// ============================================================
// Stack 4: SPA (S3 + CloudFront + Lambda@Edge)
// Lambda@Edge は us-east-1 に強制されるため env を上書き
// ============================================================
new spa_stack_1.UatSpaStack(app, `${envName}-SpaStack`, {
    env: { account: awsAccount, region: 'us-east-1' },
    tags,
    envName,
});
// 依存関係の明示
backendStack.addDependency(vpcStack);
backendStack.addDependency(ecrStack);
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWF0LWFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInVhdC1hcHAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBNkNHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyxnREFBK0M7QUFDL0MsZ0RBQStDO0FBQy9DLHdEQUF1RDtBQUN2RCxnREFBK0M7QUFFL0MsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDO0FBQ3ZELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUM7QUFDbkQsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxnQkFBZ0IsQ0FBQztBQUVyRSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDaEIsTUFBTSxJQUFJLEtBQUssQ0FDYiwrQkFBK0I7UUFDL0IsNkRBQTZEO1FBQzdELG9EQUFvRCxDQUNyRCxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sR0FBRyxHQUFvQixFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxDQUFDO0FBRXhFLE1BQU0sSUFBSSxHQUFHO0lBQ1gsT0FBTyxFQUFFLFlBQVk7SUFDckIsV0FBVyxFQUFFLE9BQU87SUFDcEIsU0FBUyxFQUFFLFNBQVM7Q0FDckIsQ0FBQztBQUVGLCtEQUErRDtBQUMvRCxlQUFlO0FBQ2YsK0RBQStEO0FBQy9ELE1BQU0sUUFBUSxHQUFHLElBQUksdUJBQVcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxPQUFPLFdBQVcsRUFBRTtJQUMzRCxHQUFHLEVBQUUsSUFBSSxFQUFFLE9BQU87Q0FDbkIsQ0FBQyxDQUFDO0FBRUgsK0RBQStEO0FBQy9ELHFCQUFxQjtBQUNyQixnQ0FBZ0M7QUFDaEMsK0RBQStEO0FBQy9ELE1BQU0sUUFBUSxHQUFHLElBQUksdUJBQVcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxPQUFPLFdBQVcsRUFBRTtJQUMzRCxHQUFHLEVBQUUsSUFBSSxFQUFFLE9BQU87Q0FDbkIsQ0FBQyxDQUFDO0FBRUgsK0RBQStEO0FBQy9ELGtEQUFrRDtBQUNsRCwrREFBK0Q7QUFDL0QsTUFBTSxZQUFZLEdBQUcsSUFBSSwrQkFBZSxDQUFDLEdBQUcsRUFBRSxHQUFHLE9BQU8sZUFBZSxFQUFFO0lBQ3ZFLEdBQUcsRUFBRSxJQUFJLEVBQUUsT0FBTztJQUNsQixHQUFHLEVBQUUsUUFBUSxDQUFDLEdBQUc7SUFDakIsU0FBUyxFQUFFLFFBQVEsQ0FBQyxTQUFTO0lBQzdCLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTztJQUN6QixPQUFPLEVBQUUsUUFBUSxDQUFDLE9BQU87SUFDekIsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVO0lBQy9CLCtDQUErQztJQUMvQyxpQkFBaUIsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQztJQUM5RCxlQUFlLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsaUJBQWlCLENBQUM7SUFDMUQsbUJBQW1CLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMscUJBQXFCLENBQUM7SUFDbEUsZUFBZSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGlCQUFpQixDQUFDO0lBQzFELGFBQWEsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxlQUFlLENBQUM7SUFDdEQseUNBQXlDO0lBQ3pDLFdBQVcsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUM7SUFDbEQsZ0NBQWdDO0lBQ2hDLFlBQVksRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLElBQUksR0FBRyxDQUFDO0NBQ3BFLENBQUMsQ0FBQztBQUVILCtEQUErRDtBQUMvRCwrQ0FBK0M7QUFDL0MsNENBQTRDO0FBQzVDLCtEQUErRDtBQUMvRCxJQUFJLHVCQUFXLENBQUMsR0FBRyxFQUFFLEdBQUcsT0FBTyxXQUFXLEVBQUU7SUFDMUMsR0FBRyxFQUFFLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFO0lBQ2pELElBQUk7SUFDSixPQUFPO0NBQ1IsQ0FBQyxDQUFDO0FBRUgsVUFBVTtBQUNWLFlBQVksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDckMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUVyQyxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIFVBVCDnkrDlooMgQ0RLIOOCqOODs+ODiOODquODneOCpOODs+ODiFxuICpcbiAqIOKUgOKUgOKUgCDlhajjgrnjgr/jg4Pjgq/kuIDmi6zjg4fjg5fjg63jgqQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gKiAgIGNkIGNkay11YXRcbiAqICAgbnBtIGluc3RhbGxcbiAqICAgLi9ub2RlX21vZHVsZXMvLmJpbi9jZGsgZGVwbG95IC0tYWxsIFxcXG4gKiAgICAgLS1jb250ZXh0IGNvbnRlbnRUb2tlblNlY3JldD0kKG9wZW5zc2wgcmFuZCAtaGV4IDMyKSBcXFxuICogICAgIC0tY29udGV4dCBjb2duaXRvVXNlclBvb2xJZD1hcC1ub3J0aGVhc3QtMV94eHh4IFxcXG4gKiAgICAgLS1jb250ZXh0IGNvZ25pdG9DbGllbnRJZD14eHh4IFxcXG4gKiAgICAgLS1jb250ZXh0IGNvZ25pdG9DbGllbnRTZWNyZXQ9eHh4eCBcXFxuICogICAgIC0tY29udGV4dCBhbnRocm9waWNBcGlLZXk9c2stYW50LXh4eHggXFxcbiAqICAgICAtLXByb2ZpbGUgUG93ZXJVc2VyQWNjZXNzLTgyMjgyNDM5MTkxMiBcXFxuICogICAgIC0tcmVxdWlyZS1hcHByb3ZhbCBuZXZlclxuICpcbiAqIOKUgOKUgOKUgCDlt67liIbnorroqo3vvIjjg4fjg5fjg63jgqTliY3jgavlv4XjgZrlrp/mlr3vvInilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbiAqICAgLi9ub2RlX21vZHVsZXMvLmJpbi9jZGsgZGlmZiAtLWFsbCBcXFxuICogICAgIC0tcHJvZmlsZSBQb3dlclVzZXJBY2Nlc3MtODIyODI0MzkxOTEyXG4gKlxuICog4pSA4pSA4pSAIOWAi+WIpeOCueOCv+ODg+OCr+abtOaWsO+8iOS+izog44Kk44Oh44O844K45pu05paw5b6M44GrIEVDUyDjga7jgb/lho3jg4fjg5fjg63jgqTvvInilIDilIDilIDilIBcbiAqICAgLi9ub2RlX21vZHVsZXMvLmJpbi9jZGsgZGVwbG95IHVhdC1CYWNrZW5kU3RhY2sgXFxcbiAqICAgICAtLXByb2ZpbGUgUG93ZXJVc2VyQWNjZXNzLTgyMjgyNDM5MTkxMiBcXFxuICogICAgIC0tcmVxdWlyZS1hcHByb3ZhbCBuZXZlclxuICpcbiAqIOKUgOKUgOKUgCDlhajliYrpmaTvvIhVQVQg55Kw5aKD44KS56C05qOE44GZ44KL5aC05ZCI77yJ4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gKiAgIC4vbm9kZV9tb2R1bGVzLy5iaW4vY2RrIGRlc3Ryb3kgLS1hbGwgXFxcbiAqICAgICAtLXByb2ZpbGUgUG93ZXJVc2VyQWNjZXNzLTgyMjgyNDM5MTkxMlxuICpcbiAqIOKUgOKUgOKUgCDjgrnjgr/jg4Pjgq/mp4vmiJAg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gKiAgIHVhdC1WcGNTdGFjayAgICAgICBWUEMgKE11bHRpLUFaLCBOQVTDlzEpXG4gKiAgIHVhdC1FY3JTdGFjayAgICAgICBFQ1Ig44Oq44Od44K444OI44OqIChuZ2lueCAvIGJmZiAvIGFwaSAvIG1vb2RsZSlcbiAqICAgdWF0LUJhY2tlbmRTdGFjayAgIFJEUyArIEVGUyArIEVDUyBGYXJnYXRlICsgQUxCICjjgrvjg4Pjg4jjgafnrqHnkIYpXG4gKiAgIHVhdC1TcGFTdGFjayAgICAgICBTMyArIENsb3VkRnJvbnQgKyBMYW1iZGFARWRnZSAodXMtZWFzdC0xKVxuICpcbiAqIOKUgOKUgOKUgCDjg4fjg5fjg63jgqTjg5Xjg63jg7wg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gKiAgIDEuIGNkayBkZXBsb3kgLS1hbGwgIChFQ1Ig5L2c5oiQKVxuICogICAyLiBkb2NrZXIgYnVpbGQgJiBwdXNoIOKGkiBFQ1JcbiAqICAgMy4gY2RrIGRlcGxveSB1YXQtQmFja2VuZFN0YWNrICAoRUNTIOOBjCBFQ1Ig44Kk44Oh44O844K444KS5Y+C54WnKVxuICogICA0LiBjZGsgZGVwbG95IHVhdC1TcGFTdGFjayAgKOODleODreODs+ODiOOCqOODs+ODieODk+ODq+ODieW+jClcbiAqXG4gKiDilIDilIDilIAg5rOo5oSPIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICogICAtIENvZ25pdG8gLyBBbnRocm9waWMg44Gu5YCk44KSIGNvbnRleHQg44Gn5rih44GV44Gq44GE5aC05ZCI44CBXG4gKiAgICAg44OH44OX44Ot44Kk5b6M44GrIFNlY3JldHMgTWFuYWdlciDjgafmiYvli5Xmm7TmlrDjgZcgRUNTIOOCkuWGjei1t+WLleOBmeOCi+OBk+OBqFxuICogICAtIGNvbnRlbnRUb2tlblNlY3JldCDjga8gQkZGIOOBriBDT05URU5UX1RPS0VOX1NFQ1JFVCDjgajlkIzjgZjlgKTjgpLkvb/jgYZcbiAqICAgLSBTUEEg44OH44OX44Ot44Kk5YmN44GrIGBjZCBmcm9udGVuZCAmJiBucG0gcnVuIGJ1aWxkYCDjgYzlv4XopoFcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVWF0VnBjU3RhY2sgfSBmcm9tICcuLi9saWIvdnBjLXN0YWNrJztcbmltcG9ydCB7IFVhdEVjclN0YWNrIH0gZnJvbSAnLi4vbGliL2Vjci1zdGFjayc7XG5pbXBvcnQgeyBVYXRCYWNrZW5kU3RhY2sgfSBmcm9tICcuLi9saWIvYmFja2VuZC1zdGFjayc7XG5pbXBvcnQgeyBVYXRTcGFTdGFjayB9IGZyb20gJy4uL2xpYi9zcGEtc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG5jb25zdCBlbnZOYW1lID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52JykgPz8gJ3VhdCc7XG5jb25zdCBhd3NBY2NvdW50ID0gcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVDtcbmNvbnN0IGF3c1JlZ2lvbiA9IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiA/PyAnYXAtbm9ydGhlYXN0LTEnO1xuXG5pZiAoIWF3c0FjY291bnQpIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgICdDREtfREVGQVVMVF9BQ0NPVU5UIOOBjOacquioreWumuOBp+OBmeOAglxcbicgK1xuICAgICcgIGV4cG9ydCBBV1NfUFJPRklMRT1Qb3dlclVzZXJBY2Nlc3MtODIyODI0MzkxOTEyIOOCkuWun+ihjOOBmeOCi+OBi+OAgVxcbicgK1xuICAgICcgIENES19ERUZBVUxUX0FDQ09VTlQ9PGFjY291bnRfaWQ+IOOCkueSsOWig+WkieaVsOOBq+ioreWumuOBl+OBpuOBj+OBoOOBleOBhOOAgidcbiAgKTtcbn1cblxuY29uc3QgZW52OiBjZGsuRW52aXJvbm1lbnQgPSB7IGFjY291bnQ6IGF3c0FjY291bnQsIHJlZ2lvbjogYXdzUmVnaW9uIH07XG5cbmNvbnN0IHRhZ3MgPSB7XG4gIFByb2plY3Q6ICdtb29kbGUtc3BhJyxcbiAgRW52aXJvbm1lbnQ6IGVudk5hbWUsXG4gIE1hbmFnZWRCeTogJ2Nkay11YXQnLFxufTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayAxOiBWUENcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuY29uc3QgdnBjU3RhY2sgPSBuZXcgVWF0VnBjU3RhY2soYXBwLCBgJHtlbnZOYW1lfS1WcGNTdGFja2AsIHtcbiAgZW52LCB0YWdzLCBlbnZOYW1lLFxufSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RhY2sgMjogRUNSIOODquODneOCuOODiOODqlxuLy8g5YWI44Gr44OH44OX44Ot44Kk44GX44GmIGRvY2tlciBwdXNoIOWPr+iDveOBqueKtuaFi+OBq+OBmeOCi1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5jb25zdCBlY3JTdGFjayA9IG5ldyBVYXRFY3JTdGFjayhhcHAsIGAke2Vudk5hbWV9LUVjclN0YWNrYCwge1xuICBlbnYsIHRhZ3MsIGVudk5hbWUsXG59KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBTdGFjayAzOiDjg5Djg4Pjgq/jgqjjg7Pjg4kgKFJEUyArIEVGUyArIEVDUyBGYXJnYXRlICsgQUxCKVxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5jb25zdCBiYWNrZW5kU3RhY2sgPSBuZXcgVWF0QmFja2VuZFN0YWNrKGFwcCwgYCR7ZW52TmFtZX0tQmFja2VuZFN0YWNrYCwge1xuICBlbnYsIHRhZ3MsIGVudk5hbWUsXG4gIHZwYzogdnBjU3RhY2sudnBjLFxuICBuZ2lueFJlcG86IGVjclN0YWNrLm5naW54UmVwbyxcbiAgYmZmUmVwbzogZWNyU3RhY2suYmZmUmVwbyxcbiAgYXBpUmVwbzogZWNyU3RhY2suYXBpUmVwbyxcbiAgbW9vZGxlUmVwbzogZWNyU3RhY2subW9vZGxlUmVwbyxcbiAgLy8gY29udGV4dCDjgafmuKHjgZnjgILnnIHnlaXmmYLjga8gU2VjcmV0cyBNYW5hZ2VyIOOBp+W+jOOBi+OCieaJi+WLleabtOaWsOWPr+iDveOAglxuICBjb2duaXRvVXNlclBvb2xJZDogYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnY29nbml0b1VzZXJQb29sSWQnKSxcbiAgY29nbml0b0NsaWVudElkOiBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdjb2duaXRvQ2xpZW50SWQnKSxcbiAgY29nbml0b0NsaWVudFNlY3JldDogYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnY29nbml0b0NsaWVudFNlY3JldCcpLFxuICBhbnRocm9waWNBcGlLZXk6IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2FudGhyb3BpY0FwaUtleScpLFxuICBtb29kbGVTaXRlVXJsOiBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdtb29kbGVTaXRlVXJsJyksXG4gIC8vIFNTSCDjgq3jg7zjg5rjgqLlkI3vvIjnnIHnlaXmmYLjga8gU1NNIFNlc3Npb24gTWFuYWdlciDjga7jgb/vvIlcbiAga2V5UGFpck5hbWU6IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2tleVBhaXJOYW1lJyksXG4gIC8vIOWIneWbnuODh+ODl+ODreOCpDogRUNSIOOBq+OCpOODoeODvOOCuOOBjOOBquOBhOWgtOWQiOOBryAwIOOBq+OBmeOCi1xuICBkZXNpcmVkQ291bnQ6IE51bWJlcihhcHAubm9kZS50cnlHZXRDb250ZXh0KCdkZXNpcmVkQ291bnQnKSA/PyAnMScpLFxufSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gU3RhY2sgNDogU1BBIChTMyArIENsb3VkRnJvbnQgKyBMYW1iZGFARWRnZSlcbi8vIExhbWJkYUBFZGdlIOOBryB1cy1lYXN0LTEg44Gr5by35Yi244GV44KM44KL44Gf44KBIGVudiDjgpLkuIrmm7jjgY1cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxubmV3IFVhdFNwYVN0YWNrKGFwcCwgYCR7ZW52TmFtZX0tU3BhU3RhY2tgLCB7XG4gIGVudjogeyBhY2NvdW50OiBhd3NBY2NvdW50LCByZWdpb246ICd1cy1lYXN0LTEnIH0sXG4gIHRhZ3MsXG4gIGVudk5hbWUsXG59KTtcblxuLy8g5L6d5a2Y6Zai5L+C44Gu5piO56S6XG5iYWNrZW5kU3RhY2suYWRkRGVwZW5kZW5jeSh2cGNTdGFjayk7XG5iYWNrZW5kU3RhY2suYWRkRGVwZW5kZW5jeShlY3JTdGFjayk7XG5cbmFwcC5zeW50aCgpO1xuIl19