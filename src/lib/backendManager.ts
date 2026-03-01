// Backend Manager wrapper for Atoms Backend operations
// This provides a clean interface to interact with Atoms Backend database

interface QueryResult {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}

export class BackendManager {
  async executeQuery(sql: string, sessionId: string): Promise<QueryResult> {
    try {
      // In Atoms platform, BackendManager is available globally
      // This is a placeholder that will be replaced with actual Atoms Backend API calls
      
      // For now, we'll use a mock implementation that stores data in localStorage
      // This will be replaced with actual Atoms Backend calls when deployed
      
      console.log('[BackendManager] Executing query:', sql);
      console.log('[BackendManager] Session ID:', sessionId);
      
      // Parse the SQL to determine the operation
      const sqlLower = sql.toLowerCase().trim();
      
      if (sqlLower.startsWith('select')) {
        return this.handleSelect(sql, sessionId);
      } else if (sqlLower.startsWith('insert')) {
        return this.handleInsert(sql, sessionId);
      } else if (sqlLower.startsWith('update')) {
        return this.handleUpdate(sql, sessionId);
      } else if (sqlLower.startsWith('delete')) {
        return this.handleDelete(sql, sessionId);
      }
      
      return { success: false, error: 'Unsupported SQL operation' };
    } catch (error) {
      console.error('[BackendManager] Query execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private handleSelect(sql: string, sessionId: string): QueryResult {
    // Extract table name and conditions from SELECT query
    const tableMatch = sql.match(/from\s+(\w+)/i);
    if (!tableMatch) return { success: false, error: 'Invalid SELECT query' };
    
    const tableName = tableMatch[1];
    const storageKey = `${sessionId}_${tableName}`;
    const dataJson = localStorage.getItem(storageKey);
    const data: Record<string, unknown>[] = dataJson ? JSON.parse(dataJson) : [];
    
    // Apply WHERE clause filtering if present
    const whereMatch = sql.match(/where\s+(.+?)(?:order by|limit|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      // Simple customer_id filter
      const customerMatch = whereClause.match(/customer_id\s*=\s*'([^']+)'/i);
      if (customerMatch) {
        const customerId = customerMatch[1];
        const filtered = data.filter((row: Record<string, unknown>) => row.customer_id === customerId);
        return { success: true, data: filtered };
      }
    }
    
    return { success: true, data };
  }

  private handleInsert(sql: string, sessionId: string): QueryResult {
    // Extract table name and values from INSERT query
    const tableMatch = sql.match(/insert into\s+(\w+)/i);
    if (!tableMatch) return { success: false, error: 'Invalid INSERT query' };
    
    const tableName = tableMatch[1];
    const storageKey = `${sessionId}_${tableName}`;
    
    // Extract column names and values
    const columnsMatch = sql.match(/\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
    if (!columnsMatch) return { success: false, error: 'Invalid INSERT syntax' };
    
    const columns = columnsMatch[1].split(',').map(c => c.trim());
    const values = columnsMatch[2].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
    
    const newRow: Record<string, unknown> = {};
    columns.forEach((col, idx) => {
      newRow[col] = values[idx] === 'NOW()' ? new Date().toISOString() : values[idx];
    });
    
    // Add to storage
    const dataJson = localStorage.getItem(storageKey);
    const data: Record<string, unknown>[] = dataJson ? JSON.parse(dataJson) : [];
    data.push(newRow);
    localStorage.setItem(storageKey, JSON.stringify(data));
    
    return { success: true };
  }

  private handleUpdate(sql: string, sessionId: string): QueryResult {
    // Extract table name from UPDATE query
    const tableMatch = sql.match(/update\s+(\w+)/i);
    if (!tableMatch) return { success: false, error: 'Invalid UPDATE query' };
    
    const tableName = tableMatch[1];
    const storageKey = `${sessionId}_${tableName}`;
    
    const dataJson = localStorage.getItem(storageKey);
    const data: Record<string, unknown>[] = dataJson ? JSON.parse(dataJson) : [];
    
    // Extract SET clause
    const setMatch = sql.match(/set\s+(.+?)\s+where/i);
    if (!setMatch) return { success: false, error: 'Invalid UPDATE syntax' };
    
    const setClause = setMatch[1];
    const updates: Record<string, unknown> = {};
    setClause.split(',').forEach(pair => {
      const [key, value] = pair.split('=').map(s => s.trim());
      updates[key] = value.replace(/^'|'$/g, '');
      if (value === 'NOW()') updates[key] = new Date().toISOString();
    });
    
    // Extract WHERE clause
    const whereMatch = sql.match(/where\s+(.+)$/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      const conditions = whereClause.split('and').map(c => c.trim());
      
      // Apply updates to matching rows
      data.forEach((row: Record<string, unknown>) => {
        let matches = true;
        conditions.forEach(condition => {
          const [key, value] = condition.split('=').map(s => s.trim().replace(/^'|'$/g, ''));
          if (row[key] !== value) matches = false;
        });
        
        if (matches) {
          Object.assign(row, updates);
        }
      });
    }
    
    localStorage.setItem(storageKey, JSON.stringify(data));
    return { success: true };
  }

  private handleDelete(sql: string, sessionId: string): QueryResult {
    // Extract table name from DELETE query
    const tableMatch = sql.match(/delete from\s+(\w+)/i);
    if (!tableMatch) return { success: false, error: 'Invalid DELETE query' };
    
    const tableName = tableMatch[1];
    const storageKey = `${sessionId}_${tableName}`;
    
    const dataJson = localStorage.getItem(storageKey);
    const data: Record<string, unknown>[] = dataJson ? JSON.parse(dataJson) : [];
    
    // Extract WHERE clause
    const whereMatch = sql.match(/where\s+(.+)$/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      const conditions = whereClause.split('and').map(c => c.trim());
      
      // Filter out matching rows
      const filtered = data.filter((row: Record<string, unknown>) => {
        let matches = true;
        conditions.forEach(condition => {
          const [key, value] = condition.split('=').map(s => s.trim().replace(/^'|'$/g, ''));
          if (row[key] !== value) matches = false;
        });
        return !matches;
      });
      
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    }
    
    return { success: true };
  }
}