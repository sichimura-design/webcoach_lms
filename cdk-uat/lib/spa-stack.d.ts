import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface UatSpaStackProps extends cdk.StackProps {
    readonly envName: string;
}
export declare class UatSpaStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: UatSpaStackProps);
}
