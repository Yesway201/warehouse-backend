# Warehouse Management System - Project State Backup
**Backup Date:** January 23, 2026
**Version:** Current Working State (Updated with Backend Credential Storage)

---

## 🔐 CREDENTIALS & CONFIGURATION

### Smartsheet Configuration
**Status:** ✅ Configured in Frontend (DataContext.tsx)

```json
{
  "apiToken": "q9MgMjegggjqp24oi9sfaLVqJjnMFOMevnnqv",
  "sheetId": "8551818792488836",
  "autoSync": false,
  "syncInterval": 15,
  "columnMappings": {
    "containerNumber": "PO # / Container #",
    "customerName": "Customer Name",
    "poNumber": "PO # / Container #",
    "door": "Door #",
    "expectedDate": "Date",
    "carrier": "Carrier",
    "status": "Status",
    "notes": "Additional Information",
    "trackingNumber": "3PL # ",
    "done": "Done"
  }
}
```

**Storage Location:** 
- Frontend: `localStorage` (key: `apiConfig`)
- Backend: `/workspace/shadcn-ui/server/storage/smartsheetSettings.json`
- Railway Volume: `/data/storage/smartsheetSettings.json` (when deployed)

### Extensiv Configuration
**Status:** ✅ **NOW USES BACKEND STORAGE** (Updated Architecture)

**Storage Location:**
- **Backend (Primary):** `/workspace/shadcn-ui/server/storage/extensivSettings.json`
- **Railway Volume:** `/data/storage/extensivSettings.json` (when deployed)
- **Frontend (Legacy):** localStorage migration on first load

**Backend API Endpoints:**
- `GET /api/extensiv-settings` - Load credentials
- `POST /api/extensiv-settings` - Save credentials
- `DELETE /api/extensiv-settings` - Clear credentials
- `GET /api/extensiv-settings/status` - Get storage status

**Security Features:**
- Client Secret encrypted with AES-256-CBC before storage
- Automatic migration from localStorage to backend on first load
- Credentials persist across browser sessions and deployments
- Masked display of sensitive data in API responses

**Configuration Structure:**
```json
{
  "clientId": "your-client-id",
  "clientSecret": "encrypted-value",
  "userLoginId": "your-user-login",
  "facilityId": "your-facility-id",
  "lastUpdated": "2026-01-23T10:00:00.000Z"
}
```

---

## 📊 DATA STORAGE LOCATIONS

### Frontend Data (localStorage)
All data is stored in browser localStorage with the following keys:

1. **apiConfig** - API credentials and settings (Smartsheet)
2. **deliveries** - Incoming deliveries data
3. **items** - Item master data per customer
4. **receivingSessions** - Receiving history records
5. **customers** - Customer database
6. **slipRequests** - Slip request records
7. **asns** - Advanced Shipping Notice records
8. **syncLogs** - Synchronization history logs
9. ~~**warehouse_extensiv_credentials**~~ - **DEPRECATED** (migrated to backend)

### Backend Data (Server-side)
- **Smartsheet Settings:** `/workspace/shadcn-ui/server/storage/smartsheetSettings.json`
- **Extensiv Settings:** `/workspace/shadcn-ui/server/storage/extensivSettings.json` ✨ **NEW**
- **Railway Volume:** `/data/storage/` (when deployed on Railway)

---

## 🏗️ PROJECT STRUCTURE

### Key Directories
```
shadcn-ui/
├── src/
│   ├── components/          # UI components
│   ├── contexts/            # State management (AuthContext, DataContext)
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # Application pages
│   ├── services/            # API service layers
│   │   ├── extensivService.ts
│   │   └── smartsheetService.ts
│   └── types/               # TypeScript type definitions
│   └── lib/
│       ├── credentialStorage.ts  # ✨ UPDATED: Backend API integration
│       ├── extensivApi.ts
│       └── smartsheetApi.ts
├── server/
│   ├── index.js             # Express server entry point (✨ UPDATED)
│   ├── routes/              # API route handlers
│   │   ├── extensiv.js      # Extensiv API integration
│   │   ├── smartsheet.js    # Smartsheet API integration
│   │   └── extensivSettings.js  # ✨ NEW: Extensiv credentials API
│   ├── lib/
│   │   ├── settingsStore.js # Smartsheet settings storage
│   │   └── extensivSettingsStore.js  # ✨ NEW: Extensiv settings storage
│   └── storage/             # Server-side data storage
│       ├── smartsheetSettings.json
│       └── extensivSettings.json  # ✨ NEW
└── public/                  # Static assets
```

---

## 🔌 API ENDPOINTS

### Smartsheet Endpoints (via `/api/smartsheet/`)
1. **POST /test-connection** - Test Smartsheet API connection
2. **POST /auto-detect-columns** - Auto-detect column mappings
3. **POST /fetch-deliveries** - Fetch deliveries from Smartsheet
4. **POST /update-status** - Update delivery status in Smartsheet
5. **POST /add-delivery** - Add new delivery to Smartsheet

### Extensiv Endpoints (via `/api/extensiv/`)
1. **POST /test-connection** - Test Extensiv API connection
2. **POST /sync-items** - Sync items from Extensiv with pagination

