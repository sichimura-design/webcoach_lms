/**
 * Logging Middleware
 * Request/response logging and audit trails
 *
 * 以前あったデバッグ用の cookieLogging(Cookie ヘッダ=セッションIDをそのまま出力)と
 * rawBodyLogging(全リクエスト本文を出力)は削除した(2026-10-22)。ノート・AIチャット本文や
 * セッションIDがログに30日残り、本文中の「エラー」等の語でSlack通知の誤検知も起きていたため。
 */

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

module.exports = {
  auditLogging
};
