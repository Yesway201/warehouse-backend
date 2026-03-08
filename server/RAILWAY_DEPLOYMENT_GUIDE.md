# Railway Deployment Guide - Step by Step

## GOOD NEWS: No Environment Variables Needed! 🎉

Your backend doesn't need any environment variables because:
- Smartsheet credentials (API token, sheet ID) come from the frontend
- No database connection required
- No secrets to configure

## Step-by-Step Deployment (5 minutes)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Click "Login" → "Login with GitHub"
3. Authorize Railway to access your GitHub

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository (or create one - see below if you don't have one)

### Step 3: Configure Build Settings
Railway will auto-detect Node.js. Verify these settings:
- **Root Directory**: `server` (IMPORTANT!)
- **Build Command**: `npm install` (auto-detected)
- **Start Command**: `node index.js` (auto-detected)

### Step 4: Deploy
1. Click "Deploy"
2. Wait 2-3 minutes for deployment
3. Railway will show "Deployed" with a green checkmark

### Step 5: Get Your URL
1. Go to "Settings" tab
2. Click "Generate Domain" under "Domains"
3. Copy the URL (e.g., `https://your-app.up.railway.app`)

### Step 6: Tell Me Your URL
Reply with your Railway URL, and I'll update the frontend code to use it.

---

## If You Don't Have a GitHub Repo Yet

### Option A: Create GitHub Repo (Recommended for auto-deploy)
1. Go to https://github.com/new
2. Create a new repository (name it "warehouse-backend")
3. Run these commands in your terminal:

```bash
cd /workspace/shadcn-ui/server
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/warehouse-backend.git
git push -u origin main
```

4. Now follow Steps 1-6 above

### Option B: Deploy Without GitHub (Manual deploys)
1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login and deploy:
   ```bash
   cd /workspace/shadcn-ui/server
   railway login
   railway init
   railway up
   ```

3. Get your URL:
   ```bash
   railway domain
   ```

---

## After Deployment

Once you give me your Railway URL, I will:
1. Update `/workspace/shadcn-ui/src/lib/api.ts` with your URL
2. Rebuild the frontend
3. Test the sync in App Viewer

Then your live Smartsheet sync will work everywhere! 🚀

---

## Benefits of Railway + GitHub

✅ **Auto-deploy**: Every time I push code changes, Railway automatically redeploys
✅ **Free tier**: 500 hours/month free (plenty for development)
✅ **Fast**: Deploys in ~2 minutes
✅ **No config**: Zero environment variables needed
✅ **Monitoring**: Built-in logs and metrics

---

## Troubleshooting

**If deployment fails:**
1. Check Railway logs (click "View Logs")
2. Verify Root Directory is set to `server`
3. Make sure Start Command is `node index.js`

**If you get CORS errors:**
- Don't worry, I've already configured CORS to allow all origins
- The backend will work with both localhost and App Viewer

---

## Current Status

- ✅ Backend code ready
- ✅ Railway config file created (`railway.json`)
- ✅ No environment variables needed
- ⏳ Waiting for you to deploy and provide URL

**Next Step:** Follow the guide above and reply with your Railway URL!
