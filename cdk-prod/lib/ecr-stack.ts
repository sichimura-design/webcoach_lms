import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface ProdEcrStackProps extends cdk.StackProps {
  readonly envName: string;
}

/**
 * ECR スタック
 *
 * UAT/dev と同じ単一リポジトリ + タグ方式を踏襲:
 *   リポジトリ名: webcoach-lms
 *   タグ:
 *     moodle-nginx-latest   → nginx リバースプロキシ
 *     moodle-bff-latest     → BFF サーバー
 *     moodle-api-latest     → API サーバー
 *     moodle-custom-latest  → Moodle 本体 (カスタムビルド)
 *
 * push 例:
 *   aws ecr get-login-password --region ap-northeast-1 \
 *     --profile PowerUserAccess-840513866884 \
 *     | docker login --username AWS --password-stdin \
 *       840513866884.dkr.ecr.ap-northeast-1.amazonaws.com
 *
 *   docker tag moodle-nginx:latest \
 *     840513866884.dkr.ecr.ap-northeast-1.amazonaws.com/webcoach-lms:moodle-nginx-latest
 *   docker push \
 *     840513866884.dkr.ecr.ap-northeast-1.amazonaws.com/webcoach-lms:moodle-nginx-latest
 */
export class ProdEcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: ProdEcrStackProps) {
    super(scope, id, props);

    const { envName } = props;

    this.repository = new ecr.Repository(this, 'WebcoachLmsRepo', {
      repositoryName: 'webcoach-lms',
      // 本番リポジトリは cdk destroy しても削除しない
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          // タグなしイメージ (古いビルドの残骸) を 7 日で削除
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageAge: cdk.Duration.days(7),
          description: 'Remove untagged images after 7 days',
        },
      ],
    });

    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'ECR repository URI (webcoach-lms)',
      exportName: `${envName}-EcrRepositoryUri`,
    });
  }
}
