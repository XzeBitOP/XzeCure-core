
import { N8N_WEBHOOK_URL } from '../constants';

export const n8nService = {
  triggerWorkflow: async (data: {
    patientName: string;
    contactNumber: string;
    email: string;
    serviceGiven: string;
    amount: number;
  }) => {
    if (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL.includes('YOUR_N8N_WEBHOOK_URL')) {
      console.warn('n8n Webhook URL not configured in constants.tsx');
      return;
    }

    try {
      // Use no-cors or ensure CORS is handled in your n8n webhook settings
      await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'XzeCure App',
          timestamp: new Date().toISOString(),
          ...data
        }),
      });
      console.log('n8n workflow triggered successfully');
    } catch (error) {
      console.error('Error triggering n8n workflow:', error);
    }
  },
};