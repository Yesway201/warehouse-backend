# 🔒 SMARTSHEET CONFIGURATION - LOCKED AND STABLE

**Version:** smartsheet-incoming-stable-2026-01-20  
**Status:** ✅ CONFIRMED WORKING - DO NOT MODIFY  
**Locked Date:** 2026-01-20  
**Git Tag:** `smartsheet-incoming-stable-2026-01-20`

---

## ⚠️ CRITICAL - DO NOT MODIFY

This configuration is **LOCKED** and **CONFIRMED WORKING**. Any modifications may break the working Smartsheet integration.

### Confirmed Working State

- ✅ **Smartsheet credentials persist correctly** across Railway deployments
- ✅ **Incoming Deliveries sync returns 34 valid rows** (filtered from 396 total)
- ✅ **Filtering logic is correct** (Customer Name → PO/Container → Done → Status)
- ✅ **Railway deployment is live** at `warehouse-backend-production-4200.up.railway.app`
- ✅ **API Version:** `incoming-filter-v2-2026-01-20`
- ✅ **Storage:** Railway Volume at `/data` for persistent credentials

---

## 🔐 Locked Components

### 1. Smartsheet Credentials (DO NOT RESET)
- **API Token:** Stored in Railway Volume `/data/storage/smartsheetSettings.json`
- **Sheet ID:** Locked and persisted
- **Mappings:** Configured and working
- **⚠️ WARNING:** Do NOT call `DELETE /api/smartsheet/settings` or modify credentials

### 2. Filtering Logic (DO NOT MODIFY)
**File:** `server/routes/smartsheet.js`
- Exact column matching: "Customer Name", "PO # / Container #", "Status", "Done"
- Filtering order: Customer Name → PO/Container → Done → Status
- Status handling: Blank → "Expected" OR ["Arrived", "Dropped", "Unloaded", "Checked In"]
- Result: 34 included deliveries from 396 total rows

### 3. Storage Configuration (DO NOT MODIFY)
**File:** `server/lib/settingsStore.js`
- Uses Railway Volume: `/data/storage/smartsheetSettings.json`
- Falls back to local storage in development
- Credentials persist across deployments

### 4. Railway Configuration (DO NOT MODIFY)
**File:** `railway.json`
- Volume mount: `/data` → `smartsheet-storage`
- Build command: `cd server && npm install`
- Start command: `cd server && npm start`

---

## 📊 Confirmed Sync Results

**Last Verified:** 2026-01-20

```json
{
  "success": true,
  "message": "Synced 34 deliveries",
  "apiVersion": "incoming-filter-v2-2026-01-20",
  "diagnostics": {
    "totalRows": 396,
    "includedRows": 34,
    "skippedRows": 362,
    "skipReasonsCount": {
      "skipped_missing_customer": "...",
      "skipped_missing_poContainer": "...",
      "skipped_done": "...",
      "skipped_status_not_allowed": "..."
    }
  }
}
```

---

## 🚫 Protected Files

The following files are **LOCKED** and must NOT be modified without explicit approval:

1. `server/routes/smartsheet.js` - Sync and filtering logic
2. `server/lib/settingsStore.js` - Credential storage
3. `server/storage/smartsheetSettings.json` - Credentials (in Railway Volume)
4. `railway.json` - Volume configuration
5. `server/index.js` - Version endpoint

---

## 🔄 Rollback Instructions

If any issues occur, rollback to this stable version:

```bash
# Checkout the locked tag
git checkout smartsheet-incoming-stable-2026-01-20

# Force push to main (if needed)
git push origin smartsheet-incoming-stable-2026-01-20:main --force

# Redeploy on Railway
# Railway will auto-deploy from the main branch
```

---

## 📝 Change Log

### Version: smartsheet-incoming-stable-2026-01-20
- ✅ Implemented Railway Volume persistence for credentials
- ✅ Fixed filtering logic with exact column matching
- ✅ Added version tracking endpoint `/api/version`
- ✅ Confirmed 34 valid deliveries from 396 total rows
- ✅ Deployed and verified on Railway

---

## ⚠️ Before Making Any Changes

1. **Create a new git branch** (never modify main directly)
2. **Test thoroughly** in a separate Railway environment
3. **Verify sync results** match expected output
4. **Document all changes** in this file
5. **Get explicit approval** before merging to main

---

**Last Updated:** 2026-01-20  
**Locked By:** Alex (Engineer)  
**Verification Status:** ✅ CONFIRMED WORKING