// Check localStorage data structure
console.log('=== Checking Data Structure ===\n');

// Check if we can access browser localStorage simulation
try {
  const customers = JSON.parse(localStorage.getItem('customers') || '[]');
  console.log('Customers in localStorage:', customers.length);
  if (customers.length > 0) {
    console.log('Sample customer:', JSON.stringify(customers[0], null, 2));
  }
  
  const deliveries = JSON.parse(localStorage.getItem('deliveries') || '[]');
  console.log('\nDeliveries in localStorage:', deliveries.length);
  if (deliveries.length > 0) {
    console.log('Sample delivery:', JSON.stringify(deliveries[0], null, 2));
  }
} catch (e) {
  console.log('Cannot access localStorage in Node.js context');
  console.log('This is expected - localStorage is browser-only');
}
