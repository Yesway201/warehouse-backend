# Backend Deployment Ready

## Changes Made:
1. Added `emails` JSONB column to customers table
2. Added `reference_prefix` VARCHAR column to customers table  
3. Added `reference_counter` INTEGER column to customers table
4. Updated GET /api/customers endpoint to return email fields
5. Updated POST /api/customers/sync endpoint to save email fields

## Migration File:
- `/workspace/warehouse-atoms/migrations/002_add_customer_fields.sql`

## Updated Files:
- `/workspace/warehouse-atoms/routes/customers.js`
- `/workspace/warehouse-atoms/migrations/002_add_customer_fields.sql`

## Deployment Instructions:
The backend code is ready. To deploy to Railway:

1. Push these changes to your GitHub repository connected to Railway
2. Railway will automatically detect changes and deploy
3. The migration will run automatically on server startup (via index.js)

## Manual Deployment Alternative:
If you have Railway CLI installed:
```bash
cd /workspace/warehouse-atoms
railway up
```

## What Will Happen:
- Railway will rebuild the backend
- Migrations will run automatically (002_add_customer_fields.sql)
- Customer emails will persist in PostgreSQL database
- No data loss - existing customers remain intact

## Test After Deployment:
1. Add email to a customer
2. Click "Update Customer"
3. Navigate away from Customers tab
4. Return to Customers tab
5. Email should still be there ✓
