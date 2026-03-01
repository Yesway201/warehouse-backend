// Paste this in browser console to debug
const sessions = JSON.parse(localStorage.getItem('receivingSessions') || '[]');
console.log('=== REVIEW QUEUE DEBUG ===');
console.log('Total sessions in localStorage:', sessions.length);

sessions.forEach((s, idx) => {
  console.log(`\nSession ${idx + 1}:`, {
    id: s.id,
    status: s.status,
    syncedToExtensiv: s.syncedToExtensiv,
    customer: s.customerName,
    container: s.containerNumber,
    completedAt: s.completedAt
  });
});

// Check what ReviewQueue should show
const pendingReview = sessions.filter(s => s.status === 'pending-review' && !s.syncedToExtensiv);
const approved = sessions.filter(s => s.status === 'approved' && !s.syncedToExtensiv);

console.log('\n=== SHOULD APPEAR IN REVIEW QUEUE ===');
console.log('Pending Review:', pendingReview.length);
console.log('Approved (Ready to Sync):', approved.length);
console.log('Total that should show:', pendingReview.length + approved.length);

// Check the badge count
const badgeCount = pendingReview.length + approved.length;
console.log('\n=== BADGE COUNT ===');
console.log('Expected badge count:', badgeCount);
