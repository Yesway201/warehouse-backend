# Railway Deployment Guide

## Current Setup
This project has TWO Railway services:

### 1. Backend Service (Already Deployed)
- **Service Name**: warehouse-backend
- **URL**: https://warehouse-backend-production-4200.up.railway.app
- **Configuration**: `railway.json`
- **Root Directory**: `/server`
- **Start Command**: `cd server && npm start`

### 2. Frontend Service (NEW - To Be Created)
- **Service Name**: warehouse-frontend (suggested name)
- **Configuration**: `railway.frontend.json`
- **Root Directory**: `/` (project root)
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npx serve -s dist -l 3000`

## Deployment Steps

### Option A: Deploy Frontend via Railway Dashboard (RECOMMENDED)
1. Go to Railway Dashboard: https://railway.app/dashboard
2. Open your existing project (warehouse-backend)
3. Click "+ New" → "GitHub Repo"
4. Select the repository: `Yesway201/warehouse-app`
5. Configure the new service:
   - **Name**: warehouse-frontend
   - **Root Directory**: Leave as `/` (project root)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx serve -s dist -l 3000`
6. Add Environment Variable:
   - Key: `VITE_API_BASE_URL`
   - Value: `https://warehouse-backend-production-4200.up.railway.app`
7. Deploy

### Option B: Deploy via Railway CLI
```bash
# Install Railway CLI if not installed
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Create new service for frontend
railway service create warehouse-frontend

# Deploy frontend
railway up --service warehouse-frontend
```

## Post-Deployment

### Update Frontend Environment Variable
After frontend is deployed, you'll get a Railway URL like:
`https://warehouse-frontend-production-xxxx.up.railway.app`

### Update Backend CORS Settings
The backend needs to allow requests from the frontend URL. Update `server/index.js` CORS configuration to include the new frontend URL.

## Current Status
- ✅ Backend: Deployed and running
- ⏳ Frontend: Ready to deploy (configuration files created)
- ✅ Latest code: Pushed to GitHub (commit 57aa857)

## Important Notes
1. The frontend is a static React app built with Vite
2. The `serve` package is used to serve the built files
3. Environment variables starting with `VITE_` are embedded at build time
4. The frontend connects to backend via `VITE_API_BASE_URL`
5. Both services should be in the same Railway project for easier management