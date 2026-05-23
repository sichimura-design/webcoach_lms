import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
export interface UatVpcStackProps extends cdk.StackProps {
    readonly envName: string;
}
export declare class UatVpcStack extends cdk.Stack {
    readonly vpc: ec2.Vpc;
    constructor(scope: Construct, id: string, props: UatVpcStackProps);
}
