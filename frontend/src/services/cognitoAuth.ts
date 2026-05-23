import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const COGNITO_USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID;
const COGNITO_CLIENT_ID = process.env.REACT_APP_COGNITO_CLIENT_ID;

if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID) {
  throw new Error('REACT_APP_COGNITO_USER_POOL_ID and REACT_APP_COGNITO_CLIENT_ID must be set');
}

const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_USER_POOL_ID,
  ClientId: COGNITO_CLIENT_ID,
});

export interface CognitoAuthResult {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  email: string;
  sub: string;
  username: string;
  groups: string[];
}

export interface NewPasswordRequiredResult {
  type: 'NEW_PASSWORD_REQUIRED';
  cognitoUser: CognitoUser;
  userAttributes: Record<string, string>;
}

export type SignInResult = CognitoAuthResult | NewPasswordRequiredResult;

function extractAuthResult(session: CognitoUserSession, username: string): CognitoAuthResult {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload();

  return {
    idToken: idToken.getJwtToken(),
    accessToken: session.getAccessToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
    email: payload.email || '',
    sub: payload.sub || '',
    username,
    groups: payload['cognito:groups'] || [],
  };
}

export function signIn(username: string, password: string): Promise<SignInResult> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (session) => {
        resolve(extractAuthResult(session, username));
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: (userAttributes) => {
        // Cognito returns attributes that need to be set
        // Remove non-writable attributes (passing these causes NotAuthorizedException)
        delete userAttributes.email_verified;
        delete userAttributes.phone_number_verified;
        delete userAttributes.email;

        resolve({
          type: 'NEW_PASSWORD_REQUIRED',
          cognitoUser,
          userAttributes,
        });
      },
    });
  });
}

export function completeNewPassword(
  cognitoUser: CognitoUser,
  newPassword: string,
  requiredAttributes: Record<string, string> = {}
): Promise<CognitoAuthResult> {
  return new Promise((resolve, reject) => {
    cognitoUser.completeNewPasswordChallenge(newPassword, requiredAttributes, {
      onSuccess: (session) => {
        resolve(extractAuthResult(session, cognitoUser.getUsername()));
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

export function signOut(): void {
  const currentUser = userPool.getCurrentUser();
  if (currentUser) {
    currentUser.signOut();
  }
}

export function getCurrentSession(): Promise<CognitoAuthResult | null> {
  return new Promise((resolve) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      resolve(null);
      return;
    }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(extractAuthResult(session, currentUser.getUsername()));
    });
  });
}

export function getIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      resolve(null);
      return;
    }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) {
        resolve(null);
        return;
      }
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

export function forgotPassword(username: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.forgotPassword({
      onSuccess: () => {
        resolve();
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

export function confirmForgotPassword(
  username: string,
  code: string,
  newPassword: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.confirmPassword(code, newPassword, {
      onSuccess: () => {
        resolve();
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

export function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      reject(new Error('ログインが必要です'));
      return;
    }

    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }
      currentUser.changePassword(oldPassword, newPassword, (changeErr) => {
        if (changeErr) {
          reject(changeErr);
        } else {
          resolve();
        }
      });
    });
  });
}

export function updateEmail(newEmail: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      reject(new Error('ログインが必要です'));
      return;
    }

    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }
      const { CognitoUserAttribute } = require('amazon-cognito-identity-js');
      const attributes = [new CognitoUserAttribute({ Name: 'email', Value: newEmail })];
      currentUser.updateAttributes(attributes, (updateErr) => {
        if (updateErr) {
          reject(updateErr);
        } else {
          resolve();
        }
      });
    });
  });
}

export function verifyEmailChange(code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      reject(new Error('ログインが必要です'));
      return;
    }

    currentUser.getSession((err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }
      currentUser.verifyAttribute('email', code, {
        onSuccess: () => resolve(),
        onFailure: (verifyErr) => reject(verifyErr),
      });
    });
  });
}
