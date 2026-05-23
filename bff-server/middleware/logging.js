/**
 * Logging Middleware
 * Request/response logging and audit trails
 */

/**
 * Cookie and session logging middleware
 */
function cookieLogging(req, res, next) {
  // リクエスト受信時のCookie情報
  console.log('=== Cookie & Session Details ===');
  console.log('Protocol:', req.protocol);
  console.log('Secure:', req.secure);
  console.log('X-Forwarded-Proto:', req.headers['x-forwarded-proto'] || 'Not set');
  console.log('X-Forwarded-Host:', req.headers['x-forwarded-host'] || 'Not set');
  console.log('Origin:', req.headers.origin || 'Not set');
  console.log('Cookie Header:', req.headers.cookie || 'No Cookie');
  console.log('Session ID:', req.sessionID || 'No Session ID');
  console.log('Session exists:', !!req.session);

  if (req.session) {
    console.log('Session data:', {
      userId: req.session.userId,
      username: req.session.username,
      cookie: {
        originalMaxAge: req.session.cookie.originalMaxAge,
        expires: req.session.cookie.expires,
        httpOnly: req.session.cookie.httpOnly,
        secure: req.session.cookie.secure,
        sameSite: req.session.cookie.sameSite
      }
    });
  }

  // レスポンス送信時のSet-Cookie情報
  const originalSetHeader = res.setHeader;
  res.setHeader = function(name, value) {
    if (name.toLowerCase() === 'set-cookie') {
      console.log('=== Set-Cookie Header ===');
      console.log('Setting Cookie:', value);
    }
    return originalSetHeader.apply(this, arguments);
  };

  next();
}

/**
 * Security audit logging middleware
 */
function auditLogging(req, res, next) {
  const start = Date.now();

  // リクエスト開始時の情報
  const auditLog = {
    timestamp: new Date().toISOString(),
    requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.session?.userId || null,
    username: req.session?.username || null,
    params: req.params,
    query: req.query
  };

  // レスポンス完了時の情報
  res.on('finish', () => {
    const duration = Date.now() - start;
    auditLog.status = res.statusCode;
    auditLog.duration = `${duration}ms`;

    // APIリクエストのみログ出力（静的ファイルは除外）
    if (req.path.startsWith('/api/')) {
      console.log('[AUDIT]', JSON.stringify(auditLog));

      // エラーレスポンスや認可失敗は警告レベルで出力
      if (res.statusCode >= 400) {
        console.warn('[AUDIT-ALERT]', JSON.stringify({
          ...auditLog,
          level: res.statusCode === 401 ? 'AUTHENTICATION_FAILED' :
                 res.statusCode === 403 ? 'AUTHORIZATION_FAILED' :
                 res.statusCode >= 500 ? 'SERVER_ERROR' : 'CLIENT_ERROR'
        }));
      }
    }
  });

  next();
}

/**
 * Raw body logging middleware (for debugging)
 */
function rawBodyLogging(req, res, buf, encoding) {
  if (buf && buf.length) {
    const rawBody = buf.toString(encoding || 'utf8');
    console.log('=== RAW BODY RECEIVED ===');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw Body String:', rawBody);
    console.log('Raw Body Length:', rawBody.length);
    console.log('Raw Body Bytes:', Array.from(buf).slice(0, 100));
  }
}

module.exports = {
  cookieLogging,
  auditLogging,
  rawBodyLogging
};
