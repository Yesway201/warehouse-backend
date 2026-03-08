# ⚠️ SMARTSHEET STABLE BASELINE - DO NOT MODIFY

**Status:** ✅ WORKING AND CONNECTED  
**Date Locked:** 2026-01-19  
**Git Tag:** `smartsheet-stable-v1.0`  
**Commit Hash:** `e55bbe6`

---

## 🔒 LOCKED CONFIGURATION

This Smartsheet integration is **STABLE and WORKING**. Any changes to the following components may break the integration.

### Critical Components (DO NOT MODIFY)

1. **Backend Routes:** `server/routes/smartsheet.js`
   - Endpoints: `/settings`, `/test-connection`, `/columns`, `/sync-deliveries`, `/update-delivery`
   - Server-side credential storage via `settingsStore.js`

2. **Settings Store:** `server/lib/settingsStore.js`
   - JSON file storage: `server/storage/smartsheetSettings.json`
   - Token masking function

3. **Server Entry:** `server/index.js`
   - Route mounting: `app.use('/api/smartsheet', smartsheetRoutes)`
   - CORS configuration for App Viewer compatibility

4. **Frontend API Client:** `src/lib/smartsheetApi.ts`
   - API Base URL: `https://warehouse-backend-production-4200.up.railway.app`
   - All requests go through Railway backend (NOT api.atoms.dev)

5. **Frontend Settings UI:** `src/pages/Settings.tsx`
   - Smartsheet tab with credential management
   - Column mapping interface

---

## 🚫 PROHIBITED CHANGES

**DO NOT:**
- Change API endpoint paths or methods
- Modify credential storage mechanism
- Switch to localStorage-only credentials
- Change API base URL back to api.atoms.dev
- Refactor working code "for cleanliness"
- Change environment variable names
- Modify CORS configuration
- Change route mounting order

---

## ✅ WORKING WORKFLOW

1. **Credential Storage:** Server-side (Railway) via `/api/smartsheet/settings`
2. **Connection Test:** POST `/api/smartsheet/test-connection`
3. **Fetch Columns:** GET `/api/smartsheet/columns`
4. **Sync Deliveries:** POST `/api/smartsheet/sync-deliveries`
5. **Update Delivery:** POST `/api/smartsheet/update-delivery`

**All credentials persist through:**
- Browser refresh ✅
- App Viewer reload ✅
- Railway redeploy ✅

---

## 🔄 ROLLBACK PROCEDURE

If Smartsheet integration breaks:

```bash
# 1. Rollback to stable tag
git checkout smartsheet-stable-v1.0

# 2. Force push to Railway (if needed)
git push origin smartsheet-stable-v1.0:main --force

# 3. Verify deployment
curl https://warehouse-backend-production-4200.up.railway.app/api/debug/routes
```

---

## 📋 DEPLOYMENT INFO

**Railway Backend:** `https://warehouse-backend-production-4200.up.railway.app`  
**GitHub Repo:** `github.com/Yesway201/warehouse-backend`  
**Auto-Deploy:** Enabled on `main` branch

**Environment Variables (Railway):**
- `PORT=3001` (auto-set by Railway)
- No Smartsheet credentials in env vars (stored in JSON file)

---

## 🛡️ PROTECTION RULES

1. **Before ANY change to Smartsheet code:**
   - Create a new git branch
   - Test thoroughly in isolation
   - Verify connection still works
   - Get explicit approval before merging

2. **If you must modify:**
   - Document the reason
   - Create a backup tag first
   - Test on a separate Railway instance
   - Have rollback plan ready

3. **Emergency Contact:**
   - Rollback immediately if connection breaks
   - Do NOT attempt fixes without testing
   - Preserve this baseline at all costs

---

## 📝 CHANGE LOG

| Date | Change | Status |
|------|--------|--------|
| 2026-01-19 | Initial stable baseline locked | ✅ WORKING |

---

**⚠️ WARNING:** This integration is mission-critical. Breaking it will disrupt the entire delivery tracking workflow. When in doubt, DO NOT MODIFY.