import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import * as path from 'path';

export interface RdsSchedulerStackProps extends cdk.StackProps {
  readonly envName: string;
  /**
   * 停止/起動スケジュールを有効にするか。既定は無効(2026-08-06 以降の本番運用に合わせる)。
   * 未指定のまま再デプロイしても、手動で DISABLED にしたルールが ENABLED に戻らないようにする。
   */
  readonly schedulesEnabled?: boolean;
  // Plain identifier of the target DB instance (e.g. "prod-moodle-db"), not a construct
  // reference. This keeps the stack free of CloudFormation cross-stack references so it
  // can be deployed independently of whatever stack actually owns the RDS instance.
  readonly dbInstanceIdentifier: string;
}

// Stops the Moodle RDS instance nightly and starts it again in the morning,
// and can also be invoked manually (with {"action": "stop"} / {"action": "start"})
// for maintenance windows.
export class RdsSchedulerStack extends cdk.Stack {
  public readonly schedulerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: RdsSchedulerStackProps) {
    super(scope, id, props);

    const { envName, schedulesEnabled = false, dbInstanceIdentifier } = props;

    const dbInstanceArn = cdk.Arn.format(
      {
        partition: this.partition,
        service: 'rds',
        region: this.region,
        account: this.account,
        resource: 'db',
        resourceName: dbInstanceIdentifier,
        arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
      },
      this
    );

    this.schedulerFunction = new lambda.Function(this, 'RdsSchedulerFunction', {
      functionName: `${envName}-rds-scheduler`,
      description: 'Stops/starts the Moodle RDS instance (schedule + manual maintenance invocation)',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/rds-scheduler')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        DB_INSTANCE_IDENTIFIER: dbInstanceIdentifier,
      },
    });

    this.schedulerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['rds:StopDBInstance', 'rds:StartDBInstance', 'rds:DescribeDBInstances'],
        resources: [dbInstanceArn],
      })
    );

    // 01:00 JST Mon-Fri = 16:00 UTC Sun-Thu (previous day). Weekends (Sat/Sun JST)
    // are intentionally excluded so the app stays up all weekend.
    const stopRule = new events.Rule(this, 'RdsStopRule', {
      ruleName: `${envName}-rds-stop-schedule`,
      description: 'Stops the Moodle RDS instance at 01:00 JST on weekdays (Mon-Fri); stays up on weekends',
      schedule: events.Schedule.cron({ minute: '0', hour: '16', weekDay: 'SUN-THU' }),
      enabled: schedulesEnabled,
    });
    stopRule.addTarget(
      new targets.LambdaFunction(this.schedulerFunction, {
        event: events.RuleTargetInput.fromObject({ action: 'stop' }),
      })
    );

    // 18:50 JST daily = 09:50 UTC — a 10-minute head start on the 19:00 JST ECS
    // start schedule (see EcsSchedulerStack) so the DB is up before Moodle boots.
    const startRule = new events.Rule(this, 'RdsStartRule', {
      ruleName: `${envName}-rds-start-schedule`,
      description: 'Starts the Moodle RDS instance daily at 18:50 JST',
      schedule: events.Schedule.cron({ minute: '50', hour: '9' }),
      enabled: schedulesEnabled,
    });
    startRule.addTarget(
      new targets.LambdaFunction(this.schedulerFunction, {
        event: events.RuleTargetInput.fromObject({ action: 'start' }),
      })
    );

    new cdk.CfnOutput(this, 'RdsSchedulerFunctionArn', {
      value: this.schedulerFunction.functionArn,
      description: 'RDS Scheduler Lambda ARN (invoke manually with {"action":"stop"|"start"} for maintenance)',
      exportName: `${envName}-RdsSchedulerFunctionArn`,
    });
  }
}
