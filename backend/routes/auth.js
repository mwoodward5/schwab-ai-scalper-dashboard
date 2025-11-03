const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// In-memory storage for tokens (in production, use a database)
const tokenStore = new Map();

/**
 * Generate OAuth authorization URL
 * GET /api/auth/authorize
 */
router.get('/authorize', (req, res) => {
  try {
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store state and code verifier for validation
    req.session = req.session || {};
    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    const authUrl = new URL(process.env.SCHWAB_AUTH_URL);
    authUrl.searchParams.append('client_id', process.env.SCHWAB_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', process.env.SCHWAB_REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('scope', 'trading readonly');

    logger.info('Generated OAuth authorization URL');
    res.json({ authUrl: authUrl.toString() });
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * OAuth callback handler
 * GET /api/auth/callback
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // Validate state
    if (!req.session || state !== req.session.oauthState) {
      throw new Error('Invalid state parameter');
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      process.env.SCHWAB_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SCHWAB_REDIRECT_URI,
        client_id: process.env.SCHWAB_CLIENT_ID,
        code_verifier: req.session.codeVerifier,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.SCHWAB_CLIENT_ID}:${process.env.SCHWAB_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Store tokens securely
    const sessionId = crypto.randomBytes(32).toString('hex');
    tokenStore.set(sessionId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
    });

    logger.info('OAuth callback successful, tokens stored');
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?session=${sessionId}`);
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/error?message=auth_failed`);
  }
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId || !tokenStore.has(sessionId)) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const tokens = tokenStore.get(sessionId);

    const tokenResponse = await axios.post(
      process.env.SCHWAB_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.SCHWAB_CLIENT_ID}:${process.env.SCHWAB_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Update stored tokens
    tokenStore.set(sessionId, {
      accessToken: access_token,
      refreshToken: refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + expires_in * 1000,
    });

    logger.info('Access token refreshed');
    res.json({ success: true });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * Logout and revoke tokens
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  try {
    const { sessionId } = req.body;

    if (sessionId && tokenStore.has(sessionId)) {
      tokenStore.delete(sessionId);
      logger.info('User logged out, tokens revoked');
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * Check authentication status
 * GET /api/auth/status
 */
router.get('/status', (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId || !tokenStore.has(sessionId)) {
    return res.json({ authenticated: false });
  }

  const tokens = tokenStore.get(sessionId);
  const isValid = tokens.expiresAt > Date.now();

  res.json({ authenticated: isValid });
});

// Export token store for use in other modules
module.exports = router;
module.exports.tokenStore = tokenStore;
