
import { Medication } from '../types';

export const notificationService = {
  requestPermission: async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  scheduleMedicationReminder: async (patientName: string, med: Medication) => {
    if (Notification.permission !== 'granted') return;

    // Parse timing string (e.g., "8am", "10:30 PM", "9")
    const timeValue = med.timing.toLowerCase();
    const isPM = timeValue.includes('pm');
    const isAM = timeValue.includes('am');
    const digits = timeValue.match(/\d+/g);
    
    if (!digits) return;

    let hours = parseInt(digits[0]);
    let minutes = digits.length > 1 ? parseInt(digits[1]) : 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    const now = new Date();
    const scheduledDate = new Date();
    scheduledDate.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledDate.getTime() < now.getTime()) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    const diff = scheduledDate.getTime() - now.getTime();

    // Foreground reminder
    setTimeout(() => {
      new Notification(`Time for Medication: ${med.name}`, {
        body: `Patient: ${patientName}\nDose: ${med.dose}\nRoute: ${med.route}`,
        icon: 'https://drive.google.com/uc?export=view&id=1GBJTXDNAbVoY77EACU6exx61PGkpnPWR'
      });
    }, diff);

    // Register Background Sync if possible
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      try {
        await (reg as any).sync.register('medication-sync');
      } catch (e) {
        console.warn('Background sync registration failed');
      }
    }
  }
};
