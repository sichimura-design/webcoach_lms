#!/usr/bin/env node
"use strict";
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
const rds_stack_1 = require("./rds-stack");
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
// RDS（dev-moodle-vpc を使い回す。VPC は RdsStack 内で fromLookup する）
new rds_stack_1.UatRdsStack(app, `${envName}-RdsStack`, {
    env, tags, envName,
    vpcId: 'vpc-078369fe5efc5e688',
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmRzLWFwcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJkcy1hcHAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXNCRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsMkNBQTBDO0FBRTFDLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUN2RCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO0FBQ25ELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksZ0JBQWdCLENBQUM7QUFFckUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQ2IsK0JBQStCO1FBQy9CLDZEQUE2RDtRQUM3RCxvREFBb0QsQ0FDckQsQ0FBQztBQUNKLENBQUM7QUFFRCxNQUFNLEdBQUcsR0FBb0IsRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsQ0FBQztBQUV4RSxNQUFNLElBQUksR0FBRztJQUNYLE9BQU8sRUFBRSxZQUFZO0lBQ3JCLFdBQVcsRUFBRSxPQUFPO0lBQ3BCLFNBQVMsRUFBRSxTQUFTO0NBQ3JCLENBQUM7QUFFRiw0REFBNEQ7QUFDNUQsSUFBSSx1QkFBVyxDQUFDLEdBQUcsRUFBRSxHQUFHLE9BQU8sV0FBVyxFQUFFO0lBQzFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsT0FBTztJQUNsQixLQUFLLEVBQUUsdUJBQXVCO0NBQy9CLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qKlxuICogVUFUIFJEUyDljZjkvZPjg4fjg5fjg63jgqTnlKggQ0RLIOOCqOODs+ODiOODquODneOCpOODs+ODiFxuICpcbiAqIGRldi1tb29kbGUtdnBjICh2cGMtMDc4MzY5ZmU1ZWZjNWU2ODgpIOOCkuS9v+OBhOWbnuOBl+OBpiBSRFMg44Gg44GR56uL44Gh5LiK44GS44KL44CCXG4gKiBWUEMgUXVvdGEg44Gu5LiK6ZmQ44Gr6YGU44GX44Gm44GE44KL44Gf44KB5paw6KaPIFZQQyDjga/kvZzmiJDjgZfjgarjgYTjgIJcbiAqXG4gKiDilIDilIDilIAg44OH44OX44Ot44KkIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuICogICBjZCBjZGstdWF0XG4gKiAgIC4vbm9kZV9tb2R1bGVzLy5iaW4vY2RrIGRlcGxveSAtLWFsbCBcXFxuICogICAgIC0tYXBwICducHggdHMtbm9kZSAtLXByZWZlci10cy1leHRzIHRlc3QvcmRzLWFwcC50cycgXFxcbiAqICAgICAtLXByb2ZpbGUgUG93ZXJVc2VyQWNjZXNzLTgyMjgyNDM5MTkxMiBcXFxuICogICAgIC0tcmVxdWlyZS1hcHByb3ZhbCBuZXZlclxuICpcbiAqIOKUgOKUgOKUgCBkaWZmIOeiuuiqjSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcbiAqICAgLi9ub2RlX21vZHVsZXMvLmJpbi9jZGsgZGlmZiAtLWFsbCBcXFxuICogICAgIC0tYXBwICducHggdHMtbm9kZSAtLXByZWZlci10cy1leHRzIHRlc3QvcmRzLWFwcC50cycgXFxcbiAqICAgICAtLXByb2ZpbGUgUG93ZXJVc2VyQWNjZXNzLTgyMjgyNDM5MTkxMlxuICpcbiAqIOKUgOKUgOKUgCDliYrpmaQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG4gKiAgIC4vbm9kZV9tb2R1bGVzLy5iaW4vY2RrIGRlc3Ryb3kgLS1hbGwgXFxcbiAqICAgICAtLWFwcCAnbnB4IHRzLW5vZGUgLS1wcmVmZXItdHMtZXh0cyB0ZXN0L3Jkcy1hcHAudHMnIFxcXG4gKiAgICAgLS1wcm9maWxlIFBvd2VyVXNlckFjY2Vzcy04MjI4MjQzOTE5MTJcbiAqL1xuXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVWF0UmRzU3RhY2sgfSBmcm9tICcuL3Jkcy1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbmNvbnN0IGVudk5hbWUgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdlbnYnKSA/PyAndWF0JztcbmNvbnN0IGF3c0FjY291bnQgPSBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5UO1xuY29uc3QgYXdzUmVnaW9uID0gcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OID8/ICdhcC1ub3J0aGVhc3QtMSc7XG5cbmlmICghYXdzQWNjb3VudCkge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgJ0NES19ERUZBVUxUX0FDQ09VTlQg44GM5pyq6Kit5a6a44Gn44GZ44CCXFxuJyArXG4gICAgJyAgZXhwb3J0IEFXU19QUk9GSUxFPVBvd2VyVXNlckFjY2Vzcy04MjI4MjQzOTE5MTIg44KS5a6f6KGM44GZ44KL44GL44CBXFxuJyArXG4gICAgJyAgQ0RLX0RFRkFVTFRfQUNDT1VOVD08YWNjb3VudF9pZD4g44KS55Kw5aKD5aSJ5pWw44Gr6Kit5a6a44GX44Gm44GP44Gg44GV44GE44CCJyxcbiAgKTtcbn1cblxuY29uc3QgZW52OiBjZGsuRW52aXJvbm1lbnQgPSB7IGFjY291bnQ6IGF3c0FjY291bnQsIHJlZ2lvbjogYXdzUmVnaW9uIH07XG5cbmNvbnN0IHRhZ3MgPSB7XG4gIFByb2plY3Q6ICdtb29kbGUtc3BhJyxcbiAgRW52aXJvbm1lbnQ6IGVudk5hbWUsXG4gIE1hbmFnZWRCeTogJ2Nkay11YXQnLFxufTtcblxuLy8gUkRT77yIZGV2LW1vb2RsZS12cGMg44KS5L2/44GE5Zue44GZ44CCVlBDIOOBryBSZHNTdGFjayDlhoXjgacgZnJvbUxvb2t1cCDjgZnjgovvvIlcbm5ldyBVYXRSZHNTdGFjayhhcHAsIGAke2Vudk5hbWV9LVJkc1N0YWNrYCwge1xuICBlbnYsIHRhZ3MsIGVudk5hbWUsXG4gIHZwY0lkOiAndnBjLTA3ODM2OWZlNWVmYzVlNjg4Jyxcbn0pO1xuXG5hcHAuc3ludGgoKTtcbiJdfQ==