### ✨ NEW: Extensiv Settings Endpoints (via `/api/extensiv-settings`)
1. **GET /** - Load saved credentials
2. **POST /** - Save credentials (with encryption)
3. **DELETE /** - Clear saved credentials
4. **GET /status** - Get storage configuration status

### Items Endpoints (via `/api/items/`)
- Item database management endpoints (backend managed)

---

## 🎯 CURRENT FEATURES STATUS

### ✅ Implemented Features
- [x] Authentication & Role Management
- [x] Dashboard with metrics overview
- [x] Customer Management (CRUD operations)
- [x] Item Database per Customer
- [x] Incoming Deliveries interface with filtering
- [x] Searchable SKU dropdown
- [x] Receive Page (ASN, Quick Receive, New Receipt modes)
- [x] Receiving History & Audit Trail
- [x] Sync History viewer
- [x] Settings & API Configuration
- [x] Smartsheet Integration
  - Connection testing
  - Auto-detect columns
  - Fetch deliveries
  - Update delivery status
  - Add new deliveries
- [x] ✨ **Extensiv Backend Credential Storage**
  - Persistent server-side storage
  - AES-256 encryption for client_secret
  - Automatic localStorage migration
  - Railway volume support
- [x] Debug endpoint for route listing
- [x] Fetch Columns feature
- [x] Sync Deliveries logic

### ⏳ Pending Features
- [ ] Automated sync scheduling
- [ ] Advanced reporting
- [ ] Export functionality enhancements

---

## 🚀 DEPLOYMENT CONFIGURATION

### Railway Deployment
**Configuration File:** `railway.json`

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Volume Setup:** 
- Mount path: `/data/storage`
- Purpose: Persistent storage for Smartsheet AND Extensiv credentials
- Documentation: `RAILWAY_VOLUME_SETUP.md`

### Environment Variables
**Optional (for enhanced security):**
- `EXTENSIV_ENCRYPTION_KEY` - Custom encryption key for client_secret (defaults to built-in key)

---

## 📝 IMPORTANT NOTES

### ✨ NEW: Credential Storage Architecture

**Both Smartsheet and Extensiv now use the same backend storage pattern:**

1. **Backend Storage:**
   - Credentials stored server-side in JSON files
   - Persist across server restarts with Railway volume
   - Encrypted sensitive data (client_secret)
   - Accessible via REST API

2. **Automatic Migration:**
   - Extensiv: localStorage credentials automatically migrated to backend on first load
   - Legacy localStorage cleared after successful migration
   - No user action required

3. **Security:**
   - Client secrets encrypted with AES-256-CBC
   - Masked display in API responses
   - HTTPS encryption in transit

### Data Persistence
1. **Frontend Data:** Stored in browser localStorage - will persist across page refreshes but is browser-specific
2. **Backend Data:** Stored in server-side JSON files - persists across server restarts when using Railway volume
3. **Backup Strategy:** Export data regularly using the application's export features

### Security Considerations
1. Extensiv client_secret is encrypted before storage using AES-256-CBC
2. API tokens transmitted securely via HTTPS
3. All API calls are proxied through the backend to avoid CORS issues
4. Credentials persist across deployments when using Railway volume

### Migration Path
- If moving to a new deployment:
  1. Ensure Railway volume is properly configured
  2. Credentials will automatically be available from backend storage
  3. No need to re-enter credentials if volume is preserved

---

## 🔄 HOW TO RESTORE THIS STATE

### Option 1: Continue in Current Environment
- All data is already in place
- Smartsheet credentials are configured
- Extensiv credentials use backend storage
- Simply continue working

### Option 2: Fresh Start with Same Configuration
1. Deploy the application to a new environment
2. Configure Railway volume for `/data/storage`
3. **Smartsheet:**
   - Open Settings page
   - Enter Smartsheet credentials
   - Click "Test Connection" to verify
4. **Extensiv:**
   - Open Extensiv settings
   - Enter credentials (clientId, clientSecret, userLoginId, facilityId)
   - Credentials automatically saved to backend
   - Persist across browser sessions

### Option 3: Remix to This Version
- Use the Atoms "Remix" feature to create a branch from this exact state
- All code, configurations, and backend storage will be preserved

---

## 📞 SUPPORT RESOURCES

### Documentation Files
- `README.md` - Project overview and setup
- `ATOMS_BACKEND_INTERNAL.md` - Backend API documentation
- `RAILWAY_VOLUME_SETUP.md` - Railway volume configuration
- `SMARTSHEET_BASELINE.md` - Smartsheet integration guide
- `DEPLOY_TO_RAILWAY.md` - Deployment instructions

### Key Dependencies
- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js, Express, crypto (for encryption)
- **APIs:** Smartsheet SDK, Extensiv 3PL Central API

---

## ✅ BACKUP VERIFICATION CHECKLIST

- [x] Smartsheet API Token documented
- [x] Smartsheet Sheet ID documented
- [x] Column mappings documented
- [x] ✨ Extensiv backend storage implemented
- [x] ✨ Extensiv credential encryption implemented
- [x] ✨ Automatic localStorage migration implemented
- [x] Project structure documented
- [x] API endpoints documented
- [x] Storage locations documented
- [x] Deployment configuration documented
- [x] Restore instructions provided

---

## ✨ CHANGELOG - Backend Credential Storage Update

**Date:** January 23, 2026

**Changes:**
1. Created `server/lib/extensivSettingsStore.js` - Backend storage module with encryption
2. Created `server/routes/extensivSettings.js` - REST API for credential management
3. Updated `server/index.js` - Registered new API routes
4. Updated `src/lib/credentialStorage.ts` - Migrated from localStorage to backend API
5. Created `server/storage/extensivSettings.json` - Initial storage file
6. Implemented AES-256-CBC encryption for client_secret
7. Implemented automatic localStorage migration
8. Added Railway volume support for persistent storage

**Benefits:**
- ✅ Credentials persist across browser sessions
- ✅ Credentials persist across deployments (with Railway volume)
- ✅ Enhanced security with server-side encryption
- ✅ Consistent architecture with Smartsheet credentials
- ✅ No user-facing changes - automatic migration

---

**This backup document ensures you can restore or recreate this exact working state at any time.**