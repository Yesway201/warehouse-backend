import { Delivery, SmartsheetConfig } from '@/types';

// Use relative paths for Atoms Backend - NO localhost URLs
export class SmartsheetService {
  private config: SmartsheetConfig;

  constructor(config: SmartsheetConfig) {
    this.config = config;
  }

  async testConnection(): Promise<{ success: boolean; sheetName?: string; error?: string }> {
    try {
      console.log('[SmartsheetService] Testing connection via Atoms Backend (relative path)');
      console.log('[SmartsheetService] API Token length:', this.config.apiToken?.length || 0);
      console.log('[SmartsheetService] Sheet ID:', this.config.sheetId);

      const response = await fetch('/api/smartsheet/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken: this.config.apiToken,
          sheetId: this.config.sheetId,
        }),
      });

      console.log('[SmartsheetService] Response status:', response.status);
      const data = await response.json();
      console.log('[SmartsheetService] Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed');
      }

      return {
        success: true,
        sheetName: data.sheetName,
      };
    } catch (error) {
      console.error('[SmartsheetService] Connection test failed:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Connection test failed';
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage = 'Cannot reach Atoms Backend. Please ensure the backend endpoints are deployed.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async autoDetectColumns(): Promise<{
    columns: Array<{ id: number; title: string; type: string }>;
    suggestedMappings: Record<string, string>;
  }> {
    try {
      console.log('[SmartsheetService] Auto-detecting columns...');
      
      const response = await fetch('/api/smartsheet/auto-detect-columns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken: this.config.apiToken,
          sheetId: this.config.sheetId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to detect columns');
      }

      console.log('[SmartsheetService] Detected columns:', data.columns?.length || 0);
      return {
        columns: data.columns,
        suggestedMappings: data.suggestedMappings,
      };
    } catch (error) {
      console.error('[SmartsheetService] Auto-detect columns failed:', error);
      throw error;
    }
  }

  async fetchDeliveries(): Promise<Delivery[]> {
    try {
      console.log('[SmartsheetService] Fetching deliveries...');
      
      const response = await fetch('/api/smartsheet/fetch-deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken: this.config.apiToken,
          sheetId: this.config.sheetId,
          columnMappings: this.config.columnMappings,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch deliveries');
      }

      console.log('[SmartsheetService] Fetched deliveries:', data.deliveries?.length || 0);
      return data.deliveries;
    } catch (error) {
      console.error('[SmartsheetService] Fetch deliveries failed:', error);
      throw error;
    }
  }

  async updateDeliveryStatus(
    rowId: number,
    status: string,
    completedAt?: string,
    notes?: string
  ): Promise<void> {
    try {
      console.log('[SmartsheetService] Updating delivery status for row:', rowId);
      
      const response = await fetch('/api/smartsheet/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken: this.config.apiToken,
          sheetId: this.config.sheetId,
          rowId,
          columnMappings: this.config.columnMappings,
          status,
          completedAt,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      console.log('[SmartsheetService] Status updated successfully');
    } catch (error) {
      console.error('[SmartsheetService] Update status failed:', error);
      throw error;
    }
  }

  async addDelivery(delivery: Delivery): Promise<number> {
    try {
      console.log('[SmartsheetService] Adding new delivery...');
      
      const response = await fetch('/api/smartsheet/add-delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiToken: this.config.apiToken,
          sheetId: this.config.sheetId,
          columnMappings: this.config.columnMappings,
          delivery,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add delivery');
      }

      console.log('[SmartsheetService] Delivery added with row ID:', data.rowId);
      return data.rowId;
    } catch (error) {
      console.error('[SmartsheetService] Add delivery failed:', error);
      throw error;
    }
  }
}