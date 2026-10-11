import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as destinations from 'aws-cdk-lib/aws-logs-destinations';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as path from 'path';
import { Construct } from 'constructs';

export interface ProdSlackNotifierStackProps extends cdk.StackProps {
  readonly envName: string;
  /** ECSタスクのログ(prod-EcsStackの /ecs/<env>/lms)。ストリームの接頭辞 api/ bff/ lms/ nginx/ でコンテナが分かれる */
  readonly ecsLogGroupName: string;
  readonly ecsClusterName: string;
  readonly ecsServiceName: string;
  /** ALBのARN(メトリクスの次元 app/<name>/<id> をここから作る) */
  readonly albArn: string;
  readonly targetGroupArn: string;
  readonly dbInstanceIdentifier: string;
  /** RDSの割り当てストレージ(GiB)。空き容量アラームの閾値の目安に使う */
  readonly dbAllocatedStorageGiB: number;
}

/**
 * 本番の監視・利用状況をSlackへ通知する(Lambdaのコードはdevと共用: cdk/lambda/slack-notifier)
 *
 * - ECSのログ(api/bff/moodle/nginx)のエラー行・AI利用ログのエラーを即時通知
 * - CloudWatchアラーム(ALB 5xx・異常タスク・正常タスク0台・RDS負荷・ECSメモリ/CPU・Lambda自身の失敗)
 *   → SNS → Lambda → エラー用チャンネル。復旧時も通知
 * - 予定外のECSタスク停止(OOM・ヘルスチェック失敗など。デプロイ・台数変更による停止は除く)
 * - 毎朝9時(JST)に前日のAI利用・運用KPI・AWS費用を利用状況用チャンネルへ、期限が近いものをエラー用へ
 *
 * Slack Incoming WebhookのURLは次の名前でSecrets Managerに手動登録する(このスタックでは作らない)。
 *   `${envName}/lms/slack-usage-webhook` 利用状況
 *   `${envName}/lms/slack-alert-webhook` エラー
 */
