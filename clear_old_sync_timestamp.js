// This script will be added to the app initialization to clear old cached timestamps
// Add this to src/main.tsx or src/App.tsx

// Clear old cached Smartsheet sync timestamp on app load
// This fixes the "stuck at 9:19" issue by forcing a fresh sync
const oldTimestamp = localStorage.getItem('smartsheet_last_sync');
if (oldTimestamp) {
  const timestampDate = new Date(oldTimestamp);
  const now = new Date();
  
  // If the cached timestamp is more than 1 hour old, clear it
  const hoursDiff = (now.getTime() - timestampDate.getTime()) / (1000 * 60 * 60);
  if (hoursDiff > 1) {
    console.log('[Init] Clearing old Smartsheet sync timestamp:', oldTimestamp);
    localStorage.removeItem('smartsheet_last_sync');
  }
}
