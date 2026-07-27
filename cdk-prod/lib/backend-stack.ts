import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ProdBackendStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.Vpc;
  /** alb-stack で作成した ALB の SG。ECS EC2 SG のインバウンド許可元として使う。 */
  readonly albSecurityGroup: ec2.ISecurityGroup;
  readonly cognitoUserPoolId?: string;
  readonly cognitoClientId?: string;
  readonly cognitoClientSecret?: string;
  readonly anthropicApiKey?: string;
  /** BFF の署名付きコンテンツURL用シークレット (SpaStack の contentTokenSecret と同じ値を使う) */
  readonly contentTokenSecret?: string;
  /** api-server ⇔ bff-server 間の内部API認証キー */
  readonly internalApiKey?: string;
  /** BFF セッション用シークレット */
  readonly sessionSecret?: string;
  /** Moodle Web Service アカウントのパスワード */
  readonly moodleServicePassword?: string;
}

/**
 * 本番データ層スタック: EFS + Secrets Manager (Cognito/Anthropic/App)
 *
 * RDS は含まない。既存の prod-RdsStack (bin/rds-app.ts、CREATE_COMPLETE 済み) を
 * そのまま使う。prod-RdsStack は `prod-DbEndpoint` / `prod-DbSecretArn` /
 * `prod-RdsSgId` という CloudFormation Export 名を既に使用しているため、
 * このスタックで同名の RDS を作ると Export 名衝突でデプロイに失敗する。
 * ecs-stack 側で `cdk.Fn.importValue(...)` により prod-RdsStack の Export を
 * 直接参照する。
 *
 * ECS (Cluster/Service/TaskDefinition) は ecs-stack.ts に分離されている。
 * アプリ側の再デプロイ (コンテナ更新など) がこのスタックに影響しないようにするため。
 *
 * ec2SecurityGroup はここで作成し ecs-stack へ渡す (ecs-stack のEC2キャパシティに
 * アタッチされる)。EFS の Ingress 許可元をこのスタック側で定義する都合上、
 * ecs-stack → backend-stack への一方向の依存関係のみに保つため、SG自体はここで
 * 作成する (循環依存を避けるため、逆方向の参照は持たせない)。
 * なお RDS 側 (prod-RdsStack の rdsSg) は VPC CIDR 全体からの 3306 を許可済みのため、
 * ec2SecurityGroup からの個別 Ingress 追加は不要。
 *
 * UAT との主な差異:
 *   - EFS / Secrets: RemovalPolicy.RETAIN
 */
