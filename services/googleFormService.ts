import { GOOGLE_FORM_URL, GOOGLE_FORM_ENTRIES, GOOGLE_PATIENT_FORM_URL, GOOGLE_PATIENT_FORM_ENTRIES } from '../constants';

export const googleFormService = {
  /**
   * Silently submits lead data to a Google Form in the background.
   */
  submitLead: async (data: {
    patientName: string;
    contactNumber: string;
    email: string;
    serviceName: string;
    consultantName: string;
  }) => {
    if (!GOOGLE_FORM_URL) return;

    const params = new URLSearchParams();
    params.append(GOOGLE_FORM_ENTRIES.patientName, data.patientName);
    params.append(GOOGLE_FORM_ENTRIES.contactNumber, data.contactNumber);
    params.append(GOOGLE_FORM_ENTRIES.email, data.email);
    params.append(GOOGLE_FORM_ENTRIES.service, data.serviceName);
    params.append(GOOGLE_FORM_ENTRIES.consultant, data.consultantName);

    try {
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
  },

  /**
   * Silently submits patient vitals data to a specific Google Form in the background.
   */
  submitPatientVitals: async (data: {
    patientName: string;
    consultantName: string;
    email: string;
    contactNumber: string;
    bp: string;
    temp: string;
    hr: string;
    spo2: string;
    rbs: string;
  }) => {
    if (!GOOGLE_PATIENT_FORM_URL) return;

    const params = new URLSearchParams();
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.patientName, data.patientName || '');
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.consultantName, data.consultantName || '');
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.email, data.email || '');
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.contactNumber, data.contactNumber || '');
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.bp, data.bp || '');
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.temp, data.temp || '');
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.hr, data.hr || '');
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.spo2, data.spo2 || '');
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.rbs, data.rbs || '');

    try {
      await fetch(GOOGLE_PATIENT_FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });
      console.log('Patient vitals auto-synced to Google Form successfully');
      return true;
    } catch (error) {
      console.error('Patient vitals sync failed:', error);
      return false;
    }
  }
};