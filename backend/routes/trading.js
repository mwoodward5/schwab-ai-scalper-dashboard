/**
 * Trading routes for Schwab AI Scalper Dashboard
 *
 * Provides endpoints for account info, quotes, and order placement.
 * Applies rate limiting and token validation.
 *
 * Base path mounted in server: /api/trading
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Import token store from auth route (or refactor to a shared module in production)
const { tokenStore } = require('../utils/tokenStore');

// Rate limiting for trading endpoints
const tradingLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 20,
  message: 'Too many trading requests, please try again later',
});

// Validate request has a valid session and non-expired token
const authenticateRequest = (req, res, next) => {
  const sessionId = req.headers['sessionid'] || req.sessionID || 'default-user';
  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const tokens = tokenStore.get(sessionId);
  if (!tokens?.accessToken) return res.status(401).json({ error: 'Unauthorized' });
  if (tokens.expiresAt <= Date.now()) return res.status(401).json({ error: 'Token expired' });
  req.accessToken = tokens.accessToken;
  req.sessionKey = sessionId;
  next();
};

/**
 * Get account information
 * GET /api/trading/accounts/:accountId
 */
router.get('/accounts/:accountId', tradingLimiter, authenticateRequest, async (req, res) => {
  try {
    const { accountId } = req.params;
    // In development, route to mock server
    const baseUrl = process.env.NODE_ENV === 'development' ? `${req.protocol}://${req.get('host')}/mock` : process.env.SCHWAB_BASE_URL;

    const resp = await axios.get(`${baseUrl}/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${req.accessToken}` },
    });
    res.json(resp.data);
  } catch (error) {
    logger.error('Accounts fetch error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch accounts' });
  }
});

/**
 * Get quote for a symbol
 * GET /api/trading/quotes/:symbol
 */
router.get('/quotes/:symbol', tradingLimiter, authenticateRequest, async (req, res) => {
  try {
    const { symbol } = req.params;
    const baseUrl = process.env.NODE_ENV === 'development' ? `${req.protocol}://${req.get('host')}/mock` : process.env.SCHWAB_BASE_URL;

    const resp = await axios.get(`${baseUrl}/quotes/${encodeURIComponent(symbol)}`);
    res.json(resp.data);
  } catch (error) {
    logger.error('Quote fetch error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to fetch quote' });
  }
});

/**
 * Place an order
 * POST /api/trading/accounts/:accountId/orders
 */
router.post('/accounts/:accountId/orders', tradingLimiter, authenticateRequest, async (req, res) => {
  try {
    const { accountId } = req.params;
    const order = req.body;
    const baseUrl = process.env.NODE_ENV === 'development' ? `${req.protocol}://${req.get('host')}/mock` : process.env.SCHWAB_BASE_URL;

    const resp = await axios.post(`${baseUrl}/accounts/${accountId}/orders`, order, {
      headers: { Authorization: `Bearer ${req.accessToken}` },
    });
    res.status(201).json(resp.data);
  } catch (error) {
    logger.error('Order placement error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to place order' });
  }
});

module.exports = router;
