# Schwab AI Scalper - Backend API

Node.js Express backend server for the Schwab AI Scalper Dashboard. This server handles Schwab OAuth authentication, trading operations, and provides secure API endpoints for the frontend.

## Features

- **OAuth 2.0 Authentication** with Schwab API using PKCE flow
- **Trading Endpoints** for account management, order placement, and market data
- **Rate Limiting** to prevent API abuse
- **Error Handling** with comprehensive logging
- **Security** with Helmet.js and CORS protection
- **Winston Logging** for debugging and monitoring

## Project Structure

```
backend/
├── server.js                 # Main Express application
├── package.json             # Dependencies and scripts
├── .env.example             # Environment variables template
├── routes/
│   ├── auth.js             # OAuth authentication routes
│   └── trading.js          # Trading and market data routes
├── middleware/
│   └── errorHandler.js     # Error handling middleware
├── utils/
│   └── logger.js           # Winston logger configuration
└── logs/                    # Log files (auto-generated)
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Schwab API credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Schwab API Configuration
SCHWAB_CLIENT_ID=your_actual_client_id
SCHWAB_CLIENT_SECRET=your_actual_client_secret
SCHWAB_REDIRECT_URI=https://127.0.0.1:3001/api/auth/callback
SCHWAB_API_BASE_URL=https://api.schwabapi.com

# OAuth Configuration
SCHWAB_AUTH_URL=https://api.schwabapi.com/v1/oauth/authorize
SCHWAB_TOKEN_URL=https://api.schwabapi.com/v1/oauth/token

# Session/Token Storage
SESSION_SECRET=your_random_session_secret
TOKEN_ENCRYPTION_KEY=your_random_encryption_key

# Logging
LOG_LEVEL=info
```

### 3. Get Schwab API Credentials

1. Visit [Schwab Developer Portal](https://developer.schwab.com/)
2. Create a new application
3. Copy your Client ID and Client Secret
4. Set your redirect URI to match `SCHWAB_REDIRECT_URI` in `.env`

### 4. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication

- **GET /api/auth/authorize** - Generate OAuth authorization URL
- **GET /api/auth/callback** - OAuth callback handler
- **POST /api/auth/refresh** - Refresh access token
- **POST /api/auth/logout** - Logout and revoke tokens
- **GET /api/auth/status** - Check authentication status

### Trading

- **GET /api/trading/accounts** - Get account information
- **GET /api/trading/positions/:accountId** - Get account positions
- **GET /api/trading/quote/:symbol** - Get quote for a symbol
- **POST /api/trading/orders** - Place an order
- **GET /api/trading/orders/:accountId/:orderId** - Get order by ID
- **GET /api/trading/orders/:accountId** - Get all orders for account
- **DELETE /api/trading/orders/:accountId/:orderId** - Cancel an order

### Health Check

- **GET /health** - Server health check

## Authentication Flow

1. Frontend calls `/api/auth/authorize` to get authorization URL
2. User is redirected to Schwab login page
3. After authentication, Schwab redirects to `/api/auth/callback`
4. Backend exchanges authorization code for access/refresh tokens
5. Tokens are stored securely (session-based)
6. Frontend receives session ID for subsequent requests

## Security Features

- **Helmet.js** - Sets security headers
- **CORS** - Restricts cross-origin requests
- **Rate Limiting** - Prevents API abuse
- **Environment Variables** - Sensitive data not in code
- **Token Storage** - Secure in-memory storage (use database in production)
- **Error Handling** - Sanitized error messages

## Logging

Logs are stored in the `logs/` directory:

- `combined.log` - All logs
- `error.log` - Error logs only
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

Log levels: `error`, `warn`, `info`, `debug`

## Development Notes

### Token Storage

Currently uses in-memory storage (Map). For production, implement:
- Redis for session storage
- Database for persistent token storage
- Token encryption at rest

### Rate Limiting

Default limits:
- General endpoints: 100 requests per 15 minutes
- Trading endpoints: 20 requests per minute

Adjust in `.env` if needed.

### Error Handling

All errors are logged and returned with appropriate status codes:
- 400 - Bad Request
- 401 - Unauthorized
- 404 - Not Found
- 429 - Too Many Requests
- 500 - Internal Server Error

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Use a process manager (PM2, systemd)
3. Implement proper token storage (Redis/Database)
4. Set up HTTPS with valid certificates
5. Configure firewall rules
6. Enable monitoring and alerting

## Troubleshooting

### Common Issues

1. **"Invalid redirect URI"** - Ensure redirect URI in Schwab app matches `.env`
2. **"Token expired"** - Call `/api/auth/refresh` to refresh token
3. **"Rate limit exceeded"** - Wait before making more requests
4. **"Connection refused"** - Check if Schwab API is accessible

### Debug Mode

Set `LOG_LEVEL=debug` in `.env` for detailed logging.

## Dependencies

- **express** - Web framework
- **axios** - HTTP client for Schwab API
- **winston** - Logging
- **helmet** - Security headers
- **cors** - CORS middleware
- **morgan** - HTTP request logger
- **dotenv** - Environment variables
- **express-rate-limit** - Rate limiting

## License

MIT
