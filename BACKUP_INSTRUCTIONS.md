# WMS System - Complete Backup & Restore Guide
**Created:** 2026-01-23
**Version:** Current Working State

---

## Quick Backup Checklist

✅ **What's Already Safe:**
- All source code (tracked in Git if repository exists)
- Project structure and configuration files
- SQL schema definitions

⚠️ **What Needs Manual Backup:**
- Extensiv API credentials (if configured)
- Smartsheet API credentials (if configured)
- Any runtime database files (*.db, *.sqlite)
- Any custom environment variables

---

## Current Project State

### 1. Credentials Storage
**Smartsheet:**
- Location: `server/storage/smartsheetSettings.json`
- Current Status: Empty (no credentials saved)
- Format: JSON with apiToken, sheetId, mappings

**Extensiv:**
- Storage Method: Passed from frontend (no backend storage)
- Current Status: Not stored on server
- Note: Users provide credentials per session

### 2. Database Status
**SQL Schema Files Found:**
- `server/sql/create_credentials_table.sql` - Schema for credentials table
- `server/sql/create_items_table.sql` - Schema for items table

**Database Files:**
- No .db or .sqlite files found in project
- Database may be in-memory or not yet created
- If using SQLite, file would typically be in `server/` or `server/sql/`

### 3. Environment Files
- No `.env` files found (only `.env.example` templates)
- Configuration is minimal by design
- Credentials handled via frontend → backend API calls

---

## How to Create a Complete Backup

### Option 1: Git Commit (Recommended for Code)
```bash
cd /workspace/shadcn-ui
git add .
git commit -m "Backup: WMS system state as of 2026-01-23"
git tag backup-2026-01-23
```

### Option 2: Create Archive (For Full Backup)
```bash
cd /workspace/shadcn-ui
tar -czf ../wms-backup-2026-01-23.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  --exclude=build \
  --exclude=.vite \
  .

# Verify archive was created
ls -lh ../wms-backup-2026-01-23.tar.gz
```

### Option 3: Copy Entire Directory
```bash
cp -r /workspace/shadcn-ui /workspace/shadcn-ui-backup-2026-01-23
```

---

## What to Backup Manually (If Configured)

### 1. Extensiv API Credentials
If you've configured Extensiv API access, save:
- API Key
- API URL (usually: https://secure-wms.com/AuthenticatedAPI.svc)
- Customer ID or Facility ID (if applicable)

**Where to save:** Keep in a secure password manager or encrypted file

### 2. Smartsheet Credentials
If you've configured Smartsheet integration, save:
- API Token
- Sheet ID
- Column mappings

**Current file to backup:** `server/storage/smartsheetSettings.json`

### 3. Customer Data
If you've entered customer information:
- Export from application UI (if available)
- Or backup database file directly

### 4. Environment Variables
If you created `.env` files:
```bash
# Backup frontend .env
cp .env .env.backup

# Backup backend .env
cp server/.env server/.env.backup
```

---

## How to Restore from Backup

### From Git Tag:
```bash
cd /workspace/shadcn-ui
git checkout backup-2026-01-23
```

### From Archive:
```bash
cd /workspace
tar -xzf wms-backup-2026-01-23.tar.gz -C shadcn-ui-restored
cd shadcn-ui-restored
pnpm install
cd server && npm install
```

### From Directory Copy:
```bash
cd /workspace/shadcn-ui-backup-2026-01-23
pnpm install
cd server && npm install
```

### Restore Credentials:
1. Copy `smartsheetSettings.json` to `server/storage/`
2. Create `.env` files if needed
3. Re-enter Extensiv credentials in the application

### Start Application:
```bash
# Terminal 1: Backend
cd server
npm start

# Terminal 2: Frontend  
pnpm run dev
```

---

## Version Control with Git

### Create a New Branch for Safety:
```bash
git checkout -b backup-branch-2026-01-23
git add .
git commit -m "Safe backup point before changes"
git checkout main  # Return to main branch
```

### To Return to This Version Later:
```bash
git checkout backup-branch-2026-01-23
```

---

## Railway Deployment Backup

If deployed to Railway:

### 1. Backup Railway Volume Data:
```bash
# SSH into Railway container
railway shell

# Create backup of volume data
tar -czf /tmp/volume-backup.tar.gz /data/storage

# Download to local machine
railway run --service <service-name> cat /tmp/volume-backup.tar.gz > volume-backup.tar.gz
```

### 2. Backup Environment Variables:
- Go to Railway dashboard
- Navigate to your service → Variables
- Copy all environment variables to a secure location

---

## Important Security Notes

⚠️ **NEVER commit these to Git:**
- `.env` files with real credentials
- `smartsheetSettings.json` with real API tokens
- Database files with customer data
- Any file containing API keys or passwords

✅ **Safe to commit:**
- `.env.example` files (templates only)
- Source code
- Configuration files without secrets
- SQL schema files

---

## Backup Verification Checklist

Before making major changes, verify you have:
- [ ] Source code backed up (Git commit or archive)
- [ ] Extensiv credentials saved securely
- [ ] Smartsheet credentials saved (if configured)
- [ ] Customer data exported (if any exists)
- [ ] Environment variables documented
- [ ] Database files backed up (if any exist)
- [ ] Tested restoration process works

---

## Emergency Recovery

If something goes wrong:

1. **Stop all services** (Ctrl+C in terminals)
2. **Restore from backup** using one of the methods above
3. **Verify credentials** are correctly restored
4. **Test application** before continuing work
5. **Check data integrity** if database was restored

---

## Questions to Answer Before Proceeding

To ensure complete backup:

1. **Have you configured Extensiv API?**
   - If yes: Save API key and URL securely
   - If no: Nothing to backup

2. **Have you configured Smartsheet?**
   - If yes: Backup `server/storage/smartsheetSettings.json`
   - If no: File is empty (already documented)

3. **Have you entered customer data?**
   - If yes: Export data or backup database file
   - If no: No data to backup

4. **Are you using a database?**
   - If yes: Find and backup .db file
   - If no: Only schema files exist (already in Git)

---

**Next Steps:**
1. Answer the questions above
2. Choose a backup method (Git tag recommended)
3. Execute the backup
4. Verify backup was created successfully
5. Document what was backed up
6. Proceed with confidence!