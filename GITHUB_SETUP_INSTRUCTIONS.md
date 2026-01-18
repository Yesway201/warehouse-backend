# GitHub Repository Setup - Step by Step

## Step 1: Create GitHub Repository

1. **Go to:** https://github.com/new
2. **Repository name:** `warehouse-backend` (or any name you prefer)
3. **Description:** "Express backend for warehouse management system"
4. **Visibility:** Choose "Private" or "Public" (your choice)
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. **Click:** "Create repository"

## Step 2: Push Your Code to GitHub

After creating the repository, GitHub will show you commands. **IGNORE THOSE** and use these instead:

```bash
cd /workspace/shadcn-ui/server
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/warehouse-backend.git
git commit -m "Initial commit - Express backend for warehouse management"
git push -u origin main
```

**IMPORTANT:** Replace `YOUR_USERNAME` with your actual GitHub username!

**Example:** If your GitHub username is "johnsmith", the command would be:
```bash
git remote add origin https://github.com/johnsmith/warehouse-backend.git
```

## Step 3: Connect Railway to GitHub

1. **Go back to Railway:** https://railway.app
2. **Click:** "New Project"
3. **Select:** "Deploy from GitHub repo"
4. **You should now see:** `warehouse-backend` in the list
5. **Select it** and continue with deployment

## Step 4: Configure Railway Settings

After selecting the repo:
1. **Root Directory:** Set to `server` (or leave as `/` since we're deploying the server folder)
2. **Build Command:** `npm install` (auto-detected)
3. **Start Command:** `node index.js` (auto-detected)
4. **Click:** "Deploy"

## Step 5: Get Your Railway URL

1. Wait 2-3 minutes for deployment
2. Go to "Settings" tab
3. Under "Domains", click "Generate Domain"
4. Copy the URL (e.g., `https://warehouse-backend-production-xxxx.up.railway.app`)
5. **Reply with this URL to Alex**

---

## Current Status

✅ Git repository initialized
✅ .gitignore created
✅ Files staged for commit
⏳ Waiting for you to create GitHub repo and push code

**Next Step:** Go to https://github.com/new and follow Step 1 above!