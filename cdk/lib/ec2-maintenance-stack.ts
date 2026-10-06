import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import * as path from 'path';

export interface Ec2MaintenanceStackProps extends cdk.StackProps {
  readonly envName: string;
  // Plain VPC ID (e.g. "vpc-xxxxxxxx"), not a construct reference. Resolved via
  // Vpc.fromLookup (a synth-time AWS API lookup, cached in cdk.context.json) rather
  // than a CloudFormation cross-stack reference, so this stack never needs to update
  // whatever stack actually owns the VPC.
  readonly vpcId: string;
}

// Minimal-cost EC2 instance for ad-hoc RDS maintenance (mysql client via SSM Session Manager,
// no SSH/public IP). Meant to be started manually when maintenance is needed; force-stopped
// nightly regardless of who started it, so it never accidentally runs unattended.
export class Ec2MaintenanceStack extends cdk.Stack {
  public readonly instance: ec2.Instance;

  constructor(scope: Construct, id: string, props: Ec2MaintenanceStackProps) {
    super(scope, id, props);

    const { envName, vpcId } = props;

    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId });

    const securityGroup = new ec2.SecurityGroup(this, 'MaintenanceEc2SecurityGroup', {
      vpc,
      securityGroupName: `${envName}-rds-maintenance-ec2-sg`,
      description: 'Security group for the RDS maintenance EC2 instance (SSM only, no inbound rules)',
      allowAllOutbound: true,
    });

    const role = new iam.Role(this, 'MaintenanceEc2Role', {
      roleName: `${envName}-rds-maintenance-ec2-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'dnf install -y mariadb105',
    );

    this.instance = new ec2.Instance(this, 'MaintenanceInstance', {
      instanceName: `${envName}-rds-maintenance`,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup,
      role,
      userData,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    const forceStopFn = new lambda.Function(this, 'Ec2ForceStopFunction', {
      functionName: `${envName}-rds-maintenance-ec2-force-stop`,
      description: 'Force-stops the RDS maintenance EC2 instance nightly regardless of who started it',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/ec2-force-stop')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        INSTANCE_ID: this.instance.instanceId,
      },
    });

    forceStopFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ec2:DescribeInstances'],
        resources: ['*'],
      })
    );
    forceStopFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ec2:StopInstances'],
        resources: [`arn:aws:ec2:${this.region}:${this.account}:instance/${this.instance.instanceId}`],
      })
    );

    // 00:00 JST daily = 15:00 UTC (previous day)
    const forceStopRule = new events.Rule(this, 'Ec2ForceStopRule', {
      ruleName: `${envName}-rds-maintenance-ec2-force-stop-schedule`,
      description: 'Force-stops the RDS maintenance EC2 instance daily at 00:00 JST',
      schedule: events.Schedule.cron({ minute: '0', hour: '15' }),
    });
    forceStopRule.addTarget(new targets.LambdaFunction(forceStopFn));

    new cdk.CfnOutput(this, 'MaintenanceInstanceId', {
      value: this.instance.instanceId,
      description: 'RDS Maintenance EC2 Instance ID (start via SSM/console when doing maintenance)',
      exportName: `${envName}-RdsMaintenanceInstanceId`,
    });
  }
}
