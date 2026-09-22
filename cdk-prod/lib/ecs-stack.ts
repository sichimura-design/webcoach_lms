import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';

export interface ProdEcsStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.Vpc;
  /** webcoach-lms リポジトリ (タグでコンテナを区別) */
  readonly repository: ecr.Repository;
  /** alb-stack で作成した空のターゲットグループの ARN。ECS サービス作成後にアタッチする。 */
  readonly targetGroupArn: string;
  /** backend-stack (データ層) で作成した ECS EC2 インスタンス用 SG。EFS の Ingress 許可元として backend-stack 側で先に定義されている。 */
  readonly ec2SecurityGroup: ec2.ISecurityGroup;
  /** 既存 prod-RdsStack (bin/rds-app.ts) の RDS エンドポイント。cdk.Fn.importValue で解決した値を渡す。 */
  readonly databaseEndpointAddress: string;
  /** 既存 prod-RdsStack の RDS ポート。cdk.Fn.importValue で解決した値を渡す。 */
  readonly databaseEndpointPort: string;
  /** 既存 prod-RdsStack の DB 認証情報シークレット ARN。cdk.Fn.importValue で解決した値を渡す。 */
  readonly dbSecretArn: string;
  /** backend-stack の EFS (moodledata 永続化) */
  readonly fileSystem: efs.FileSystem;
  /** backend-stack の EFS アクセスポイント (/moodledata 永続化) */
  readonly moodledataAccessPoint: efs.AccessPoint;
  /** backend-stack の EFS アクセスポイント (/bitnami/moodle アプリ本体の永続化。Bitnami イメージの初回起動判定に必須) */
  readonly moodleAppAccessPoint: efs.AccessPoint;
  readonly cognitoSecret: secretsmanager.ISecret;
  readonly anthropicSecret: secretsmanager.ISecret;
  readonly appSecrets: secretsmanager.ISecret;
  readonly cognitoUserPoolId?: string;
  readonly cognitoClientId?: string;
  /** Moodle の wwwroot URL。ALB DNS 名または独自ドメイン。*/
  readonly moodleSiteUrl?: string;
  /** 初回デプロイ: ECR にイメージがない場合は 0 を指定 */
  readonly desiredCount?: number;
  /** BFF/API の CORS 許可オリジン (カンマ区切り) */
  readonly allowedOrigins?: string;
  /** Moodle Web Service のショートネーム */
  readonly moodleServiceName?: string;
  /** Moodle Web Service 用アカウントのユーザー名 */
  readonly moodleServiceUsername?: string;
  /** Moodle 初回インストール時に作成する管理者アカウントのメールアドレス */
  readonly moodleAdminEmail?: string;
  /** Moodle 既定言語 */
  readonly moodleLang?: string;
  /** api-server のベクトルDB実装 (faiss / chromadb 等) */
  readonly vectorDbEnv?: string;
  /** prod-SpaStack デプロイ後に出力される CloudFront ドメイン。先にSpaStackをデプロイしてから渡す。 */
  readonly cloudfrontDomain?: string;
  /** prod-SpaStack デプロイ後に出力される S3 バケット名。先にSpaStackをデプロイしてから渡す。 */
  readonly s3BucketName?: string;
}

/**
 * 本番 ECS スタック: Cluster + EC2キャパシティ + TaskDefinition + Service
 *
 * RDS は既存の prod-RdsStack (bin/rds-app.ts、CREATE_COMPLETE 済み) を
 * cdk.Fn.importValue 経由でそのまま利用する (新規作成しない)。
 * EFS / Secrets Manager (Cognito/Anthropic/App) は backend-stack (データ層) が所有し、
 * このスタックは props 経由で参照するのみ (アプリ側の再デプロイで
 * データ層に影響が出ないようにするため)。
 *
 * ALB / ターゲットグループは alb-stack で先行作成し、ここでは
 * ECS サービスをそのターゲットグループにアタッチするのみ。
 *
 * ECR: webcoach-lms リポジトリのタグでコンテナを区別
 *   moodle-nginx-latest  / moodle-bff-latest
 *   moodle-api-latest    / moodle-custom-latest
 *
 * UAT との主な差異:
 *   - ECS: Private サブネット配置 / desiredCount=2 / EC2 最小 2 台
 *   - CloudWatch: 1 ヶ月保持
 */
export class ProdEcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProdEcsStackProps) {
    super(scope, id, props);

