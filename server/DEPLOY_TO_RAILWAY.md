# Deploy Updated Backend to Railway

## What Changed
Added explicit OPTIONS handler for CORS preflight requests in `server/index.js`:
```javascript
// Handle preflight requests explicitly
app.options('*', cors());
```

This ensures browsers can successfully complete preflight checks before making POST requests.

## Deployment Steps

### Option 1: Push to GitHub (Recommended - Auto-deploys)

1. **Navigate to server directory:**
   ```bash
   cd /workspace/shadcn-ui/server
   ```

2. **Check current status:**
   ```bash
   git status
   ```

3. **Add the updated file:**
   ```bash
   git add index.js
   ```

4. **Commit the change:**
   ```bash
   git commit -m "Add explicit OPTIONS handler for CORS preflight requests"
   ```

5. **Push to GitHub:**
   ```bash
   git push origin main
   ```

6. **Railway will auto-deploy** (takes ~2-3 minutes)
   - Go to: https://railway.app/dashboard
   - Watch the deployment logs
   - Wait for "Deployed" status

7. **Verify deployment:**
   ```bash
   curl -I https://warehouse-backend-production-4200.up.railway.app/health
   ```
   Should return HTTP 200 with CORS headers

### Option 2: Manual Railway CLI Deploy

If you have Railway CLI installed:

1. **Login to Railway:**
   ```bash
   railway login
   ```

2. **Link to your project:**
   ```bash
   cd /workspace/shadcn-ui/server
   railway link
   ```

3. **Deploy:**
   ```bash
   railway up
   ```

### Option 3: Railway Dashboard Upload

1. Go to https://railway.app/dashboard
2. Select your `warehouse-backend` project
3. Click "Settings" → "Deploy"
4. Upload the updated `server/index.js` file
5. Railway will rebuild and deploy

## After Deployment

### Test the Updated Backend

1. **Test health endpoint:**
   ```bash
   curl -I https://warehouse-backend-production-4200.up.railway.app/health
   ```

2. **Test OPTIONS preflight:**
   ```bash
   curl -X OPTIONS https://warehouse-backend-production-4200.up.railway.app/api/smartsheet/fetch-deliveries -H "Origin: https://example.com" -v
   ```
   Should return HTTP 204 or 200 with CORS headers

3. **Test actual sync:**
   ```bash
   curl -X POST https://warehouse-backend-production-4200.up.railway.app/api/smartsheet/fetch-deliveries \
     -H "Content-Type: application/json" \
     -d '{
       "apiToken": "q9MgMjegggjqp24oi9sfaLVqJjnMFOMevnnqv",
       "sheetId": "8551818792488836",
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
     }'
   ```
   Should return JSON with 32 deliveries

### Test in App Viewer

1. **Clear browser cache** in App Viewer
2. **Open browser console** (F12)
3. **Click "Sync from Smartsheet"** button
4. **Check console** for any errors

### Alternative: Test with Local HTML File

Open `/workspace/shadcn-ui/test_browser_sync.html` in your browser to see detailed test results and exact error messages.

## Troubleshooting

### If deployment fails:
1. Check Railway logs for errors
2. Verify `package.json` has correct start script
3. Ensure `railway.json` is properly configured

### If sync still fails after deployment:
1. Open `test_browser_sync.html` in browser
2. Check browser console (F12) → Network tab
3. Look for failed OPTIONS or POST requests
4. Verify CORS headers in response

### Common Issues:

**"Failed to fetch" persists:**
- App Viewer might have firewall rules blocking Railway URLs
- Try testing in a regular browser first
- Check if App Viewer requires backend to be on same domain

**OPTIONS request returns 404:**
- Deployment didn't complete - wait 2-3 minutes
- Check Railway logs for startup errors

**CORS headers missing:**
- Clear Railway cache: Settings → Restart
- Verify code was actually deployed (check Railway commit hash)

## Verification Checklist

- [ ] Code pushed to GitHub
- [ ] Railway deployment completed (green checkmark)
- [ ] Health endpoint returns 200
- [ ] OPTIONS request returns CORS headers
- [ ] POST request returns 32 deliveries
- [ ] Browser test file shows success
- [ ] App Viewer sync works

## Need Help?

If sync still fails after deployment:
1. Share Railway deployment logs
2. Share browser console errors from `test_browser_sync.html`
3. Share Network tab screenshot showing failed request