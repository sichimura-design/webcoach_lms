import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface Ec2AmiStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.Vpc;
  readonly amiId: string;
  readonly keyPairName?: string;
  readonly cognitoUserPoolId?: string;
}

export class Ec2AmiStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly elasticIp: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: Ec2AmiStackProps) {
    super(scope, id, props);

    const { envName, vpc, amiId, keyPairName, cognitoUserPoolId } = props;

    // ========================================
    // Security Group
    // ========================================
    this.securityGroup = new ec2.SecurityGroup(this, 'MoodleEc2SecurityGroup', {
      vpc,
      securityGroupName: `${envName}-moodle-ec2-sg`,
      description: 'Security group for Moodle EC2 instance (Docker)',
      allowAllOutbound: true,
    });

    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH'
    );
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP'
    );
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS'
    );
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), ec2.Port.tcp(3001), 'Allow BFF'
    );
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), ec2.Port.tcp(8001), 'Allow API'
    );

    // ========================================
    // IAM Role
    // ========================================
    const role = new iam.Role(this, 'MoodleEc2Role', {
      roleName: `${envName}-moodle-docker-ec2-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // Cognito管理操作の権限を付与（BFFサーバー用）
    if (cognitoUserPoolId) {
      role.addToPolicy(new iam.PolicyStatement({
        sid: 'CognitoAdminAccess',
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:ListUsers',
          'cognito-idp:ListGroups',
          'cognito-idp:ListUsersInGroup',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:CreateGroup',
        ],
        resources: [
          `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/${cognitoUserPoolId}`,
        ],
      }));
    }

    // SSM Parameter Store アクセス権限
    role.addToPolicy(new iam.PolicyStatement({
      sid: 'SsmParameterAccess',
      actions: [
        'ssm:PutParameter',
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
        'ssm:DeleteParameter',
      ],
      resources: [
        `arn:aws:ssm:ap-northeast-1:${this.account}:parameter/moodle/*`,
      ],
    }));

    role.addToPolicy(new iam.PolicyStatement({
      sid: 'KmsDecryptAccess',
      actions: ['kms:Decrypt'],
      resources: ['*'],
    }));

    // SPAフロントエンドバケットのアクセス権限（HTMLコンテンツ取得・画像アップロード用）
    const spaBucketName = 'moodle-spa-frontend-spafrontendbucketa0c499f3-1q1oez2ib24b';
    role.addToPolicy(new iam.PolicyStatement({
      sid: 'SpaFrontendBucketReadAccess',
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [`arn:aws:s3:::${spaBucketName}/*`],
    }));
    role.addToPolicy(new iam.PolicyStatement({
      sid: 'SpaFrontendBucketListAccess',
      actions: ['s3:ListBucket'],
      resources: [`arn:aws:s3:::${spaBucketName}`],
    }));

    // ========================================
    // User Data (Docker起動のみ)
    // ========================================
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      '# Dockerサービス起動',
      'systemctl enable docker',
      'systemctl start docker',
      '',
      '# Dockerネットワーク作成（存在しない場合）',
      'docker network inspect moodle-network >/dev/null 2>&1 || docker network create moodle-network',
      '',
      '# Docker Compose起動',
      'cd /home/ec2-user/moodle-docker',
      'if [ -f docker-compose.yml ]; then',
      '  docker compose up -d',
      'fi',
    );

    // ========================================
    // EC2 Instance (AMIから起動)
    // ========================================
    const machineImage = ec2.MachineImage.genericLinux({
      [this.region]: amiId,
    });

    this.instance = new ec2.Instance(this, 'MoodleInstance', {
      instanceName: `${envName}-moodle-docker`,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM,
      ),
      machineImage,
      securityGroup: this.securityGroup,
      role,
      userData,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(50, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
      keyPair: keyPairName
        ? ec2.KeyPair.fromKeyPairName(this, 'KeyPair', keyPairName)
        : undefined,
    });

    // ========================================
    // Elastic IP
    // ========================================
    this.elasticIp = new ec2.CfnEIP(this, 'MoodleEIP', {
      instanceId: this.instance.instanceId,
      tags: [
        { key: 'Name', value: `${envName}-moodle-eip` },
      ],
    });

    // ========================================
    // Outputs
    // ========================================
    new cdk.CfnOutput(this, 'InstanceId', {
      value: this.instance.instanceId,
      exportName: `${envName}-MoodleDockerInstanceId`,
    });

    new cdk.CfnOutput(this, 'PublicIp', {
      value: this.elasticIp.attrPublicIp,
      exportName: `${envName}-MoodleDockerPublicIp`,
    });

    new cdk.CfnOutput(this, 'PrivateIp', {
      value: this.instance.instancePrivateIp,
      exportName: `${envName}-MoodleDockerPrivateIp`,
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      exportName: `${envName}-MoodleDockerSgId`,
    });
  }
}
