/**
 * Schwab AI Scalper Dashboard - Backend Server
 * 
 * Main Express.js server file that handles:
 * - API routing for authentication and trading operations
 * - Security middleware configuration
 * - Request logging and error handling
 * - Mock API endpoints for development testing
 * 
 * @module server
 * @requires express
 * @requires cors
 * @requires helmet
 * @requires morgan
 * @requires dotenv
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Route imports
const authRoutes = require('./routes/auth');
const tradingRoutes = require('./routes/trading');

// Middleware imports
const { errorHandler } = require('./middleware/errorHandler');

// Utility imports
const logger = require('./utils/logger');

/**
 * Load environment variables from .env file
 * Required variables:
 * - PORT: Server port (default: 3001)
 * - FRONTEND_URL: Frontend application URL for CORS
 * - SCHWAB_API_KEY: Schwab API key
 * - SCHWAB_API_SECRET: Schwab API secret
 * - NODE_ENV: Environment mode (development/production)
 */
dotenv.config();

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 3001;

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// =============================================================================
// MIDDLEWARE CONFIGURATION
// =============================================================================

/**
 * Helmet - Sets security-related HTTP headers
 * Protects against common web vulnerabilities:
 * - XSS attacks
 * - Clickjacking
 * - MIME type sniffing
 */
app.use(helmet());

/**
 * CORS - Cross-Origin Resource Sharing configuration
 * Allows frontend to make requests to this backend
 * @param {Object} options - CORS configuration
 * @param {string} options.origin - Allowed origin URL
 * @param {boolean} options.credentials - Allow credentials (cookies, auth headers)
 */
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

/**
 * Body parser middleware
 * Parses incoming request bodies in JSON format
 */
app.use(express.json());

/**
 * URL-encoded body parser
 * Parses URL-encoded data with extended option for rich objects
 */
app.use(express.urlencoded({ extended: true }));

/**
 * Morgan - HTTP request logger
 * Logs all incoming requests using the Winston logger stream
 * Format: 'combined' (Apache combined log format)
 */
app.use(morgan('combined', { stream: logger.stream }));

// =============================================================================
// HEALTH CHECK ENDPOINT
// =============================================================================

