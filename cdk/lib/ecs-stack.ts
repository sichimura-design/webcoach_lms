import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface EcsStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.Vpc;
  readonly rdsSecret: secretsmanager.ISecret;
  readonly auroraSecret: secretsmanager.ISecret;
}

export class EcsStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly frontendRepository: ecr.Repository;
  public readonly bffRepository: ecr.Repository;
  public readonly apiRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const { envName, vpc, rdsSecret, auroraSecret } = props;

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'MoodleCluster', {
      clusterName: `${envName}-moodle-cluster`,
      vpc,
      containerInsights: true,
    });

    // ECR Repositories
    this.frontendRepository = new ecr.Repository(this, 'FrontendRepo', {
      repositoryName: `${envName}-moodle-frontend`,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: envName !== 'prod',
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep last 10 images',
        },
      ],
    });

    this.bffRepository = new ecr.Repository(this, 'BffRepo', {
      repositoryName: `${envName}-moodle-bff`,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: envName !== 'prod',
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep last 10 images',
        },
      ],
    });

    this.apiRepository = new ecr.Repository(this, 'ApiRepo', {
      repositoryName: `${envName}-moodle-api`,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: envName !== 'prod',
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep last 10 images',
        },
      ],
    });

    // Security Group for ALB
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc,
      securityGroupName: `${envName}-moodle-alb-sg`,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP'
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS'
    );

    // Security Group for ECS Services
    const ecsSecurityGroup = new ec2.SecurityGroup(this, 'EcsSecurityGroup', {
      vpc,
      securityGroupName: `${envName}-moodle-ecs-sg`,
      description: 'Security group for ECS Fargate services',
      allowAllOutbound: true,
    });

    // Allow ALB to access ECS services
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3000),
      'Allow Frontend from ALB'
    );
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(3001),
      'Allow BFF from ALB'
    );
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(8001),
      'Allow API from ALB'
    );

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'MoodleAlb', {
      loadBalancerName: `${envName}-moodle-alb`,
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // HTTP Listener (redirect to HTTPS in production)
    const httpListener = this.alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.fixedResponse(200, {
        contentType: 'text/plain',
        messageBody: 'OK',
      }),
    });

    // Task Execution Role
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      roleName: `${envName}-moodle-task-execution-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant access to secrets
    rdsSecret.grantRead(taskExecutionRole);
    auroraSecret.grantRead(taskExecutionRole);

    // Task Role (for application-level permissions)
    const taskRole = new iam.Role(this, 'TaskRole', {
      roleName: `${envName}-moodle-task-role`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // CloudWatch Log Groups
    const frontendLogGroup = new logs.LogGroup(this, 'FrontendLogGroup', {
      logGroupName: `/ecs/${envName}/moodle-frontend`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    const bffLogGroup = new logs.LogGroup(this, 'BffLogGroup', {
      logGroupName: `/ecs/${envName}/moodle-bff`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/${envName}/moodle-api`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // Frontend Task Definition
    const frontendTaskDef = new ecs.FargateTaskDefinition(this, 'FrontendTaskDef', {
      family: `${envName}-moodle-frontend`,
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole,
      taskRole,
    });

    frontendTaskDef.addContainer('frontend', {
      containerName: 'frontend',
      image: ecs.ContainerImage.fromEcrRepository(this.frontendRepository, 'latest'),
      portMappings: [{ containerPort: 3000 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'frontend',
        logGroup: frontendLogGroup,
      }),
      environment: {
        NODE_ENV: envName === 'prod' ? 'production' : 'development',
        VITE_BFF_URL: '/api',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/ || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // BFF Task Definition
    const bffTaskDef = new ecs.FargateTaskDefinition(this, 'BffTaskDef', {
      family: `${envName}-moodle-bff`,
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskExecutionRole,
      taskRole,
    });

    bffTaskDef.addContainer('bff', {
      containerName: 'bff',
      image: ecs.ContainerImage.fromEcrRepository(this.bffRepository, 'latest'),
      portMappings: [{ containerPort: 3001 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'bff',
        logGroup: bffLogGroup,
      }),
      environment: {
        NODE_ENV: envName === 'prod' ? 'production' : 'development',
        PORT: '3001',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3001/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // API Task Definition
    const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      family: `${envName}-moodle-api`,
      memoryLimitMiB: 1024,
      cpu: 512,
      executionRole: taskExecutionRole,
      taskRole,
    });

    apiTaskDef.addContainer('api', {
      containerName: 'api',
      image: ecs.ContainerImage.fromEcrRepository(this.apiRepository, 'latest'),
      portMappings: [{ containerPort: 8001 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'api',
        logGroup: apiLogGroup,
      }),
      environment: {
        ENV: envName,
        PORT: '8001',
      },
      secrets: {
        DB_HOST: ecs.Secret.fromSecretsManager(rdsSecret, 'host'),
        DB_PORT: ecs.Secret.fromSecretsManager(rdsSecret, 'port'),
        DB_NAME: ecs.Secret.fromSecretsManager(rdsSecret, 'dbname'),
        DB_USER: ecs.Secret.fromSecretsManager(rdsSecret, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(rdsSecret, 'password'),
        VECTOR_DB_HOST: ecs.Secret.fromSecretsManager(auroraSecret, 'host'),
        VECTOR_DB_PORT: ecs.Secret.fromSecretsManager(auroraSecret, 'port'),
        VECTOR_DB_NAME: ecs.Secret.fromSecretsManager(auroraSecret, 'dbname'),
        VECTOR_DB_USER: ecs.Secret.fromSecretsManager(auroraSecret, 'username'),
        VECTOR_DB_PASSWORD: ecs.Secret.fromSecretsManager(auroraSecret, 'password'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8001/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Frontend Service
    const frontendService = new ecs.FargateService(this, 'FrontendService', {
      serviceName: `${envName}-moodle-frontend`,
      cluster: this.cluster,
      taskDefinition: frontendTaskDef,
      desiredCount: envName === 'prod' ? 2 : 1,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
    });

    // BFF Service
    const bffService = new ecs.FargateService(this, 'BffService', {
      serviceName: `${envName}-moodle-bff`,
      cluster: this.cluster,
      taskDefinition: bffTaskDef,
      desiredCount: envName === 'prod' ? 2 : 1,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
    });

    // API Service
    const apiService = new ecs.FargateService(this, 'ApiService', {
      serviceName: `${envName}-moodle-api`,
      cluster: this.cluster,
      taskDefinition: apiTaskDef,
      desiredCount: envName === 'prod' ? 2 : 1,
      securityGroups: [ecsSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      assignPublicIp: false,
    });

    // Target Groups
    const frontendTargetGroup = new elbv2.ApplicationTargetGroup(this, 'FrontendTargetGroup', {
      targetGroupName: `${envName}-frontend-tg`,
      vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
    });

    const bffTargetGroup = new elbv2.ApplicationTargetGroup(this, 'BffTargetGroup', {
      targetGroupName: `${envName}-bff-tg`,
      vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
    });

    const apiTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      targetGroupName: `${envName}-api-tg`,
      vpc,
      port: 8001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
    });

    // Register services with target groups
    frontendService.attachToApplicationTargetGroup(frontendTargetGroup);
    bffService.attachToApplicationTargetGroup(bffTargetGroup);
    apiService.attachToApplicationTargetGroup(apiTargetGroup);

    // Add routing rules
    httpListener.addAction('FrontendRule', {
      priority: 30,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/*']),
      ],
      action: elbv2.ListenerAction.forward([frontendTargetGroup]),
    });

    httpListener.addAction('BffRule', {
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/*']),
      ],
      action: elbv2.ListenerAction.forward([bffTargetGroup]),
    });

    httpListener.addAction('ApiRule', {
      priority: 20,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/v1/*']),
      ],
      action: elbv2.ListenerAction.forward([apiTargetGroup]),
    });

    // Outputs
    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: `${envName}-EcsClusterName`,
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      description: 'ECS Cluster ARN',
      exportName: `${envName}-EcsClusterArn`,
    });

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
      exportName: `${envName}-AlbDnsName`,
    });

    new cdk.CfnOutput(this, 'AlbArn', {
      value: this.alb.loadBalancerArn,
      description: 'Application Load Balancer ARN',
      exportName: `${envName}-AlbArn`,
    });

    new cdk.CfnOutput(this, 'FrontendRepoUri', {
      value: this.frontendRepository.repositoryUri,
      description: 'Frontend ECR Repository URI',
      exportName: `${envName}-FrontendRepoUri`,
    });

    new cdk.CfnOutput(this, 'BffRepoUri', {
      value: this.bffRepository.repositoryUri,
      description: 'BFF ECR Repository URI',
      exportName: `${envName}-BffRepoUri`,
    });

    new cdk.CfnOutput(this, 'ApiRepoUri', {
      value: this.apiRepository.repositoryUri,
      description: 'API ECR Repository URI',
      exportName: `${envName}-ApiRepoUri`,
    });
  }
}
