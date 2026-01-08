
export interface ServiceOption {
  label: string;
  value: number;
}

export interface ServiceGroup {
  label: string;
  options: ServiceOption[];
}

export interface Medication {
  id: string;
  route: string;
  name: string;
  dose: string;
  frequency: number; // 1 to 6
  timing: string;
  takenToday?: boolean;
}

export interface DailyVital {
  id: string;
  timestamp: string;
  bp: string;
  spo2: string;
  hr: string;
  rbs: string;
  weight: string;
}

export interface VisitData {
  visitId: string;
  staffName: string;
  patientName: string;
  age: string;
  contactNumber: string;
  address: string;
  weight: string;
  height: string;
  bmi: string;
  complaints: string;
  duration: string;
  history: string;
  surgicalHistory: string;
  vitals: string; 
  vitalTemp: string;
  vitalBp: string;
  vitalSpo2: string;
  vitalHr: string;
  vitalRbs: string;
  signs: string;
  treatment: string;
  medications: Medication[];
  investigationsAdvised: string;
  followup: 'Yes' | 'No';
  followupDate: string;
  whatsappNumber: string;
  serviceCharge: number;
  quantity: number;
  pdfColor: 'white' | 'black';
  serviceName: string;
  photos: string[];
}

export interface SavedVisit {
  id: string;
  visitId: string;
  name: string;
  date: string;
  staff: string;
  fullData?: VisitData;
}