/**
 * Health check endpoint
 * Used by monitoring tools and load balancers to verify server status
 * 
 * @route GET /health
 * @returns {Object} 200 - Server status and timestamp
 * @returns {string} 200.status - Always 'ok' if server is running
 * @returns {string} 200.timestamp - Current server time in ISO format
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// =============================================================================
// MOCK API ENDPOINTS (Development Mode Only)
// =============================================================================

if (isDevelopment) {
  /**
   * Mock Schwab API endpoints for local development and testing
   * These endpoints simulate Schwab API responses without making real API calls
   * Only available when NODE_ENV=development
   */
  
  /**
   * Mock OAuth token endpoint
   * Simulates Schwab OAuth token generation
   * 
   * @route POST /mock/oauth/token
   * @param {string} req.body.grant_type - OAuth grant type
   * @param {string} req.body.code - Authorization code (for authorization_code grant)
   * @param {string} req.body.refresh_token - Refresh token (for refresh_token grant)
   * @returns {Object} 200 - Mock OAuth token response
   */
  app.post('/mock/oauth/token', (req, res) => {
    logger.info('Mock OAuth token request received');
    res.json({
      access_token: 'mock_access_token_' + Date.now(),
      refresh_token: 'mock_refresh_token_' + Date.now(),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'trading'
    });
  });

  /**
   * Mock account information endpoint
   * Returns simulated account data
   * 
   * @route GET /mock/accounts/:accountId
   * @param {string} req.params.accountId - Account ID
   * @returns {Object} 200 - Mock account information
   */
  app.get('/mock/accounts/:accountId', (req, res) => {
    logger.info(`Mock account request for account: ${req.params.accountId}`);
    res.json({
      accountId: req.params.accountId,
      accountType: 'MARGIN',
      roundTrips: 0,
      isDayTrader: false,
      isClosingOnlyRestricted: false,
      currentBalances: {
        liquidationValue: 50000.00,
        cashBalance: 25000.00,
        equity: 50000.00
      },
      positions: []
    });
  });

  /**
   * Mock quote endpoint
   * Returns simulated real-time quote data
   * 
   * @route GET /mock/quotes/:symbol
   * @param {string} req.params.symbol - Stock symbol
   * @returns {Object} 200 - Mock quote data
   */
  app.get('/mock/quotes/:symbol', (req, res) => {
    const symbol = req.params.symbol;
    logger.info(`Mock quote request for symbol: ${symbol}`);
    
    // Generate realistic mock data
    const basePrice = 100 + Math.random() * 100;
    res.json({
      symbol: symbol,
      description: `${symbol} Mock Company`,
      bidPrice: basePrice - 0.05,
      askPrice: basePrice + 0.05,
      lastPrice: basePrice,
      openPrice: basePrice - 2,
      highPrice: basePrice + 3,
      lowPrice: basePrice - 4,
      closePrice: basePrice - 1,
      volume: Math.floor(Math.random() * 10000000),
      quoteTime: Date.now(),
      mark: basePrice
    });
  });

  /**
   * Mock order placement endpoint
   * Simulates order submission
   * 
   * @route POST /mock/accounts/:accountId/orders
   * @param {string} req.params.accountId - Account ID
   * @param {Object} req.body - Order details
   * @returns {Object} 201 - Mock order confirmation
   */
  app.post('/mock/accounts/:accountId/orders', (req, res) => {
    logger.info(`Mock order placement for account: ${req.params.accountId}`, req.body);
    res.status(201).json({
      orderId: 'MOCK_ORDER_' + Date.now(),
      status: 'WORKING',
      enteredTime: new Date().toISOString(),
      accountId: req.params.accountId
    });
  });

  /**
   * Mock order status endpoint
   * Returns simulated order status
   * 
   * @route GET /mock/accounts/:accountId/orders/:orderId
   * @param {string} req.params.accountId - Account ID
   * @param {string} req.params.orderId - Order ID
   * @returns {Object} 200 - Mock order status
   */
  app.get('/mock/accounts/:accountId/orders/:orderId', (req, res) => {
    logger.info(`Mock order status check: ${req.params.orderId}`);
    res.json({
      orderId: req.params.orderId,
      status: 'FILLED',
      filledQuantity: 100,
      remainingQuantity: 0,
      filledTime: new Date().toISOString()
    });
  });

  logger.info('Mock API endpoints enabled for development');
}

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * Authentication routes
 * Handles user authentication, OAuth flows, and token management
 * Base path: /api/auth
 */
app.use('/api/auth', authRoutes);

/**
 * Trading routes
 * Handles trading operations, account queries, and market data
 * Base path: /api/trading
 */
app.use('/api/trading', tradingRoutes);

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Global error handling middleware
 * Must be registered last to catch errors from all previous middleware/routes
 * Logs errors and returns appropriate HTTP responses
 */
app.use(errorHandler);

// =============================================================================
// SERVER STARTUP
// =============================================================================

/**
 * Start the Express server
 * Listens on the configured PORT and logs startup information
 */
app.listen(PORT, () => {
  logger.info(`Server started successfully`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Port: ${PORT}`);
  logger.info(`Mock API: ${isDevelopment ? 'ENABLED' : 'DISABLED'}`);
  console.log(`\n🚀 Schwab AI Scalper Dashboard Backend`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🧪 Mock API: ${isDevelopment ? 'ENABLED' : 'DISABLED'}\n`);
});

/**
 * Graceful shutdown handler
 * Ensures clean shutdown on SIGTERM/SIGINT signals
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Export the app for testing purposes
module.exports = app;
