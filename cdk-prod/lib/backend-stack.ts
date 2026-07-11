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

export interface ProdBackendStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.Vpc;
  /** webcoach-lms リポジトリ (タグでコンテナを区別) */
  readonly repository: ecr.Repository;
  /** alb-stack で作成した ALB の SG。EC2 SG のインバウンド許可元として使う。 */
  readonly albSecurityGroup: ec2.ISecurityGroup;
  /** alb-stack で作成した空のターゲットグループの ARN。ECS サービス作成後にアタッチする。 */
  readonly targetGroupArn: string;
  readonly cognitoUserPoolId?: string;
  readonly cognitoClientId?: string;
  readonly cognitoClientSecret?: string;
  readonly anthropicApiKey?: string;
  /** Moodle の wwwroot URL。ALB DNS 名または独自ドメイン。*/
  readonly moodleSiteUrl?: string;
  /** 初回デプロイ: ECR にイメージがない場合は 0 を指定 */
  readonly desiredCount?: number;
}

/**
 * 本番バックエンドスタック: RDS + EFS + ECS EC2
 *
 * ALB / ターゲットグループは alb-stack で先行作成し、ここでは
 * ECS サービスをそのターゲットグループにアタッチするのみ。
 *
 * ECR: webcoach-lms リポジトリのタグでコンテナを区別
 *   moodle-nginx-latest  / moodle-bff-latest
 *   moodle-api-latest    / moodle-custom-latest
 *
 * UAT との主な差異:
 *   - RDS: Multi-AZ / t3.medium / 削除保護 ON / RemovalPolicy.RETAIN / バックアップ 7 日
 *   - ECS: Private サブネット配置 / desiredCount=2 / EC2 最小 2 台
 *   - CloudWatch: 1 ヶ月保持
 *   - EFS / Secrets: RemovalPolicy.RETAIN
 */
export class ProdBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProdBackendStackProps) {
    super(scope, id, props);

    const {
      envName, vpc, repository,
      albSecurityGroup, targetGroupArn,
      cognitoUserPoolId, cognitoClientId, cognitoClientSecret, anthropicApiKey,
      moodleSiteUrl,
      desiredCount = 2,
    } = props;

    // ========================================
    // Security Groups
    // ========================================
    // HOST ネットワークモードでは EC2 インスタンスの SG がコンテナに適用される
    const ec2Sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
      vpc,
      securityGroupName: `${envName}-lms-ec2-sg`,
      description: 'ECS EC2 instance security group',
      allowAllOutbound: true,
    });
    ec2Sg.addIngressRule(albSecurityGroup, ec2.Port.tcp(80), 'HTTP from ALB');

    const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc,
      securityGroupName: `${envName}-lms-rds-sg`,
      description: 'RDS MySQL security group',
      allowAllOutbound: false,
    });
    rdsSg.addIngressRule(ec2Sg, ec2.Port.tcp(3306), 'MySQL from ECS EC2');

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
    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `${envName}/lms/db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'moodleuser' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const cognitoSecret = new secretsmanager.Secret(this, 'CognitoSecret', {
      secretName: `${envName}/lms/cognito-credentials`,
      secretObjectValue: {
        userPoolId: cdk.SecretValue.unsafePlainText(cognitoUserPoolId ?? 'REPLACE_ME'),
        clientId: cdk.SecretValue.unsafePlainText(cognitoClientId ?? 'REPLACE_ME'),
        clientSecret: cdk.SecretValue.unsafePlainText(cognitoClientSecret ?? 'REPLACE_ME'),
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const anthropicSecret = new secretsmanager.Secret(this, 'AnthropicSecret', {
      secretName: `${envName}/lms/anthropic-api-key`,
      secretStringValue: cdk.SecretValue.unsafePlainText(anthropicApiKey ?? 'REPLACE_ME'),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ========================================
    // RDS MySQL (本番設定)
    // ========================================
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      instanceIdentifier: `${envName}-lms-db`,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      databaseName: 'moodle',
      credentials: rds.Credentials.fromSecret(dbSecret),
      allocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      maxAllocatedStorage: 500,
      multiAz: true,
      backupRetention: cdk.Duration.days(7),
      preferredBackupWindow: '17:00-18:00',      // JST 02:00-03:00
      preferredMaintenanceWindow: 'Mon:18:00-Mon:19:00', // JST 月曜 03:00-04:00
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      storageEncrypted: true,
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      parameterGroup: new rds.ParameterGroup(this, 'MoodleParameterGroup', {
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_0,
        }),
        parameters: {
          character_set_server: 'utf8mb4',
          collation_server: 'utf8mb4_unicode_ci',
          max_connections: '300',
        },
      }),
    });

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

    const moodledataAP = fileSystem.addAccessPoint('MoodledataAP', {
      path: '/moodledata',
      createAcl: { ownerUid: '1', ownerGid: '1', permissions: '755' },
      posixUser: { uid: '1', gid: '1' },
    });

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
    const asg = cluster.addCapacity('Ec2Capacity', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.XLARGE),
      minCapacity: 2,
      maxCapacity: 4,
      desiredCapacity: 2,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
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

    asg.addSecurityGroup(ec2Sg);
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
              accessPointId: moodledataAP.accessPointId,
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
        MOODLE_SERVICE_NAME: 'moodle_mobile_app',
      },
      secrets: {
        COGNITO_USER_POOL_ID: ecs.Secret.fromSecretsManager(cognitoSecret, 'userPoolId'),
        COGNITO_CLIENT_ID: ecs.Secret.fromSecretsManager(cognitoSecret, 'clientId'),
        COGNITO_CLIENT_SECRET: ecs.Secret.fromSecretsManager(cognitoSecret, 'clientSecret'),
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

    const moodleContainer = taskDef.addContainer('moodle-app', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'moodle-custom-latest'),
      memoryLimitMiB: 2048,
      cpu: 2048,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'lms', logGroup }),
      portMappings: [{ containerPort: 8080, protocol: ecs.Protocol.TCP }],
      essential: true,
      environment: {
        MOODLE_DATABASE_HOST: database.dbInstanceEndpointAddress,
        MOODLE_DATABASE_NAME: 'moodle',
        MOODLE_DATABASE_TYPE: 'mysqli',
        MOODLE_DATAROOT: '/moodledata',
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
      circuitBreaker: { rollback: true },
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

    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: database.dbInstanceEndpointAddress,
      description: 'RDS MySQL endpoint',
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

    new cdk.CfnOutput(this, 'RdsSgId', {
      value: rdsSg.securityGroupId,
      exportName: `${envName}-RdsSgId`,
    });
  }
}
