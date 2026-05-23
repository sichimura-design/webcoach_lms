#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { SpaFrontendStack } from '../lib/spa-frontend-stack';

const app = new App();

new SpaFrontendStack(app, 'moodle-spa-frontend', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: 'ap-northeast-1',
    },
    tags: {
        Project: 'moodle-spa',
        ManagedBy: 'cdk',
    },
});

app.synth();