export class ProdSlackNotifierStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProdSlackNotifierStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const ecsLogGroup = logs.LogGroup.fromLogGroupName(this, 'EcsLogGroup', props.ecsLogGroupName);

    const usageSecretName = `${envName}/lms/slack-usage-webhook`;
    const alertSecretName = `${envName}/lms/slack-alert-webhook`;
    const usageSecret = secretsmanager.Secret.fromSecretNameV2(this, 'SlackUsageWebhookSecret', usageSecretName);
    const alertSecret = secretsmanager.Secret.fromSecretNameV2(this, 'SlackAlertWebhookSecret', alertSecretName);

    const fn = new lambda.Function(this, 'NotifierFunction', {
      functionName: `${envName}-slack-notifier`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../cdk/lambda/slack-notifier'), {
        exclude: ['test_*.py', '__pycache__', '.pytest_cache', '*.yml'],
      }),
      // 日次集計はLogs Insightsを最大60秒待つ
      timeout: cdk.Duration.seconds(180),
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
        USAGE_LOG_GROUP_NAME: props.ecsLogGroupName,
        REPORT_LOG_GROUP_NAME: props.ecsLogGroupName,
        USAGE_WEBHOOK_SECRET_ID: usageSecretName,
        ALERT_WEBHOOK_SECRET_ID: alertSecretName,
        COST_REPORT_ENABLED: 'true',
      },
    });

    usageSecret.grantRead(fn);
    alertSecret.grantRead(fn);
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:StartQuery'],
      resources: [ecsLogGroup.logGroupArn],
    }));
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['logs:GetQueryResults', 'ce:GetCostAndUsage'],
      resources: ['*'],
    }));

    // ---- ログのエラー(サブスクリプションフィルタはロググループあたり2本まで) ----
    const destination = new destinations.LambdaDestination(fn);
    new logs.SubscriptionFilter(this, 'EcsErrorSubscription', {
      logGroup: ecsLogGroup,
      destination,
      // 4コンテナ分の語をまとめて広めに拾い、サービスごとの絞り込みはLambda側(ERROR_PATTERNS)で行う
      filterPattern: logs.FilterPattern.anyTerm(
        'ERROR', 'CRITICAL', 'Traceback', 'Error', 'error', 'Exception', 'Failed', 'failed',
        'エラー', '失敗', 'Fatal', 'crit', 'alert', 'emerg',
      ),
    });
    new logs.SubscriptionFilter(this, 'AiErrorSubscription', {
      logGroup: ecsLogGroup,
      destination,
      filterPattern: logs.FilterPattern.literal(
        '{ ($.event = "ai_chat" || $.event = "ai_app_call") && ($.status = "error" || $.status = "timeout") }',
      ),
    });

    // ---- CloudWatchアラーム → SNS → Lambda ----
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', { topicName: `${envName}-slack-notifier-alarms` });
    alarmTopic.addSubscription(new snsSubscriptions.LambdaSubscription(fn));
    const action = new cwActions.SnsAction(alarmTopic);

    const addAlarm = (id: string, description: string, metric: cloudwatch.IMetric, opts: {
      threshold: number;
      evaluationPeriods?: number;
      comparison?: cloudwatch.ComparisonOperator;
    }) => {
      const alarm = new cloudwatch.Alarm(this, id, {
        alarmName: `${envName}-${id.replace(/Alarm$/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
        alarmDescription: description,
        metric,
        threshold: opts.threshold,
        evaluationPeriods: opts.evaluationPeriods ?? 1,
        comparisonOperator: opts.comparison ?? cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      alarm.addAlarmAction(action);
      alarm.addOkAction(action);
      return alarm;
    };

    // arn:aws:elasticloadbalancing:<region>:<account>:loadbalancer/app/<name>/<id> → app/<name>/<id>
    const albDimension = cdk.Fn.select(1, cdk.Fn.split(':loadbalancer/', props.albArn));
    // arn:...:targetgroup/<name>/<id> → targetgroup/<name>/<id>
    const tgDimension = cdk.Fn.join('', ['targetgroup/', cdk.Fn.select(1, cdk.Fn.split(':targetgroup/', props.targetGroupArn))]);
    const albMetric = (metricName: string, statistic: string, withTg = false) => new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName,
      statistic,
      period: cdk.Duration.minutes(withTg ? 1 : 5),
      dimensionsMap: withTg ? { LoadBalancer: albDimension, TargetGroup: tgDimension } : { LoadBalancer: albDimension },
    });

    // ALB自身が返した5xx(502/503/504: タスクが落ちている・応答しない・タイムアウト)
    addAlarm('AlbElb5xxAlarm', 'ALBが5xxを返しています(タスク停止・応答なし・タイムアウトの可能性)',
      albMetric('HTTPCode_ELB_5XX_Count', 'Sum'), { threshold: 10 });
    // アプリ(nginx/BFF/Moodle)が返した5xx
    addAlarm('AlbTarget5xxAlarm', 'アプリが5xxエラーを多く返しています',
      albMetric('HTTPCode_Target_5XX_Count', 'Sum'), { threshold: 20 });
    addAlarm('UnhealthyTargetAlarm', 'ヘルスチェックに失敗しているタスクがあります(3分続いています)',
      albMetric('UnHealthyHostCount', 'Maximum', true), { threshold: 1, evaluationPeriods: 3 });
    addAlarm('NoHealthyTargetAlarm', '正常なタスクが0台です(サイトに繋がりません。停止スクリプトで止めた場合は想定内)',
      albMetric('HealthyHostCount', 'Minimum', true),
      { threshold: 1, evaluationPeriods: 2, comparison: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD });

    const rdsMetric = (metricName: string, statistic: string) => new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName,
      statistic,
      period: cdk.Duration.minutes(5),
      dimensionsMap: { DBInstanceIdentifier: props.dbInstanceIdentifier },
    });
    addAlarm('RdsCpuAlarm', 'RDSのCPU使用率が15分以上80%を超えています',
      rdsMetric('CPUUtilization', 'Average'), { threshold: 80, evaluationPeriods: 3 });
    // max_connections=300(t4g.medium、rds-stack.ts と合わせる)。接続プールの上限に近づくと新しい接続が待たされる
    addAlarm('RdsConnectionsAlarm', 'RDSの接続数が225を超えています(上限300)',
      rdsMetric('DatabaseConnections', 'Maximum'), { threshold: 225, evaluationPeriods: 2 });
    const storageThresholdBytes = Math.max(2, Math.round(props.dbAllocatedStorageGiB * 0.15)) * 1024 ** 3;
    addAlarm('RdsFreeStorageAlarm', `RDSの空き容量が${storageThresholdBytes / 1024 ** 3}GiBを切りました`,
      rdsMetric('FreeStorageSpace', 'Minimum'),
      { threshold: storageThresholdBytes, comparison: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD });
    addAlarm('RdsFreeMemoryAlarm', 'RDSの空きメモリが15分以上150MBを切っています',
      rdsMetric('FreeableMemory', 'Minimum'),
      { threshold: 150 * 1024 ** 2, evaluationPeriods: 3, comparison: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD });

    const ecsMetric = (metricName: string, statistic: string) => new cloudwatch.Metric({
      namespace: 'AWS/ECS',
      metricName,
      statistic,
      period: cdk.Duration.minutes(5),
      dimensionsMap: { ClusterName: props.ecsClusterName, ServiceName: props.ecsServiceName },
    });
    addAlarm('EcsMemoryAlarm', 'ECSサービスのメモリ使用率が15分以上90%を超えています(OOMで落ちる手前)',
      ecsMetric('MemoryUtilization', 'Maximum'), { threshold: 90, evaluationPeriods: 3 });
    addAlarm('EcsCpuAlarm', 'ECSサービスのCPU使用率が15分以上85%を超えています',
      ecsMetric('CPUUtilization', 'Average'), { threshold: 85, evaluationPeriods: 3 });

    // Lambda自身の失敗(日次集計のクエリ失敗・Slack投稿失敗など)。
    // 失敗したのが日次集計でも、SNS経由の呼び出しは別の処理なので届く
    addAlarm('NotifierErrorsAlarm', 'Slack通知Lambdaが失敗しています(日次レポートが届いていない可能性)',
      fn.metricErrors({ period: cdk.Duration.minutes(5), statistic: 'Sum' }), { threshold: 1 });

    // ---- ECSタスクの停止 ----
    new events.Rule(this, 'EcsTaskStoppedRule', {
      ruleName: `${envName}-ecs-task-stopped`,
      eventPattern: {
        source: ['aws.ecs'],
        detailType: ['ECS Task State Change'],
        detail: {
          clusterArn: [`arn:aws:ecs:${this.region}:${this.account}:cluster/${props.ecsClusterName}`],
          lastStatus: ['STOPPED'],
        },
      },
      targets: [new targets.LambdaFunction(fn)],
    });

    // ---- 日次レポート ----
    new events.Rule(this, 'DailySummaryRule', {
      ruleName: `${envName}-daily-report`,
      // 00:00 UTC = 09:00 JST
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      targets: [new targets.LambdaFunction(fn)],
    });

    new cdk.CfnOutput(this, 'FunctionName', { value: fn.functionName });
    new cdk.CfnOutput(this, 'AlarmTopicArn', { value: alarmTopic.topicArn });
  }
}
