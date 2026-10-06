import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ses from 'aws-cdk-lib/aws-ses';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ProdCognitoStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly moodleDomain: string;
  /**
   * SES で使用する送信元メールアドレス (例: noreply@webcoach.jp)
   * 指定しない場合は Cognito デフォルトメール (50通/日上限) を使用する
   */
  readonly sesFromEmail?: string;
  /**
   * SES の送信元ドメイン (例: webcoach.jp)
   * sesFromEmail と合わせて指定するとドメイン検証済みアドレスとして扱われる
   */
  readonly sesFromDomain?: string;
  /**
   * true の場合、CDK が ses.EmailIdentity リソースを作成・管理する。
   * webcoach.jp は AWS CLI で手動作成・検証済みのため、デフォルト false のまま
   * (CDK に取り込むと将来のスタック変更で誤って本番の検証済みIDが削除されるリスクがある)。
   */
  readonly manageSesIdentity?: boolean;
  /**
   * アカウント発行メール内に表示するSPAログインURL(例: https://study.webcoach.jp/login)
   */
  readonly loginUrl: string;
  /**
   * アカウント発行・パスワード再設定メール内のお問い合わせ先URL(Channel Talk)
   */
  readonly contactUrl: string;
}

export class ProdCognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly spaClient: cognito.UserPoolClient;
  public readonly moodleClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: ProdCognitoStackProps) {
    super(scope, id, props);

    const { envName, moodleDomain, sesFromEmail, sesFromDomain, manageSesIdentity, loginUrl, contactUrl } = props;

    // ========================================
    // SES メールアドレス検証
    // manageSesIdentity=true の場合のみ CDK でリソースを作成する。
    // webcoach.jp は手動検証済みのため、通常はここをスキップして既存IDをそのまま使う。
    // ========================================
    if (sesFromEmail && manageSesIdentity) {
      new ses.EmailIdentity(this, 'SesEmailIdentity', {
        identity: sesFromDomain
          ? ses.Identity.domain(sesFromDomain)
          : ses.Identity.email(sesFromEmail),
      });
    }

    // ========================================
    // Custom Message Lambda (invite / forgot-password email copy)
    // ========================================
    // Cognito's built-in email templates only support {username}/{####} placeholders
    // (and username here is an opaque UUID, not human-readable), so the invite/reset
    // copy is built here instead where the full user attributes are available.
    const customMessageFunction = new lambda.Function(this, 'CustomMessageFunction', {
      functionName: `${envName}-cognito-custom-message`,
      description: 'Builds WEBCOACH account-invite / password-reset email copy for Cognito',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/cognito-custom-message')),
      timeout: cdk.Duration.seconds(10),
      environment: {
        LOGIN_URL: loginUrl,
        CONTACT_URL: contactUrl,
      },
    });

    // ========================================
    // Cognito User Pool
    // ========================================
    const emailConfig = sesFromEmail
      ? cognito.UserPoolEmail.withSES({
          sesRegion: this.region,
          fromEmail: sesFromEmail,
          fromName: 'WEBCOACHカスタマーサポート',
          // ドメイン指定時は SES でドメイン検証済みとして扱う
          ...(sesFromDomain ? { sesVerifiedDomain: sesFromDomain } : {}),
        })
      // SES 未設定時は Cognito デフォルト (50通/日)
      // 本番では必ず sesFromEmail を context で指定すること
      : cognito.UserPoolEmail.withCognito();

    this.userPool = new cognito.UserPool(this, 'MoodleUserPool', {
      userPoolName: `${envName}-lms-user-pool`,
      signInAliases: { email: true, username: true },
      signInCaseSensitive: false,
      // 管理者がユーザーを作成する運用のため自己サインアップは無効
      selfSignUpEnabled: false,
      autoVerify: { email: true },
      userVerification: {
        emailSubject: '[WEBCOACH] メールアドレスの確認',
        emailBody: '確認コードは {####} です。',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      // 招待メール・パスワード再設定メールの文面は CustomMessage Lambda で上書きする
      lambdaTriggers: {
        customMessage: customMessageFunction,
      },
      email: emailConfig,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: { domainPrefix: `${envName}-lms-webcoach` },
    });

    this.spaClient = this.userPool.addClient('SpaClient', {
      userPoolClientName: `${envName}-lms-spa-client`,
      generateSecret: false,
      authFlows: { userSrp: true, userPassword: true },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, emailVerified: true, fullname: true }),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, fullname: true }),
    });

    const moodleCallbackUrls = [`https://${moodleDomain}/admin/oauth2callback.php`];
    const moodleLogoutUrls = [
      `https://${moodleDomain}`,
      `https://${moodleDomain}/login/logout.php`,
    ];

    this.moodleClient = this.userPool.addClient('MoodleClient', {
      userPoolClientName: `${envName}-lms-oauth-client`,
      generateSecret: true,
      authFlows: { userSrp: true, userPassword: true },
      oAuth: {
        flows: { authorizationCodeGrant: true, implicitCodeGrant: false },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: moodleCallbackUrls,
        logoutUrls: moodleLogoutUrls,
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, emailVerified: true, fullname: true }),
    });

    // ========================================
    // Outputs
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

    if (sesFromEmail) {
      new cdk.CfnOutput(this, 'SesFromEmail', {
        value: sesFromEmail,
        description: 'SES 送信元アドレス — デプロイ後に検証が必要',
      });
    }
  }
}
