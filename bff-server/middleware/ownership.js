/**
 * Ownership Authorization Middleware
 * Verify resource ownership
 */

/**
 * Require resource ownership - check if authenticated user owns the resource
 */
function requireOwnership(req, res, next) {
  const requestedUserId = req.params.userid || req.body.userid || req.query.userid;
  const authenticatedMoodleUserId = req.user?.moodleUserId;

  console.log('=== Authorization Check ===');
  console.log('Requested userId:', requestedUserId);
  console.log('Authenticated Moodle userId:', authenticatedMoodleUserId);
  console.log('Cognito sub:', req.user?.sub);
  console.log('Cognito groups:', req.user?.groups);
  console.log('Is internal service:', req.user?.isInternalService);

  // Internal service can access any user's data
  if (req.user?.isInternalService) {
    console.log('Authorization BYPASS - Internal Service');
    return next();
  }

  // Admin users can access any user's data
  const isAdmin = req.user?.groups && (
    req.user.groups.includes('admin') ||
    req.user.groups.includes('Admin') ||
    req.user.groups.includes('administrators')
  );

  if (isAdmin) {
    console.log('Authorization BYPASS - Admin User');
    return next();
  }

  // Moodleユーザーが見つからない場合は警告を出す
  if (!authenticatedMoodleUserId) {
    console.warn('[SECURITY ALERT] No Moodle user ID found for authenticated user');
    console.warn('This endpoint requires Moodle user mapping');
    console.warn('Moodle user creation error:', req.user?.moodleUserCreationError);
    console.warn('Moodle user lookup error:', req.user?.moodleUserLookupError);

    // エラーの詳細をレスポンスに含める
    let errorMessage = 'Moodleユーザーとの紐付けが必要です';
    let errorDetail = null;

    if (req.user?.moodleUserCreationError) {
      errorDetail = `Moodleユーザーの作成に失敗しました: ${req.user.moodleUserCreationError}`;
    } else if (req.user?.moodleUserLookupError) {
      errorDetail = `Moodleユーザーの検索に失敗しました: ${req.user.moodleUserLookupError}`;
    } else {
      errorDetail = 'サービスアカウントトークンが利用できないか、メールアドレスが見つかりません。システム管理者に連絡してください。';
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: errorMessage,
      detail: errorDetail,
      cognitoEmail: req.user?.email
    });
  }

  // useridパラメータがある場合、認証されたMoodleユーザーIDと一致するかチェック
  if (requestedUserId) {
    const requestedUserIdInt = parseInt(requestedUserId);

    if (requestedUserIdInt !== authenticatedMoodleUserId) {
      console.warn(`[SECURITY ALERT] Authorization FAILED - Moodle User ${authenticatedMoodleUserId} (Cognito: ${req.user.sub}) attempted to access user ${requestedUserIdInt}'s data`);
      console.warn(`[SECURITY ALERT] Path: ${req.method} ${req.path}`);
      console.warn(`[SECURITY ALERT] IP: ${req.ip}`);

      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own data'
      });
    }
  }

  console.log('Authorization SUCCESS');
  next();
}

module.exports = requireOwnership;
