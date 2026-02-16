
import { GOOGLE_FORM_URL, GOOGLE_FORM_ENTRIES, GOOGLE_PATIENT_FORM_URL, GOOGLE_PATIENT_FORM_ENTRIES } from '../constants';

export const googleFormService = {
  /**
   * Silently submits lead data to the Doctor Hub Google Form.
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
    params.append(GOOGLE_FORM_ENTRIES.patientName, data.patientName || '');
    params.append(GOOGLE_FORM_ENTRIES.contactNumber, data.contactNumber || '');
    params.append(GOOGLE_FORM_ENTRIES.email, data.email || '');
    params.append(GOOGLE_FORM_ENTRIES.service, data.serviceName || '');
    params.append(GOOGLE_FORM_ENTRIES.consultant, data.consultantName || '');

    try {
      await fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });
      return true;
    } catch (error) {
      console.error('Lead sync failed:', error);
      return false;
    }
  },

  /**
   * Silently submits patient vitals to the Patient Portal Google Form.
   * Maps data exactly to the provided pre-fill link entry IDs.
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
    // Precise mapping from pre-fill link:
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.patientName, data.patientName || '');      // entry.534657666
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.consultantName, data.consultantName || ''); // entry.1256186146
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.bp, data.bp || '');                        // entry.1825925436
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.temp, data.temp || '');                    // entry.934297216
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.hr, data.hr || '');                        // entry.1387668940
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.spo2, data.spo2 || '');                    // entry.62151591
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.rbs, data.rbs || '');                      // entry.834722516
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.email, data.email || '');                  // entry.913860886
    params.append(GOOGLE_PATIENT_FORM_ENTRIES.contactNumber, data.contactNumber || '');  // entry.432392514

    try {
      // mode: 'no-cors' is mandatory for Google Forms
      await fetch(GOOGLE_PATIENT_FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });
      console.log('Patient vitals sync attempted to Google Form');
      return true;
    } catch (error) {
      console.error('Patient vitals sync failed:', error);
      return false;
    }
  }
};
