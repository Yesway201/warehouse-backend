#!/bin/bash
echo "=== Checking dist folder ==="
ls -la dist/ 2>/dev/null || echo "No dist folder"

echo -e "\n=== Checking if dev server is running ==="
curl -s http://localhost:5173/ | head -20

echo -e "\n=== Build info ==="
if [ -f "dist/index.html" ]; then
  echo "Build exists"
  cat dist/index.html | grep -E "(script|link)" | head -5
else
  echo "No build found"
fi