export class ProdBackendStack extends cdk.Stack {
  public readonly ec2SecurityGroup: ec2.SecurityGroup;
  public readonly fileSystem: efs.FileSystem;
  public readonly moodledataAccessPoint: efs.AccessPoint;
  public readonly moodleAppAccessPoint: efs.AccessPoint;
  public readonly cognitoSecret: secretsmanager.ISecret;
  public readonly anthropicSecret: secretsmanager.ISecret;
  public readonly appSecrets: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: ProdBackendStackProps) {
    super(scope, id, props);

    const {
      envName, vpc,
      albSecurityGroup,
      cognitoUserPoolId, cognitoClientId, cognitoClientSecret, anthropicApiKey,
      contentTokenSecret,
      internalApiKey,
      sessionSecret,
      moodleServicePassword,
    } = props;

    // ========================================
    // Security Groups
    // ========================================
    // ECS EC2 インスタンス用 SG。ecs-stack のASGにアタッチされる。
    // HOST ネットワークモードでは EC2 インスタンスの SG がコンテナに適用される
    const ec2Sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
      vpc,
      securityGroupName: `${envName}-lms-ec2-sg`,
      description: 'ECS EC2 instance security group',
      allowAllOutbound: true,
    });
    ec2Sg.addIngressRule(albSecurityGroup, ec2.Port.tcp(80), 'HTTP from ALB');
    this.ec2SecurityGroup = ec2Sg;

    const efsSg = new ec2.SecurityGroup(this, 'EfsSg', {
      vpc,
      securityGroupName: `${envName}-lms-efs-sg`,
      description: 'EFS security group',
      allowAllOutbound: false,
    });
    efsSg.addIngressRule(ec2Sg, ec2.Port.tcp(2049), 'NFS from ECS EC2');

    // ========================================
    // Secrets Manager
    // ========================================
    const cognitoSecret = new secretsmanager.Secret(this, 'CognitoSecret', {
      secretName: `${envName}/lms/cognito-credentials`,
      secretObjectValue: {
        userPoolId: cdk.SecretValue.unsafePlainText(cognitoUserPoolId ?? 'REPLACE_ME'),
        clientId: cdk.SecretValue.unsafePlainText(cognitoClientId ?? 'REPLACE_ME'),
        clientSecret: cdk.SecretValue.unsafePlainText(cognitoClientSecret ?? 'REPLACE_ME'),
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.cognitoSecret = cognitoSecret;

    const anthropicSecret = new secretsmanager.Secret(this, 'AnthropicSecret', {
      secretName: `${envName}/lms/anthropic-api-key`,
      secretStringValue: cdk.SecretValue.unsafePlainText(anthropicApiKey ?? 'REPLACE_ME'),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.anthropicSecret = anthropicSecret;

    // アプリ側シークレット (content-token / internal-api-key / session / moodle-service-password)
    // すべて未指定時は 'REPLACE_ME' で作成し、デプロイ後に手動で put-secret-value する。
    const appSecrets = new secretsmanager.Secret(this, 'AppSecrets', {
      secretName: `${envName}/lms/app-secrets`,
      secretObjectValue: {
        contentTokenSecret: cdk.SecretValue.unsafePlainText(contentTokenSecret ?? 'REPLACE_ME'),
        internalApiKey: cdk.SecretValue.unsafePlainText(internalApiKey ?? 'REPLACE_ME'),
        sessionSecret: cdk.SecretValue.unsafePlainText(sessionSecret ?? 'REPLACE_ME'),
        moodleServicePassword: cdk.SecretValue.unsafePlainText(moodleServicePassword ?? 'REPLACE_ME'),
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.appSecrets = appSecrets;

    // ========================================
    // EFS (moodledata 永続化)
    // ========================================
    const fileSystem = new efs.FileSystem(this, 'MoodleEfs', {
      vpc,
      fileSystemName: `${envName}-lms-efs`,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroup: efsSg,
      encrypted: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_30_DAYS,
    });
    this.fileSystem = fileSystem;

    this.moodledataAccessPoint = fileSystem.addAccessPoint('MoodledataAP', {
      path: '/moodledata',
      createAcl: { ownerUid: '1', ownerGid: '1', permissions: '755' },
      posixUser: { uid: '1', gid: '1' },
    });

    // Bitnami Moodle イメージの is_app_initialized は BITNAMI_VOLUME_DIR/moodle
    // (= /bitnami/moodle) の中身が空かどうかで「初回起動」を判定する。
    // ここを永続化していないと、コンテナ再作成のたびに「持続化済み」と誤認識され
    // config.php が存在しないまま復元処理に入りクラッシュする。
    this.moodleAppAccessPoint = fileSystem.addAccessPoint('MoodleAppAP', {
      path: '/moodleapp',
      createAcl: { ownerUid: '1', ownerGid: '1', permissions: '755' },
      posixUser: { uid: '1', gid: '1' },
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'CognitoSecretArn', {
      value: cognitoSecret.secretArn,
      description: 'デプロイ後に手動更新: aws secretsmanager put-secret-value ...',
      exportName: `${envName}-CognitoSecretArn`,
    });

    new cdk.CfnOutput(this, 'EfsId', {
      value: fileSystem.fileSystemId,
      exportName: `${envName}-EfsId`,
    });
  }
}
