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
  /** ボットに読ませるソースのgitの参照。本番で動いているもの(master)に合わせる。デプロイ前に git fetch しておくこと */
  readonly codeRef: string;
}

const REPO_ROOT = path.join(__dirname, '../..');
const LAMBDA_DIR = path.join(__dirname, '../lambda/support-bot');
const MANUAL_DIR = path.join(__dirname, '../../docs/support');

// ボットに読ませるソース。git管理下のファイルだけを取り出すので、作業ツリーの鍵ファイル等は入らない
const CODE_PATHSPECS = [
  'frontend/src', 'bff-server', 'api-server', 'moodle', 'nginx', 'cdk-prod/lib', 'cdk-prod/lambda', 'scripts/db',
  // 画面のモックデータは本番と違う値で誤答の元になる。テストやカバレッジ出力も調べる対象ではない
  ':(exclude)frontend/src/mocks', ':(exclude)api-server/tests', ':(exclude)api-server/htmlcov',
  ':(exclude)api-server/chromadb', ':(exclude)**/*.test.*', ':(exclude)**/test_*.py', ':(exclude)**/__pycache__',
  // 鍵・環境変数ファイルは調べる対象ではないので、git管理下にあっても入れない(nginx/ssl/server.key 等)
  ':(exclude)nginx/ssl', ':(exclude)**/*.key', ':(exclude)**/*.pem', ':(exclude)**/.env*',
];
// 画像などの読めないファイルと、データの塊(大きなSQLダンプ等)は入れない
const SKIP_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|pdf|zip|gz|pyc|map|lock)$/i;
const MAX_CODE_FILE_BYTES = 200 * 1024;

function pruneCode(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pruneCode(full);
    } else if (SKIP_EXTENSIONS.test(entry.name) || entry.name === 'package-lock.json'
      || fs.statSync(full).size > MAX_CODE_FILE_BYTES) {
      fs.rmSync(full);
    }
  }
}

/** Lambdaの中身を組み立てる: プログラム + マニュアル(docs/support/*.md → manual/) + 本番のソース(→ code/) */
function copyProgramManualAndCode(outputDir: string, codeRef: string) {
  for (const name of ['index.py', 'code_tools.py']) {
    fs.copyFileSync(path.join(LAMBDA_DIR, name), path.join(outputDir, name));
  }
  const manualOut = path.join(outputDir, 'manual');
  fs.mkdirSync(manualOut, { recursive: true });
  for (const name of fs.readdirSync(MANUAL_DIR).filter((n) => n.endsWith('.md'))) {
    fs.copyFileSync(path.join(MANUAL_DIR, name), path.join(manualOut, name));
  }

  const codeOut = path.join(outputDir, 'code');
  fs.mkdirSync(codeOut, { recursive: true });
  const commit = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', '--short', codeRef]).toString().trim();
  const tar = execFileSync('git', ['-C', REPO_ROOT, 'archive', '--format=tar', codeRef, '--', ...CODE_PATHSPECS],
    { maxBuffer: 512 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', codeOut], { input: tar, maxBuffer: 512 * 1024 * 1024 });
  pruneCode(codeOut);
  fs.writeFileSync(path.join(codeOut, 'VERSION'), `${codeRef} ${commit}\n`);
}

/**
 * 問い合わせ一次対応のSlackボット(Lambda + Function URL)。稼働中のサービスには何も変更を加えない
 *
 * Slackでボットにメンションすると、docs/support/ のマニュアルをもとにClaudeが回答案をスレッドに返す。
 * マニュアルで足りないときは、同梱した本番のソース(codeRef、既定 origin/master)を検索して確かめる。
 * マニュアルもソースもデプロイ時にLambdaへ同梱するので、直したら・本番を更新したら再デプロイすると反映される。
 */
export class ProdSupportBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProdSupportBotStackProps) {
    super(scope, id, props);

    const { envName, codeRef } = props;
    const functionName = `${envName}-support-bot`;
    const slackSecret = secretsmanager.Secret.fromSecretNameV2(this, 'SlackSecret', props.slackSecretName);
    const anthropicSecret = secretsmanager.Secret.fromSecretNameV2(this, 'AnthropicSecret', props.anthropicSecretName);

    const fn = new lambda.Function(this, 'SupportBotFunction', {
      functionName,
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.X86_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(LAMBDA_DIR, {
        // マニュアル・ソースの変更でも作り直されるよう、組み立て後の中身でハッシュを取る
        assetHashType: cdk.AssetHashType.OUTPUT,
        bundling: {
          // CDKの型の都合で指定するだけ。マニュアルとソースはこのフォルダの外にあり、Dockerでは組み立てられないので、
          // 下の local が失敗したらデプロイ自体を失敗させる(tryBundle は失敗時に例外を投げる)
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: ['bash', '-c', 'echo "support-bot はローカルでのみ組み立てる" && exit 1'],
          // 手元のpipでLambda(Python 3.12/x86_64)向けのwheelを入れる
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
              copyProgramManualAndCode(outputDir, codeRef);
              return true;
            },
          },
        },
      }),
      // Claudeの回答待ち(ソースを調べると1〜2分)。受け口はすぐ200を返すので、Slackの3秒制限には関係しない
      timeout: cdk.Duration.seconds(300),
      // ソースの検索はメモリ上で全ファイルを読むので、CPUの割り当て(メモリに比例)を多めにする
      memorySize: 1024,
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
