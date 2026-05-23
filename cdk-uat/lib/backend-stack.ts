import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
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
export class UatBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: UatBackendStackProps) {
    super(scope, id, props);

    const {
      envName, vpc,
      nginxRepo, bffRepo, apiRepo, moodleRepo,
      cognitoUserPoolId, cognitoClientId, cognitoClientSecret, anthropicApiKey,
      moodleSiteUrl,
      keyPairName,
      desiredCount = 1,
    } = props;

    // ========================================
    // Security Groups
    // ========================================
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      securityGroupName: `${envName}-moodle-alb-sg`,
      description: 'ALB security group',
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    // HOST ネットワークモードでは EC2 インスタンスの SG がそのままコンテナに適用される
    const ec2Sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
      vpc,
      securityGroupName: `${envName}-moodle-ec2-sg`,
      description: 'ECS EC2 instance security group',
      allowAllOutbound: true,
    });
    ec2Sg.addIngressRule(albSg, ec2.Port.tcp(80), 'HTTP from ALB');
    if (keyPairName) {
      ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH');
    }

    const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc,
      securityGroupName: `${envName}-moodle-rds-sg`,
      description: 'RDS MySQL security group',
      allowAllOutbound: false,
    });
    rdsSg.addIngressRule(ec2Sg, ec2.Port.tcp(3306), 'MySQL from ECS EC2');

    const efsSg = new ec2.SecurityGroup(this, 'EfsSg', {
      vpc,
      securityGroupName: `${envName}-moodle-efs-sg`,
      description: 'EFS security group',
      allowAllOutbound: false,
    });
    efsSg.addIngressRule(ec2Sg, ec2.Port.tcp(2049), 'NFS from ECS EC2');

    // ========================================
    // Secrets Manager
    // ========================================
    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `${envName}/moodle/db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'moodleuser' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    const cognitoSecret = new secretsmanager.Secret(this, 'CognitoSecret', {
      secretName: `${envName}/moodle/cognito-credentials`,
      secretObjectValue: {
        userPoolId: cdk.SecretValue.unsafePlainText(cognitoUserPoolId ?? 'REPLACE_ME'),
        clientId: cdk.SecretValue.unsafePlainText(cognitoClientId ?? 'REPLACE_ME'),
        clientSecret: cdk.SecretValue.unsafePlainText(cognitoClientSecret ?? 'REPLACE_ME'),
      },
    });

    const anthropicSecret = new secretsmanager.Secret(this, 'AnthropicSecret', {
      secretName: `${envName}/moodle/anthropic-api-key`,
      secretStringValue: cdk.SecretValue.unsafePlainText(anthropicApiKey ?? 'REPLACE_ME'),
    });

    // ========================================
    // RDS MySQL
    // ========================================
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      instanceIdentifier: `${envName}-moodle-db`,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      databaseName: 'moodle',
      credentials: rds.Credentials.fromSecret(dbSecret),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      multiAz: false,
      backupRetention: cdk.Duration.days(3),
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      storageEncrypted: true,
    });

    // ========================================
    // EFS (moodledata 永続化)
    // ========================================
    const fileSystem = new efs.FileSystem(this, 'MoodleEfs', {
      vpc,
      fileSystemName: `${envName}-moodle-efs`,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, // EFS は外部公開不要
      securityGroup: efsSg,
      encrypted: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
    });

    const moodledataAP = fileSystem.addAccessPoint('MoodledataAP', {
      path: '/moodledata',
      createAcl: { ownerUid: '1', ownerGid: '1', permissions: '755' },
      posixUser: { uid: '1', gid: '1' },
    });

    // ========================================
    // CloudWatch Logs
    // ========================================
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/${envName}/moodle`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // ECS Cluster + EC2 キャパシティ
    // ========================================
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: `${envName}-moodle-cluster`,
      containerInsights: true,
    });

    // t3.xlarge: 4vCPU / 16GB → 全コンテナ合計 ~3.8GB + OS 余裕あり
    // UAT: NAT 不要のため Public サブネットに配置
    const asg = cluster.addCapacity('Ec2Capacity', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.XLARGE),
      minCapacity: 1,
      maxCapacity: 2,
      desiredCapacity: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      keyPair: keyPairName
        ? ec2.KeyPair.fromKeyPairName(this, 'KeyPair', keyPairName)
        : undefined,
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

    // addCapacity は securityGroup を直接受け付けないため後付けで追加
    asg.addSecurityGroup(ec2Sg);

    // IAM ポリシーを auto-created role に付与
    asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
    );
    asg.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
    );
    // EFS アクセス権限
    asg.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'elasticfilesystem:ClientMount',
        'elasticfilesystem:ClientWrite',
        'elasticfilesystem:ClientRootAccess',
      ],
      resources: [fileSystem.fileSystemArn],
    }));
    // Secrets Manager 読み取り（EC2 タスクでも必要）
    asg.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
      resources: [
        dbSecret.secretArn,
        cognitoSecret.secretArn,
        anthropicSecret.secretArn,
      ],
    }));

    // ========================================
    // ECS Task Definition (EC2 / HOST ネットワーク)
    //
    // HOST モード = 全コンテナが EC2 ホストのネットワーク共有
    //   → docker-compose と同様に localhost で相互通信可能
    //   → BFF: MOODLE_URL=http://localhost:8080 がそのまま動く
    // ========================================
    const taskDef = new ecs.Ec2TaskDefinition(this, 'TaskDef', {
      family: `${envName}-moodle-task`,
      networkMode: ecs.NetworkMode.HOST,
      volumes: [
        {
          name: 'moodledata',
          efsVolumeConfiguration: {
            fileSystemId: fileSystem.fileSystemId,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId: moodledataAP.accessPointId,
              iam: 'ENABLED',
            },
          },
        },
      ],
    });

    // タスク実行ロールに Secrets Manager 権限
    taskDef.addToExecutionRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
      resources: [
        dbSecret.secretArn,
        cognitoSecret.secretArn,
        anthropicSecret.secretArn,
      ],
    }));

    // ----------------------------------------
    // nginx (リバースプロキシ)
    // HOST モードなので hostPort 指定不要
    // ----------------------------------------
    const nginxContainer = taskDef.addContainer('nginx', {
      image: ecs.ContainerImage.fromEcrRepository(nginxRepo, 'latest'),
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

    // ----------------------------------------
    // bff-server
    // ----------------------------------------
    const bffContainer = taskDef.addContainer('bff-server', {
      image: ecs.ContainerImage.fromEcrRepository(bffRepo, 'latest'),
      memoryLimitMiB: 512,
      cpu: 512,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'bff', logGroup }),
      portMappings: [{ containerPort: 3001, protocol: ecs.Protocol.TCP }],
      essential: true,
      environment: {
        NODE_ENV: 'production',
        MOODLE_URL: 'http://localhost:8080',
        API_SERVER_URL: 'http://localhost:8001',
        MOODLE_SERVICE_NAME: 'moodle_mobile_app',
      },
      secrets: {
        COGNITO_USER_POOL_ID: ecs.Secret.fromSecretsManager(cognitoSecret, 'userPoolId'),
        COGNITO_CLIENT_ID: ecs.Secret.fromSecretsManager(cognitoSecret, 'clientId'),
        COGNITO_CLIENT_SECRET: ecs.Secret.fromSecretsManager(cognitoSecret, 'clientSecret'),
      },
    });

    // ----------------------------------------
    // api-server
    // ----------------------------------------
    const apiContainer = taskDef.addContainer('api-server', {
      image: ecs.ContainerImage.fromEcrRepository(apiRepo, 'latest'),
      memoryLimitMiB: 1024,
      cpu: 1024,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup }),
      portMappings: [{ containerPort: 8001, protocol: ecs.Protocol.TCP }],
      essential: true,
      environment: {
        DATABASE_HOST: database.dbInstanceEndpointAddress,
        DATABASE_PORT: database.dbInstanceEndpointPort,
        DATABASE_NAME: 'moodle',
        MOODLE_URL: 'http://localhost:8080',
      },
      secrets: {
        DATABASE_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(anthropicSecret),
      },
    });

    // ----------------------------------------
    // moodle-app
    // ----------------------------------------
    const moodleContainer = taskDef.addContainer('moodle-app', {
      image: ecs.ContainerImage.fromEcrRepository(moodleRepo, 'latest'),
      memoryLimitMiB: 2048,
      cpu: 2048,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'moodle', logGroup }),
      portMappings: [{ containerPort: 8080, protocol: ecs.Protocol.TCP }],
      essential: true,
      environment: {
        MOODLE_DATABASE_HOST: database.dbInstanceEndpointAddress,
        MOODLE_DATABASE_NAME: 'moodle',
        MOODLE_DATABASE_TYPE: 'mysqli',
        MOODLE_DATAROOT: '/moodledata',
        // ALB DNS 確定後に --context moodleSiteUrl=http://... で再デプロイ
        MOODLE_SITE_URL: moodleSiteUrl ?? 'REPLACE_ME',
        MOODLE_SESSION_HANDLER: 'database',
      },
      secrets: {
        MOODLE_DATABASE_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        MOODLE_DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
      },
    });

    moodleContainer.addMountPoints({
      sourceVolume: 'moodledata',
      containerPath: '/moodledata',
      readOnly: false,
    });

    nginxContainer.addContainerDependencies(
      { container: bffContainer, condition: ecs.ContainerDependencyCondition.START },
      { container: apiContainer, condition: ecs.ContainerDependencyCondition.START },
      { container: moodleContainer, condition: ecs.ContainerDependencyCondition.START },
    );

    // ========================================
    // ECS Service (EC2)
    // ========================================
    const service = new ecs.Ec2Service(this, 'Service', {
      cluster,
      taskDefinition: taskDef,
      serviceName: `${envName}-moodle-service`,
      desiredCount,
      minHealthyPercent: 0,
      maxHealthyPercent: 100, // EC2 1台のとき 200 にするとタスクが2つ起動してポート衝突する
      healthCheckGracePeriod: cdk.Duration.seconds(120),
      enableExecuteCommand: true, // ECS Exec でコンテナに入れる
      circuitBreaker: { rollback: true },
    });

    // ========================================
    // Application Load Balancer
    // ========================================
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      loadBalancerName: `${envName}-moodle-alb`,
    });

    const listener = alb.addListener('HttpListener', { port: 80, open: true });

    listener.addTargets('EcsTargets', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      targetGroupName: `${envName}-moodle-tg`,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS — moodleSiteUrl と REACT_APP_API_URL に設定する',
      exportName: `${envName}-AlbDnsName`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      exportName: `${envName}-ClusterName`,
    });

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: database.dbInstanceEndpointAddress,
      exportName: `${envName}-DbEndpoint`,
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: dbSecret.secretArn,
      exportName: `${envName}-DbSecretArn`,
    });

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
