// Run this in browser console to check localStorage data
const sessions = JSON.parse(localStorage.getItem('receivingSessions') || '[]');
console.log('=== RECEIVING SESSIONS DEBUG ===');
console.log('Total sessions:', sessions.length);
sessions.forEach((session, idx) => {
  console.log(`\nSession ${idx + 1}:`, {
    id: session.id,
    status: session.status,
    customer: session.customerName,
    container: session.containerNumber,
    completedAt: session.completedAt,
    syncedToExtensiv: session.syncedToExtensiv,
    itemCount: session.items?.length
  });
});

// Check for the specific filtering conditions
const pendingReview = sessions.filter(s => s.status === 'pending-review');
console.log('\n=== PENDING REVIEW SESSIONS ===');
console.log('Count:', pendingReview.length);
pendingReview.forEach(s => console.log('- ', s.customerName, s.status));

const approved = sessions.filter(s => s.status === 'approved' && !s.syncedToExtensiv);
console.log('\n=== APPROVED (NOT SYNCED) SESSIONS ===');
console.log('Count:', approved.length);

console.log('\n=== ALL STATUSES ===');
const statuses = [...new Set(sessions.map(s => s.status))];
console.log('Unique statuses found:', statuses);
