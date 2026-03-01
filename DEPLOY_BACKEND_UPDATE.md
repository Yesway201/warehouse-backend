# Deploy Backend Update to Railway

## What's Missing
The Railway backend is missing the new `/api/extensiv/send-receiving` endpoint that was added to handle receiving transactions.

## Current Routes on Railway
- ✅ `/api/extensiv/test-connection`
- ✅ `/api/extensiv/sync-items`
- ❌ `/api/extensiv/send-receiving` (MISSING - needs deployment)

## Files That Need to Be Deployed
- `server/routes/extensiv.js` (contains the new send-receiving endpoint)

## Deployment Options

### Option 1: Deploy via Railway CLI (Recommended)

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Link to your project**:
   ```bash
   cd /workspace/shadcn-ui/server
   railway link
   ```
   Select your backend project: `warehouse-backend-production-4200`

4. **Deploy the update**:
   ```bash
   railway up
   ```

5. **Verify deployment**:
   ```bash
   curl https://warehouse-backend-production-4200.up.railway.app/api/debug/routes | grep send-receiving
   ```
   You should see: `"/api/extensiv/send-receiving"`

### Option 2: Deploy via Git Push (If connected to GitHub)

1. **Commit the changes**:
   ```bash
   cd /workspace/shadcn-ui/server
   git add routes/extensiv.js
   git commit -m "Add send-receiving endpoint for Extensiv integration"
   git push origin main
   ```

2. **Railway will auto-deploy** (if GitHub integration is set up)

3. **Wait 2-3 minutes** for deployment to complete

4. **Verify**:
   ```bash
   curl https://warehouse-backend-production-4200.up.railway.app/api/debug/routes | grep send-receiving
   ```

### Option 3: Manual Upload via Railway Dashboard

1. Go to https://railway.app/dashboard
2. Select your backend project
3. Go to "Deployments" tab
4. Click "Deploy" → "Upload Files"
5. Upload `server/routes/extensiv.js`
6. Wait for deployment to complete

## After Deployment

Test the endpoint:
```bash
curl -X POST https://warehouse-backend-production-4200.up.railway.app/api/extensiv/send-receiving \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "userLoginId": "your-user-login-id",
    "facilityId": "your-facility-id",
    "receivingSession": {
      "id": "test-123",
      "customerName": "Test Customer",
      "customerId": "12345",
      "containerNumber": "CONT-001",
      "items": []
    }
  }'
```

Expected response (with invalid credentials):
```json
{
  "success": false,
  "error": "Authentication failed (401): ...",
  "step": "token"
}
```

This confirms the endpoint is working (authentication fails as expected with test credentials).

## Troubleshooting

If the route still doesn't appear after deployment:

1. **Check Railway logs**:
   - Go to Railway dashboard → Your backend project → Logs
   - Look for startup errors

2. **Verify the file was deployed**:
   - Check if `routes/extensiv.js` exists in the deployed container

3. **Restart the service**:
   - Railway dashboard → Your backend project → Settings → Restart

4. **Check environment variables**:
   - Ensure all required env vars are set in Railway

## Need Help?

If you're unable to deploy, I can:
1. Provide more detailed step-by-step instructions
2. Help troubleshoot deployment errors
3. Suggest alternative deployment methods