/**
 * Error Handler Utility
 * Converts internal errors to user-friendly messages
 */

/**
 * Convert AWS Cognito error to user-friendly message
 * Removes sensitive AWS configuration info while keeping helpful error details
 */
function sanitizeCognitoError(error) {
  // Extract AWS error code if available
  const awsErrorCode = error.name || error.code || '';
  const errorMessage = error.message || '';

  // Handle specific AWS error types
  if (errorMessage.includes('not authorized to perform')) {
    // Extract the action name from the error message
    const actionMatch = errorMessage.match(/cognito-idp:(\w+)/);
    const action = actionMatch ? actionMatch[1] : 'この操作';

    return {
      message: `権限エラー: ${action}を実行する権限がありません。システム管理者にお問い合わせください。`,
      errorCode: awsErrorCode,
      errorType: 'PERMISSION_DENIED'
    };
  }

  if (errorMessage.includes('User does not exist') || awsErrorCode === 'UserNotFoundException') {
    return {
      message: 'ユーザーが見つかりません。',
      errorCode: awsErrorCode,
      errorType: 'USER_NOT_FOUND'
    };
  }

  if (errorMessage.includes('already exists') || awsErrorCode === 'UsernameExistsException') {
    return {
      message: 'このユーザーは既に存在します。',
      errorCode: awsErrorCode,
      errorType: 'USER_ALREADY_EXISTS'
    };
  }

  if (errorMessage.includes('ResourceNotFoundException') || awsErrorCode === 'ResourceNotFoundException') {
    return {
      message: 'Cognitoユーザープールの設定が見つかりません。システム管理者にお問い合わせください。',
      errorCode: awsErrorCode,
      errorType: 'RESOURCE_NOT_FOUND',
      hint: 'User Pool IDの設定を確認してください'
    };
  }

  if (errorMessage.includes('InvalidParameterException') || awsErrorCode === 'InvalidParameterException') {
    // Remove AWS resource identifiers from the message
    const cleanMessage = errorMessage
      .replace(/arn:aws:[^:]+:[^:]+:[^:]+:[^\s]+/g, '[AWS Resource]')
      .replace(/UserPoolId: [^\s,]+/g, 'UserPoolId: [REDACTED]');

    return {
      message: `無効なパラメータが指定されました: ${cleanMessage}`,
      errorCode: awsErrorCode,
      errorType: 'INVALID_PARAMETER'
    };
  }

  if (errorMessage.includes('LimitExceededException') || awsErrorCode === 'LimitExceededException') {
    return {
      message: 'Cognitoのリクエスト数上限に達しました。しばらくしてから再度お試しください。',
      errorCode: awsErrorCode,
      errorType: 'RATE_LIMIT_EXCEEDED',
      hint: '1時間後に再試行してください'
    };
  }

  if (errorMessage.includes('TooManyRequestsException') || awsErrorCode === 'TooManyRequestsException') {
    return {
      message: 'リクエストが多すぎます。しばらくしてから再度お試しください。',
      errorCode: awsErrorCode,
      errorType: 'TOO_MANY_REQUESTS',
      hint: '数分後に再試行してください'
    };
  }

  if (errorMessage.includes('Missing credentials') || errorMessage.includes('Could not load credentials')) {
    return {
      message: 'AWS認証情報が設定されていません。システム管理者にお問い合わせください。',
      errorCode: awsErrorCode,
      errorType: 'CREDENTIALS_MISSING',
      hint: 'AWS_ACCESS_KEY_IDとAWS_SECRET_ACCESS_KEYの環境変数を確認してください'
    };
  }

  if (errorMessage.includes('NetworkingError') || errorMessage.includes('ENOTFOUND') || errorMessage.includes('ETIMEDOUT')) {
    return {
      message: 'AWS Cognitoへの接続に失敗しました。ネットワーク接続を確認してください。',
      errorCode: awsErrorCode,
      errorType: 'NETWORK_ERROR'
    };
  }

  // For unknown errors, return a generic message with error code
  return {
    message: 'ユーザー操作の処理中にエラーが発生しました。',
    errorCode: awsErrorCode || 'UNKNOWN',
    errorType: 'COGNITO_ERROR',
    // Include sanitized error message (remove AWS resource identifiers)
    detail: errorMessage
      .replace(/arn:aws:[^:]+:[^:]+:[^:]+:[^\s]+/g, '[AWS Resource]')
      .replace(/UserPoolId: [^\s,]+/g, 'UserPoolId: [REDACTED]')
      .replace(/user pool [a-z0-9-_]+/gi, 'user pool [REDACTED]')
  };
}

/**
 * Convert Moodle error to user-friendly message
 */
function sanitizeMoodleError(error) {
  const errorMessage = error.message || '';

  if (errorMessage.includes('webservice') || errorMessage.includes('token')) {
    return 'Moodle連携エラー: 認証に失敗しました。';
  }

  if (errorMessage.includes('not found') || errorMessage.includes('404')) {
    return '指定されたリソースが見つかりません。';
  }

  if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
    return 'アクセス権限がありません。';
  }

  return 'Moodle操作の処理中にエラーが発生しました。';
}

/**
 * Generic error sanitizer
 * Removes sensitive information and provides user-friendly messages
 */
function sanitizeError(error, context = 'general') {
  // Log the full error for debugging
  console.error(`[ErrorHandler] Original error (${context}):`, error);

  // Determine error type and sanitize accordingly
  if (error.message && error.message.includes('cognito-idp')) {
    return sanitizeCognitoError(error);
  }

  if (context === 'cognito') {
    return sanitizeCognitoError(error);
  }

  if (context === 'moodle') {
    return sanitizeMoodleError(error);
  }

  // For custom error messages (already user-friendly)
  if (error.message && error.message.match(/^[ぁ-んァ-ヶー一-龠々]+/)) {
    // If the error message starts with Japanese characters, it's likely already user-friendly
    return {
      message: error.message,
      errorType: 'CUSTOM_ERROR'
    };
  }

  // Generic fallback
  return {
    message: '操作の処理中にエラーが発生しました。詳細はシステム管理者にお問い合わせください。',
    errorType: 'GENERIC_ERROR'
  };
}

/**
 * Create standardized error response
 * Returns specific error information while hiding AWS configuration details
 */
function createErrorResponse(error, context = 'general', statusCode = 500) {
  const sanitized = sanitizeError(error, context);

  // Handle both string and object responses from sanitizeError
  const errorInfo = typeof sanitized === 'string'
    ? { message: sanitized, errorType: 'UNKNOWN' }
    : sanitized;

  const response = {
    success: false,
    message: errorInfo.message,
    errorType: errorInfo.errorType,
    ...(errorInfo.errorCode && { errorCode: errorInfo.errorCode }),
    ...(errorInfo.hint && { hint: errorInfo.hint }),
    ...(errorInfo.detail && { detail: errorInfo.detail })
  };

  // Only include full stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      originalError: error.message,
      stack: error.stack
    };
  }

  return response;
}

module.exports = {
  sanitizeError,
  sanitizeCognitoError,
  sanitizeMoodleError,
  createErrorResponse
};
