import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface AuroraStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.Vpc;
}

export class AuroraStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: AuroraStackProps) {
    super(scope, id, props);

    const { envName, vpc } = props;

    // Security Group for Aurora
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
      vpc,
      securityGroupName: `${envName}-aurora-pg-sg`,
      description: 'Security group for Aurora PostgreSQL with pgvector',
      allowAllOutbound: false,
    });

    // Allow PostgreSQL access from within VPC (for ECS services)
    this.dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from VPC'
    );

    // Aurora PostgreSQL Cluster with pgvector support
    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      clusterIdentifier: `${envName}-aurora-pgvector`,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      writer: rds.ClusterInstance.provisioned('writer', {
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MEDIUM
        ),
        publiclyAccessible: false,
      }),
      readers: envName === 'prod'
        ? [
            rds.ClusterInstance.provisioned('reader1', {
              instanceType: ec2.InstanceType.of(
                ec2.InstanceClass.T3,
                ec2.InstanceSize.MEDIUM
              ),
              publiclyAccessible: false,
            }),
          ]
        : [], // No readers for dev/staging
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.dbSecurityGroup],
      defaultDatabaseName: 'vectordb',
      credentials: rds.Credentials.fromGeneratedSecret('vectordb_admin', {
        secretName: `${envName}/aurora/postgres-credentials`,
      }),
      storageEncrypted: true,
      deletionProtection: envName === 'prod',
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      backup: {
        retention: envName === 'prod'
          ? cdk.Duration.days(30)
          : cdk.Duration.days(7),
        preferredWindow: '03:00-04:00', // UTC
      },
      preferredMaintenanceWindow: 'Mon:04:00-Mon:05:00', // UTC
      parameterGroup: new rds.ParameterGroup(this, 'AuroraParameterGroup', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_15_4,
        }),
        parameters: {
          'shared_preload_libraries': 'pg_stat_statements,pgvector',
          'log_statement': 'ddl',
          'log_min_duration_statement': '1000', // Log queries > 1s
        },
      }),
      enableDataApi: true, // Enable Data API for serverless access
    });

    // Store secret reference
    this.dbSecret = this.cluster.secret!;

    // Outputs
    new cdk.CfnOutput(this, 'AuroraClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
      description: 'Aurora PostgreSQL Cluster Endpoint',
      exportName: `${envName}-AuroraClusterEndpoint`,
    });

    new cdk.CfnOutput(this, 'AuroraClusterPort', {
      value: this.cluster.clusterEndpoint.port.toString(),
      description: 'Aurora PostgreSQL Cluster Port',
      exportName: `${envName}-AuroraClusterPort`,
    });

    new cdk.CfnOutput(this, 'AuroraReaderEndpoint', {
      value: this.cluster.clusterReadEndpoint.hostname,
      description: 'Aurora PostgreSQL Reader Endpoint',
      exportName: `${envName}-AuroraReaderEndpoint`,
    });

    new cdk.CfnOutput(this, 'AuroraSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'Aurora PostgreSQL Secret ARN',
      exportName: `${envName}-AuroraSecretArn`,
    });

    new cdk.CfnOutput(this, 'AuroraSecurityGroupId', {
      value: this.dbSecurityGroup.securityGroupId,
      description: 'Aurora Security Group ID',
      exportName: `${envName}-AuroraSecurityGroupId`,
    });
  }
}
