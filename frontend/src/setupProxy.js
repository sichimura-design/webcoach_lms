const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Notion API プロキシ（ポート3004）
  app.use(
    '/api/notion',
    createProxyMiddleware({
      target: 'http://localhost:3004',
      changeOrigin: true,
      logLevel: 'info'
    })
  );

  // MCP プロキシ（ポート3001）
  app.use(
    '/api/mcp',
    createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      logLevel: 'info',
      timeout: 60000,
      proxyTimeout: 60000,
      secure: false,
      onError: (err, req, res) => {
        console.error('MCP Proxy Error:', err);
      }
    })
  );

  // Moodle Web Service プロキシ（ポート80）
  app.use(
    '/webservice',
    createProxyMiddleware({
      target: 'http://localhost',
      changeOrigin: true,
      logLevel: 'info',
      timeout: 60000, // 60秒に延長
      proxyTimeout: 60000, // 60秒に延長
      secure: false,
      onError: (err, req, res) => {
        console.error('Proxy Error:', err);
        res.status(500).json({
          error: 'Proxy timeout',
          message: 'Moodle server is not responding. Please try again later.'
        });
      }
    })
  );
};