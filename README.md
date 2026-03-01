# Warehouse Management System

A full-stack warehouse management application with Extensiv 3PL Central API integration.

## Features

- **Customer Management**: Import/export Excel files, CRUD operations
- **Item Database**: Real-time sync with Extensiv API
- **Extensiv Integration**: OAuth 2.0 authentication, paginated item fetching

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- shadcn-ui + Tailwind CSS
- React Router

### Backend
- Node.js + Express
- Extensiv 3PL Central API integration
- OAuth 2.0 client credentials flow

## Local Development

### Prerequisites
- Node.js 18+
- pnpm (for frontend)
- npm (for backend)

### Setup

1. **Install Frontend Dependencies**
```bash
pnpm install
```

2. **Install Backend Dependencies**
```bash
cd server
npm install
```

3. **Start Backend Server**
```bash
cd server
npm start
# Server runs on http://localhost:3001
```

4. **Start Frontend Dev Server**
```bash
# In root directory
pnpm run dev
# App runs on http://localhost:8080
```

## Railway Deployment

### Step 1: Prepare Repository

1. Initialize git (if not already done):
```bash
git init
git add .
git commit -m "Initial commit"
```

2. Create GitHub repository and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Railway

1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect the configuration from `railway.json`

### Step 3: Configure Environment Variables (Optional)

In Railway dashboard, add any environment variables if needed:
- `PORT` (Railway sets this automatically)
- `NODE_ENV=production`

### Step 4: Get Your Backend URL

After deployment, Railway provides a URL like:
```
https://your-app-name.up.railway.app
```

### Step 5: Update Frontend API Client

Update `/workspace/shadcn-ui/src/lib/extensivApi.ts`:

```typescript
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://your-app-name.up.railway.app/api/extensiv'
  : '/api/extensiv';
```

Or use environment variable in `.env`:
```
VITE_API_BASE_URL=https://your-app-name.up.railway.app
```

## API Endpoints

### POST /api/extensiv/test-connection
Test Extensiv OAuth credentials

**Request:**
```json
{
  "clientId": "your_client_id",
  "clientSecret": "your_client_secret",
  "userLoginId": "API Integration"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OAuth token obtained successfully"
}
```

### POST /api/extensiv/sync-items
Sync items from Extensiv API with pagination

**Request:**
```json
{
  "clientId": "your_client_id",
  "clientSecret": "your_client_secret",
  "userLoginId": "API Integration",
  "customerId": "12345"
}
```

**Response:**
```json
{
  "success": true,
  "items": [...],
  "totalItems": 1247
}
```

## Project Structure

```
/workspace/shadcn-ui/
├── server/                    # Backend Express server
│   ├── index.js              # Server entry point
│   ├── routes/
│   │   └── extensiv.js       # Extensiv API routes
│   └── package.json
├── src/                      # Frontend React app
│   ├── pages/
│   │   ├── CustomerManagement.tsx
│   │   ├── ItemDatabase.tsx
│   │   └── Settings.tsx
│   ├── lib/
│   │   ├── extensivApi.ts    # API client
│   │   └── credentialStorage.ts
│   └── components/ui/        # shadcn-ui components
├── railway.json              # Railway deployment config
├── vite.config.ts           # Vite configuration
└── package.json             # Frontend dependencies
```

## Extensiv API Integration

### OAuth 2.0 Flow

1. Encode credentials: `Base64(clientId:clientSecret)`
2. Request token from: `https://secure-wms.com/AuthServer/api/Token`
3. Use Bearer token for API requests

### Item Sync Pagination

- Page size: 500 items
- Max pages: 10 (5,000 items total)
- Endpoint: `https://secure-wms.com/customers/{customerId}/items?pgsiz=500&pgnum={page}`

## Troubleshooting

### Backend not starting on Railway
- Check logs in Railway dashboard
- Verify `railway.json` configuration
- Ensure `server/package.json` has correct start script

### CORS errors
- Backend already configured with `cors({ origin: '*' })`
- If issues persist, update CORS config in `server/index.js`

### Frontend can't reach backend
- Update `VITE_API_BASE_URL` in `.env`
- Check Railway deployment URL is correct
- Verify backend is running (check Railway logs)

## License

MIT# Test credential persistence
# Force rebuild Mon Feb  2 08:12:10 PST 2026
