
import { ServiceGroup } from './types';

export const SECRET_PIN = '472892';

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    label: "Doctor Services",
    options: [
      { label: "Doctor Home Visit (Daytime) - ₹999", value: 999 },
      { label: "Emergency / Night Visit - ₹1499", value: 1499 },
      { label: "Tele / Video Consultation - ₹499", value: 499 },
    ]
  },
  {
    label: "Nursing Services",
    options: [
      { label: "Nursing Visit (Injection / Dressing) - ₹400", value: 400 },
      { label: "12-hour Nursing Shift - ₹1200", value: 1200 },
      { label: "24-hour Nursing Care - ₹2200", value: 2200 },
      { label: "ICU-trained Nurse - ₹1500", value: 1500 },
    ]
  },
  {
    label: "Attendant / Caregiver Services",
    options: [
      { label: "Daytime Attendant (12 hours) - ₹900", value: 900 },
      { label: "24-hour Attendant - ₹1800", value: 1800 },
    ]
  },
  {
    label: "Physiotherapy",
    options: [
      { label: "One-time Physiotherapy Consultation - ₹400", value: 400 },
      { label: "Follow-up Physiotherapy Session - ₹600", value: 600 },
      { label: "Package (10 sessions) - ₹4999", value: 4999 },
    ]
  },
  {
    label: "Other Medical Services",
    options: [
      { label: "Nebulisation at Home - ₹99", value: 99 },
      { label: "ECG at Home - ₹199", value: 199 },
      { label: "IV / Injection at Home - ₹99", value: 99 },
      { label: "Wound Dressing - ₹199", value: 199 },
      { label: "Catheter/Ryle's Tube Change - ₹499", value: 499 },
      { label: "Blood Sample Collection at Home - ₹149", value: 149 },
    ]
  },
  {
    label: "Additional Services",
    options: [
      { label: "Medicine Delivery at Home - ₹150", value: 150 },
    ]
  }
];

// URLs updated based on the visual assets for XzeCure
export const DEFAULT_LOGO = "https://drive.google.com/uc?export=view&id=1GBJTXDNAbVoY77EACU6exx61PGkpnPWR";
export const DEFAULT_LETTERHEAD = "https://drive.google.com/uc?export=view&id=1PVkL2iQhLYDTPXX0Od5M3Va0GMauwpN8";
