import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as elbv2Actions from 'aws-cdk-lib/aws-elasticloadbalancingv2-actions';
import { Construct } from 'constructs';

export interface ProdAlbStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.IVpc;
  /**
   * ALB の HTTPS リスナーに使用する ACM 証明書 ARN (ap-northeast-1)。
   * 指定するとポート 443 リスナーが追加され、80 は 443 にリダイレクトされる。
   */
  readonly albCertificateArn?: string;
  /**
   * 指定すると、Moodle(BFF用のパス以外)へのアクセスをALBでCognitoログイン済みの人だけに絞る。
   * HTTPSリスナーがあるときだけ有効。
   */
  readonly moodleGate?: MoodleGateProps;
}

export interface MoodleGateProps {
  /** 本番ユーザープールID(prod-CognitoStack)。ALB用のアプリクライアントをこのプールに追加する */
  readonly userPoolId: string;
  /** Cognitoドメインのプレフィックス(ログイン画面 https://<prefix>.auth.<region>.amazoncognito.com) */
  readonly userPoolDomainPrefix: string;
  /** ALBのドメイン(api.webcoach.jp)。ログイン後の戻り先 /oauth2/idpresponse に使う */
  readonly albDomain: string;
}

/**
 * ALBのCognito認証を通さずに素通しするパス。SPA(BFF)・Googleなど外部からの戻り先・ヘルスチェック用。
 * BFF/api-serverからMoodleへの呼び出しは localhost:8080 直結でALBを通らないので、ここに無くてよい。
 * 1つの条件に書けるのは5個まで。
 */
const MOODLE_GATE_PUBLIC_PATHS = ['/api/*', '/health', '/user/info', '/login', '/auth.html'];

/**
 * ALB スタック: ECS サービスより先に ALB + 空のターゲットグループを用意する。
 *
 * ECS サービス自体は backend-stack 側で作成し、ここで作った
 * targetGroup (ARN) に後からアタッチする (targetGroup.addTarget(service))。
 * これにより ECR にイメージが無い段階でも ALB の DNS 名を先に確保できる。
 */
export class ProdAlbStack extends cdk.Stack {
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: Construct, id: string, props: ProdAlbStackProps) {
    super(scope, id, props);

    const { envName, vpc, albCertificateArn, moodleGate } = props;

    this.albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      securityGroupName: `${envName}-lms-alb-sg`,
      description: 'ALB security group',
      allowAllOutbound: true,
    });
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      securityGroup: this.albSecurityGroup,
      loadBalancerName: `${envName}-lms-alb`,
      deletionProtection: true,
    });

    // ECS サービス作成前のため、ターゲット未登録のターゲットグループを先に作る。
    // HOST ネットワークモードの EC2 起動タイプなので targetType は INSTANCE。
    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      targetGroupName: `${envName}-lms-tg`,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
      // api-serverはAIチャットの非同期ジョブ(_chat_jobs)とDify会話キャッシュを
      // プロセス内メモリに持っている。タスクが複数あると、ジョブ作成とポーリング・
      // 会話の続きが別タスクに振り分けられて「job_idが見つからない」「会話がリセット
      // される」ため、同じ利用者は同じタスクへ固定する(ALB生成Cookie、AWSALB/AWSALBCORS)。
      // 共有ストア(Redis)へ移行したら外してよい。
      stickinessCookieDuration: cdk.Duration.days(1),
    });

    if (albCertificateArn) {
      const cert = acm.Certificate.fromCertificateArn(this, 'AlbCert', albCertificateArn);
      const forwardToEcs = elbv2.ListenerAction.forward([this.targetGroup]);
      const httpsListener = this.alb.addListener('HttpsListener', {
        port: 443,
        certificates: [cert],
        defaultAction: moodleGate ? this.moodleGateAction(envName, moodleGate, forwardToEcs) : forwardToEcs,
      });
      httpsListener.node.addDependency(this.targetGroup);

      if (moodleGate) {
        // BFF・ヘルスチェック等は認証なしで通す(既定の動作=Cognito認証より先に評価される)
        httpsListener.addAction('MoodleGatePublicPaths', {
          priority: 10,
          conditions: [elbv2.ListenerCondition.pathPatterns(MOODLE_GATE_PUBLIC_PATHS)],
          action: forwardToEcs,
        });
      }

      this.alb.addListener('HttpListener', {
        port: 80,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: 'HTTPS',
          port: '443',
          permanent: true,
        }),
      });
    } else {
      const listener = this.alb.addListener('HttpListener', { port: 80, open: true });
      listener.addTargetGroups('EcsTargets', { targetGroups: [this.targetGroup] });
    }

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS — moodleSiteUrl と REACT_APP_API_URL に設定する',
      exportName: `${envName}-AlbDnsName`,
    });

    new cdk.CfnOutput(this, 'TargetGroupArn', {
      value: this.targetGroup.targetGroupArn,
      description: 'backend-stack が ECS サービスをアタッチする際に使うターゲットグループARN',
      exportName: `${envName}-TargetGroupArn`,
    });

    new cdk.CfnOutput(this, 'AlbSecurityGroupId', {
      value: this.albSecurityGroup.securityGroupId,
      description: 'backend-stack の EC2 SG が ALB からのインバウンドを許可する際に参照するSG ID',
      exportName: `${envName}-AlbSecurityGroupId`,
    });
  }

  /**
   * 2026-10-24: Moodle(PHP)を、Cognitoにログインしていない人から隠す。
   * Moodle 4.3はセキュリティサポートが終わっており、ログイン前に突ける穴・デバッグ表示・
   * パスワード再設定画面が外から見えていたため、4.5へ上げるまでの応急処置として入れた。
   * 本番プールをそのまま使うので受講生・コーチもALBは通過できる(その先はMoodle自身のログイン)。
   */
  private moodleGateAction(envName: string, gate: MoodleGateProps, next: elbv2.ListenerAction): elbv2.ListenerAction {
    const userPool = cognito.UserPool.fromUserPoolId(this, 'MoodleGateUserPool', gate.userPoolId);
    const userPoolClient = new cognito.UserPoolClient(this, 'MoodleGateClient', {
      userPool,
      userPoolClientName: `${envName}-lms-alb-moodle-gate`,
      // ALBの認証はクライアントシークレット必須
      generateSecret: true,
      authFlows: {},
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID],
        callbackUrls: [`https://${gate.albDomain}/oauth2/idpresponse`],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      preventUserExistenceErrors: true,
    });
    const userPoolDomain = cognito.UserPoolDomain.fromDomainName(this, 'MoodleGateDomain', gate.userPoolDomainPrefix);
    return new elbv2Actions.AuthenticateCognitoAction({
      userPool,
      userPoolClient,
      userPoolDomain,
      // 管理作業の1日分。切れたらCognitoのログイン画面に戻される
      sessionTimeout: cdk.Duration.hours(12),
      next,
    });
  }
}
