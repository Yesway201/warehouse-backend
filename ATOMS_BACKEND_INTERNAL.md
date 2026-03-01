# ✅ Atoms Backend - Internal Managed Services

## Architecture

This application uses **ONLY Atoms Backend's internal managed infrastructure**:

- ✅ **NO external Supabase** - All removed
- ✅ **NO Edge Functions deployment** - Not needed
- ✅ **NO external database** - Uses Atoms' internal storage
- ✅ **Serverless API endpoints** - `/api/extensiv/*` routes work automatically
- ✅ **Internal data storage** - localStorage + Atoms managed backend

## How It Works

### Backend API Routes

All backend routes are served by Atoms' internal serverless infrastructure:

```
/api/extensiv/sync-items          → Sync items from Extensiv
/api/extensiv/test-connection     → Test Extensiv OAuth credentials
/api/credentials/save             → Save encrypted credentials
/api/credentials/get              → Retrieve credentials
/api/items/*                      → Item CRUD operations
```

These routes are automatically available in:
- **Preview mode** (App Viewer)
- **Production** (after publish)

### Data Storage

All data is stored using Atoms' internal managed storage:

1. **Items** → `localStorage` key: `warehouse_mgmt_extensiv_items`
2. **Sync Status** → `localStorage` key: `warehouse_mgmt_extensiv_items_sync_status`
3. **Credentials** → Encrypted in `localStorage`: `extensiv_credentials`

### Extensiv Integration

The backend handles all Extensiv API calls:

1. **OAuth Token** - Backend requests token using client credentials
2. **Items Sync** - Backend fetches items with pagination (up to 10 pages, 500 items/page)
3. **Error Handling** - Comprehensive logging and JSON error responses

## Backend Code Location

```
/workspace/shadcn-ui/server/
├── index.js                    # Express server (Atoms managed)
├── routes/
│   ├── extensiv.js            # Extensiv API integration
│   ├── credentials.js         # Credential storage
│   └── items.js               # Item CRUD operations
└── package.json               # Dependencies (no Supabase)
```

## Frontend Configuration

The frontend uses **relative paths** for all API calls:

```typescript
// src/lib/extensivApi.ts
const url = '/api/extensiv/sync-items';  // Relative path - works in preview & production

fetch(url, {
  method: 'POST',
  body: JSON.stringify({ clientId, clientSecret, userLoginId, customerId })
});
```

## No External Setup Required

✅ **No Supabase account needed**  
✅ **No environment variables to configure**  
✅ **No deployment commands to run**  
✅ **Works immediately in App Viewer**  
✅ **Automatically deployed when published**

## Testing the Integration

1. **Open App Viewer** - Backend is already running
2. **Go to Settings** → Extensiv Integration tab
3. **Enter credentials**:
   - Client ID
   - Client Secret
   - User Login ID (e.g., "API Integration")
4. **Click "Test Connection"** - Should succeed if credentials are valid
5. **Go to Item Database** settings
6. **Select a customer** from dropdown
7. **Click "Sync from Extensiv"** - Should fetch items

## Troubleshooting

### "Backend returned non-JSON response" (500 error)

This was caused by Supabase references. Now fixed:
- ✅ All Supabase code removed
- ✅ Backend uses only Atoms internal services
- ✅ Proper error handling with JSON responses

### Check Backend Logs

The backend logs every step with `[Backend]` prefix:
```
[Backend] Handler /api/extensiv/sync-items started at 2026-01-18T...
[Backend] Credentials check: clientId present: true
[Backend] STEP 1: Getting OAuth token...
[Backend] STEP 2: Fetching items from Extensiv...
```

### Verify API Endpoints

Test the health check:
```bash
curl https://your-app-url/api/health
# Should return: {"status":"ok","message":"Backend API server is running"}
```

## Support

If you encounter issues:
1. Check browser console for `[Frontend]` and `[Backend]` logs
2. Verify Extensiv credentials are correct
3. Check Network tab for API request/response details
4. Use "View Error Details" in error toasts to see full diagnostics