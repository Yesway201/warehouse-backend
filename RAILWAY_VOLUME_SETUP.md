# Railway Volume Setup Instructions

## ⚠️ REQUIRED: One-Time Railway Volume Configuration

To ensure Smartsheet credentials persist across deployments, you must create a Railway Volume in the Railway Dashboard.

---

## 📋 Steps to Create Railway Volume

1. **Go to Railway Dashboard**
   - Navigate to your project: `warehouse-backend-production-4200`
   - Click on your backend service

2. **Open Variables Tab**
   - Click on the "Variables" tab in the service settings
   - Scroll down to the "Volumes" section

3. **Create New Volume**
   - Click "New Volume" button
   - **Mount Path:** `/data`
   - **Name:** `smartsheet-storage` (optional, can be any name)
   - Click "Add" or "Create"

4. **Redeploy Service**
   - After adding the volume, Railway will prompt you to redeploy
   - Click "Deploy" to restart the service with the volume mounted

---

## ✅ Verification After Volume Creation

After the volume is created and service is redeployed, verify the configuration:

```bash
GET https://warehouse-backend-production-4200.up.railway.app/api/version
```

**Expected Response:**
```json
{
  "apiVersion": "incoming-filter-v2-2026-01-20",
  "backendCommit": "...",
  "storage": {
    "usingRailwayVolume": true,
    "storagePath": "/data/storage/smartsheetSettings.json",
    "fileExists": false,
    "smartsheetConfigured": false
  }
}
```

**Key Indicators:**
- ✅ `usingRailwayVolume: true` - Volume is detected
- ✅ `storagePath: "/data/storage/smartsheetSettings.json"` - Using persistent path
- ⚠️ `fileExists: false` - Normal on first setup (no credentials saved yet)
- ⚠️ `smartsheetConfigured: false` - Normal on first setup

---

## 🔄 One-Time Credential Migration

If you had Smartsheet credentials saved before the volume was created, the backend will automatically migrate them on first boot:

**Migration Process:**
1. Backend checks if `/data/storage/smartsheetSettings.json` exists
2. If NOT, checks if old location `server/storage/smartsheetSettings.json` exists
3. If old file exists, copies it to `/data/storage/smartsheetSettings.json`
4. Logs: `✅ Migration complete: credentials copied to /data/storage/smartsheetSettings.json`

**Check Logs:**
- Go to Railway Dashboard → Your service → "Deployments" tab
- Click on the latest deployment
- Check logs for migration messages

---

## 🎯 After Volume Setup

Once the volume is created and mounted:

1. **Save Smartsheet Credentials (One Time Only):**
   ```bash
   POST https://warehouse-backend-production-4200.up.railway.app/api/smartsheet/settings
   {
     "apiToken": "your-smartsheet-api-token",
     "sheetId": "your-sheet-id",
     "mappings": [...]
   }
   ```

2. **Verify Credentials Saved:**
   ```bash
   GET https://warehouse-backend-production-4200.up.railway.app/api/version
   ```
   
   Should return:
   ```json
   {
     "storage": {
       "usingRailwayVolume": true,
       "fileExists": true,
       "smartsheetConfigured": true
     }
   }
   ```

3. **Test Sync:**
   ```bash
   POST https://warehouse-backend-production-4200.up.railway.app/api/smartsheet/sync-deliveries
   ```
   
   Should return 34 deliveries (not "credentials not configured" error)

4. **Redeploy to Confirm Persistence:**
   - Make any small change to the code (e.g., add a comment)
   - Push to GitHub to trigger Railway deployment
   - After deployment, call `/api/version` again
   - Verify `smartsheetConfigured: true` (credentials persisted!)

---

## 🚨 Troubleshooting

**Issue: `usingRailwayVolume: false` after volume creation**
- Solution: Ensure mount path is exactly `/data` (case-sensitive)
- Redeploy the service after creating the volume

**Issue: `fileExists: false` after saving credentials**
- Solution: Check Railway logs for write errors
- Ensure volume has write permissions

**Issue: Credentials lost after deployment**
- Solution: Verify volume is mounted at `/data` in Railway Dashboard
- Check that `usingRailwayVolume: true` in `/api/version` response

---

## 📝 Summary

**Before Volume Setup:**
- Credentials stored in container filesystem (ephemeral)
- Lost on every deployment

**After Volume Setup:**
- Credentials stored in Railway Volume at `/data/storage/smartsheetSettings.json`
- Persist across all deployments
- Only need to save credentials once

**Volume Configuration:**
- Mount Path: `/data`
- Storage File: `/data/storage/smartsheetSettings.json`
- Auto-migration from old location on first boot