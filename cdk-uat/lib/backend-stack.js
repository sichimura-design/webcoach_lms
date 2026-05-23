"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.UatBackendStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const efs = __importStar(require("aws-cdk-lib/aws-efs"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const autoscaling = __importStar(require("aws-cdk-lib/aws-autoscaling"));
/**
 * ECS EC2 起動タイプによる UAT バックエンドスタック。
 *
 * ネットワークモード: HOST
 *   → 全コンテナが EC2 ホストのネットワークを共有
 *   → docker-compose と同じく localhost で相互通信可能
 *   → EC2 に SSH または ECS Exec でコンテナに入り、ファイル編集が可能
 *
 * コンテナ構成 (1タスク):
 *   nginx     :80   → リバースプロキシ
 *   bff-server:3001 → BFF (Moodle セッション認証)
 *   api-server:8001 → API サーバー
 *   moodle-app:8080 → Moodle 本体 (moodledata は EFS)
 */
class UatBackendStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { envName, vpc, nginxRepo, bffRepo, apiRepo, moodleRepo, cognitoUserPoolId, cognitoClientId, cognitoClientSecret, anthropicApiKey, moodleSiteUrl, keyPairName, desiredCount = 1, } = props;
        // ========================================
        // Security Groups
        // ========================================
        const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
            vpc,
            securityGroupName: `${envName}-moodle-alb-sg`,
            description: 'ALB security group',
            allowAllOutbound: true,
        });
        albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
        albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
        // HOST ネットワークモードでは EC2 インスタンスの SG がそのままコンテナに適用される
        const ec2Sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
            vpc,
            securityGroupName: `${envName}-moodle-ec2-sg`,
            description: 'ECS EC2 instance security group',
            allowAllOutbound: true,
        });
        ec2Sg.addIngressRule(albSg, ec2.Port.tcp(80), 'HTTP from ALB');
        if (keyPairName) {
            ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'SSH');
        }
        const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
            vpc,
            securityGroupName: `${envName}-moodle-rds-sg`,
            description: 'RDS MySQL security group',
            allowAllOutbound: false,
        });
        rdsSg.addIngressRule(ec2Sg, ec2.Port.tcp(3306), 'MySQL from ECS EC2');
        const efsSg = new ec2.SecurityGroup(this, 'EfsSg', {
            vpc,
            securityGroupName: `${envName}-moodle-efs-sg`,
            description: 'EFS security group',
            allowAllOutbound: false,
        });
        efsSg.addIngressRule(ec2Sg, ec2.Port.tcp(2049), 'NFS from ECS EC2');
        // ========================================
        // Secrets Manager
        // ========================================
        const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
            secretName: `${envName}/moodle/db-credentials`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'moodleuser' }),
                generateStringKey: 'password',
                excludePunctuation: true,
                includeSpace: false,
            },
        });
        const cognitoSecret = new secretsmanager.Secret(this, 'CognitoSecret', {
            secretName: `${envName}/moodle/cognito-credentials`,
            secretObjectValue: {
                userPoolId: cdk.SecretValue.unsafePlainText(cognitoUserPoolId ?? 'REPLACE_ME'),
                clientId: cdk.SecretValue.unsafePlainText(cognitoClientId ?? 'REPLACE_ME'),
                clientSecret: cdk.SecretValue.unsafePlainText(cognitoClientSecret ?? 'REPLACE_ME'),
            },
        });
        const anthropicSecret = new secretsmanager.Secret(this, 'AnthropicSecret', {
            secretName: `${envName}/moodle/anthropic-api-key`,
            secretStringValue: cdk.SecretValue.unsafePlainText(anthropicApiKey ?? 'REPLACE_ME'),
        });
        // ========================================
        // RDS MySQL
        // ========================================
        const database = new rds.DatabaseInstance(this, 'Database', {
            engine: rds.DatabaseInstanceEngine.mysql({
                version: rds.MysqlEngineVersion.VER_8_0,
            }),
            instanceIdentifier: `${envName}-moodle-db`,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            securityGroups: [rdsSg],
            databaseName: 'moodle',
            credentials: rds.Credentials.fromSecret(dbSecret),
            allocatedStorage: 20,
            maxAllocatedStorage: 100,
            multiAz: false,
            backupRetention: cdk.Duration.days(3),
            deletionProtection: false,
            removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
            storageEncrypted: true,
        });
        // ========================================
        // EFS (moodledata 永続化)
        // ========================================
        const fileSystem = new efs.FileSystem(this, 'MoodleEfs', {
            vpc,
            fileSystemName: `${envName}-moodle-efs`,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }, // EFS は外部公開不要
            securityGroup: efsSg,
            encrypted: true,
            removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
            lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
        });
        const moodledataAP = fileSystem.addAccessPoint('MoodledataAP', {
            path: '/moodledata',
            createAcl: { ownerUid: '1', ownerGid: '1', permissions: '755' },
            posixUser: { uid: '1', gid: '1' },
        });
        // ========================================
        // CloudWatch Logs
        // ========================================
        const logGroup = new logs.LogGroup(this, 'LogGroup', {
            logGroupName: `/ecs/${envName}/moodle`,
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // ========================================
        // ECS Cluster + EC2 キャパシティ
        // ========================================
        const cluster = new ecs.Cluster(this, 'Cluster', {
            vpc,
            clusterName: `${envName}-moodle-cluster`,
            containerInsights: true,
        });
        // t3.xlarge: 4vCPU / 16GB → 全コンテナ合計 ~3.8GB + OS 余裕あり
        // UAT: NAT 不要のため Public サブネットに配置
        const asg = cluster.addCapacity('Ec2Capacity', {
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.XLARGE),
            minCapacity: 1,
            maxCapacity: 2,
            desiredCapacity: 1,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            keyPair: keyPairName
                ? ec2.KeyPair.fromKeyPairName(this, 'KeyPair', keyPairName)
                : undefined,
            blockDevices: [
                {
                    deviceName: '/dev/xvda',
                    volume: autoscaling.BlockDeviceVolume.ebs(50, {
                        volumeType: autoscaling.EbsDeviceVolumeType.GP3,
                        encrypted: true,
                    }),
                },
            ],
        });
        // addCapacity は securityGroup を直接受け付けないため後付けで追加
        asg.addSecurityGroup(ec2Sg);
        // IAM ポリシーを auto-created role に付与
        asg.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
        asg.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'));
        // EFS アクセス権限
        asg.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'elasticfilesystem:ClientMount',
                'elasticfilesystem:ClientWrite',
                'elasticfilesystem:ClientRootAccess',
            ],
            resources: [fileSystem.fileSystemArn],
        }));
        // Secrets Manager 読み取り（EC2 タスクでも必要）
        asg.addToRolePolicy(new iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
            resources: [
                dbSecret.secretArn,
                cognitoSecret.secretArn,
                anthropicSecret.secretArn,
            ],
        }));
        // ========================================
        // ECS Task Definition (EC2 / HOST ネットワーク)
        //
        // HOST モード = 全コンテナが EC2 ホストのネットワーク共有
        //   → docker-compose と同様に localhost で相互通信可能
        //   → BFF: MOODLE_URL=http://localhost:8080 がそのまま動く
        // ========================================
        const taskDef = new ecs.Ec2TaskDefinition(this, 'TaskDef', {
            family: `${envName}-moodle-task`,
            networkMode: ecs.NetworkMode.HOST,
            volumes: [
                {
                    name: 'moodledata',
                    efsVolumeConfiguration: {
                        fileSystemId: fileSystem.fileSystemId,
                        transitEncryption: 'ENABLED',
                        authorizationConfig: {
                            accessPointId: moodledataAP.accessPointId,
                            iam: 'ENABLED',
                        },
                    },
                },
            ],
        });
        // タスク実行ロールに Secrets Manager 権限
        taskDef.addToExecutionRolePolicy(new iam.PolicyStatement({
            actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
            resources: [
                dbSecret.secretArn,
                cognitoSecret.secretArn,
                anthropicSecret.secretArn,
            ],
        }));
        // ----------------------------------------
        // nginx (リバースプロキシ)
        // HOST モードなので hostPort 指定不要
        // ----------------------------------------
        const nginxContainer = taskDef.addContainer('nginx', {
            image: ecs.ContainerImage.fromEcrRepository(nginxRepo, 'latest'),
            memoryLimitMiB: 256,
            cpu: 256,
            logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'nginx', logGroup }),
            portMappings: [{ containerPort: 80, protocol: ecs.Protocol.TCP }],
            essential: true,
            environment: {
                BFF_HOST: 'localhost:3001',
                API_HOST: 'localhost:8001',
                MOODLE_HOST: 'localhost:8080',
            },
        });
        // ----------------------------------------
        // bff-server
        // ----------------------------------------
        const bffContainer = taskDef.addContainer('bff-server', {
            image: ecs.ContainerImage.fromEcrRepository(bffRepo, 'latest'),
            memoryLimitMiB: 512,
            cpu: 512,
            logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'bff', logGroup }),
            portMappings: [{ containerPort: 3001, protocol: ecs.Protocol.TCP }],
            essential: true,
            environment: {
                NODE_ENV: 'production',
                MOODLE_URL: 'http://localhost:8080',
                API_SERVER_URL: 'http://localhost:8001',
                MOODLE_SERVICE_NAME: 'moodle_mobile_app',
            },
            secrets: {
                COGNITO_USER_POOL_ID: ecs.Secret.fromSecretsManager(cognitoSecret, 'userPoolId'),
                COGNITO_CLIENT_ID: ecs.Secret.fromSecretsManager(cognitoSecret, 'clientId'),
                COGNITO_CLIENT_SECRET: ecs.Secret.fromSecretsManager(cognitoSecret, 'clientSecret'),
            },
        });
        // ----------------------------------------
        // api-server
        // ----------------------------------------
        const apiContainer = taskDef.addContainer('api-server', {
            image: ecs.ContainerImage.fromEcrRepository(apiRepo, 'latest'),
            memoryLimitMiB: 1024,
            cpu: 1024,
            logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup }),
            portMappings: [{ containerPort: 8001, protocol: ecs.Protocol.TCP }],
            essential: true,
            environment: {
                DATABASE_HOST: database.dbInstanceEndpointAddress,
                DATABASE_PORT: database.dbInstanceEndpointPort,
                DATABASE_NAME: 'moodle',
                MOODLE_URL: 'http://localhost:8080',
            },
            secrets: {
                DATABASE_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
                DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
                ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(anthropicSecret),
            },
        });
        // ----------------------------------------
        // moodle-app
        // ----------------------------------------
        const moodleContainer = taskDef.addContainer('moodle-app', {
            image: ecs.ContainerImage.fromEcrRepository(moodleRepo, 'latest'),
            memoryLimitMiB: 2048,
            cpu: 2048,
            logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'moodle', logGroup }),
            portMappings: [{ containerPort: 8080, protocol: ecs.Protocol.TCP }],
            essential: true,
            environment: {
                MOODLE_DATABASE_HOST: database.dbInstanceEndpointAddress,
                MOODLE_DATABASE_NAME: 'moodle',
                MOODLE_DATABASE_TYPE: 'mysqli',
                MOODLE_DATAROOT: '/moodledata',
                // ALB DNS 確定後に --context moodleSiteUrl=http://... で再デプロイ
                MOODLE_SITE_URL: moodleSiteUrl ?? 'REPLACE_ME',
                MOODLE_SESSION_HANDLER: 'database',
            },
            secrets: {
                MOODLE_DATABASE_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
                MOODLE_DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
            },
        });
        moodleContainer.addMountPoints({
            sourceVolume: 'moodledata',
            containerPath: '/moodledata',
            readOnly: false,
        });
        nginxContainer.addContainerDependencies({ container: bffContainer, condition: ecs.ContainerDependencyCondition.START }, { container: apiContainer, condition: ecs.ContainerDependencyCondition.START }, { container: moodleContainer, condition: ecs.ContainerDependencyCondition.START });
        // ========================================
        // ECS Service (EC2)
        // ========================================
        const service = new ecs.Ec2Service(this, 'Service', {
            cluster,
            taskDefinition: taskDef,
            serviceName: `${envName}-moodle-service`,
            desiredCount,
            minHealthyPercent: 0,
            maxHealthyPercent: 100, // EC2 1台のとき 200 にするとタスクが2つ起動してポート衝突する
            healthCheckGracePeriod: cdk.Duration.seconds(120),
            enableExecuteCommand: true, // ECS Exec でコンテナに入れる
            circuitBreaker: { rollback: true },
        });
        // ========================================
        // Application Load Balancer
        // ========================================
        const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
            vpc,
            internetFacing: true,
            securityGroup: albSg,
            loadBalancerName: `${envName}-moodle-alb`,
        });
        const listener = alb.addListener('HttpListener', { port: 80, open: true });
        listener.addTargets('EcsTargets', {
            port: 80,
            protocol: elbv2.ApplicationProtocol.HTTP,
            targets: [service],
            targetGroupName: `${envName}-moodle-tg`,
            healthCheck: {
                path: '/health',
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(10),
                healthyThresholdCount: 2,
                unhealthyThresholdCount: 3,
            },
            deregistrationDelay: cdk.Duration.seconds(30),
        });
        // ========================================
        // Outputs
        // ========================================
        new cdk.CfnOutput(this, 'AlbDnsName', {
            value: alb.loadBalancerDnsName,
            description: 'ALB DNS — moodleSiteUrl と REACT_APP_API_URL に設定する',
            exportName: `${envName}-AlbDnsName`,
        });
        new cdk.CfnOutput(this, 'ClusterName', {
            value: cluster.clusterName,
            exportName: `${envName}-ClusterName`,
        });
        new cdk.CfnOutput(this, 'DbEndpoint', {
            value: database.dbInstanceEndpointAddress,
            exportName: `${envName}-DbEndpoint`,
        });
        new cdk.CfnOutput(this, 'DbSecretArn', {
            value: dbSecret.secretArn,
            exportName: `${envName}-DbSecretArn`,
        });
        new cdk.CfnOutput(this, 'CognitoSecretArn', {
            value: cognitoSecret.secretArn,
            description: 'デプロイ後に手動更新: aws secretsmanager put-secret-value ...',
            exportName: `${envName}-CognitoSecretArn`,
        });
        new cdk.CfnOutput(this, 'EfsId', {
            value: fileSystem.fileSystemId,
            exportName: `${envName}-EfsId`,
        });
    }
}
exports.UatBackendStack = UatBackendStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2VuZC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJhY2tlbmQtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsOEVBQWdFO0FBQ2hFLHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsK0VBQWlFO0FBRWpFLDJEQUE2QztBQUM3Qyx5REFBMkM7QUFDM0MseUVBQTJEO0FBNEIzRDs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ0gsTUFBYSxlQUFnQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUNKLE9BQU8sRUFBRSxHQUFHLEVBQ1osU0FBUyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUN2QyxpQkFBaUIsRUFBRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUUsZUFBZSxFQUN4RSxhQUFhLEVBQ2IsV0FBVyxFQUNYLFlBQVksR0FBRyxDQUFDLEdBQ2pCLEdBQUcsS0FBSyxDQUFDO1FBRVYsMkNBQTJDO1FBQzNDLGtCQUFrQjtRQUNsQiwyQ0FBMkM7UUFDM0MsTUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7WUFDakQsR0FBRztZQUNILGlCQUFpQixFQUFFLEdBQUcsT0FBTyxnQkFBZ0I7WUFDN0MsV0FBVyxFQUFFLG9CQUFvQjtZQUNqQyxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUNILEtBQUssQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FB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LEdBQUcsT0FBTyxRQUFRO1NBQy9CLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXBaRCwwQ0FvWkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnO1xuaW1wb3J0ICogYXMgZWxidjIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjInO1xuaW1wb3J0ICogYXMgZWZzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lZnMnO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGVjciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWNyJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgYXV0b3NjYWxpbmcgZnJvbSAnYXdzLWNkay1saWIvYXdzLWF1dG9zY2FsaW5nJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFVhdEJhY2tlbmRTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICByZWFkb25seSBlbnZOYW1lOiBzdHJpbmc7XG4gIHJlYWRvbmx5IHZwYzogZWMyLlZwYztcbiAgcmVhZG9ubHkgbmdpbnhSZXBvOiBlY3IuUmVwb3NpdG9yeTtcbiAgcmVhZG9ubHkgYmZmUmVwbzogZWNyLlJlcG9zaXRvcnk7XG4gIHJlYWRvbmx5IGFwaVJlcG86IGVjci5SZXBvc2l0b3J5O1xuICByZWFkb25seSBtb29kbGVSZXBvOiBlY3IuUmVwb3NpdG9yeTtcbiAgcmVhZG9ubHkgY29nbml0b1VzZXJQb29sSWQ/OiBzdHJpbmc7XG4gIHJlYWRvbmx5IGNvZ25pdG9DbGllbnRJZD86IHN0cmluZztcbiAgcmVhZG9ubHkgY29nbml0b0NsaWVudFNlY3JldD86IHN0cmluZztcbiAgcmVhZG9ubHkgYW50aHJvcGljQXBpS2V5Pzogc3RyaW5nO1xuICAvKipcbiAgICogTW9vZGxlIOOBriB3d3dyb290IFVSTOOAgkFMQiBETlMg5ZCN44G+44Gf44Gv54us6Ieq44OJ44Oh44Kk44Oz44CCXG4gICAqIOWIneWbnuODh+ODl+ODreOCpOaZguOBr+ecgeeVpeWPr+OAgkFMQiDnorrlrprlvozjgavlho3jg4fjg5fjg63jgqTjgafoqK3lrprjgZnjgovjgIJcbiAgICovXG4gIHJlYWRvbmx5IG1vb2RsZVNpdGVVcmw/OiBzdHJpbmc7XG4gIC8qKlxuICAgKiBTU0gg44Ki44Kv44K744K555So44Kt44O844Oa44Ki5ZCN44CC5oyH5a6a44GZ44KL44GoRUMy44GrU1NI5Y+v6IO944Gr44Gq44KL44CCXG4gICAqIFVBVCDjgafjga7nm7TmjqXjg4fjg5Djg4PjgrDjgavkvb/nlKjjgILnnIHnlaXmmYLjga8gU1NNIFNlc3Npb24gTWFuYWdlciDjga7jgb/jgIJcbiAgICovXG4gIHJlYWRvbmx5IGtleVBhaXJOYW1lPzogc3RyaW5nO1xuICAvKiogRUNSIOOBq+OCpOODoeODvOOCuOOBjOOBquOBhOWIneWbnuODh+ODl+ODreOCpOaZguOBryAwIOOCkuaMh+WumiAqL1xuICByZWFkb25seSBkZXNpcmVkQ291bnQ/OiBudW1iZXI7XG59XG5cbi8qKlxuICogRUNTIEVDMiDotbfli5Xjgr/jgqTjg5fjgavjgojjgosgVUFUIOODkOODg+OCr+OCqOODs+ODieOCueOCv+ODg+OCr+OAglxuICpcbiAqIOODjeODg+ODiOODr+ODvOOCr+ODouODvOODiTogSE9TVFxuICogICDihpIg5YWo44Kz44Oz44OG44OK44GMIEVDMiDjg5vjgrnjg4jjga7jg43jg4Pjg4jjg6/jg7zjgq/jgpLlhbHmnIlcbiAqICAg4oaSIGRvY2tlci1jb21wb3NlIOOBqOWQjOOBmOOBjyBsb2NhbGhvc3Qg44Gn55u45LqS6YCa5L+h5Y+v6IO9XG4gKiAgIOKGkiBFQzIg44GrIFNTSCDjgb7jgZ/jga8gRUNTIEV4ZWMg44Gn44Kz44Oz44OG44OK44Gr5YWl44KK44CB44OV44Kh44Kk44Or57eo6ZuG44GM5Y+v6IO9XG4gKlxuICog44Kz44Oz44OG44OK5qeL5oiQICgx44K/44K544KvKTpcbiAqICAgbmdpbnggICAgIDo4MCAgIOKGkiDjg6rjg5Djg7zjgrnjg5fjg63jgq3jgrdcbiAqICAgYmZmLXNlcnZlcjozMDAxIOKGkiBCRkYgKE1vb2RsZSDjgrvjg4Pjgrfjg6fjg7Poqo3oqLwpXG4gKiAgIGFwaS1zZXJ2ZXI6ODAwMSDihpIgQVBJIOOCteODvOODkOODvFxuICogICBtb29kbGUtYXBwOjgwODAg4oaSIE1vb2RsZSDmnKzkvZMgKG1vb2RsZWRhdGEg44GvIEVGUylcbiAqL1xuZXhwb3J0IGNsYXNzIFVhdEJhY2tlbmRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBVYXRCYWNrZW5kU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3Qge1xuICAgICAgZW52TmFtZSwgdnBjLFxuICAgICAgbmdpbnhSZXBvLCBiZmZSZXBvLCBhcGlSZXBvLCBtb29kbGVSZXBvLFxuICAgICAgY29nbml0b1VzZXJQb29sSWQsIGNvZ25pdG9DbGllbnRJZCwgY29nbml0b0NsaWVudFNlY3JldCwgYW50aHJvcGljQXBpS2V5LFxuICAgICAgbW9vZGxlU2l0ZVVybCxcbiAgICAgIGtleVBhaXJOYW1lLFxuICAgICAgZGVzaXJlZENvdW50ID0gMSxcbiAgICB9ID0gcHJvcHM7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU2VjdXJpdHkgR3JvdXBzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGFsYlNnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdBbGJTZycsIHtcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtlbnZOYW1lfS1tb29kbGUtYWxiLXNnYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQUxCIHNlY3VyaXR5IGdyb3VwJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG4gICAgYWxiU2cuYWRkSW5ncmVzc1J1bGUoZWMyLlBlZXIuYW55SXB2NCgpLCBlYzIuUG9ydC50Y3AoODApLCAnSFRUUCcpO1xuICAgIGFsYlNnLmFkZEluZ3Jlc3NSdWxlKGVjMi5QZWVyLmFueUlwdjQoKSwgZWMyLlBvcnQudGNwKDQ0MyksICdIVFRQUycpO1xuXG4gICAgLy8gSE9TVCDjg43jg4Pjg4jjg6/jg7zjgq/jg6Ljg7zjg4njgafjga8gRUMyIOOCpOODs+OCueOCv+ODs+OCueOBriBTRyDjgYzjgZ3jga7jgb7jgb7jgrPjg7Pjg4bjg4rjgavpgannlKjjgZXjgozjgotcbiAgICBjb25zdCBlYzJTZyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnRWMyU2cnLCB7XG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwTmFtZTogYCR7ZW52TmFtZX0tbW9vZGxlLWVjMi1zZ2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VDUyBFQzIgaW5zdGFuY2Ugc2VjdXJpdHkgZ3JvdXAnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcbiAgICBlYzJTZy5hZGRJbmdyZXNzUnVsZShhbGJTZywgZWMyLlBvcnQudGNwKDgwKSwgJ0hUVFAgZnJvbSBBTEInKTtcbiAgICBpZiAoa2V5UGFpck5hbWUpIHtcbiAgICAgIGVjMlNnLmFkZEluZ3Jlc3NSdWxlKGVjMi5QZWVyLmFueUlwdjQoKSwgZWMyLlBvcnQudGNwKDIyKSwgJ1NTSCcpO1xuICAgIH1cblxuICAgIGNvbnN0IHJkc1NnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdSZHNTZycsIHtcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtlbnZOYW1lfS1tb29kbGUtcmRzLXNnYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkRTIE15U1FMIHNlY3VyaXR5IGdyb3VwJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IGZhbHNlLFxuICAgIH0pO1xuICAgIHJkc1NnLmFkZEluZ3Jlc3NSdWxlKGVjMlNnLCBlYzIuUG9ydC50Y3AoMzMwNiksICdNeVNRTCBmcm9tIEVDUyBFQzInKTtcblxuICAgIGNvbnN0IGVmc1NnID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdFZnNTZycsIHtcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtlbnZOYW1lfS1tb29kbGUtZWZzLXNnYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRUZTIHNlY3VyaXR5IGdyb3VwJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IGZhbHNlLFxuICAgIH0pO1xuICAgIGVmc1NnLmFkZEluZ3Jlc3NSdWxlKGVjMlNnLCBlYzIuUG9ydC50Y3AoMjA0OSksICdORlMgZnJvbSBFQ1MgRUMyJyk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU2VjcmV0cyBNYW5hZ2VyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGRiU2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnRGJTZWNyZXQnLCB7XG4gICAgICBzZWNyZXROYW1lOiBgJHtlbnZOYW1lfS9tb29kbGUvZGItY3JlZGVudGlhbHNgLFxuICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcbiAgICAgICAgc2VjcmV0U3RyaW5nVGVtcGxhdGU6IEpTT04uc3RyaW5naWZ5KHsgdXNlcm5hbWU6ICdtb29kbGV1c2VyJyB9KSxcbiAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6ICdwYXNzd29yZCcsXG4gICAgICAgIGV4Y2x1ZGVQdW5jdHVhdGlvbjogdHJ1ZSxcbiAgICAgICAgaW5jbHVkZVNwYWNlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBjb2duaXRvU2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnQ29nbml0b1NlY3JldCcsIHtcbiAgICAgIHNlY3JldE5hbWU6IGAke2Vudk5hbWV9L21vb2RsZS9jb2duaXRvLWNyZWRlbnRpYWxzYCxcbiAgICAgIHNlY3JldE9iamVjdFZhbHVlOiB7XG4gICAgICAgIHVzZXJQb29sSWQ6IGNkay5TZWNyZXRWYWx1ZS51bnNhZmVQbGFpblRleHQoY29nbml0b1VzZXJQb29sSWQgPz8gJ1JFUExBQ0VfTUUnKSxcbiAgICAgICAgY2xpZW50SWQ6IGNkay5TZWNyZXRWYWx1ZS51bnNhZmVQbGFpblRleHQoY29nbml0b0NsaWVudElkID8/ICdSRVBMQUNFX01FJyksXG4gICAgICAgIGNsaWVudFNlY3JldDogY2RrLlNlY3JldFZhbHVlLnVuc2FmZVBsYWluVGV4dChjb2duaXRvQ2xpZW50U2VjcmV0ID8/ICdSRVBMQUNFX01FJyksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgYW50aHJvcGljU2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnQW50aHJvcGljU2VjcmV0Jywge1xuICAgICAgc2VjcmV0TmFtZTogYCR7ZW52TmFtZX0vbW9vZGxlL2FudGhyb3BpYy1hcGkta2V5YCxcbiAgICAgIHNlY3JldFN0cmluZ1ZhbHVlOiBjZGsuU2VjcmV0VmFsdWUudW5zYWZlUGxhaW5UZXh0KGFudGhyb3BpY0FwaUtleSA/PyAnUkVQTEFDRV9NRScpLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFJEUyBNeVNRTFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBkYXRhYmFzZSA9IG5ldyByZHMuRGF0YWJhc2VJbnN0YW5jZSh0aGlzLCAnRGF0YWJhc2UnLCB7XG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUluc3RhbmNlRW5naW5lLm15c3FsKHtcbiAgICAgICAgdmVyc2lvbjogcmRzLk15c3FsRW5naW5lVmVyc2lvbi5WRVJfOF8wLFxuICAgICAgfSksXG4gICAgICBpbnN0YW5jZUlkZW50aWZpZXI6IGAke2Vudk5hbWV9LW1vb2RsZS1kYmAsXG4gICAgICBpbnN0YW5jZVR5cGU6IGVjMi5JbnN0YW5jZVR5cGUub2YoZWMyLkluc3RhbmNlQ2xhc3MuVDMsIGVjMi5JbnN0YW5jZVNpemUuU01BTEwpLFxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW3Jkc1NnXSxcbiAgICAgIGRhdGFiYXNlTmFtZTogJ21vb2RsZScsXG4gICAgICBjcmVkZW50aWFsczogcmRzLkNyZWRlbnRpYWxzLmZyb21TZWNyZXQoZGJTZWNyZXQpLFxuICAgICAgYWxsb2NhdGVkU3RvcmFnZTogMjAsXG4gICAgICBtYXhBbGxvY2F0ZWRTdG9yYWdlOiAxMDAsXG4gICAgICBtdWx0aUF6OiBmYWxzZSxcbiAgICAgIGJhY2t1cFJldGVudGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMyksXG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IGZhbHNlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuU05BUFNIT1QsXG4gICAgICBzdG9yYWdlRW5jcnlwdGVkOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEVGUyAobW9vZGxlZGF0YSDmsLjntprljJYpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGZpbGVTeXN0ZW0gPSBuZXcgZWZzLkZpbGVTeXN0ZW0odGhpcywgJ01vb2RsZUVmcycsIHtcbiAgICAgIHZwYyxcbiAgICAgIGZpbGVTeXN0ZW1OYW1lOiBgJHtlbnZOYW1lfS1tb29kbGUtZWZzYCxcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCB9LCAvLyBFRlMg44Gv5aSW6YOo5YWs6ZaL5LiN6KaBXG4gICAgICBzZWN1cml0eUdyb3VwOiBlZnNTZyxcbiAgICAgIGVuY3J5cHRlZDogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlNOQVBTSE9ULFxuICAgICAgbGlmZWN5Y2xlUG9saWN5OiBlZnMuTGlmZWN5Y2xlUG9saWN5LkFGVEVSXzE0X0RBWVMsXG4gICAgfSk7XG5cbiAgICBjb25zdCBtb29kbGVkYXRhQVAgPSBmaWxlU3lzdGVtLmFkZEFjY2Vzc1BvaW50KCdNb29kbGVkYXRhQVAnLCB7XG4gICAgICBwYXRoOiAnL21vb2RsZWRhdGEnLFxuICAgICAgY3JlYXRlQWNsOiB7IG93bmVyVWlkOiAnMScsIG93bmVyR2lkOiAnMScsIHBlcm1pc3Npb25zOiAnNzU1JyB9LFxuICAgICAgcG9zaXhVc2VyOiB7IHVpZDogJzEnLCBnaWQ6ICcxJyB9LFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIENsb3VkV2F0Y2ggTG9nc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBsb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9lY3MvJHtlbnZOYW1lfS9tb29kbGVgLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEVDUyBDbHVzdGVyICsgRUMyIOOCreODo+ODkeOCt+ODhuOCo1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBjb25zdCBjbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsICdDbHVzdGVyJywge1xuICAgICAgdnBjLFxuICAgICAgY2x1c3Rlck5hbWU6IGAke2Vudk5hbWV9LW1vb2RsZS1jbHVzdGVyYCxcbiAgICAgIGNvbnRhaW5lckluc2lnaHRzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gdDMueGxhcmdlOiA0dkNQVSAvIDE2R0Ig4oaSIOWFqOOCs+ODs+ODhuODiuWQiOioiCB+My44R0IgKyBPUyDkvZnoo5XjgYLjgopcbiAgICAvLyBVQVQ6IE5BVCDkuI3opoHjga7jgZ/jgoEgUHVibGljIOOCteODluODjeODg+ODiOOBq+mFjee9rlxuICAgIGNvbnN0IGFzZyA9IGNsdXN0ZXIuYWRkQ2FwYWNpdHkoJ0VjMkNhcGFjaXR5Jywge1xuICAgICAgaW5zdGFuY2VUeXBlOiBlYzIuSW5zdGFuY2VUeXBlLm9mKGVjMi5JbnN0YW5jZUNsYXNzLlQzLCBlYzIuSW5zdGFuY2VTaXplLlhMQVJHRSksXG4gICAgICBtaW5DYXBhY2l0eTogMSxcbiAgICAgIG1heENhcGFjaXR5OiAyLFxuICAgICAgZGVzaXJlZENhcGFjaXR5OiAxLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMgfSxcbiAgICAgIGtleVBhaXI6IGtleVBhaXJOYW1lXG4gICAgICAgID8gZWMyLktleVBhaXIuZnJvbUtleVBhaXJOYW1lKHRoaXMsICdLZXlQYWlyJywga2V5UGFpck5hbWUpXG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgYmxvY2tEZXZpY2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBkZXZpY2VOYW1lOiAnL2Rldi94dmRhJyxcbiAgICAgICAgICB2b2x1bWU6IGF1dG9zY2FsaW5nLkJsb2NrRGV2aWNlVm9sdW1lLmVicyg1MCwge1xuICAgICAgICAgICAgdm9sdW1lVHlwZTogYXV0b3NjYWxpbmcuRWJzRGV2aWNlVm9sdW1lVHlwZS5HUDMsXG4gICAgICAgICAgICBlbmNyeXB0ZWQ6IHRydWUsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gYWRkQ2FwYWNpdHkg44GvIHNlY3VyaXR5R3JvdXAg44KS55u05o6l5Y+X44GR5LuY44GR44Gq44GE44Gf44KB5b6M5LuY44GR44Gn6L+95YqgXG4gICAgYXNnLmFkZFNlY3VyaXR5R3JvdXAoZWMyU2cpO1xuXG4gICAgLy8gSUFNIOODneODquOCt+ODvOOCkiBhdXRvLWNyZWF0ZWQgcm9sZSDjgavku5jkuI5cbiAgICBhc2cucm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBbWF6b25TU01NYW5hZ2VkSW5zdGFuY2VDb3JlJyksXG4gICAgKTtcbiAgICBhc2cucm9sZS5hZGRNYW5hZ2VkUG9saWN5KFxuICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdDbG91ZFdhdGNoQWdlbnRTZXJ2ZXJQb2xpY3knKSxcbiAgICApO1xuICAgIC8vIEVGUyDjgqLjgq/jgrvjgrnmqKnpmZBcbiAgICBhc2cuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2VsYXN0aWNmaWxlc3lzdGVtOkNsaWVudE1vdW50JyxcbiAgICAgICAgJ2VsYXN0aWNmaWxlc3lzdGVtOkNsaWVudFdyaXRlJyxcbiAgICAgICAgJ2VsYXN0aWNmaWxlc3lzdGVtOkNsaWVudFJvb3RBY2Nlc3MnLFxuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW2ZpbGVTeXN0ZW0uZmlsZVN5c3RlbUFybl0sXG4gICAgfSkpO1xuICAgIC8vIFNlY3JldHMgTWFuYWdlciDoqq3jgb/lj5bjgorvvIhFQzIg44K/44K544Kv44Gn44KC5b+F6KaB77yJXG4gICAgYXNnLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ3NlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlJywgJ2ttczpEZWNyeXB0J10sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgZGJTZWNyZXQuc2VjcmV0QXJuLFxuICAgICAgICBjb2duaXRvU2VjcmV0LnNlY3JldEFybixcbiAgICAgICAgYW50aHJvcGljU2VjcmV0LnNlY3JldEFybixcbiAgICAgIF0sXG4gICAgfSkpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEVDUyBUYXNrIERlZmluaXRpb24gKEVDMiAvIEhPU1Qg44ON44OD44OI44Ov44O844KvKVxuICAgIC8vXG4gICAgLy8gSE9TVCDjg6Ljg7zjg4kgPSDlhajjgrPjg7Pjg4bjg4rjgYwgRUMyIOODm+OCueODiOOBruODjeODg+ODiOODr+ODvOOCr+WFseaciVxuICAgIC8vICAg4oaSIGRvY2tlci1jb21wb3NlIOOBqOWQjOanmOOBqyBsb2NhbGhvc3Qg44Gn55u45LqS6YCa5L+h5Y+v6IO9XG4gICAgLy8gICDihpIgQkZGOiBNT09ETEVfVVJMPWh0dHA6Ly9sb2NhbGhvc3Q6ODA4MCDjgYzjgZ3jga7jgb7jgb7li5XjgY9cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3QgdGFza0RlZiA9IG5ldyBlY3MuRWMyVGFza0RlZmluaXRpb24odGhpcywgJ1Rhc2tEZWYnLCB7XG4gICAgICBmYW1pbHk6IGAke2Vudk5hbWV9LW1vb2RsZS10YXNrYCxcbiAgICAgIG5ldHdvcmtNb2RlOiBlY3MuTmV0d29ya01vZGUuSE9TVCxcbiAgICAgIHZvbHVtZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdtb29kbGVkYXRhJyxcbiAgICAgICAgICBlZnNWb2x1bWVDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICBmaWxlU3lzdGVtSWQ6IGZpbGVTeXN0ZW0uZmlsZVN5c3RlbUlkLFxuICAgICAgICAgICAgdHJhbnNpdEVuY3J5cHRpb246ICdFTkFCTEVEJyxcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25Db25maWc6IHtcbiAgICAgICAgICAgICAgYWNjZXNzUG9pbnRJZDogbW9vZGxlZGF0YUFQLmFjY2Vzc1BvaW50SWQsXG4gICAgICAgICAgICAgIGlhbTogJ0VOQUJMRUQnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIOOCv+OCueOCr+Wun+ihjOODreODvOODq+OBqyBTZWNyZXRzIE1hbmFnZXIg5qip6ZmQXG4gICAgdGFza0RlZi5hZGRUb0V4ZWN1dGlvblJvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZScsICdrbXM6RGVjcnlwdCddLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGRiU2VjcmV0LnNlY3JldEFybixcbiAgICAgICAgY29nbml0b1NlY3JldC5zZWNyZXRBcm4sXG4gICAgICAgIGFudGhyb3BpY1NlY3JldC5zZWNyZXRBcm4sXG4gICAgICBdLFxuICAgIH0pKTtcblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBuZ2lueCAo44Oq44OQ44O844K544OX44Ot44Kt44K3KVxuICAgIC8vIEhPU1Qg44Oi44O844OJ44Gq44Gu44GnIGhvc3RQb3J0IOaMh+WumuS4jeimgVxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBuZ2lueENvbnRhaW5lciA9IHRhc2tEZWYuYWRkQ29udGFpbmVyKCduZ2lueCcsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkobmdpbnhSZXBvLCAnbGF0ZXN0JyksXG4gICAgICBtZW1vcnlMaW1pdE1pQjogMjU2LFxuICAgICAgY3B1OiAyNTYsXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHsgc3RyZWFtUHJlZml4OiAnbmdpbngnLCBsb2dHcm91cCB9KSxcbiAgICAgIHBvcnRNYXBwaW5nczogW3sgY29udGFpbmVyUG9ydDogODAsIHByb3RvY29sOiBlY3MuUHJvdG9jb2wuVENQIH1dLFxuICAgICAgZXNzZW50aWFsOiB0cnVlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQkZGX0hPU1Q6ICdsb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgIEFQSV9IT1NUOiAnbG9jYWxob3N0OjgwMDEnLFxuICAgICAgICBNT09ETEVfSE9TVDogJ2xvY2FsaG9zdDo4MDgwJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gYmZmLXNlcnZlclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBiZmZDb250YWluZXIgPSB0YXNrRGVmLmFkZENvbnRhaW5lcignYmZmLXNlcnZlcicsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkoYmZmUmVwbywgJ2xhdGVzdCcpLFxuICAgICAgbWVtb3J5TGltaXRNaUI6IDUxMixcbiAgICAgIGNwdTogNTEyLFxuICAgICAgbG9nZ2luZzogZWNzLkxvZ0RyaXZlcnMuYXdzTG9ncyh7IHN0cmVhbVByZWZpeDogJ2JmZicsIGxvZ0dyb3VwIH0pLFxuICAgICAgcG9ydE1hcHBpbmdzOiBbeyBjb250YWluZXJQb3J0OiAzMDAxLCBwcm90b2NvbDogZWNzLlByb3RvY29sLlRDUCB9XSxcbiAgICAgIGVzc2VudGlhbDogdHJ1ZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXG4gICAgICAgIE1PT0RMRV9VUkw6ICdodHRwOi8vbG9jYWxob3N0OjgwODAnLFxuICAgICAgICBBUElfU0VSVkVSX1VSTDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODAwMScsXG4gICAgICAgIE1PT0RMRV9TRVJWSUNFX05BTUU6ICdtb29kbGVfbW9iaWxlX2FwcCcsXG4gICAgICB9LFxuICAgICAgc2VjcmV0czoge1xuICAgICAgICBDT0dOSVRPX1VTRVJfUE9PTF9JRDogZWNzLlNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIoY29nbml0b1NlY3JldCwgJ3VzZXJQb29sSWQnKSxcbiAgICAgICAgQ09HTklUT19DTElFTlRfSUQ6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGNvZ25pdG9TZWNyZXQsICdjbGllbnRJZCcpLFxuICAgICAgICBDT0dOSVRPX0NMSUVOVF9TRUNSRVQ6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGNvZ25pdG9TZWNyZXQsICdjbGllbnRTZWNyZXQnKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gYXBpLXNlcnZlclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBhcGlDb250YWluZXIgPSB0YXNrRGVmLmFkZENvbnRhaW5lcignYXBpLXNlcnZlcicsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkoYXBpUmVwbywgJ2xhdGVzdCcpLFxuICAgICAgbWVtb3J5TGltaXRNaUI6IDEwMjQsXG4gICAgICBjcHU6IDEwMjQsXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHsgc3RyZWFtUHJlZml4OiAnYXBpJywgbG9nR3JvdXAgfSksXG4gICAgICBwb3J0TWFwcGluZ3M6IFt7IGNvbnRhaW5lclBvcnQ6IDgwMDEsIHByb3RvY29sOiBlY3MuUHJvdG9jb2wuVENQIH1dLFxuICAgICAgZXNzZW50aWFsOiB0cnVlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgREFUQUJBU0VfSE9TVDogZGF0YWJhc2UuZGJJbnN0YW5jZUVuZHBvaW50QWRkcmVzcyxcbiAgICAgICAgREFUQUJBU0VfUE9SVDogZGF0YWJhc2UuZGJJbnN0YW5jZUVuZHBvaW50UG9ydCxcbiAgICAgICAgREFUQUJBU0VfTkFNRTogJ21vb2RsZScsXG4gICAgICAgIE1PT0RMRV9VUkw6ICdodHRwOi8vbG9jYWxob3N0OjgwODAnLFxuICAgICAgfSxcbiAgICAgIHNlY3JldHM6IHtcbiAgICAgICAgREFUQUJBU0VfVVNFUjogZWNzLlNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIoZGJTZWNyZXQsICd1c2VybmFtZScpLFxuICAgICAgICBEQVRBQkFTRV9QQVNTV09SRDogZWNzLlNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIoZGJTZWNyZXQsICdwYXNzd29yZCcpLFxuICAgICAgICBBTlRIUk9QSUNfQVBJX0tFWTogZWNzLlNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIoYW50aHJvcGljU2VjcmV0KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gbW9vZGxlLWFwcFxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICBjb25zdCBtb29kbGVDb250YWluZXIgPSB0YXNrRGVmLmFkZENvbnRhaW5lcignbW9vZGxlLWFwcCcsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkobW9vZGxlUmVwbywgJ2xhdGVzdCcpLFxuICAgICAgbWVtb3J5TGltaXRNaUI6IDIwNDgsXG4gICAgICBjcHU6IDIwNDgsXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHsgc3RyZWFtUHJlZml4OiAnbW9vZGxlJywgbG9nR3JvdXAgfSksXG4gICAgICBwb3J0TWFwcGluZ3M6IFt7IGNvbnRhaW5lclBvcnQ6IDgwODAsIHByb3RvY29sOiBlY3MuUHJvdG9jb2wuVENQIH1dLFxuICAgICAgZXNzZW50aWFsOiB0cnVlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTU9PRExFX0RBVEFCQVNFX0hPU1Q6IGRhdGFiYXNlLmRiSW5zdGFuY2VFbmRwb2ludEFkZHJlc3MsXG4gICAgICAgIE1PT0RMRV9EQVRBQkFTRV9OQU1FOiAnbW9vZGxlJyxcbiAgICAgICAgTU9PRExFX0RBVEFCQVNFX1RZUEU6ICdteXNxbGknLFxuICAgICAgICBNT09ETEVfREFUQVJPT1Q6ICcvbW9vZGxlZGF0YScsXG4gICAgICAgIC8vIEFMQiBETlMg56K65a6a5b6M44GrIC0tY29udGV4dCBtb29kbGVTaXRlVXJsPWh0dHA6Ly8uLi4g44Gn5YaN44OH44OX44Ot44KkXG4gICAgICAgIE1PT0RMRV9TSVRFX1VSTDogbW9vZGxlU2l0ZVVybCA/PyAnUkVQTEFDRV9NRScsXG4gICAgICAgIE1PT0RMRV9TRVNTSU9OX0hBTkRMRVI6ICdkYXRhYmFzZScsXG4gICAgICB9LFxuICAgICAgc2VjcmV0czoge1xuICAgICAgICBNT09ETEVfREFUQUJBU0VfVVNFUjogZWNzLlNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIoZGJTZWNyZXQsICd1c2VybmFtZScpLFxuICAgICAgICBNT09ETEVfREFUQUJBU0VfUEFTU1dPUkQ6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGRiU2VjcmV0LCAncGFzc3dvcmQnKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBtb29kbGVDb250YWluZXIuYWRkTW91bnRQb2ludHMoe1xuICAgICAgc291cmNlVm9sdW1lOiAnbW9vZGxlZGF0YScsXG4gICAgICBjb250YWluZXJQYXRoOiAnL21vb2RsZWRhdGEnLFxuICAgICAgcmVhZE9ubHk6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgbmdpbnhDb250YWluZXIuYWRkQ29udGFpbmVyRGVwZW5kZW5jaWVzKFxuICAgICAgeyBjb250YWluZXI6IGJmZkNvbnRhaW5lciwgY29uZGl0aW9uOiBlY3MuQ29udGFpbmVyRGVwZW5kZW5jeUNvbmRpdGlvbi5TVEFSVCB9LFxuICAgICAgeyBjb250YWluZXI6IGFwaUNvbnRhaW5lciwgY29uZGl0aW9uOiBlY3MuQ29udGFpbmVyRGVwZW5kZW5jeUNvbmRpdGlvbi5TVEFSVCB9LFxuICAgICAgeyBjb250YWluZXI6IG1vb2RsZUNvbnRhaW5lciwgY29uZGl0aW9uOiBlY3MuQ29udGFpbmVyRGVwZW5kZW5jeUNvbmRpdGlvbi5TVEFSVCB9LFxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gRUNTIFNlcnZpY2UgKEVDMilcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgY29uc3Qgc2VydmljZSA9IG5ldyBlY3MuRWMyU2VydmljZSh0aGlzLCAnU2VydmljZScsIHtcbiAgICAgIGNsdXN0ZXIsXG4gICAgICB0YXNrRGVmaW5pdGlvbjogdGFza0RlZixcbiAgICAgIHNlcnZpY2VOYW1lOiBgJHtlbnZOYW1lfS1tb29kbGUtc2VydmljZWAsXG4gICAgICBkZXNpcmVkQ291bnQsXG4gICAgICBtaW5IZWFsdGh5UGVyY2VudDogMCxcbiAgICAgIG1heEhlYWx0aHlQZXJjZW50OiAxMDAsIC8vIEVDMiAx5Y+w44Gu44Go44GNIDIwMCDjgavjgZnjgovjgajjgr/jgrnjgq/jgYwy44Gk6LW35YuV44GX44Gm44Od44O844OI6KGd56qB44GZ44KLXG4gICAgICBoZWFsdGhDaGVja0dyYWNlUGVyaW9kOiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMjApLFxuICAgICAgZW5hYmxlRXhlY3V0ZUNvbW1hbmQ6IHRydWUsIC8vIEVDUyBFeGVjIOOBp+OCs+ODs+ODhuODiuOBq+WFpeOCjOOCi1xuICAgICAgY2lyY3VpdEJyZWFrZXI6IHsgcm9sbGJhY2s6IHRydWUgfSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGFsYiA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcih0aGlzLCAnQWxiJywge1xuICAgICAgdnBjLFxuICAgICAgaW50ZXJuZXRGYWNpbmc6IHRydWUsXG4gICAgICBzZWN1cml0eUdyb3VwOiBhbGJTZyxcbiAgICAgIGxvYWRCYWxhbmNlck5hbWU6IGAke2Vudk5hbWV9LW1vb2RsZS1hbGJgLFxuICAgIH0pO1xuXG4gICAgY29uc3QgbGlzdGVuZXIgPSBhbGIuYWRkTGlzdGVuZXIoJ0h0dHBMaXN0ZW5lcicsIHsgcG9ydDogODAsIG9wZW46IHRydWUgfSk7XG5cbiAgICBsaXN0ZW5lci5hZGRUYXJnZXRzKCdFY3NUYXJnZXRzJywge1xuICAgICAgcG9ydDogODAsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgdGFyZ2V0czogW3NlcnZpY2VdLFxuICAgICAgdGFyZ2V0R3JvdXBOYW1lOiBgJHtlbnZOYW1lfS1tb29kbGUtdGdgLFxuICAgICAgaGVhbHRoQ2hlY2s6IHtcbiAgICAgICAgcGF0aDogJy9oZWFsdGgnLFxuICAgICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICAgIGhlYWx0aHlUaHJlc2hvbGRDb3VudDogMixcbiAgICAgICAgdW5oZWFsdGh5VGhyZXNob2xkQ291bnQ6IDMsXG4gICAgICB9LFxuICAgICAgZGVyZWdpc3RyYXRpb25EZWxheTogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIE91dHB1dHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FsYkRuc05hbWUnLCB7XG4gICAgICB2YWx1ZTogYWxiLmxvYWRCYWxhbmNlckRuc05hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FMQiBETlMg4oCUIG1vb2RsZVNpdGVVcmwg44GoIFJFQUNUX0FQUF9BUElfVVJMIOOBq+ioreWumuOBmeOCiycsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZOYW1lfS1BbGJEbnNOYW1lYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbHVzdGVyTmFtZScsIHtcbiAgICAgIHZhbHVlOiBjbHVzdGVyLmNsdXN0ZXJOYW1lLFxuICAgICAgZXhwb3J0TmFtZTogYCR7ZW52TmFtZX0tQ2x1c3Rlck5hbWVgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RiRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogZGF0YWJhc2UuZGJJbnN0YW5jZUVuZHBvaW50QWRkcmVzcyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudk5hbWV9LURiRW5kcG9pbnRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RiU2VjcmV0QXJuJywge1xuICAgICAgdmFsdWU6IGRiU2VjcmV0LnNlY3JldEFybixcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudk5hbWV9LURiU2VjcmV0QXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb2duaXRvU2VjcmV0QXJuJywge1xuICAgICAgdmFsdWU6IGNvZ25pdG9TZWNyZXQuc2VjcmV0QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICfjg4fjg5fjg63jgqTlvozjgavmiYvli5Xmm7TmlrA6IGF3cyBzZWNyZXRzbWFuYWdlciBwdXQtc2VjcmV0LXZhbHVlIC4uLicsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZOYW1lfS1Db2duaXRvU2VjcmV0QXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdFZnNJZCcsIHtcbiAgICAgIHZhbHVlOiBmaWxlU3lzdGVtLmZpbGVTeXN0ZW1JZCxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudk5hbWV9LUVmc0lkYCxcbiAgICB9KTtcbiAgfVxufVxuIl19