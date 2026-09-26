import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as destinations from 'aws-cdk-lib/aws-logs-destinations';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';
import { Construct } from 'constructs';

export interface AiUsageNotifierStackProps extends cdk.StackProps {
  readonly envName: string;
}

/**
 * AI利用ログ(api-server/agents/usage_log.py の1行JSON)をSlackへ通知する
 *
 * - api-serverのログ置き場(CloudWatch Logs)。dev EC2はdocker-compose.awslogs.ymlでここへ送る
 * - status=error/timeout の行だけをサブスクリプションフィルタでLambdaへ流し、即時通知
 * - 毎朝9時(JST)にLambdaがLogs Insightsで前日分を集計して投稿
 *
 * Slack Incoming WebhookのURLは `${envName}/moodle/slack-ai-usage-webhook` に
 * 手動で登録する(値を CDK/リポジトリに載せないため、このスタックでは作成しない)。
 */
export class AiUsageNotifierStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AiUsageNotifierStackProps) {
    super(scope, id, props);

    const { envName } = props;

    const logGroup = new logs.LogGroup(this, 'ApiServerLogGroup', {
      logGroupName: `/${envName}/moodle/api-server`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const webhookSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'SlackWebhookSecret', `${envName}/moodle/slack-ai-usage-webhook`,
    );

    const fn = new lambda.Function(this, 'NotifierFunction', {
      functionName: `${envName}-ai-usage-slack-notifier`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/ai-usage-slack-notifier'), {
        exclude: ['test_*.py', '__pycache__', '.pytest_cache'],
      }),
      timeout: cdk.Duration.seconds(90),
      memorySize: 128,
      // エラーが連発しても同時実行でSlackを連投しないよう1本に絞る
      reservedConcurrentExecutions: 1,
      logGroup: new logs.LogGroup(this, 'NotifierFunctionLogGroup', {
        logGroupName: `/aws/lambda/${envName}-ai-usage-slack-notifier`,
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      environment: {
        ENV_NAME: envName,
        LOG_GROUP_NAME: logGroup.logGroupName,
        WEBHOOK_SECRET_ID: `${envName}/moodle/slack-ai-usage-webhook`,
      },
    });

    webhookSecret.grantRead(fn);
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:StartQuery'],
      resources: [logGroup.logGroupArn],
    }));
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:GetQueryResults'],
      resources: ['*'],
    }));

    new logs.SubscriptionFilter(this, 'ErrorSubscription', {
      logGroup,
      destination: new destinations.LambdaDestination(fn),
      filterPattern: logs.FilterPattern.literal(
        '{ ($.event = "ai_chat" || $.event = "ai_app_call") && ($.status = "error" || $.status = "timeout") }',
      ),
    });

    new events.Rule(this, 'DailySummaryRule', {
      ruleName: `${envName}-ai-usage-daily-summary`,
      // 00:00 UTC = 09:00 JST
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      targets: [new targets.LambdaFunction(fn)],
    });

    new cdk.CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName });
    new cdk.CfnOutput(this, 'FunctionName', { value: fn.functionName });
  }
}
