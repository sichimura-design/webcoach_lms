import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface RdsStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.Vpc;
}

export class RdsStack extends cdk.Stack {
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    const { envName, vpc } = props;

    // Security Group for RDS
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'RdsSecurityGroup', {
      vpc,
      securityGroupName: `${envName}-moodle-rds-sg`,
      description: 'Security group for Moodle RDS MySQL',
      allowAllOutbound: false,
    });

    // Allow MySQL access from within VPC (for EC2 and ECS)
    this.dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(3306),
      'Allow MySQL from VPC'
    );

    // RDS MySQL Instance
    this.dbInstance = new rds.DatabaseInstance(this, 'MoodleRds', {
      instanceIdentifier: `${envName}-moodle-mysql`,
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.dbSecurityGroup],
      databaseName: 'moodle',
      credentials: rds.Credentials.fromGeneratedSecret('moodle_admin', {
        secretName: `${envName}/moodle/mysql-credentials`,
      }),
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      maxAllocatedStorage: 100, // Enable storage autoscaling
      multiAz: envName === 'prod', // Multi-AZ only for prod
      deletionProtection: envName === 'prod',
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      backupRetention: envName === 'prod'
        ? cdk.Duration.days(30)
        : cdk.Duration.days(7),
      preferredBackupWindow: '03:00-04:00', // UTC
      preferredMaintenanceWindow: 'Mon:04:00-Mon:05:00', // UTC
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      parameterGroup: new rds.ParameterGroup(this, 'MoodleParameterGroup', {
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_0,
        }),
        parameters: {
          'character_set_server': 'utf8mb4',
          'collation_server': 'utf8mb4_unicode_ci',
          'max_connections': '200',
        },
      }),
    });

    // Store secret reference
    this.dbSecret = this.dbInstance.secret!;

    // Outputs
    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: this.dbInstance.dbInstanceEndpointAddress,
      description: 'RDS MySQL Endpoint',
      exportName: `${envName}-RdsEndpoint`,
    });

    new cdk.CfnOutput(this, 'RdsPort', {
      value: this.dbInstance.dbInstanceEndpointPort,
      description: 'RDS MySQL Port',
      exportName: `${envName}-RdsPort`,
    });

    new cdk.CfnOutput(this, 'RdsSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'RDS MySQL Secret ARN',
      exportName: `${envName}-RdsSecretArn`,
    });

    new cdk.CfnOutput(this, 'RdsSecurityGroupId', {
      value: this.dbSecurityGroup.securityGroupId,
      description: 'RDS Security Group ID',
      exportName: `${envName}-RdsSecurityGroupId`,
    });
  }
}
