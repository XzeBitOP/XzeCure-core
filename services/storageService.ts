import { SavedVisit, DailyVital, Appointment, VisitData } from '../types';

const STORAGE_KEY = 'xzecure_visits';
const VITALS_KEY = 'xzecure_daily_vitals';
const APPOINTMENTS_KEY = 'xzecure_appointments';
const INVESTIGATIONS_STATUS_KEY = 'xzecure_investigations_status_v2';
const DRAFT_KEY = 'xzecure_form_draft';

export const storageService = {
  getVisits: (): SavedVisit[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveVisit: (visit: Omit<SavedVisit, 'id'>) => {
    const visits = storageService.getVisits();
    const newVisit: SavedVisit = {
      ...visit,
      id: crypto.randomUUID(),
    };
    visits.unshift(newVisit); 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visits.slice(0, 50)));
    localStorage.removeItem(DRAFT_KEY); // Clear draft on successful save
    return newVisit;
  },

  getDailyVitals: (): DailyVital[] => {
    try {
      const data = localStorage.getItem(VITALS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveDailyVital: (vital: Omit<DailyVital, 'id' | 'timestamp'>) => {
    const vitals = storageService.getDailyVitals();
    const newVital: DailyVital = {
      ...vital,
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleString('en-IN'),
    };
    vitals.unshift(newVital);
    localStorage.setItem(VITALS_KEY, JSON.stringify(vitals.slice(0, 30)));
    return newVital;
  },

  updateDailyVital: (id: string, updatedVital: Partial<DailyVital>) => {
    const vitals = storageService.getDailyVitals();
    const updated = vitals.map(v => v.id === id ? { ...v, ...updatedVital } : v);
    localStorage.setItem(VITALS_KEY, JSON.stringify(updated));
    return updated;
  },

  deleteDailyVital: (id: string) => {
    const vitals = storageService.getDailyVitals();
    const updated = vitals.filter(v => v.id !== id);
    localStorage.setItem(VITALS_KEY, JSON.stringify(updated));
    return updated;
  },

  getAppointments: (): Appointment[] => {
    try {
      const data = localStorage.getItem(APPOINTMENTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveAppointment: (appointment: Omit<Appointment, 'id' | 'status'>) => {
    const appointments = storageService.getAppointments();
    const newAppointment: Appointment = {
      ...appointment,
      id: crypto.randomUUID(),
      status: 'pending'
    };
    appointments.unshift(newAppointment);
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointments));
    return newAppointment;
  },

  updateAppointmentStatus: (id: string, status: Appointment['status']) => {
    const appointments = storageService.getAppointments();
    const updated = appointments.map(a => a.id === id ? { ...a, status } : a);
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(updated));
    return updated;
  },

  saveFormDraft: (data: VisitData) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  },

  getFormDraft: (): VisitData | null => {
    try {
      const data = localStorage.getItem(DRAFT_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  getCompletedInvestigations: (visitId: string): string[] => {
    try {
      const data = localStorage.getItem(INVESTIGATIONS_STATUS_KEY);
      const statusMap = data ? JSON.parse(data) : {};
      return statusMap[visitId] || [];
    } catch {
      return [];
    }
  },

  toggleInvestigationItem: (visitId: string, itemName: string) => {
    try {
      const data = localStorage.getItem(INVESTIGATIONS_STATUS_KEY);
      const statusMap = data ? JSON.parse(data) : {};
      const completed = statusMap[visitId] || [];
      
      const index = completed.indexOf(itemName);
      if (index === -1) {
        completed.push(itemName);
      } else {
        completed.splice(index, 1);
      }
      
      statusMap[visitId] = completed;
      localStorage.setItem(INVESTIGATIONS_STATUS_KEY, JSON.stringify(statusMap));
      return completed;
    } catch (e) {
      console.error('Failed to save investigation item status', e);
      return [];
    }
  }
};