#!/bin/bash

# Kill existing processes
pkill -f "node.*index.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Start backend
cd /workspace/shadcn-ui
node server/index.js > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Check backend health
HEALTH=$(curl -s http://localhost:3001/health)
if [[ $HEALTH == *"ok"* ]]; then
    echo "✅ Backend started successfully on port 3001"
else
    echo "❌ Backend failed to start"
    exit 1
fi

# Start frontend
pnpm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 5

# Get the actual port
PORT=$(grep -oP 'Local:\s+http://localhost:\K\d+' /tmp/frontend.log | head -1)

echo "✅ Frontend started on port $PORT"
echo ""
echo "🔗 Application URL: http://localhost:$PORT"
echo "🔗 Backend API: http://localhost:3001"
echo ""
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
