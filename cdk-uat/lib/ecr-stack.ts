import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface UatEcrStackProps extends cdk.StackProps {
  readonly envName: string;
}

export class UatEcrStack extends cdk.Stack {
  public readonly nginxRepo: ecr.Repository;
  public readonly bffRepo: ecr.Repository;
  public readonly apiRepo: ecr.Repository;
  public readonly moodleRepo: ecr.Repository;

  constructor(scope: Construct, id: string, props: UatEcrStackProps) {
    super(scope, id, props);

    const { envName } = props;

    // ECR は環境をまたいで共有可能だが、UAT 用に独立させる
    this.nginxRepo = new ecr.Repository(this, 'NginxRepo', {
      repositoryName: `${envName}-moodle-nginx`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        { maxImageCount: 10, description: 'Keep last 10 images' },
      ],
    });

    this.bffRepo = new ecr.Repository(this, 'BffRepo', {
      repositoryName: `${envName}-moodle-bff`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        { maxImageCount: 10, description: 'Keep last 10 images' },
      ],
    });

    this.apiRepo = new ecr.Repository(this, 'ApiRepo', {
      repositoryName: `${envName}-moodle-api`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        { maxImageCount: 10, description: 'Keep last 10 images' },
      ],
    });

    this.moodleRepo = new ecr.Repository(this, 'MoodleRepo', {
      repositoryName: `${envName}-moodle-app`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        { maxImageCount: 10, description: 'Keep last 10 images' },
      ],
    });

    // Outputs (docker push 時に使用)
    new cdk.CfnOutput(this, 'NginxRepoUri', {
      value: this.nginxRepo.repositoryUri,
      exportName: `${envName}-NginxRepoUri`,
    });
    new cdk.CfnOutput(this, 'BffRepoUri', {
      value: this.bffRepo.repositoryUri,
      exportName: `${envName}-BffRepoUri`,
    });
    new cdk.CfnOutput(this, 'ApiRepoUri', {
      value: this.apiRepo.repositoryUri,
      exportName: `${envName}-ApiRepoUri`,
    });
    new cdk.CfnOutput(this, 'MoodleRepoUri', {
      value: this.moodleRepo.repositoryUri,
      exportName: `${envName}-MoodleRepoUri`,
    });
  }
}
