const express = require('express');
const router = express.Router();
const axios = require('axios');
const { tokenStore } = require('./auth');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for trading endpoints
const tradingLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 20,
  message: 'Too many trading requests, please try again later',
});

// Middleware to validate session and get access token
const authenticateRequest = (req, res, next) => {
  const { sessionId } = req.headers;

  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const tokens = tokenStore.get(sessionId);

  if (tokens.expiresAt <= Date.now()) {
    return res.status(401).json({ error: 'Token expired' });
  }

  req.accessToken = tokens.accessToken;
  next();
};

/**
 * Get account information
 * GET /api/trading/accounts
 */
router.get('/accounts', authenticateRequest, async (req, res) => {
  try {
    const response = await axios.get(
      `${process.env.SCHWAB_API_BASE_URL}/trader/v1/accounts`,
      {
        headers: {
          Authorization: `Bearer ${req.accessToken}`,
        },
      }
    );

    logger.info('Retrieved account information');
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching accounts:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch account information',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * Get account positions
 * GET /api/trading/positions/:accountId
 */
router.get('/positions/:accountId', authenticateRequest, async (req, res) => {
  try {
    const { accountId } = req.params;

    const response = await axios.get(
      `${process.env.SCHWAB_API_BASE_URL}/trader/v1/accounts/${accountId}/positions`,
      {
        headers: {
          Authorization: `Bearer ${req.accessToken}`,
        },
      }
    );

    logger.info(`Retrieved positions for account ${accountId}`);
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching positions:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch positions',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * Get quote for a symbol
 * GET /api/trading/quote/:symbol
 */
router.get('/quote/:symbol', authenticateRequest, async (req, res) => {
  try {
    const { symbol } = req.params;

    const response = await axios.get(
      `${process.env.SCHWAB_API_BASE_URL}/marketdata/v1/quotes/${symbol}`,
      {
        headers: {
          Authorization: `Bearer ${req.accessToken}`,
        },
      }
    );

    logger.info(`Retrieved quote for ${symbol}`);
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching quote:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch quote',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * Place an order
 * POST /api/trading/orders
 */
router.post('/orders', tradingLimiter, authenticateRequest, async (req, res) => {
  try {
    const { accountId, orderData } = req.body;

    if (!accountId || !orderData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate order data structure
    if (!orderData.orderType || !orderData.session || !orderData.duration || !orderData.orderStrategyType) {
      return res.status(400).json({ error: 'Invalid order data structure' });
    }

    const response = await axios.post(
      `${process.env.SCHWAB_API_BASE_URL}/trader/v1/accounts/${accountId}/orders`,
      orderData,
      {
        headers: {
          Authorization: `Bearer ${req.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info(`Order placed for account ${accountId}`, { orderData });
    res.status(201).json({
      success: true,
      orderId: response.headers['location']?.split('/').pop(),
      message: 'Order placed successfully',
    });
  } catch (error) {
    logger.error('Error placing order:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to place order',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * Get order by ID
 * GET /api/trading/orders/:accountId/:orderId
 */
router.get('/orders/:accountId/:orderId', authenticateRequest, async (req, res) => {
  try {
    const { accountId, orderId } = req.params;

    const response = await axios.get(
      `${process.env.SCHWAB_API_BASE_URL}/trader/v1/accounts/${accountId}/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${req.accessToken}`,
        },
      }
    );

    logger.info(`Retrieved order ${orderId} for account ${accountId}`);
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching order:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch order',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * Cancel an order
 * DELETE /api/trading/orders/:accountId/:orderId
 */
router.delete('/orders/:accountId/:orderId', tradingLimiter, authenticateRequest, async (req, res) => {
  try {
    const { accountId, orderId } = req.params;

    await axios.delete(
      `${process.env.SCHWAB_API_BASE_URL}/trader/v1/accounts/${accountId}/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${req.accessToken}`,
        },
      }
    );

    logger.info(`Cancelled order ${orderId} for account ${accountId}`);
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    logger.error('Error cancelling order:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to cancel order',
      details: error.response?.data || error.message,
    });
  }
});

/**
 * Get all orders for an account
 * GET /api/trading/orders/:accountId
 */
router.get('/orders/:accountId', authenticateRequest, async (req, res) => {
  try {
    const { accountId } = req.params;
    const { fromDate, toDate, status } = req.query;

    const params = {};
    if (fromDate) params.fromEnteredTime = fromDate;
    if (toDate) params.toEnteredTime = toDate;
    if (status) params.status = status;

    const response = await axios.get(
      `${process.env.SCHWAB_API_BASE_URL}/trader/v1/accounts/${accountId}/orders`,
      {
        headers: {
          Authorization: `Bearer ${req.accessToken}`,
        },
        params,
      }
    );

    logger.info(`Retrieved orders for account ${accountId}`);
    res.json(response.data);
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch orders',
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
