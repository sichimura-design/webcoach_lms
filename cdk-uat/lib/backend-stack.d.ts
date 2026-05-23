import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
export interface UatBackendStackProps extends cdk.StackProps {
    readonly envName: string;
    readonly vpc: ec2.Vpc;
    readonly nginxRepo: ecr.Repository;
    readonly bffRepo: ecr.Repository;
    readonly apiRepo: ecr.Repository;
    readonly moodleRepo: ecr.Repository;
    readonly cognitoUserPoolId?: string;
    readonly cognitoClientId?: string;
    readonly cognitoClientSecret?: string;
    readonly anthropicApiKey?: string;
    /**
     * Moodle の wwwroot URL。ALB DNS 名または独自ドメイン。
     * 初回デプロイ時は省略可。ALB 確定後に再デプロイで設定する。
     */
    readonly moodleSiteUrl?: string;
    /**
     * SSH アクセス用キーペア名。指定するとEC2にSSH可能になる。
     * UAT での直接デバッグに使用。省略時は SSM Session Manager のみ。
     */
    readonly keyPairName?: string;
    /** ECR にイメージがない初回デプロイ時は 0 を指定 */
    readonly desiredCount?: number;
}
/**
 * ECS EC2 起動タイプによる UAT バックエンドスタック。
 *
 * ネットワークモード: HOST
 *   → 全コンテナが EC2 ホストのネットワークを共有
 *   → docker-compose と同じく localhost で相互通信可能
 *   → EC2 に SSH または ECS Exec でコンテナに入り、ファイル編集が可能
 *
 * コンテナ構成 (1タスク):
 *   nginx     :80   → リバースプロキシ
 *   bff-server:3001 → BFF (Moodle セッション認証)
 *   api-server:8001 → API サーバー
 *   moodle-app:8080 → Moodle 本体 (moodledata は EFS)
 */
export declare class UatBackendStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: UatBackendStackProps);
}
