import { ExtensivConfig, ExtensivItem, ReceivingSession } from '@/types';

// Use relative paths for Atoms Backend - NO localhost URLs
export class ExtensivService {
  private config: ExtensivConfig;

  constructor(config: ExtensivConfig) {
    this.config = config;
  }

  async testConnection(): Promise<{ success: boolean; facilityName?: string; error?: string }> {
    try {
      const response = await fetch('/api/extensiv/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: this.config.apiKey,
          facilityId: this.config.facilityId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed');
      }

      return {
        success: true,
        facilityName: data.facilityName,
      };
    } catch (error) {
      console.error('Extensiv connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  async fetchItems(): Promise<ExtensivItem[]> {
    try {
      const response = await fetch('/api/extensiv/fetch-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: this.config.apiKey,
          facilityId: this.config.facilityId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch items');
      }

      return data.items;
    } catch (error) {
      console.error('Fetch items failed:', error);
      throw error;
    }
  }

  async sendReceivingTransaction(session: ReceivingSession): Promise<void> {
    try {
      const response = await fetch('/api/extensiv/send-receiving', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: this.config.apiKey,
          facilityId: this.config.facilityId,
          receivingData: session,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send receiving transaction');
      }
    } catch (error) {
      console.error('Send receiving transaction failed:', error);
      throw error;
    }
  }
}