const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://warehouse-backend-production-4200.up.railway.app';

interface RequestSlipParams {
  deliveryId: string;
  customerEmails: string[];
  customerName: string;
  containerNumber: string;
  expectedDate: string;
  requestedBy: string;
  reminderCount?: number;
}

interface RequestSlipResponse {
  success: boolean;
  message?: string;
  emailId?: string;
  error?: string;
}

/**
 * Send packing slip request email to ALL customer email addresses
 */
export async function requestPackingSlip(params: RequestSlipParams): Promise<RequestSlipResponse> {
  try {
    console.log('[DeliveriesAPI] Sending packing slip request to', params.customerEmails.length, 'recipient(s):', params);

    const response = await fetch(`${API_BASE_URL}/api/deliveries/${params.deliveryId}/request-slip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerEmails: params.customerEmails,
        customerName: params.customerName,
        containerNumber: params.containerNumber,
        expectedDate: params.expectedDate,
        requestedBy: params.requestedBy,
        reminderCount: params.reminderCount || 0,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[DeliveriesAPI] Email sent successfully:', data);

    return {
      success: data.success,
      message: data.message,
      emailId: data.emailId,
    };
  } catch (error) {
    console.error('[DeliveriesAPI] Exception during request:', error);
    throw error;
  }
}