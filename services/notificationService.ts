
import { Medication, VisitData } from '../types';

export const notificationService = {
  requestPermission: async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  /**
   * Resets all existing schedules to prevent duplicate alarms
   */
  cancelAllSchedules: () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_ALL_NOTIFICATIONS' });
    }
  },

  /**
   * Schedules recurring vitals reminders at key clinical check points
   */
  scheduleVitalsReminders: () => {
    const vitalsHours = [7, 12, 14, 19, 23];
    vitalsHours.forEach(hour => {
      notificationService.scheduleRecurring(
        '🩺 XzeCure Vitals Check',
        'Time to log your daily vitals. Your clinical hub and family are waiting for your update.',
        hour,
        0,
        `vitals-reminder-${hour}`
      );
    });
  },

  /**
   * Parses medication data and schedules specific alarms for each medication.
   */
  scheduleAllMedicationReminders: (record: VisitData) => {
    if (!record.medications) return;
    
    record.medications.forEach(med => {
      const timeValue = med.timing.toLowerCase();
      
      // Standard clinical shorthand (e.g., 1-0-1)
      if (timeValue.includes('-')) {
        const doses = timeValue.split('-');
        const baseHours = [8, 14, 21]; // Morning, Afternoon, Night
        doses.forEach((count, index) => {
          if (parseInt(count) > 0) {
            notificationService.scheduleRecurring(
              `💊 Medication: ${med.name}`,
              `Time for your dose: ${med.dose}. Route: ${med.route}. Frequency: ${med.timing}`,
              baseHours[index],
              0,
              `med-${med.id}-${index}`
            );
          }
        });
      } else {
        // Simple time parsing (e.g., 8am, 10:30pm)
        const isPM = timeValue.includes('pm');
        const digits = timeValue.match(/\d+/g);
        if (digits) {
          let h = parseInt(digits[0]);
          let m = digits.length > 1 ? parseInt(digits[1]) : 0;
          if (isPM && h < 12) h += 12;
          if (!isPM && h === 12) h = 0; // Midnight 12am
          
          notificationService.scheduleRecurring(
            `💊 Medication: ${med.name}`,
            `It is time for your prescribed dose of ${med.dose} (${med.route}).`,
            h,
            m,
            `med-${med.id}-once`
          );
        }
      }
    });
  },

  /**
   * Triggers an immediate notification with interactive buttons for sharing stats.
   */
  showVitalsLoggedNotification: (summary: string, doctorPhone: string, relativePhone: string) => {
    const title = '✅ Health Stats Captured';
    const body = `Stats: ${summary}. Tap to share with your medical team.`;
    const tag = 'vitals-logged-action';

    const actions = [
      { action: 'inform_doctor', title: '👨‍⚕️ Inform Doctor' }
    ];

    if (relativePhone && relativePhone.trim()) {
      actions.push({ action: 'inform_relative', title: '🏡 Inform Relative' });
    }

    const data = {
      doctorPhone,
      relativePhone,
      shareMessage: `XzeCure Daily Health Update:\nStats: ${summary}\nStatus: Captured & Logged.`
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        // Cast to any to bypass standard NotificationOptions limitations for Service Worker extensions
        reg.showNotification(title, {
          body,
          tag,
          actions,
          data,
          icon: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR',
          badge: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR',
          vibrate: [200, 100, 200],
          requireInteraction: true
        } as any);
      });
    } else {
      notificationService.showLocalNotification(title, { body, tag });
    }
  },

  scheduleRecurring: (title: string, body: string, hour: number, minute: number, tag: string) => {
    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(hour, minute, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (scheduled.getTime() <= now.getTime()) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    const delay = scheduled.getTime() - now.getTime();

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        title,
        body,
        delay,
        tag
      });
    }

    // Main thread fallback for immediate testing or active tab use
    setTimeout(() => {
      notificationService.showLocalNotification(title, { body, tag });
      // Re-schedule next instance
      notificationService.scheduleRecurring(title, body, hour, minute, tag);
    }, delay);
  },

  showLocalNotification: (title: string, options: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        ...options,
        icon: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR',
        badge: 'https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR'
      });
    }
  }
};
