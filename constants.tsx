
import { ServiceGroup } from './types';

export const SECRET_PIN = '472892';

// PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE AFTER DEPLOYING
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYED_URL/exec';

export interface ConsultantEntry {
  name: string;
  hospital: string;
  logo: string;
}

export const CONSULTANTS_DATABASE: ConsultantEntry[] = [
  { 
    name: 'Dr. Samir Shah', 
    hospital: 'Shah Multi-Speciality Hospital', 
    logo: 'https://lh3.googleusercontent.com/d/11caZFCVGHAyQzVxQYiEcpLwmuTioNTDT' 
  },
  { 
    name: 'Dr. Viral Mehta', 
    hospital: 'City Clinic', 
    logo: '' 
  }
];

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

export const COMMON_ICD_CODES = [
  { code: 'A09.9', description: 'Gastroenteritis and colitis of infectious origin' },
  { code: 'B34.9', description: 'Viral infection, unspecified' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'J00', description: 'Acute nasopharyngitis [common cold]' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified' },
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified' },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated' },
  { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis' },
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified' },
  { code: 'R05', description: 'Cough' },
  { code: 'R10.9', description: 'Unspecified abdominal pain' },
  { code: 'R50.9', description: 'Fever, unspecified' },
  { code: 'R51', description: 'Headache' },
  { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings' }
];

export const DEFAULT_LOGO = "https://lh3.googleusercontent.com/d/1GBJTXDNAbVoY77EACU6exx61PGkpnPWR";
export const DEFAULT_LETTERHEAD = "https://lh3.googleusercontent.com/d/1PVkL2iQhLYDTPXX0Od5M3Va0GMauwpN8";
