import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface EcrStackProps extends cdk.StackProps {
  readonly envName: string;
}

export class EcrStack extends cdk.Stack {
  public readonly apiRepository: ecr.Repository;
  public readonly bffRepository: ecr.Repository;
  public readonly nginxRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const { envName } = props;

    const repoConfig = {
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
    };

    this.apiRepository = new ecr.Repository(this, 'ApiRepo', {
      repositoryName: `${envName}/moodle/api-server`,
      ...repoConfig,
    });

    this.bffRepository = new ecr.Repository(this, 'BffRepo', {
      repositoryName: `${envName}/moodle/bff-server`,
      ...repoConfig,
    });

    this.nginxRepository = new ecr.Repository(this, 'NginxRepo', {
      repositoryName: `${envName}/moodle/nginx`,
      ...repoConfig,
    });

    new cdk.CfnOutput(this, 'ApiRepoUri', {
      value: this.apiRepository.repositoryUri,
      description: 'API Server ECR Repository URI',
      exportName: `${envName}-ApiServerRepoUri`,
    });

    new cdk.CfnOutput(this, 'BffRepoUri', {
      value: this.bffRepository.repositoryUri,
      description: 'BFF Server ECR Repository URI',
      exportName: `${envName}-BffServerRepoUri`,
    });

    new cdk.CfnOutput(this, 'NginxRepoUri', {
      value: this.nginxRepository.repositoryUri,
      description: 'Nginx ECR Repository URI',
      exportName: `${envName}-NginxRepoUri`,
    });
  }
}
