import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface CognitoStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly moodleDomain: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly spaClient: cognito.UserPoolClient;
  public readonly moodleClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const { envName, moodleDomain } = props;

    // ========================================
    // User Pool
    // ========================================
    this.userPool = new cognito.UserPool(this, 'MoodleUserPool', {
      userPoolName: `${envName}-moodle-user-pool`,

      // Sign-in: email + username
      signInAliases: {
        email: true,
        username: true,
      },
      signInCaseSensitive: false,

      // Admin creates users (no self sign-up)
      selfSignUpEnabled: false,

      // Email verification
      autoVerify: { email: true },
      userVerification: {
        emailSubject: `[${envName.toUpperCase()}] WEBCOACH - メールアドレスの確認`,
        emailBody: '確認コードは {####} です。',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },

      // Account recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // Password policy
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: envName === 'prod',
        tempPasswordValidity: cdk.Duration.days(7),
      },

      // MFA (optional TOTP)
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },

      // Standard attributes
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },

      removalPolicy: envName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // User Pool Domain (for OAuth2 endpoints)
    // ========================================
    this.userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `${envName}-moodle-webcoach`,
      },
    });

    // ========================================
    // SPA Client (public, no secret)
    // ========================================
    this.spaClient = this.userPool.addClient('SpaClient', {
      userPoolClientName: `${envName}-moodle-spa-client`,
      generateSecret: false,

      authFlows: {
        userSrp: true,
        userPassword: true,
      },

      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      preventUserExistenceErrors: true,

      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          emailVerified: true,
          fullname: true,
        }),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          fullname: true,
        }),
    });

    // ========================================
    // Moodle Client (confidential, with secret)
    // ========================================
    const moodleCallbackUrls = [
      `https://${moodleDomain}/admin/oauth2callback.php`,
    ];
    const moodleLogoutUrls = [
      `https://${moodleDomain}`,
      `https://${moodleDomain}/login/logout.php`,
    ];
    // Note: Cognito requires HTTPS for callback URLs (except localhost)

    this.moodleClient = this.userPool.addClient('MoodleClient', {
      userPoolClientName: `${envName}-moodle-oauth-client`,
      generateSecret: true,

      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: moodleCallbackUrls,
        logoutUrls: moodleLogoutUrls,
      },

      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],

      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      preventUserExistenceErrors: true,

      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          emailVerified: true,
          fullname: true,
        }),
    });

    // ========================================
    // CloudFormation Outputs
    // ========================================
    const issuerUrl = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`;
    const domainUrl = this.userPoolDomain.baseUrl();

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `${envName}-CognitoUserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      exportName: `${envName}-CognitoUserPoolArn`,
    });

    new cdk.CfnOutput(this, 'SpaClientId', {
      value: this.spaClient.userPoolClientId,
      exportName: `${envName}-CognitoSpaClientId`,
    });

    new cdk.CfnOutput(this, 'MoodleClientId', {
      value: this.moodleClient.userPoolClientId,
      exportName: `${envName}-CognitoMoodleClientId`,
    });

    new cdk.CfnOutput(this, 'UserPoolDomainUrl', {
      value: domainUrl,
      exportName: `${envName}-CognitoUserPoolDomainUrl`,
    });

    new cdk.CfnOutput(this, 'IssuerUrl', {
      value: issuerUrl,
      exportName: `${envName}-CognitoIssuerUrl`,
    });

    new cdk.CfnOutput(this, 'AuthorizationEndpoint', {
      value: `${domainUrl}/oauth2/authorize`,
      exportName: `${envName}-CognitoAuthorizationEndpoint`,
    });

    new cdk.CfnOutput(this, 'TokenEndpoint', {
      value: `${domainUrl}/oauth2/token`,
      exportName: `${envName}-CognitoTokenEndpoint`,
    });

    new cdk.CfnOutput(this, 'UserInfoEndpoint', {
      value: `${domainUrl}/oauth2/userInfo`,
      exportName: `${envName}-CognitoUserInfoEndpoint`,
    });

    new cdk.CfnOutput(this, 'JwksUri', {
      value: `${issuerUrl}/.well-known/jwks.json`,
      exportName: `${envName}-CognitoJwksUri`,
    });
  }
}
