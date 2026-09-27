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

export interface SlackNotifierStackProps extends cdk.StackProps {
  readonly envName: string;
}

/**
 * api-server / bff-server のログをSlackへ通知する
 *
 * - 両サーバーのログ置き場(CloudWatch Logs)。dev EC2はdocker-compose.awslogs.ymlでここへ送る
 * - エラーっぽい行(文字列マッチ)と、AI利用ログ(api-server/agents/usage_log.py)の
 *   status=error/timeout の行をサブスクリプションフィルタでLambdaへ流し、エラー用チャンネルへ即時通知
 * - 毎朝9時(JST)にLambdaがLogs InsightsでAI利用状況の前日分を集計し、利用状況用チャンネルへ投稿
 *
 * Slack Incoming WebhookのURL(チャンネルごとに1本)は次の名前で手動登録する
 * (値を CDK/リポジトリに載せないため、このスタックでは作成しない)。
 *   `${envName}/moodle/slack-usage-webhook` 利用状況
 *   `${envName}/moodle/slack-alert-webhook` エラー
 */
export class SlackNotifierStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SlackNotifierStackProps) {
    super(scope, id, props);

    const { envName } = props;

    const apiLogGroup = new logs.LogGroup(this, 'ApiServerLogGroup', {
      logGroupName: `/${envName}/moodle/api-server`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const bffLogGroup = new logs.LogGroup(this, 'BffServerLogGroup', {
      logGroupName: `/${envName}/moodle/bff-server`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const usageSecretName = `${envName}/moodle/slack-usage-webhook`;
    const alertSecretName = `${envName}/moodle/slack-alert-webhook`;
    const usageSecret = secretsmanager.Secret.fromSecretNameV2(this, 'SlackUsageWebhookSecret', usageSecretName);
    const alertSecret = secretsmanager.Secret.fromSecretNameV2(this, 'SlackAlertWebhookSecret', alertSecretName);

    const fn = new lambda.Function(this, 'NotifierFunction', {
      functionName: `${envName}-slack-notifier`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/slack-notifier'), {
        exclude: ['test_*.py', '__pycache__', '.pytest_cache', '*.yml'],
      }),
      timeout: cdk.Duration.seconds(90),
      memorySize: 128,
      // エラーが連発しても同時実行でSlackを連投しないよう1本に絞る
      // (同じエラーの再通知抑止もこの1本のメモリで持っている)
      reservedConcurrentExecutions: 1,
      logGroup: new logs.LogGroup(this, 'NotifierFunctionLogGroup', {
        logGroupName: `/aws/lambda/${envName}-slack-notifier`,
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      environment: {
        ENV_NAME: envName,
        USAGE_LOG_GROUP_NAME: apiLogGroup.logGroupName,
        USAGE_WEBHOOK_SECRET_ID: usageSecretName,
        ALERT_WEBHOOK_SECRET_ID: alertSecretName,
      },
    });

    usageSecret.grantRead(fn);
    alertSecret.grantRead(fn);
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:StartQuery'],
      resources: [apiLogGroup.logGroupArn],
    }));
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:GetQueryResults'],
      resources: ['*'],
    }));

    // サブスクリプションフィルタはロググループあたり2本まで
    const destination = new destinations.LambdaDestination(fn);
    new logs.SubscriptionFilter(this, 'ApiServerErrorSubscription', {
      logGroup: apiLogGroup,
      destination,
      // Pythonのloggingの「- ERROR -」「ERROR:」、uvicornの未処理例外、Traceback
      filterPattern: logs.FilterPattern.anyTerm('ERROR', 'CRITICAL', 'Traceback'),
    });
    new logs.SubscriptionFilter(this, 'ApiServerAiErrorSubscription', {
      logGroup: apiLogGroup,
      destination,
      filterPattern: logs.FilterPattern.literal(
        '{ ($.event = "ai_chat" || $.event = "ai_app_call") && ($.status = "error" || $.status = "timeout") }',
      ),
    });
    new logs.SubscriptionFilter(this, 'BffServerErrorSubscription', {
      logGroup: bffLogGroup,
      destination,
      // console.error の書式が統一されていないため広めに拾い、想定内のものはLambda側で捨てる
      filterPattern: logs.FilterPattern.anyTerm(
        'Error', 'ERROR', 'error', 'Exception', 'Failed', 'failed', 'エラー', '失敗',
      ),
    });

    new events.Rule(this, 'DailySummaryRule', {
      ruleName: `${envName}-ai-usage-daily-summary`,
      // 00:00 UTC = 09:00 JST
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      targets: [new targets.LambdaFunction(fn)],
    });

    new cdk.CfnOutput(this, 'ApiServerLogGroupName', { value: apiLogGroup.logGroupName });
    new cdk.CfnOutput(this, 'BffServerLogGroupName', { value: bffLogGroup.logGroupName });
    new cdk.CfnOutput(this, 'FunctionName', { value: fn.functionName });
  }
}
