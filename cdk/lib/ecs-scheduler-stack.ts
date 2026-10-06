import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import * as path from 'path';

export interface EcsSchedulerStackProps extends cdk.StackProps {
  readonly envName: string;
  /**
   * 停止/起動スケジュールを有効にするか。既定は無効(2026-08-06 以降の本番運用に合わせる)。
   * 未指定のまま再デプロイしても、手動で DISABLED にしたルールが ENABLED に戻らないようにする。
   */
  readonly schedulesEnabled?: boolean;
  // Plain identifiers, not construct references, so this stack can be deployed
  // independently of whatever stack actually owns the ECS cluster/service (mirrors
  // the pattern used by RdsSchedulerStack).
  readonly clusterName: string;
  readonly serviceName: string;
  // CloudFormation stack name that owns the ECS EC2-capacity Auto Scaling Group.
  // The ASG's physical name is CDK-generated and not predictable ahead of deploy, so
  // the Lambda discovers it at runtime via the "aws:cloudformation:stack-name" tag
  // that CloudFormation automatically applies to it.
  readonly asgStackName: string;
  readonly serviceDesiredCount?: number;
  readonly asgMinCapacity?: number;
  readonly asgDesiredCapacity?: number;
}

// Stops the LMS ECS service (desiredCount -> 0) and its EC2 capacity (ASG -> 0)
// overnight/daytime and restarts them in the evening, so EC2 instance-hours aren't
// paid for while nobody is using the app. Can also be invoked manually
// (with {"action": "stop"} / {"action": "start"}).
export class EcsSchedulerStack extends cdk.Stack {
  public readonly schedulerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: EcsSchedulerStackProps) {
    super(scope, id, props);

    const {
      envName,
      schedulesEnabled = false,
      clusterName,
      serviceName,
      asgStackName,
      serviceDesiredCount = 2,
      asgMinCapacity = 2,
      asgDesiredCapacity = 2,
    } = props;

    const serviceArn = cdk.Arn.format(
      {
        partition: this.partition,
        service: 'ecs',
        region: this.region,
        account: this.account,
        resource: 'service',
        resourceName: `${clusterName}/${serviceName}`,
      },
      this
    );

    this.schedulerFunction = new lambda.Function(this, 'EcsSchedulerFunction', {
      functionName: `${envName}-ecs-scheduler`,
      description: 'Stops/starts the LMS ECS service + EC2 capacity (schedule + manual invocation)',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/ecs-scheduler')),
      timeout: cdk.Duration.seconds(60),
      environment: {
        CLUSTER_NAME: clusterName,
        SERVICE_NAME: serviceName,
        ASG_STACK_NAME: asgStackName,
        SERVICE_DESIRED_COUNT: String(serviceDesiredCount),
        ASG_MIN_CAPACITY: String(asgMinCapacity),
        ASG_DESIRED_CAPACITY: String(asgDesiredCapacity),
      },
    });

    this.schedulerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecs:DescribeServices', 'ecs:UpdateService'],
        resources: [serviceArn],
      })
    );

    // Auto Scaling doesn't support resource-level restriction for these actions, and
    // the ASG's physical name isn't known until after deploy (see asgStackName above),
    // so this is scoped to the action set only, not a specific resource.
    this.schedulerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['autoscaling:DescribeAutoScalingGroups', 'autoscaling:UpdateAutoScalingGroup'],
        resources: ['*'],
      })
    );

    // 01:00 JST Mon-Fri = 16:00 UTC Sun-Thu (previous day) — matches the RDS stop
    // schedule. Weekends (Sat/Sun JST) are intentionally excluded so the app stays
    // up all weekend.
    const stopRule = new events.Rule(this, 'EcsStopRule', {
      ruleName: `${envName}-ecs-stop-schedule`,
      description: 'Stops the LMS ECS service + EC2 capacity at 01:00 JST on weekdays (Mon-Fri); stays up on weekends',
      schedule: events.Schedule.cron({ minute: '0', hour: '16', weekDay: 'SUN-THU' }),
      enabled: schedulesEnabled,
    });
    stopRule.addTarget(
      new targets.LambdaFunction(this.schedulerFunction, {
        event: events.RuleTargetInput.fromObject({ action: 'stop' }),
      })
    );

    // 19:00 JST daily = 10:00 UTC
    const startRule = new events.Rule(this, 'EcsStartRule', {
      ruleName: `${envName}-ecs-start-schedule`,
      description: 'Starts the LMS ECS service + EC2 capacity daily at 19:00 JST',
      schedule: events.Schedule.cron({ minute: '0', hour: '10' }),
      enabled: schedulesEnabled,
    });
    startRule.addTarget(
      new targets.LambdaFunction(this.schedulerFunction, {
        event: events.RuleTargetInput.fromObject({ action: 'start' }),
      })
    );

    new cdk.CfnOutput(this, 'EcsSchedulerFunctionArn', {
      value: this.schedulerFunction.functionArn,
      description: 'ECS Scheduler Lambda ARN (invoke manually with {"action":"stop"|"start"} for maintenance)',
      exportName: `${envName}-EcsSchedulerFunctionArn`,
    });
  }
}
