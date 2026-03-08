import { query } from './db.js';

async function checkASNs() {
  try {
    const countResult = await query('SELECT COUNT(*) as total FROM asns');
    console.log('Total ASNs in database:', countResult.rows[0].total);
    
    const asnsResult = await query(`
      SELECT a.id, a.asn_number, a.customer_id, c.name as customer_name, 
             (SELECT COUNT(*) FROM asn_items WHERE asn_id = a.id) as items_count,
             a.created_at
      FROM asns a 
      LEFT JOIN customers c ON a.customer_id = c.id 
      ORDER BY a.created_at DESC 
      LIMIT 10
    `);
    
    console.log('\nRecent ASNs:');
    asnsResult.rows.forEach(row => {
      console.log(`  ID: ${row.id}, ASN#: ${row.asn_number}, Customer: ${row.customer_name || 'N/A'}, Items: ${row.items_count}, Created: ${row.created_at}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Database error:', error.message);
    process.exit(1);
  }
}

checkASNs();
