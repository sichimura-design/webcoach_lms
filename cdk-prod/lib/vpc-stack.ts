import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface ProdVpcStackProps extends cdk.StackProps {
  readonly envName: string;
}

export class ProdVpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: ProdVpcStackProps) {
    super(scope, id, props);

    const { envName } = props;

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${envName}-lms-vpc`,
      ipAddresses: ec2.IpAddresses.cidr('10.2.0.0/16'),
      maxAzs: 2,
      // 本番: 各 AZ に NAT Gateway を配置して AZ 障害時でもアウトバウンド通信を維持
      natGateways: 2,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          // ECS タスク用 (NAT 経由でアウトバウンド通信可能)
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          // RDS / EFS 用 (インターネット接続なし)
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    this.vpc.addFlowLog('FlowLog', {
      destination: ec2.FlowLogDestination.toCloudWatchLogs(),
      trafficType: ec2.FlowLogTrafficType.REJECT,
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: `${envName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PublicSubnets', {
      value: this.vpc.publicSubnets.map(s => s.subnetId).join(','),
      exportName: `${envName}-PublicSubnets`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnets', {
      value: this.vpc.privateSubnets.map(s => s.subnetId).join(','),
      exportName: `${envName}-PrivateSubnets`,
    });

    new cdk.CfnOutput(this, 'IsolatedSubnets', {
      value: this.vpc.isolatedSubnets.map(s => s.subnetId).join(','),
      exportName: `${envName}-IsolatedSubnets`,
    });
  }
}
