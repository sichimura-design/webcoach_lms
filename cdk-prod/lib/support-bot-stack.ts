import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface ProdSupportBotStackProps extends cdk.StackProps {
  readonly envName: string;
  /** Slackアプリのbotトークンと署名シークレット。JSON {"bot_token": "xoxb-...", "signing_secret": "..."} */
  readonly slackSecretName: string;
  /** AnthropicのAPIキー(prod-BackendStackが作ったものを共用) */
  readonly anthropicSecretName: string;
  /** 答えてよいチャンネルID(カンマ区切り)。空なら招待されたチャンネルすべて */
  readonly allowedChannels?: string;
}

const LAMBDA_DIR = path.join(__dirname, '../lambda/support-bot');
const MANUAL_DIR = path.join(__dirname, '../../docs/support');

/** Lambdaの中身を組み立てる: index.py + 依存(anthropic) + マニュアル(docs/support/*.md → manual/) */
function copyCodeAndManual(outputDir: string) {
  fs.copyFileSync(path.join(LAMBDA_DIR, 'index.py'), path.join(outputDir, 'index.py'));
  const manualOut = path.join(outputDir, 'manual');
  fs.mkdirSync(manualOut, { recursive: true });
  for (const name of fs.readdirSync(MANUAL_DIR).filter((n) => n.endsWith('.md'))) {
    fs.copyFileSync(path.join(MANUAL_DIR, name), path.join(manualOut, name));
  }
}

/**
 * 問い合わせ一次対応のSlackボット(Lambda + Function URL)。稼働中のサービスには何も変更を加えない
 *
 * Slackでボットにメンションすると、docs/support/ のマニュアルをもとにClaudeが回答案をスレッドに返す。
 * マニュアルはデプロイ時にLambdaへ同梱するので、マニュアルを直したら再デプロイすると反映される。
 */
export class ProdSupportBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProdSupportBotStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const functionName = `${envName}-support-bot`;
    const slackSecret = secretsmanager.Secret.fromSecretNameV2(this, 'SlackSecret', props.slackSecretName);
    const anthropicSecret = secretsmanager.Secret.fromSecretNameV2(this, 'AnthropicSecret', props.anthropicSecretName);

    const fn = new lambda.Function(this, 'SupportBotFunction', {
      functionName,
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(LAMBDA_DIR, {
        // マニュアルの変更でも作り直されるよう、組み立て後の中身でハッシュを取る
        assetHashType: cdk.AssetHashType.OUTPUT,
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash', '-c',
            'pip install -r requirements.txt -t /asset-output && cp index.py /asset-output/',
          ],
          // 手元のpipでLambda(Python 3.12/x86_64)向けのwheelを入れる。失敗したらDockerで組み立てる
          // (Dockerの場合マニュアルはasset外にあるので入らない。そのときは失敗させる)
          local: {
            tryBundle(outputDir: string) {
              try {
                execFileSync('pip3', [
                  'install', '-r', path.join(LAMBDA_DIR, 'requirements.txt'), '-t', outputDir,
                  '--platform', 'manylinux2014_x86_64', '--implementation', 'cp', '--python-version', '3.12',
                  '--only-binary=:all:', '--upgrade', '--quiet',
                ], { stdio: 'inherit' });
              } catch (err) {
                throw new Error(`support-bot: pip3での依存の取得に失敗しました: ${err}`);
              }
              copyCodeAndManual(outputDir);
              return true;
            },
          },
        },
      }),
      // Claudeの回答待ち(通常は数十秒)。受け口はすぐ200を返すので、Slackの3秒制限には関係しない
      timeout: cdk.Duration.seconds(120),
      memorySize: 256,
      // 誤って連投されても費用が膨らまないよう同時実行を絞る
      reservedConcurrentExecutions: 5,
      logGroup: new logs.LogGroup(this, 'SupportBotLogGroup', {
        logGroupName: `/aws/lambda/${functionName}`,
        retention: logs.RetentionDays.ONE_MONTH,
      }),
      environment: {
        SLACK_SECRET_ID: props.slackSecretName,
        ANTHROPIC_SECRET_ID: props.anthropicSecretName,
        ALLOWED_CHANNELS: props.allowedChannels ?? '',
      },
    });

    slackSecret.grantRead(fn);
    anthropicSecret.grantRead(fn);
    // 回答作りは自分自身を非同期で呼び直す。fn.functionArn を使うとロールと関数が循環参照するので名前から組み立てる
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [`arn:aws:lambda:${this.region}:${this.account}:function:${functionName}`],
    }));

    // Slackからの受け口。認証はSlackの署名(signing_secret)をLambda側で確かめる
    const url = fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE });

    new cdk.CfnOutput(this, 'SlackRequestUrl', {
      value: url.url,
      description: 'SlackアプリのEvent Subscriptions → Request URL に設定する',
    });
  }
}
