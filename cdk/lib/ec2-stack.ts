import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface Ec2StackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.Vpc;
  readonly moodleStorageBucket: s3.Bucket;
  readonly frontendBucketName?: string;
  readonly keyPairName?: string;
  readonly cognitoUserPoolArn?: string;
}

export class Ec2Stack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly elasticIp: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: Ec2StackProps) {
    super(scope, id, props);

    const { envName, vpc, moodleStorageBucket, frontendBucketName, keyPairName, cognitoUserPoolArn } = props;

    // Security Group for Moodle EC2
    this.securityGroup = new ec2.SecurityGroup(this, 'MoodleEc2SecurityGroup', {
      vpc,
      securityGroupName: `${envName}-moodle-ec2-sg`,
      description: 'Security group for Moodle EC2 instance',
      allowAllOutbound: true,
    });

    // Allow HTTP/HTTPS from anywhere
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP'
    );
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS'
    );
    // Allow SSH from anywhere (should be restricted in production)
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH'
    );

    // IAM Role for EC2
    const role = new iam.Role(this, 'MoodleEc2Role', {
      roleName: `${envName}-moodle-ec2-role`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // Grant S3 access for Moodle storage
    moodleStorageBucket.grantReadWrite(role);

    // Grant S3 read access to SPA frontend bucket (for HTML content reading)
    if (frontendBucketName) {
      const frontendBucket = s3.Bucket.fromBucketName(this, 'SpaBucket', frontendBucketName);
      frontendBucket.grantRead(role);
    }

    // Grant Cognito permissions for user management
    if (cognitoUserPoolArn) {
      role.addToPolicy(new iam.PolicyStatement({
        actions: [
          'cognito-idp:ListGroups',
          'cognito-idp:ListUsersInGroup',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:ListUsers',
        ],
        resources: [cognitoUserPoolArn],
      }));
    }

    // User Data script for Moodle installation
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      '# Update system',
      'dnf update -y',
      '',
      '# Install required packages',
      'dnf install -y httpd php8.2 php8.2-mysqlnd php8.2-xml php8.2-mbstring php8.2-gd php8.2-intl php8.2-opcache php8.2-soap php8.2-zip',
      '',
      '# Install additional PHP extensions for Moodle',
      'dnf install -y php8.2-curl php8.2-ldap php8.2-sodium',
      '',
      '# Install AWS CLI',
      'dnf install -y awscli',
      '',
      '# Configure PHP',
      'cat > /etc/php.ini.d/moodle.ini << EOF',
      'memory_limit = 512M',
      'upload_max_filesize = 100M',
      'post_max_size = 100M',
      'max_execution_time = 300',
      'max_input_vars = 5000',
      'opcache.enable = 1',
      'opcache.memory_consumption = 256',
      'opcache.max_accelerated_files = 10000',
      'EOF',
      '',
      '# Create Moodle directories',
      'mkdir -p /var/www/html/moodle',
      'mkdir -p /var/moodledata',
      'chown -R apache:apache /var/www/html/moodle',
      'chown -R apache:apache /var/moodledata',
      'chmod -R 755 /var/www/html/moodle',
      'chmod -R 777 /var/moodledata',
      '',
      '# Configure Apache',
      'cat > /etc/httpd/conf.d/moodle.conf << EOF',
      '<VirtualHost *:80>',
      '    DocumentRoot /var/www/html/moodle',
      '    <Directory /var/www/html/moodle>',
      '        Options Indexes FollowSymLinks',
      '        AllowOverride All',
      '        Require all granted',
      '    </Directory>',
      '</VirtualHost>',
      'EOF',
      '',
      '# Enable and start services',
      'systemctl enable httpd',
      'systemctl start httpd',
      '',
      '# Install CloudWatch agent',
      'dnf install -y amazon-cloudwatch-agent',
      'systemctl enable amazon-cloudwatch-agent',
      '',
      'echo "Moodle EC2 setup complete. Moodle needs to be installed manually."',
    );

    // Amazon Linux 2023 AMI
    const machineImage = ec2.MachineImage.latestAmazonLinux2023({
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });

    // EC2 Instance
    this.instance = new ec2.Instance(this, 'MoodleInstance', {
      instanceName: `${envName}-moodle-lms`,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MEDIUM
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

    // Elastic IP
    this.elasticIp = new ec2.CfnEIP(this, 'MoodleEIP', {
      instanceId: this.instance.instanceId,
      tags: [
        {
          key: 'Name',
          value: `${envName}-moodle-eip`,
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'InstanceId', {
      value: this.instance.instanceId,
      description: 'Moodle EC2 Instance ID',
      exportName: `${envName}-MoodleInstanceId`,
    });

    new cdk.CfnOutput(this, 'InstancePublicIp', {
      value: this.elasticIp.attrPublicIp,
      description: 'Moodle EC2 Public IP (Elastic IP)',
      exportName: `${envName}-MoodlePublicIp`,
    });

    new cdk.CfnOutput(this, 'InstancePrivateIp', {
      value: this.instance.instancePrivateIp,
      description: 'Moodle EC2 Private IP',
      exportName: `${envName}-MoodlePrivateIp`,
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: this.securityGroup.securityGroupId,
      description: 'Moodle EC2 Security Group ID',
      exportName: `${envName}-MoodleEc2SecurityGroupId`,
    });
  }
}
