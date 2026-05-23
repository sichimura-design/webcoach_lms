/**
 * Moodle BFF Server
 * Backend for Frontend - Facade for Moodle and API Server
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// Configuration
const { config, validateEnvironment } = require('./config/environment');

// Utilities
const logger = require('./utils/logger');

// Services
const authService = require('./services/AuthService');

// Middleware
const { cookieLogging, auditLogging, rawBodyLogging } = require('./middleware/logging');
const { generalLimiter } = require('./middleware/rateLimit');

// Routes
const authRoutes = require('./routes/auth');
const moodleRoutes = require('./routes/moodle');
const webcoachRoutes = require('./routes/webcoach');
const adminRoutes = require('./routes/admin');
const faissRoutes = require('./routes/faiss');

// Initialize Express app
const app = express();
const PORT = config.port;

// Load Swagger documentation
const swaggerDocument = YAML.load('./swagger.yaml');

// Validate environment variables
validateEnvironment();

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", config.moodleUrl, config.apiServerUrl],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: config.allowedOrigins,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Trust proxy (for nginx, CloudFront, etc.)
app.set('trust proxy', true);

// Rate limiting (applied to all routes)
app.use('/api/', generalLimiter);

// Body parsing
app.use(express.json({ verify: rawBodyLogging }));
app.use(express.urlencoded({ extended: true }));

// Session configuration
const sessionConfig = {
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'sessionId',
  cookie: {
    httpOnly: true,
    secure: 'auto',
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  proxy: true
};

app.use(session(sessionConfig));

// Logging middleware
app.use(cookieLogging);
app.use(auditLogging);

// ==================== ROUTES ====================

// Serve static files (for auth.html)
app.use(express.static('public'));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Moodle BFF API Documentation'
}));

// Health check - detailed version
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Moodle BFF',
    environment: config.nodeEnv,
    checks: {
      serviceAccountToken: authService.isServiceTokenAvailable(),
      moodle: { status: 'unknown' },
      apiServer: { status: 'unknown' }
    }
  };

  // Check Moodle connection
  const moodleAdapter = require('./adapters/MoodleAdapter');
  try {
    await moodleAdapter.getSiteInfo();
    health.checks.moodle = { status: 'ok' };
  } catch (error) {
    health.status = 'degraded';
    health.checks.moodle = {
      status: 'error',
      message: error.message
    };
  }

  // Check API Server connection
  const apiServerAdapter = require('./adapters/ApiServerAdapter');
  try {
    await apiServerAdapter.healthCheck();
    health.checks.apiServer = { status: 'ok' };
  } catch (error) {
    health.checks.apiServer = {
      status: 'error',
      message: error.message
    };
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Simple health check (for load balancers)
app.get('/api/health', (req, res) => {
  const isHealthy = authService.isServiceTokenAvailable();
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'error',
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api', authRoutes);
app.use('/api/moodle', moodleRoutes);
app.use('/api/webcoach', webcoachRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/faiss', faissRoutes);

// Backward compatibility - user info without /api prefix
app.get('/user/info', authRoutes);

// ==================== ERROR HANDLING ====================

// Error handling middleware
app.use((error, req, res, next) => {
  // Generate error ID for tracking
  const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Log full error details with error ID
  logger.error(`Error ${errorId}:`, {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  // In production, never expose error details
  if (config.nodeEnv === 'production') {
    res.status(500).json({
      error: 'Internal server error',
      errorId: errorId,
      detail: 'An unexpected error occurred. Please contact support with the error ID.'
    });
  } else {
    // In development, show error details for debugging
    res.status(500).json({
      error: 'Internal server error',
      errorId: errorId,
      message: error.message,
      stack: error.stack
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ==================== SERVER STARTUP ====================

if (require.main === module) {
  // Initialize service account and start server
  authService
    .initializeServiceAccount()
    .then(() => {
      // Start token refresh
      authService.startTokenRefresh();

      // Start HTTP server
      app.listen(PORT, () => {
        logger.log(`BFF Server running on port ${PORT}`);
        logger.log(`Environment: ${config.nodeEnv}`);
        logger.log(`Moodle URL: ${config.moodleUrl}`);
        logger.log(`API Server URL: ${config.apiServerUrl}`);
        logger.log(`Service Account: ${config.moodleServiceUsername}`);
        logger.log(`Authentication mode: Service Account`);
      });
    })
    .catch((error) => {
      logger.error('Failed to initialize service account:', error.message);
      logger.error('Server will not start without service account credentials.');
      process.exit(1);
    });
}

module.exports = app;