    const {
      envName, vpc, repository,
      targetGroupArn,
      ec2SecurityGroup,
      databaseEndpointAddress, databaseEndpointPort, dbSecretArn,
      fileSystem, moodledataAccessPoint, moodleAppAccessPoint,
      cognitoSecret, anthropicSecret, appSecrets,
      cognitoUserPoolId, cognitoClientId,
      moodleSiteUrl,
      desiredCount = 2,
      allowedOrigins,
      moodleServiceName,
      moodleServiceUsername,
      moodleAdminEmail,
      moodleLang,
      vectorDbEnv,
      cloudfrontDomain,
      s3BucketName,
    } = props;

    // 既存 prod-RdsStack のシークレットを ARN からインポート
    const dbSecret = secretsmanager.Secret.fromSecretCompleteArn(this, 'DbSecret', dbSecretArn);

    // ========================================
    // CloudWatch Logs
    // ========================================
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/${envName}/lms`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // ECS Cluster + EC2 キャパシティ
    // ========================================
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: `${envName}-lms-cluster`,
      containerInsights: true,
    });

    // 本番: Private サブネット配置 (NAT 経由でアウトバウンド通信)
    // NAT Gateway が vpc-stack.ts で1個(availabilityZones[0])のみのため、
    // AZ間データ転送料金を避けるためECSもそのAZに寄せる。
    const asg = cluster.addCapacity('Ec2Capacity', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.XLARGE),
      minCapacity: 2,
      maxCapacity: 4,
      desiredCapacity: 2,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        availabilityZones: [vpc.availabilityZones[0]],
      },
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: autoscaling.BlockDeviceVolume.ebs(50, {
            volumeType: autoscaling.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    asg.addSecurityGroup(ec2SecurityGroup);
    asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
    );
    asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
    );
    asg.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'elasticfilesystem:ClientMount',
        'elasticfilesystem:ClientWrite',
        'elasticfilesystem:ClientRootAccess',
      ],
      resources: [fileSystem.fileSystemArn],
    }));
    asg.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
      resources: [
        dbSecret.secretArn,
        cognitoSecret.secretArn,
        anthropicSecret.secretArn,
        appSecrets.secretArn,
      ],
    }));

    // ========================================
    // ECS Task Definition (EC2 / HOST ネットワーク)
    // ========================================
    const taskDef = new ecs.Ec2TaskDefinition(this, 'TaskDef', {
      family: `${envName}-lms-task`,
      networkMode: ecs.NetworkMode.HOST,
      volumes: [
        {
          name: 'moodledata',
          efsVolumeConfiguration: {
            fileSystemId: fileSystem.fileSystemId,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId: moodledataAccessPoint.accessPointId,
              iam: 'ENABLED',
            },
          },
        },
        {
          name: 'moodleapp',
          efsVolumeConfiguration: {
            fileSystemId: fileSystem.fileSystemId,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId: moodleAppAccessPoint.accessPointId,
              iam: 'ENABLED',
            },
          },
        },
      ],
    });

    taskDef.addToExecutionRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
      resources: [
        dbSecret.secretArn,
        cognitoSecret.secretArn,
        anthropicSecret.secretArn,
        appSecrets.secretArn,
      ],
    }));

    // ----------------------------------------
    // 各コンテナイメージ: webcoach-lms リポジトリのタグで区別
    // ----------------------------------------
    const nginxContainer = taskDef.addContainer('nginx', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'moodle-nginx-latest'),
      memoryLimitMiB: 256,
      cpu: 256,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'nginx', logGroup }),
      portMappings: [{ containerPort: 80, protocol: ecs.Protocol.TCP }],
      essential: true,
      environment: {
        BFF_HOST: 'localhost:3001',
        API_HOST: 'localhost:8001',
        MOODLE_HOST: 'localhost:8080',
      },
    });

    const bffContainer = taskDef.addContainer('bff-server', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'moodle-bff-latest'),
      memoryLimitMiB: 512,
      cpu: 512,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'bff', logGroup }),
      portMappings: [{ containerPort: 3001, protocol: ecs.Protocol.TCP }],
      essential: true,
      environment: {
        NODE_ENV: 'production',
        MOODLE_URL: 'http://localhost:8080',
        API_SERVER_URL: 'http://localhost:8001',
        MOODLE_SERVICE_NAME: moodleServiceName ?? 'moodle-api-service',
        MOODLE_SERVICE_USERNAME: moodleServiceUsername ?? 'admin',
        ALLOWED_ORIGINS: allowedOrigins ?? '',
        COGNITO_REGION: this.region,
        ...(cloudfrontDomain ? { CLOUDFRONT_DOMAIN: cloudfrontDomain } : {}),
        ...(s3BucketName ? { S3_BUCKET_NAME: s3BucketName } : {}),
      },
      secrets: {
        COGNITO_USER_POOL_ID: ecs.Secret.fromSecretsManager(cognitoSecret, 'userPoolId'),
        COGNITO_CLIENT_ID: ecs.Secret.fromSecretsManager(cognitoSecret, 'clientId'),
        COGNITO_CLIENT_SECRET: ecs.Secret.fromSecretsManager(cognitoSecret, 'clientSecret'),
        CONTENT_TOKEN_SECRET: ecs.Secret.fromSecretsManager(appSecrets, 'contentTokenSecret'),
        INTERNAL_API_KEY: ecs.Secret.fromSecretsManager(appSecrets, 'internalApiKey'),
        SESSION_SECRET: ecs.Secret.fromSecretsManager(appSecrets, 'sessionSecret'),
        MOODLE_SERVICE_PASSWORD: ecs.Secret.fromSecretsManager(appSecrets, 'moodleServicePassword'),
      },
    });

    const apiContainer = taskDef.addContainer('api-server', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'moodle-api-latest'),
      memoryLimitMiB: 1024,
      cpu: 1024,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup }),
      portMappings: [{ containerPort: 8001, protocol: ecs.Protocol.TCP }],
      essential: true,
      environment: {
        MOODLE_DB_HOST: databaseEndpointAddress,
        MOODLE_DB_PORT: databaseEndpointPort,
        MOODLE_DB_NAME: 'moodle',
        MOODLE_URL: 'http://localhost:8080',
        ALLOWED_ORIGINS: allowedOrigins ?? '',
        VECTOR_DB_ENV: vectorDbEnv ?? 'faiss',
        COGNITO_REGION: this.region,
        ...(cognitoUserPoolId ? { COGNITO_USER_POOL_ID: cognitoUserPoolId } : {}),
        ...(cognitoClientId ? { COGNITO_CLIENT_ID: cognitoClientId } : {}),
        ...(s3BucketName ? { S3_BUCKET_NAME: s3BucketName } : {}),
      },
      secrets: {
        MOODLE_DB_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        MOODLE_DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(anthropicSecret),
      },
    });

    const moodleContainer = taskDef.addContainer('moodle-app', {
      // 2026-08-01: 'moodle-app-latest' タグを使い回すと、再pushしてもECSホストが古い
      // digestをそのまま使い続ける事象を確認(docker rmiで削除しても再pull時に同じ古い
      // レイヤーが復元される謎のキャッシュ不整合)。曖昧さを排除するため、DB接続修正版は
      // 専用タグを直接指定する。
      // 2026-08-02: 生mysqlコマンドに差し替えても症状不変のため、実際のmysqlエラー内容を
      // ログに出す debug タグに一時切り替え(原因特定のため)。
      // 2026-08-02: 根本原因(config.phpのdbpassがgetenv()式でmoodle_conf_get()に
      // 誤読されていた問題)を特定・修正済み。デバッグ用の平文パスワードログを
      // 削除したクリーン版タグに戻す。
      image: ecs.ContainerImage.fromEcrRepository(repository, 'moodle-app-dbfix-20260802-clean'),
      memoryLimitMiB: 2048,
      cpu: 2048,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'lms', logGroup }),
      portMappings: [{ containerPort: 8080, protocol: ecs.Protocol.TCP }],
      essential: true,
      // webcoach-lms:moodle-app-latest イメージは /bitnami/moodle 配下に
      // カスタムプラグイン(local/webcoach_tags, local/webcoach_utils, oauth2_debug.php)を
      // ビルド時にCOPYしている。ECSのEFSマウントはDockerの「volume」として扱われるため、
      // マウント先(/bitnami/moodle)が空だと、Dockerがイメージ内の同パスの中身を
      // 自動的にvolumeへコピーしてしまう(bind mountでは起きない、volume特有の挙動)。
      // これにより実際には一度もインストールが完了していないのに永続化ディレクトリが
      // 「非空」に見えてしまい、Bitnamiエントリポイントが「復元」分岐に入って
      // config.php不在でクラッシュする(exitCode 2)。
      // 本来の修正はイメージ側のCOPY先を /opt/bitnami/moodle/local に変更することだが、
      // このイメージのDockerfileソースが手元にないため、entrypointをラップして
      // 「本物の永続化インストールかどうか(version.phpの有無)」を実行時に判定し、
      // 偽物(イメージ由来のゴミ)であれば起動前にクリアしてから本来のentrypointへ渡す。
      entryPoint: ['sh', '-c'],
      // 2026-07-30: 新規タスク起動時、moodle-appが「DB接続後60秒でタイムアウト」して
      // 毎回失敗する問題を確認(本番のRDS/SG/認証情報は全て正常。手動でECS Exec経由から
      // 全く同じ接続チェック関数を同じ環境変数・同じuid:gidで実行すると常に一瞬で成功するため、
      // 実際のブートチェーン固有の一過性の要因と推測されるが、ECS Exec経由の外部観測では
      // 根本原因を特定できなかった)。2回目以降の呼び出しは必ず成功する、という経験則から
      // entrypoint.shの呼び出し自体を最大3回までリトライする対応を入れたが、2026-08-01の
      // 本番障害では3回とも失敗するケースを確認。ネットワーク(ENI/awsvpc)確立の遅延が
      // 3回×60秒(=約3分)の範囲を超えて長引く場合があると推測されるため、各試行の前に
      // 5秒の待機を挟んで初回接続の成功率を上げる。リトライ上限はECSヘルスチェックの
      // startPeriod上限(300秒)以内に収める必要があるため4回(約4分)とする。
      // entrypoint.shが成功すると内部でexecしてApache/PHP-FPMがそのまま動き続けるため、
      // このループは通常時は初回の1回で内側のプロセスをブロックしたまま返ってこない。
      command: [
        [
          'i=0;',
          'while [ "$i" -lt 4 ]; do',
          '  i=$((i+1));',
          '  if [ ! -f /bitnami/moodle/version.php ]; then',
          '    echo "[webcoach-fix] /bitnami/moodle has no real persisted install (version.php missing) - clearing stale content before entrypoint";',
          '    find /bitnami/moodle -mindepth 1 -delete;',
          '  fi;',
          '  sleep 5;',
          '  /opt/bitnami/scripts/moodle/entrypoint.sh /opt/bitnami/scripts/moodle/run.sh;',
          '  rc=$?;',
          '  if [ "$rc" -eq 0 ]; then exit 0; fi;',
          '  echo "[webcoach-fix] entrypoint attempt $i failed (exit $rc), retrying...";',
          'done;',
          'echo "[webcoach-fix] entrypoint failed after $i attempts, giving up";',
          'exit "$rc"',
        ].join(' '),
      ],
      environment: {
        MOODLE_DATABASE_HOST: databaseEndpointAddress,
        // 2026-08-02: Bitnamiが実際に読む変数名はMOODLE_DATABASE_PORT_NUMBER。
        // これまで未設定でBitnami側のデフォルト(3306)に依存していたため明示的に設定。
        MOODLE_DATABASE_PORT_NUMBER: databaseEndpointPort,
        MOODLE_DATABASE_NAME: 'moodle',
        MOODLE_DATABASE_TYPE: 'mysqli',
        // Bitnami イメージが実際に読むのは MOODLE_DATA_DIR (MOODLE_DATAROOT ではない)。
        MOODLE_DATA_DIR: '/moodledata',
        MOODLE_SITE_URL: moodleSiteUrl ?? 'REPLACE_ME',
        MOODLE_SESSION_HANDLER: 'database',
        MOODLE_LANG: moodleLang ?? 'ja',
        // 2026-07-24: 「既存498テーブル」は実際には admin/user/context 等の
        // 基礎データを含まない未完了インストールだったと判明 (mdl_user=0, mdl_context=0)。
        // スキーマは全DROP済み(手動スナップショット取得後)。Moodle標準インストーラーに
        // スキーマ作成〜システムコンテキスト/管理者ユーザー/フロントページコース作成まで
        // 一通り完走させる。
        MOODLE_SKIP_BOOTSTRAP: 'no',
        // ここで作成される初期管理者アカウントは、bff-server が Web Service 経由で
        // ログインするサービスアカウント (MOODLE_SERVICE_USERNAME/MOODLE_SERVICE_PASSWORD、
        // 上記 bffContainer 参照) と同一ユーザー名・パスワードにしておくことで、
        // 初回インストール完了後すぐに bff-server が疎通できるようにする。
        MOODLE_USERNAME: moodleServiceUsername ?? 'admin',
        MOODLE_EMAIL: moodleAdminEmail ?? 'admin@webcoach.jp',
        MOODLE_SITE_NAME: 'WebCoach',
      },
      secrets: {
        MOODLE_DATABASE_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        MOODLE_DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        MOODLE_PASSWORD: ecs.Secret.fromSecretsManager(appSecrets, 'moodleServicePassword'),
      },
      // 2026-07-26: このイメージ (Bitnami moodle base) には curl/wget が存在しないため、
      // 元の `curl -f ...` ヘルスチェックは常に exit 127 で失敗していた
      // (アプリが実際に正常でも UNHEALTHY のまま)。bash 組み込みの /dev/tcp で
      // TCP 接続確認のみ行う (HTTP レスポンス内容までは見ないが、Apache が
      // リッスンしているかどうかの確認としては十分)。
      healthCheck: {
        command: ['CMD-SHELL', 'bash -c "echo > /dev/tcp/127.0.0.1/8080" || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        // Moodle の初回起動はインストール処理が走るため、Bitnami イメージ既定の60秒より長めに確保。
        // 2026-08-01: entrypoint再試行を最大4回(各試行 約60秒+5秒待機、最悪ケースで約260秒)に
        // 拡大したため、ヘルスチェックがそれより先にUNHEALTHY判定してタスクを殺してしまわない
        // よう、ECSの上限値(300秒)まで延長。
        startPeriod: cdk.Duration.seconds(300),
        retries: 3,
      },
      // 2026-07-26: このタスクが使う EFS アクセスポイント (backend-stack.ts の
      // moodledataAccessPoint/moodleAppAccessPoint) は posixUser を uid=1/gid=1 (daemon) で
      // 強制している。イメージ本体は Dockerfile.moodle-ja で `USER 1001` になっており、
      // コンテナのプロセスuid(1001)とEFS上のファイル実所有者(uid=1、アクセスポイント越しの
      // 全操作がこのuidに強制される)が食い違うと、Moodle標準のセッションファイル所有者検証
      // (lib/classes/session/handler.php) が毎回失敗し、全リクエストが500になる
      // (「Session data file is not created by your uid」)。EFSアクセスポイントは作成後に
      // posixUserを変更できない(削除→再作成が必要でリスクが高い)ため、コンテナ側の実行uidを
      // アクセスポイント側に合わせるほうが安全な恒久対応。
      user: '1:0',
    });

    moodleContainer.addMountPoints({
      sourceVolume: 'moodledata',
      containerPath: '/moodledata',
      readOnly: false,
    });

    moodleContainer.addMountPoints({
      sourceVolume: 'moodleapp',
      containerPath: '/bitnami/moodle',
      readOnly: false,
    });

    // bff-server はサービスアカウント認証のため起動時に moodle-app へ接続する。
    // moodle-app (Bitnami イメージのビルトイン HEALTHCHECK) が HEALTHY になるまで待つ。
    bffContainer.addContainerDependencies(
      { container: moodleContainer, condition: ecs.ContainerDependencyCondition.HEALTHY },
    );

    nginxContainer.addContainerDependencies(
      { container: bffContainer, condition: ecs.ContainerDependencyCondition.START },
      { container: apiContainer, condition: ecs.ContainerDependencyCondition.START },
      { container: moodleContainer, condition: ecs.ContainerDependencyCondition.START },
    );

    // ========================================
    // ECS Service
    // ========================================
    const service = new ecs.Ec2Service(this, 'Service', {
      cluster,
      taskDefinition: taskDef,
      serviceName: `${envName}-lms-service`,
      desiredCount,
      minHealthyPercent: 50,
      maxHealthyPercent: 100,
      healthCheckGracePeriod: cdk.Duration.seconds(120),
      enableExecuteCommand: true,
      // 2026-08-01: 一時的にサーキットブレーカーを無効化していたが、2026-08-02に
      // config.phpのdbpass誤読が根本原因と判明・修正し、安定稼働を確認したため再度有効化。
      circuitBreaker: { enable: true, rollback: true },
    });

    // ========================================
    // ALB ターゲットグループへアタッチ (ALB自体は alb-stack で作成済み)
    // ========================================
    const targetGroup = elbv2.ApplicationTargetGroup.fromTargetGroupAttributes(this, 'TargetGroup', {
      targetGroupArn,
    });
    targetGroup.addTarget(service);

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      exportName: `${envName}-ClusterName`,
    });
  }
}
