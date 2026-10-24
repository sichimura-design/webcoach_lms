import * as cdk from 'aws-cdk-lib';
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
import { Construct } from 'constructs';

export interface ProdGuardDutyStackProps extends cdk.StackProps {
  readonly envName: string;
}

/**
 * GuardDuty(脅威検知)をこのリージョンで有効にする。
 *
 * 2026-10-22の調査で本番に検知の仕組みが何も無かった(IMDSv1有効・Moodleへのスキャン多数)ため追加。
 * 基本の検知(CloudTrail管理イベント・VPCフローログ・DNSログ)は常に有効で、
 * EC2ロールのキーが外部から使われた(InstanceCredentialExfiltration)・不審な通信先などを拾う。
 * 追加の保護は、エージェントの導入が要らず費用の小さいものだけ有効にしている。
 * 検知結果はコンソール(GuardDuty → 結果)で見る。重要度「中」以上はprod-SlackNotifierStackのルールで#lms-alertへ通知する。
 */
export class ProdGuardDutyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProdGuardDutyStackProps) {
    super(scope, id, props);

    const enabled = (name: string) => ({ name, status: 'ENABLED' });
    const disabled = (name: string) => ({ name, status: 'DISABLED' });

    const detector = new guardduty.CfnDetector(this, 'Detector', {
      enable: true,
      findingPublishingFrequency: 'FIFTEEN_MINUTES',
      features: [
        // 教材・録画などのS3バケットへの不審なアクセス
        enabled('S3_DATA_EVENTS'),
        // 検知があったときだけEC2のEBSをスキャンする(常時スキャンではない)
        enabled('EBS_MALWARE_PROTECTION'),
        // RDSへの不審なログイン(対応していないエンジンでは何もしない)
        enabled('RDS_LOGIN_EVENTS'),
        // Slack通知・問い合わせボット等のLambdaの通信
        enabled('LAMBDA_NETWORK_LOGS'),
        // EKSは使っていない
        disabled('EKS_AUDIT_LOGS'),
        // ECS(EC2)の実行時監視はEC2へのエージェント導入が要るので、入れるなら別途判断する
        disabled('RUNTIME_MONITORING'),
      ],
    });

    new cdk.CfnOutput(this, 'DetectorId', { value: detector.ref });
  }
}
