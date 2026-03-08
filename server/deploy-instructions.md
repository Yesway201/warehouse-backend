# Backend Deployment Instructions

Your Express backend needs to be deployed to the cloud so the App Viewer can access it.

## Option 1: Railway (Recommended - Easiest)

1. Go to https://railway.app and sign up (free tier available)
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select your repository
4. Railway will auto-detect the Express app
5. Add environment variables in Railway dashboard:
   - No special variables needed (Smartsheet credentials come from frontend)
6. Railway will provide a URL like: https://your-app.railway.app
7. Update `/workspace/shadcn-ui/src/lib/api.ts` line 5:
   Change: `return 'http://localhost:3001/api';`
   To: `return 'https://your-app.railway.app/api';`

## Option 2: Render

1. Go to https://render.com and sign up (free tier available)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - Build Command: `cd server && npm install`
   - Start Command: `cd server && node index.js`
   - Environment: Node
5. Add environment variables (none required for now)
6. Render will provide a URL like: https://your-app.onrender.com
7. Update `/workspace/shadcn-ui/src/lib/api.ts` line 5 with your Render URL

## Option 3: Heroku

1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
2. Run these commands:
   ```bash
   cd /workspace/shadcn-ui/server
   heroku login
   heroku create your-warehouse-backend
   git init
   git add .
   git commit -m "Deploy backend"
   heroku git:remote -a your-warehouse-backend
   git push heroku main
   ```
3. Your app will be at: https://your-warehouse-backend.herokuapp.com
4. Update `/workspace/shadcn-ui/src/lib/api.ts` line 5 with your Heroku URL

## After Deployment

1. Test your deployed backend:
   ```bash
   curl https://your-deployed-url.com/health
   ```
   Should return: `{"status":"ok","message":"Backend API server is running"}`

2. Update the frontend API URL in `/workspace/shadcn-ui/src/lib/api.ts`

3. Rebuild the frontend:
   ```bash
   cd /workspace/shadcn-ui
   pnpm run build
   ```

4. Test in App Viewer - the sync should now work!

## Current Status

- Backend is running locally at: http://localhost:3001
- Frontend can access it on localhost but NOT in App Viewer
- You need to deploy the backend to one of the services above
- Once deployed, update the API URL in the code
