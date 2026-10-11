import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ProdRdsStackProps extends cdk.StackProps {
  readonly envName: string;
  /** 既存 VPC の ID (prod-VpcStack が作成した VPC) */
  readonly vpcId: string;
}

export class ProdRdsStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly rdsSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ProdRdsStackProps) {
    super(scope, id, props);

    const { envName, vpcId } = props;

    // 既存 VPC (prod-VpcStack) を参照
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId });

    // ========================================
    // Security Group
    // ========================================
    this.rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc,
      securityGroupName: `${envName}-lms-rds-sg`,
      description: 'RDS MySQL security group',
      allowAllOutbound: false,
    });
    // VPC 内からの MySQL アクセスを許可（ECS EC2 等）
    this.rdsSg.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(3306),
      'MySQL from VPC',
    );

    // ========================================
    // Secrets Manager
    // ========================================
    this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `${envName}/moodle/db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'moodleuser' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
      },
    });

    // ========================================
    // RDS MySQL
    // ========================================
    this.database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.mysql({
        // 実体(prod-lms-db)は自動マイナーアップグレードで 8.4.8。8.4.7 を指定すると
        // ダウングレード扱いでデプロイが失敗する。
        version: rds.MysqlEngineVersion.VER_8_4_8,
      }),
      allowMajorVersionUpgrade: true,
      // 2026-10-06: 2026-07-25 にスナップショット復元で作った prod-lms-db を cdk import で
      // 管理下に戻した(旧 prod-moodle-db は削除済み)。
      instanceIdentifier: `${envName}-lms-db`,
      // 2026-10-11: 200人規模の同時アクセスに備え t3.small(2GiB) → t4g.medium(Graviton・4GiB)。
      // メモリが増えると InnoDB バッファプール(既定でメモリの約3/4)も自動で増える。
      // ⚠ クラス変更はシングルAZのため適用中(5〜10分)DBに接続できない。利用者のいない時間にデプロイすること
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.rdsSg],
      databaseName: 'moodle',
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      multiAz: false,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      parameterGroup: new rds.ParameterGroup(this, 'MoodleParamGroup', {
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_4_7,
        }),
        parameters: {
          character_set_server: 'utf8mb4',
          collation_server: 'utf8mb4_unicode_ci',
          // Moodle(2タスク分) + api-server(接続プール10+20 × 2タスク) + 予備。
          // t4g.medium(4GiB)に合わせて200から引き上げ。動的パラメータなので再起動不要
          max_connections: '300',
        },
      }),
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.database.dbInstanceEndpointAddress,
      description: 'RDS MySQL endpoint',
      exportName: `${envName}-DbEndpoint`,
    });

    new cdk.CfnOutput(this, 'DbPort', {
      value: this.database.dbInstanceEndpointPort,
      description: 'RDS MySQL port',
      exportName: `${envName}-DbPort`,
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'Secrets Manager ARN for DB credentials',
      exportName: `${envName}-DbSecretArn`,
    });

    new cdk.CfnOutput(this, 'RdsSgId', {
      value: this.rdsSg.securityGroupId,
      description: 'RDS security group ID',
      exportName: `${envName}-RdsSgId`,
    });
  }
}
