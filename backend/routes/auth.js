/**
 * Authentication routes for Schwab AI Scalper Dashboard
 *
 * Provides endpoints to start OAuth authorization, handle callback,
 * refresh tokens, and revoke/logout. Uses PKCE for enhanced security.
 *
 * Base path mounted in server: /api/auth
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// In-memory storage for tokens (in production, use a persistent store)
const tokenStore = new Map(); // key: session/user id, value: { accessToken, refreshToken, expiresAt }

/**
 * Build the Schwab OAuth authorization URL with PKCE parameters.
 * GET /api/auth/authorize
 *
 * Response: { authUrl: string }
 */
router.get('/authorize', (req, res) => {
  try {
    // Generate CSRF state and PKCE verifier/challenge
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Persist state + verifier in session for later validation
    req.session = req.session || {};
    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    // Construct the authorization URL
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
 * Handle the OAuth callback, exchange code for tokens, and store them.
 * GET /api/auth/callback?code=...&state=...
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    // Validate anti-CSRF state
    if (!req.session || state !== req.session.oauthState) {
      throw new Error('Invalid state parameter');
    }

    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      process.env.SCHWAB_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.SCHWAB_CLIENT_ID,
        redirect_uri: process.env.SCHWAB_REDIRECT_URI,
        code_verifier: req.session.codeVerifier,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in, token_type } = tokenResponse.data;

    // Persist token payload in-memory (replace with DB/Redis for production)
    const userKey = req.sessionID || 'default-user';
    tokenStore.set(userKey, {
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenType: token_type,
      expiresAt: Date.now() + (expires_in - 30) * 1000, // subtract 30s buffer
    });

    logger.info('OAuth tokens stored for session');
    res.json({ success: true });
  } catch (error) {
    logger.error('OAuth callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'OAuth callback failed' });
  }
});

/**
 * Refresh the access token using a stored refresh token.
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const userKey = req.sessionID || 'default-user';
    const tokens = tokenStore.get(userKey);
    if (!tokens?.refreshToken) return res.status(401).json({ error: 'No refresh token' });

    const resp = await axios.post(
      process.env.SCHWAB_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: process.env.SCHWAB_CLIENT_ID,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in, token_type } = resp.data;
    tokenStore.set(userKey, {
      accessToken: access_token,
      refreshToken: refresh_token || tokens.refreshToken,
      tokenType: token_type,
      expiresAt: Date.now() + (expires_in - 30) * 1000,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Token refresh failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * Log out and revoke tokens if supported, then clear stored tokens.
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const userKey = req.sessionID || 'default-user';
    tokenStore.delete(userKey);
    res.json({ success: true });
  } catch (error) {
    logger.error('Logout error:', error.message);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
