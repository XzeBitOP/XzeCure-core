

import { Medication, VisitData } from '../types';

const NOTIF_STORAGE_KEY = 'xzecure_scheduled_notifications';

export const notificationService = {
  requestPermission: async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  /**
   * Schedules a recurring vitals update reminder at specific hours: 7, 12, 14, 19, 23
   */
  scheduleVitalsReminders: () => {
    const vitalsHours = [7, 12, 14, 19, 23];
    vitalsHours.forEach(hour => {
      const now = new Date();
      const scheduledDate = new Date();
      scheduledDate.setHours(hour, 0, 0, 0);

      // If the time for today has passed, schedule for tomorrow
      if (scheduledDate.getTime() < now.getTime()) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }

      const diff = scheduledDate.getTime() - now.getTime();
      
      // We use a simple setTimeout for the first one, 
      // but in a real PWA you'd want a periodic sync or push.
      setTimeout(() => {
        // Fix: Removed 'renotify' property as it is not available in standard NotificationOptions
        notificationService.showNotification('Vitals Update Reminder', {
          body: 'It is time to log your vitals and share them with your Clinical Hub.',
          tag: `vitals-rem-${hour}`
        });
        // Re-schedule for next day
        notificationService.scheduleVitalsReminders();
      }, diff);
    });
  },

  /**
   * Parses medication timings from a VisitData record and schedules notifications.
   */
  scheduleAllMedicationReminders: (record: VisitData) => {
    if (!record.medications) return;
    
    record.medications.forEach(med => {
      notificationService.scheduleMedicationReminder(record.patientName, med);
    });
  },

  scheduleMedicationReminder: async (patientName: string, med: Medication) => {
    if (Notification.permission !== 'granted') return;

    // Parse timing string (e.g., "1-0-1", "8am", "10:30 PM", "9")
    const timeValue = med.timing.toLowerCase();
    
    // Handle standard clinical timing strings like 1-1-1
    if (timeValue.includes('-')) {
      const doses = timeValue.split('-');
      // Morning (8 AM), Afternoon (2 PM), Night (9 PM)
      const hours = [8, 14, 21];
      doses.forEach((count, index) => {
        if (parseInt(count) > 0) {
          notificationService.scheduleAtHour(patientName, med, hours[index]);
        }
      });
      return;
    }

    const isPM = timeValue.includes('pm');
    const isAM = timeValue.includes('am');
    const digits = timeValue.match(/\d+/g);
    
    if (!digits) return;

    let hours = parseInt(digits[0]);
    let minutes = digits.length > 1 ? parseInt(digits[1]) : 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    notificationService.scheduleAtTime(patientName, med, hours, minutes);
  },

  scheduleAtHour: (patientName: string, med: Medication, hour: number) => {
    notificationService.scheduleAtTime(patientName, med, hour, 0);
  },

  scheduleAtTime: (patientName: string, med: Medication, hours: number, minutes: number) => {
    const now = new Date();
    const scheduledDate = new Date();
    scheduledDate.setHours(hours, minutes, 0, 0);

    if (scheduledDate.getTime() < now.getTime()) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    const diff = scheduledDate.getTime() - now.getTime();

    setTimeout(() => {
      // Fix: Removed 'renotify' property as it is not available in standard NotificationOptions
      notificationService.showNotification(`Medication Due: ${med.name}`, {
        body: `Dose: ${med.dose}\nTiming: ${med.timing}\nRoute: ${med.route}`,
        tag: `med-rem-${med.id}-${hours}`
      });
      // Reschedule for next day
      notificationService.scheduleAtTime(patientName, med, hours, minutes);
    }, diff);
  },

  showNotification: (title: string, options: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      const notif = new Notification(title, {
        ...options,
        icon: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR',
        badge: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR',
      });
      
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }
  }
};
