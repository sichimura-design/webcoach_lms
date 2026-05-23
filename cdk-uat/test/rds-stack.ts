import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface UatRdsStackProps extends cdk.StackProps {
  readonly envName: string;
  /** 使い回す既存 VPC の ID (例: vpc-078369fe5efc5e688) */
  readonly vpcId: string;
}

export class UatRdsStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly dbSecret: secretsmanager.Secret;
  public readonly rdsSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: UatRdsStackProps) {
    super(scope, id, props);

    const { envName, vpcId } = props;

    // 既存 VPC を参照
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId });

    // ========================================
    // Security Group
    // ========================================
    this.rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc,
      securityGroupName: `${envName}-moodle-rds-sg`,
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
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      instanceIdentifier: `${envName}-moodle-db`,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.rdsSg],
      databaseName: 'moodle',
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      multiAz: false,
      backupRetention: cdk.Duration.days(3),
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      parameterGroup: new rds.ParameterGroup(this, 'MoodleParamGroup', {
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_0,
        }),
        parameters: {
          character_set_server: 'utf8mb4',
          collation_server: 'utf8mb4_unicode_ci',
          max_connections: '200',
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
