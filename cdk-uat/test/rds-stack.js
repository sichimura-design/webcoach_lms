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
exports.UatRdsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
class UatRdsStack extends cdk.Stack {
    database;
    dbSecret;
    rdsSg;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { envName, vpcId } = props;
        // 既存 VPC を参照
        const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId });
        // ========================================
        // Security Group
        // ========================================
        this.rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
            vpc,
            securityGroupName: `${envName}-moodle-rds-sg`,
            description: 'RDS MySQL security group',
            allowAllOutbound: false,
        });
        // VPC 内からの MySQL アクセスを許可（ECS EC2 等）
        this.rdsSg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(3306), 'MySQL from VPC');
        // ========================================
        // Secrets Manager
        // ========================================
        this.dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
            secretName: `${envName}/moodle/db-credentials`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'moodleuser' }),
                generateStringKey: 'password',
                excludePunctuation: true,
                includeSpace: false,
            },
        });
        // ========================================
        // RDS MySQL
        // ========================================
        this.database = new rds.DatabaseInstance(this, 'Database', {
            engine: rds.DatabaseInstanceEngine.mysql({
                version: rds.MysqlEngineVersion.VER_8_0,
            }),
            instanceIdentifier: `${envName}-moodle-db`,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
            vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            securityGroups: [this.rdsSg],
            databaseName: 'moodle',
            credentials: rds.Credentials.fromSecret(this.dbSecret),
            allocatedStorage: 20,
            maxAllocatedStorage: 100,
            storageEncrypted: true,
            multiAz: false,
            backupRetention: cdk.Duration.days(3),
            deletionProtection: false,
            removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
            parameterGroup: new rds.ParameterGroup(this, 'MoodleParamGroup', {
                engine: rds.DatabaseInstanceEngine.mysql({
                    version: rds.MysqlEngineVersion.VER_8_0,
                }),
                parameters: {
                    character_set_server: 'utf8mb4',
                    collation_server: 'utf8mb4_unicode_ci',
                    max_connections: '200',
                },
            }),
        });
        // ========================================
        // Outputs
        // ========================================
        new cdk.CfnOutput(this, 'DbEndpoint', {
            value: this.database.dbInstanceEndpointAddress,
            description: 'RDS MySQL endpoint',
            exportName: `${envName}-DbEndpoint`,
        });
        new cdk.CfnOutput(this, 'DbPort', {
            value: this.database.dbInstanceEndpointPort,
            description: 'RDS MySQL port',
            exportName: `${envName}-DbPort`,
        });
        new cdk.CfnOutput(this, 'DbSecretArn', {
            value: this.dbSecret.secretArn,
            description: 'Secrets Manager ARN for DB credentials',
            exportName: `${envName}-DbSecretArn`,
        });
        new cdk.CfnOutput(this, 'RdsSgId', {
            value: this.rdsSg.securityGroupId,
            description: 'RDS security group ID',
            exportName: `${envName}-RdsSgId`,
        });
    }
}
exports.UatRdsStack = UatRdsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmRzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmRzLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLCtFQUFpRTtBQVNqRSxNQUFhLFdBQVksU0FBUSxHQUFHLENBQUMsS0FBSztJQUN4QixRQUFRLENBQXVCO0lBQy9CLFFBQVEsQ0FBd0I7SUFDaEMsS0FBSyxDQUFvQjtJQUV6QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRWpDLGFBQWE7UUFDYixNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUV2RCwyQ0FBMkM7UUFDM0MsaUJBQWlCO1FBQ2pCLDJDQUEyQztRQUMzQyxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQ2hELEdBQUc7WUFDSCxpQkFBaUIsRUFBRSxHQUFHLE9BQU8sZ0JBQWdCO1lBQzdDLFdBQVcsRUFBRSwwQkFBMEI7WUFDdkMsZ0JBQWdCLEVBQUUsS0FBSztTQUN4QixDQUFDLENBQUM7UUFDSCxvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQ3ZCLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsRUFDL0IsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQ2xCLGdCQUFnQixDQUNq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LElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUztZQUM5QixXQUFXLEVBQUUsd0NBQXdDO1lBQ3JELFVBQVUsRUFBRSxHQUFHLE9BQU8sY0FBYztTQUNyQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUNqQyxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlO1lBQ2pDLFdBQVcsRUFBRSx1QkFBdUI7WUFDcEMsVUFBVSxFQUFFLEdBQUcsT0FBTyxVQUFVO1NBQ2pDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXRHRCxrQ0FzR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFVhdFJkc1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHJlYWRvbmx5IGVudk5hbWU6IHN0cmluZztcbiAgLyoqIOS9v+OBhOWbnuOBmeaXouWtmCBWUEMg44GuIElEICjkvos6IHZwYy0wNzgzNjlmZTVlZmM1ZTY4OCkgKi9cbiAgcmVhZG9ubHkgdnBjSWQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFVhdFJkc1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRhdGFiYXNlOiByZHMuRGF0YWJhc2VJbnN0YW5jZTtcbiAgcHVibGljIHJlYWRvbmx5IGRiU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5TZWNyZXQ7XG4gIHB1YmxpYyByZWFkb25seSByZHNTZzogZWMyLlNlY3VyaXR5R3JvdXA7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFVhdFJkc1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgZW52TmFtZSwgdnBjSWQgfSA9IHByb3BzO1xuXG4gICAgLy8g5pei5a2YIFZQQyDjgpLlj4LnhadcbiAgICBjb25zdCB2cGMgPSBlYzIuVnBjLmZyb21Mb29rdXAodGhpcywgJ1ZwYycsIHsgdnBjSWQgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU2VjdXJpdHkgR3JvdXBcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5yZHNTZyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnUmRzU2cnLCB7XG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwTmFtZTogYCR7ZW52TmFtZX0tbW9vZGxlLXJkcy1zZ2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JEUyBNeVNRTCBzZWN1cml0eSBncm91cCcsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZSxcbiAgICB9KTtcbiAgICAvLyBWUEMg5YaF44GL44KJ44GuIE15U1FMIOOCouOCr+OCu+OCueOCkuioseWPr++8iEVDUyBFQzIg562J77yJXG4gICAgdGhpcy5yZHNTZy5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLmlwdjQodnBjLnZwY0NpZHJCbG9jayksXG4gICAgICBlYzIuUG9ydC50Y3AoMzMwNiksXG4gICAgICAnTXlTUUwgZnJvbSBWUEMnLFxuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU2VjcmV0cyBNYW5hZ2VyXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuZGJTZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdEYlNlY3JldCcsIHtcbiAgICAgIHNlY3JldE5hbWU6IGAke2Vudk5hbWV9L21vb2RsZS9kYi1jcmVkZW50aWFsc2AsXG4gICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xuICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogJ21vb2RsZXVzZXInIH0pLFxuICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogJ3Bhc3N3b3JkJyxcbiAgICAgICAgZXhjbHVkZVB1bmN0dWF0aW9uOiB0cnVlLFxuICAgICAgICBpbmNsdWRlU3BhY2U6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBSRFMgTXlTUUxcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5kYXRhYmFzZSA9IG5ldyByZHMuRGF0YWJhc2VJbnN0YW5jZSh0aGlzLCAnRGF0YWJhc2UnLCB7XG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUluc3RhbmNlRW5naW5lLm15c3FsKHtcbiAgICAgICAgdmVyc2lvbjogcmRzLk15c3FsRW5naW5lVmVyc2lvbi5WRVJfOF8wLFxuICAgICAgfSksXG4gICAgICBpbnN0YW5jZUlkZW50aWZpZXI6IGAke2Vudk5hbWV9LW1vb2RsZS1kYmAsXG4gICAgICBpbnN0YW5jZVR5cGU6IGVjMi5JbnN0YW5jZVR5cGUub2YoZWMyLkluc3RhbmNlQ2xhc3MuVDMsIGVjMi5JbnN0YW5jZVNpemUuU01BTEwpLFxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVEIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW3RoaXMucmRzU2ddLFxuICAgICAgZGF0YWJhc2VOYW1lOiAnbW9vZGxlJyxcbiAgICAgIGNyZWRlbnRpYWxzOiByZHMuQ3JlZGVudGlhbHMuZnJvbVNlY3JldCh0aGlzLmRiU2VjcmV0KSxcbiAgICAgIGFsbG9jYXRlZFN0b3JhZ2U6IDIwLFxuICAgICAgbWF4QWxsb2NhdGVkU3RvcmFnZTogMTAwLFxuICAgICAgc3RvcmFnZUVuY3J5cHRlZDogdHJ1ZSxcbiAgICAgIG11bHRpQXo6IGZhbHNlLFxuICAgICAgYmFja3VwUmV0ZW50aW9uOiBjZGsuRHVyYXRpb24uZGF5cygzKSxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZmFsc2UsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5TTkFQU0hPVCxcbiAgICAgIHBhcmFtZXRlckdyb3VwOiBuZXcgcmRzLlBhcmFtZXRlckdyb3VwKHRoaXMsICdNb29kbGVQYXJhbUdyb3VwJywge1xuICAgICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUluc3RhbmNlRW5naW5lLm15c3FsKHtcbiAgICAgICAgICB2ZXJzaW9uOiByZHMuTXlzcWxFbmdpbmVWZXJzaW9uLlZFUl84XzAsXG4gICAgICAgIH0pLFxuICAgICAgICBwYXJhbWV0ZXJzOiB7XG4gICAgICAgICAgY2hhcmFjdGVyX3NldF9zZXJ2ZXI6ICd1dGY4bWI0JyxcbiAgICAgICAgICBjb2xsYXRpb25fc2VydmVyOiAndXRmOG1iNF91bmljb2RlX2NpJyxcbiAgICAgICAgICBtYXhfY29ubmVjdGlvbnM6ICcyMDAnLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gT3V0cHV0c1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGJFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRhdGFiYXNlLmRiSW5zdGFuY2VFbmRwb2ludEFkZHJlc3MsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JEUyBNeVNRTCBlbmRwb2ludCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZOYW1lfS1EYkVuZHBvaW50YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYlBvcnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kYXRhYmFzZS5kYkluc3RhbmNlRW5kcG9pbnRQb3J0LFxuICAgICAgZGVzY3JpcHRpb246ICdSRFMgTXlTUUwgcG9ydCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZOYW1lfS1EYlBvcnRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RiU2VjcmV0QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGJTZWNyZXQuc2VjcmV0QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWNyZXRzIE1hbmFnZXIgQVJOIGZvciBEQiBjcmVkZW50aWFscycsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZOYW1lfS1EYlNlY3JldEFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUmRzU2dJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJkc1NnLnNlY3VyaXR5R3JvdXBJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkRTIHNlY3VyaXR5IGdyb3VwIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudk5hbWV9LVJkc1NnSWRgLFxuICAgIH0pO1xuICB9XG59XG4iXX0=