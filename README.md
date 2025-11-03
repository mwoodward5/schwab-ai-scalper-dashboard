# Schwab AI Scalper Dashboard

End-to-end trading dashboard integrating Schwab APIs for authentication, market data, and order placement. Includes a development mock API for safe E2E testing and deployment scaffolding for Heroku and Vercel.

## Features
- OAuth2 + PKCE auth flow (auth routes)
- Trading routes for accounts, quotes, and orders
- Dev-only Mock Schwab API at /mock for E2E testing
- Centralized logging and global error handling
- Rate limiting for trading endpoints
- Heroku Procfile and Vercel config scaffold

## Architecture
- backend/server.js: Express app, middleware, health, mock endpoints
- backend/routes/auth.js: OAuth endpoints (/authorize, /callback, /refresh, /logout)
- backend/routes/trading.js: Accounts, quotes, orders (routes to /mock in development)
- backend/middleware/errorHandler.js: APIError and global error handler
- backend/utils/logger.js: Winston logger stream (used by morgan)
- backend/utils/tokenStore.js: In-memory token store (dev only)

## Prerequisites
- Node.js 18+
- Schwab Developer account and app credentials
- Git

## Environment Variables
Create a .env file in backend/ with:

```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Schwab endpoints and credentials
SCHWAB_AUTH_URL=<Schwab OAuth authorize URL>
SCHWAB_TOKEN_URL=<Schwab OAuth token URL>
SCHWAB_BASE_URL=<Schwab API base URL>
SCHWAB_CLIENT_ID=<Your app client id>
SCHWAB_REDIRECT_URI=<Your redirect uri>

# Rate limiting (optional)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=20
```

## Local Setup
1) Clone repository
2) cd backend && npm install
3) Create backend/.env with values above
4) Start dev server:

```
NODE_ENV=development npm start
```

This enables the mock endpoints under /mock so you can test the frontend and integrators without hitting live Schwab.

## Mock API Usage (Development)
- POST /mock/oauth/token -> returns mock access/refresh tokens
- GET /mock/accounts/:accountId -> returns mock account data
- GET /mock/quotes/:symbol -> returns mock quote data
- POST /mock/accounts/:accountId/orders -> simulates order placement
- GET /mock/accounts/:accountId/orders/:orderId -> mock order status

Trading routes automatically switch to /mock when NODE_ENV=development. In production, requests go to SCHWAB_BASE_URL.

## Frontend Integration
- Health check: GET {BACKEND_URL}/health
- Start OAuth: GET {BACKEND_URL}/api/auth/authorize -> redirect user to returned authUrl
- Handle OAuth callback on your redirect URI, then call GET {BACKEND_URL}/api/auth/callback?code=...&state=...
- Store a session ID (cookie or header). For dev, you can send header: sessionid: <some-id>
- Authorized routes:
  - GET {BACKEND_URL}/api/trading/accounts/:accountId
  - GET {BACKEND_URL}/api/trading/quotes/:symbol
  - POST {BACKEND_URL}/api/trading/accounts/:accountId/orders (JSON body)

## Deployment

### Heroku
1) Create Heroku app
2) Add Config Vars (same as .env)
3) Ensure Procfile exists at repo root or backend (see below)
4) Deploy via Git or GitHub integration

Procfile (at repo root):
```
web: node backend/server.js
```

### Vercel
1) Create a Vercel project and import this repo
2) Set Framework to "Other"
3) Build Command: ""
4) Output Directory: ""
5) Set Environment Variables as shown above
6) Add vercel.json at repo root (see below)

vercel.json:
```
{
  "version": 2,
  "builds": [
    { "src": "backend/server.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "backend/server.js" }
  ]
}
```

package.json (root) adjustments (if needed):
```
{
  "scripts": {
    "start": "node backend/server.js"
  },
  "engines": {
    "node": ">=18"
  }
}
```

## Testing
- Unit tests can stub axios to hit /mock
- End-to-end: run backend in development mode; the trading routes route to /mock automatically

Manual E2E smoke test:
1) Start server in development
2) GET /health -> { status: "ok" }
3) GET /api/auth/authorize -> returns authUrl (dev only use)
4) Simulate token: POST /mock/oauth/token -> store access_token
5) GET /api/trading/quotes/AAPL -> returns mock quote
6) POST /api/trading/accounts/123/orders -> returns mock order id

## Troubleshooting
- 401 Unauthorized: ensure sessionid header is sent and tokens exist
- Token expired: call /api/auth/refresh or re-authenticate
- CORS errors: set FRONTEND_URL to your frontend origin
- Vercel 500: ensure vercel.json routes to backend/server.js and env vars set
- Heroku H10/H14: check logs and that Procfile is at repo root with correct command

## Security Notes
- Never commit real API keys
- Use HTTPS in production
- Replace in-memory tokenStore with Redis/DB in production
- Limit order privileges in testing environments

## License
MIT
