# Warehouse Management Backend API

Backend server for handling Smartsheet and Extensiv API connections.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will run on `http://localhost:3001`

## API Endpoints

### Health Check
- `GET /health` - Check if server is running

### Smartsheet Endpoints
- `POST /api/smartsheet/test-connection` - Test Smartsheet connection
- `POST /api/smartsheet/auto-detect-columns` - Auto-detect column mappings
- `POST /api/smartsheet/fetch-deliveries` - Fetch all deliveries from Smartsheet
- `POST /api/smartsheet/update-status` - Update delivery status in Smartsheet
- `POST /api/smartsheet/add-delivery` - Add new delivery to Smartsheet

### Extensiv Endpoints
- `POST /api/extensiv/test-connection` - Test Extensiv connection
- `POST /api/extensiv/fetch-items` - Fetch items from Extensiv
- `POST /api/extensiv/send-receiving` - Send receiving transaction to Extensiv

## Request Examples

### Test Smartsheet Connection
```bash
curl -X POST http://localhost:3001/api/smartsheet/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "apiToken": "your_token",
    "sheetId": "your_sheet_id"
  }'
```

### Fetch Deliveries
```bash
curl -X POST http://localhost:3001/api/smartsheet/fetch-deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "apiToken": "your_token",
    "sheetId": "your_sheet_id",
    "columnMappings": {
      "containerNumber": "Container Number",
      "customerName": "Customer",
      "poNumber": "PO Number",
      "door": "Door",
      "expectedDate": "Expected Date",
      "carrier": "Carrier",
      "trackingNumber": "Tracking Number",
      "status": "Status",
      "notes": "Notes"
    }
  }'
```

## Deployment

### Heroku
```bash
heroku create your-app-name
git push heroku main
heroku config:set FRONTEND_URL=https://your-frontend-url.com
```

### AWS/DigitalOcean
1. Set up a Node.js server
2. Clone the repository
3. Install dependencies: `npm install`
4. Set environment variables
5. Run with PM2: `pm2 start index.js`

### Vercel (Serverless)
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts

## Security Notes

- Never commit `.env` file
- Use environment variables for sensitive data
- Enable CORS only for your frontend domain in production
- Consider rate limiting for production use
- Use HTTPS in production# Test redeploy Mon Jan 26 21:50:32 PST 2026
# Redeploy test Mon Jan 26 22:02:28 PST 2026
# Test credential persistence
