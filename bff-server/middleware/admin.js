/**
 * Admin Authorization Middleware
 * Verify admin privileges via Cognito groups
 */

/**
 * Require admin authorization - check Cognito groups for 'admin'
 */
function requireAdmin(req, res, next) {
  const groups = req.user?.groups || [];

  console.log('=== Admin Authorization Check ===');
  console.log('User:', req.user?.email);
  console.log('Groups:', groups);
  console.log('Path:', req.path);

  if (!groups.includes('admin')) {
    console.warn(`[SECURITY ALERT] Non-admin user ${req.user?.email} (${req.user?.sub}) attempted admin access`);
    console.warn(`[SECURITY ALERT] Path: ${req.method} ${req.path}`);
    console.warn(`[SECURITY ALERT] IP: ${req.ip}`);

    return res.status(403).json({
      error: 'Forbidden',
      message: '管理者権限が必要です。この操作は管理者のみ実行できます。'
    });
  }

  console.log('Admin authorization SUCCESS');
  next();
}

module.exports = requireAdmin;
