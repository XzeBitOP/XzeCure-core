
import { GOOGLE_FORM_URL, GOOGLE_FORM_ENTRIES } from '../constants';

export const googleFormService = {
  /**
   * Silently submits lead data to a Google Form in the background.
   * Uses URLSearchParams to ensure 'application/x-www-form-urlencoded' compatibility.
   */
  submitLead: async (data: {
    patientName: string;
    contactNumber: string;
    email: string;
    serviceName: string;
    consultantName: string;
  }) => {
    if (!GOOGLE_FORM_URL) return;

    // Use URLSearchParams to match the content-type Google Forms expects
    const params = new URLSearchParams();
    params.append(GOOGLE_FORM_ENTRIES.patientName, data.patientName);
    params.append(GOOGLE_FORM_ENTRIES.contactNumber, data.contactNumber);
    params.append(GOOGLE_FORM_ENTRIES.email, data.email);
    params.append(GOOGLE_FORM_ENTRIES.service, data.serviceName);
    params.append(GOOGLE_FORM_ENTRIES.consultant, data.consultantName);

    try {
      // mode: 'no-cors' is required as Google does not return CORS headers
      await fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });
      console.log('Lead auto-synced to Google Form successfully');
      return true;
    } catch (error) {
      console.error('Lead sync failed:', error);
      return false;
    }
  }
};
