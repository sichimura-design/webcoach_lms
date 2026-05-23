import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
export interface UatRdsStackProps extends cdk.StackProps {
    readonly envName: string;
    /** 使い回す既存 VPC の ID (例: vpc-078369fe5efc5e688) */
    readonly vpcId: string;
}
export declare class UatRdsStack extends cdk.Stack {
    readonly database: rds.DatabaseInstance;
    readonly dbSecret: secretsmanager.Secret;
    readonly rdsSg: ec2.SecurityGroup;
    constructor(scope: Construct, id: string, props: UatRdsStackProps);
}
