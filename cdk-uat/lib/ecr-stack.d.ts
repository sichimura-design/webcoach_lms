import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
export interface UatEcrStackProps extends cdk.StackProps {
    readonly envName: string;
}
export declare class UatEcrStack extends cdk.Stack {
    readonly nginxRepo: ecr.Repository;
    readonly bffRepo: ecr.Repository;
    readonly apiRepo: ecr.Repository;
    readonly moodleRepo: ecr.Repository;
    constructor(scope: Construct, id: string, props: UatEcrStackProps);
}
