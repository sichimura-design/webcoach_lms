import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

export interface ProdAlbStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly vpc: ec2.IVpc;
  /**
   * ALB の HTTPS リスナーに使用する ACM 証明書 ARN (ap-northeast-1)。
   * 指定するとポート 443 リスナーが追加され、80 は 443 にリダイレクトされる。
   */
  readonly albCertificateArn?: string;
}

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

    const { envName, vpc, albCertificateArn } = props;

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
    });

    if (albCertificateArn) {
      const cert = acm.Certificate.fromCertificateArn(this, 'AlbCert', albCertificateArn);
      const httpsListener = this.alb.addListener('HttpsListener', {
        port: 443,
        certificates: [cert],
        defaultTargetGroups: [this.targetGroup],
      });
      httpsListener.node.addDependency(this.targetGroup);

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
}
