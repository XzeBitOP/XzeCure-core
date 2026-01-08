
import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Users, Stethoscope, CheckCircle2, XCircle, Loader2, 
  Pill, ArrowLeft, Bell, Check, FileUp, 
  HeartPulse, Siren, Trash2, 
  Plus, FileText, FileDown, CreditCard, Thermometer, 
  Activity, Scale, Calendar, ClipboardList, ChevronRight
} from 'lucide-react';
import { SECRET_PIN, SERVICE_GROUPS, DEFAULT_LOGO, DEFAULT_LETTERHEAD } from './constants';
import { VisitData, Medication, DailyVital } from './types';
import { storageService } from './services/storageService';
import { generateVisitPdf } from './services/pdfService';
import { notificationService } from './services/notificationService';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Configure pdfjs worker
GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@^4.0.379/build/pdf.worker.mjs`;

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'doctor' | 'patient' | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  
  // Patient Portal State
  const [currentPatientRecord, setCurrentPatientRecord] = useState<VisitData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [medsStatus, setMedsStatus] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [completedInvestigations, setCompletedInvestigations] = useState<string[]>([]);
  const [showVitalsEntry, setShowVitalsEntry] = useState(false);
  const [dailyVitals, setDailyVitals] = useState<DailyVital[]>([]);
  const [newVital, setNewVital] = useState({
    bp: '', spo2: '', hr: '', rbs: '', weight: ''
  });

  // Doctor Form State
  const initialFormState: VisitData = {
    visitId: '', staffName: '', patientName: '', age: '', contactNumber: '',
    address: '', weight: '', height: '', bmi: '', complaints: '', duration: '',
    history: '', surgicalHistory: '', investigationsAdvised: '',
    vitals: '', vitalTemp: '', vitalBp: '', vitalSpo2: '',
    vitalHr: '', vitalRbs: '', signs: '', treatment: '', nonMedicinalAdvice: '', medications: [],
    followup: 'No', followupDate: '', whatsappNumber: '',
    serviceCharge: 0, quantity: 1, pdfColor: 'white', serviceName: 'Standard Consultation',
    photos: []
  };

  const [formData, setFormData] = useState<VisitData>(initialFormState);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftIn'>('cm');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 2500);
    setDailyVitals(storageService.getDailyVitals());
    
    if ('Notification' in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (currentPatientRecord) {
      setCompletedInvestigations(storageService.getCompletedInvestigations(currentPatientRecord.visitId));
    }
  }, [currentPatientRecord]);

  // BMI Calculation Logic
  useEffect(() => {
    let heightCm = 0;
    if (heightUnit === 'cm') {
      heightCm = parseFloat(formData.height);
    } else {
      const ft = parseFloat(heightFt) || 0;
      const inch = parseFloat(heightIn) || 0;
      heightCm = (ft * 12 + inch) * 2.54;
    }

    const weightKg = parseFloat(formData.weight);
    if (weightKg > 0 && heightCm > 0) {
      const heightM = heightCm / 100;
      const calculatedBmi = (weightKg / (heightM * heightM)).toFixed(1);
      setFormData(prev => ({ ...prev, bmi: calculatedBmi }));
    } else {
      setFormData(prev => ({ ...prev, bmi: '' }));
    }
  }, [formData.weight, formData.height, heightFt, heightIn, heightUnit]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleEmergencyAction = (type: 'ambulance' | 'doctor') => {
    const actionText = type === 'ambulance' ? 'emergency ambulance required' : 'emergency doctor requirement here';
    setShowEmergencyDialog(false);
    
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 500]);

    if ("geolocation" in navigator) {
      showToast('Getting Live Location...', 'info');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          const message = encodeURIComponent(`🚨 SOS ALERT 🚨\n\nMESSAGE: ${actionText.toUpperCase()}\n\nLIVE LOCATION: ${mapsUrl}\n\nID: ${currentPatientRecord?.visitId || 'XZ-GUEST'}`);
          window.open(`https://wa.me/918200095781?text=${message}`, "_blank");
        },
        () => {
          const message = encodeURIComponent(`🚨 SOS ALERT 🚨\n\nMESSAGE: ${actionText.toUpperCase()}\n\nLOCATION: [Geolocation Access Denied]`);
          window.open(`https://wa.me/918200095781?text=${message}`, "_blank");
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      const message = encodeURIComponent(`🚨 SOS ALERT 🚨\n\nMESSAGE: ${actionText.toUpperCase()}`);
      window.open(`https://wa.me/918200095781?text=${message}`, "_blank");
    }
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await (loadingTask as any).promise;
      const metadataResult = await (pdf as any).getMetadata();
      const info = (metadataResult.info || {}) as any;
      const embeddedData = info.Subject;
      if (!embeddedData) throw new Error("No Data");
      const decodedJson = decodeURIComponent(escape(atob(embeddedData)));
      const visitData: VisitData = JSON.parse(decodedJson);
      setCurrentPatientRecord(visitData);
      showToast('Records Synced', 'success');
    } catch (err) {
      showToast('Sync Failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const updateMedication = (id: string, updates: Partial<Medication>) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    const selectedOption = e.target.options[e.target.selectedIndex];
    const label = selectedOption.text.split(' - ')[0];
    if (!isNaN(value)) setFormData(prev => ({ ...prev, serviceCharge: value, serviceName: label }));
  };

  const setPrescriptionReminder = (med: Medication) => {
    if (!notificationsEnabled) {
      notificationService.requestPermission().then(granted => {
        setNotificationsEnabled(granted);
        if (granted) showToast('Notifications Ready', 'success');
      });
      return;
    }
    const medId = med.id;
    const isAlreadyEnabled = reminders[medId];
    if (isAlreadyEnabled) {
      setReminders(prev => ({ ...prev, [medId]: false }));
      showToast(`Reminder removed`, 'info');
    } else {
      setReminders(prev => ({ ...prev, [medId]: true }));
      showToast(`Reminder set: ${med.timing}`, 'success');
      if (currentPatientRecord) {
        notificationService.scheduleMedicationReminder(currentPatientRecord.patientName, med);
      }
    }
  };

  const toggleMed = (id: string) => {
    if ('vibrate' in navigator) navigator.vibrate(60);
    setMedsStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleInvestigationItem = (itemName: string) => {
    if (!currentPatientRecord) return;
    if ('vibrate' in navigator) navigator.vibrate(40);
    const nextCompleted = storageService.toggleInvestigationItem(currentPatientRecord.visitId, itemName);
    setCompletedInvestigations(nextCompleted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    if ('vibrate' in navigator) navigator.vibrate(100);
    try {
      const vId = `XZ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      let finalHeight = formData.height;
      if (heightUnit === 'ftIn') {
        const ft = parseFloat(heightFt) || 0;
        const inch = parseFloat(heightIn) || 0;
        finalHeight = ((ft * 12 + inch) * 2.54).toFixed(1);
      }
      
      const finalData = { ...formData, visitId: vId, height: finalHeight };
      const blob = await generateVisitPdf(finalData, finalData.photos, DEFAULT_LETTERHEAD);
      setPdfBlob(blob);
      storageService.saveVisit({ visitId: vId, name: finalData.patientName, date: new Date().toISOString(), staff: finalData.staffName, fullData: finalData });
      showToast('Report Ready', 'success');
    } catch (err) {
      showToast('PDF Engine Error', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[200]">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/30 blur-[120px] rounded-full animate-pulse" />
          <HeartPulse className="w-24 h-24 sm:w-32 sm:h-32 text-blue-500 relative z-10" />
        </div>
        <div className="mt-8 text-center space-y-4 z-10 px-6">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter">XzeCure</h1>
          <div className="w-40 sm:w-48 h-1.5 bg-white/5 rounded-full overflow-hidden mx-auto border border-white/10">
            <div className="h-full bg-blue-500 w-full animate-[loading_2s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm space-y-8 sm:space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-block p-5 sm:p-6 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl">
              <img src={DEFAULT_LOGO} className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter">XzeCure</h1>
            <p className="text-slate-400 font-medium text-base sm:text-lg">Secure Medical Hub</p>
          </div>
          <div className="grid gap-3 sm:gap-4">
            <button onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} className="group relative overflow-hidden w-full p-6 sm:p-8 bg-blue-600 rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all shadow-2xl">
               <div className="flex items-center gap-3 sm:gap-4 text-white">
                 <Users className="w-6 h-6 sm:w-8 sm:h-8" />
                 <span className="text-xl sm:text-2xl font-black tracking-tight">Patient Portal</span>
               </div>
               <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white/50 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => setSelectedRole('doctor')} className="group w-full p-6 sm:p-8 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all">
               <div className="flex items-center gap-3 sm:gap-4 text-slate-300">
                 <Stethoscope className="w-6 h-6 sm:w-8 sm:h-8" />
                 <span className="text-xl sm:text-2xl font-black tracking-tight">Doctor Access</span>
               </div>
               <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-slate-500" />
            </button>
            <button 
              onClick={() => setShowEmergencyDialog(true)} 
              className="w-full p-6 sm:p-8 bg-rose-600 rounded-[2rem] sm:rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all shadow-2xl shadow-rose-600/30 group"
            >
               <div className="flex items-center gap-3 sm:gap-4 text-white">
                 <Siren className="w-6 h-6 sm:w-8 sm:h-8 group-hover:animate-bounce" />
                 <span className="text-xl sm:text-2xl font-black tracking-tight">Emergency SOS</span>
               </div>
               <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white/50" />
            </button>
          </div>

          {showEmergencyDialog && (
            <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-sm space-y-6 sm:space-y-8 shadow-2xl">
                <div className="text-center space-y-2">
                  <h3 className="text-xl sm:text-2xl font-black text-white">Emergency Support</h3>
                  <p className="text-slate-500 font-medium text-sm sm:text-base">Please select the type of assistance required immediately.</p>
                </div>
                <div className="grid gap-3 sm:gap-4">
                  <button 
                    onClick={() => handleEmergencyAction('ambulance')}
                    className="w-full p-6 sm:p-8 bg-rose-600 text-white rounded-[1.5rem] sm:rounded-[2rem] flex flex-col items-center gap-2 sm:gap-3 active:scale-95 transition-all"
                  >
                    <Siren className="w-8 h-8 sm:w-10 sm:h-10" />
                    <span className="text-lg sm:text-xl font-black uppercase">Ambulance</span>
                  </button>
                  <button 
                    onClick={() => handleEmergencyAction('doctor')}
                    className="w-full p-6 sm:p-8 bg-blue-600 text-white rounded-[1.5rem] sm:rounded-[2rem] flex flex-col items-center gap-2 sm:gap-3 active:scale-95 transition-all"
                  >
                    <Stethoscope className="w-8 h-8 sm:w-10 sm:h-10" />
                    <span className="text-lg sm:text-xl font-black uppercase">Doctor Requirement</span>
                  </button>
                  <button 
                    onClick={() => setShowEmergencyDialog(false)}
                    className="w-full p-3 text-slate-500 font-black uppercase text-[10px] tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedRole === 'doctor' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <input type="password" maxLength={6} value={pin} onChange={(e) => {
                setPin(e.target.value);
                if (e.target.value === SECRET_PIN) { setIsLocked(false); setPinError(''); }
              }} placeholder="••••••"
              className="w-full bg-slate-900 border-2 border-white/10 text-white text-center py-5 sm:py-6 rounded-[2rem] sm:rounded-[2.5rem] text-3xl sm:text-4xl font-black outline-none focus:border-blue-500 transition-all placeholder:text-slate-800" />
              {pinError && <p className="text-rose-500 text-center font-bold text-sm">{pinError}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white">
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-white text-slate-950 px-6 sm:px-8 py-3 sm:py-4 rounded-full shadow-2xl font-black text-xs sm:text-sm tracking-widest animate-in slide-in-from-top-12 border border-white/20">
          {toast.message.toUpperCase()}
        </div>
      )}

      {selectedRole === 'doctor' && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-12 pb-32">
          <header className="flex justify-between items-center">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="p-4 sm:p-5 bg-white/5 backdrop-blur-3xl rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl">
                <img src={DEFAULT_LOGO} className="w-10 h-10 sm:w-14 sm:h-14 object-contain" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tighter">Clinical Hub</h1>
                <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Practitioner Node</p>
              </div>
            </div>
            <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-4 sm:p-5 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl text-slate-400 hover:text-white transition-colors active:scale-90"><ArrowLeft size={20} /></button>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-10">
            <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] sm:rounded-[3.5rem] border border-white/10 p-6 sm:p-12 shadow-2xl space-y-8 sm:space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Practitioner Profile</label>
                  <input required type="text" value={formData.staffName} onChange={e => setFormData({...formData, staffName: e.target.value})} placeholder="Dr. Kenil" className="w-full bg-white/5 border border-white/10 p-5 sm:p-7 rounded-[1.5rem] sm:rounded-[2.5rem] text-lg sm:text-xl font-bold text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-800" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Patient Identity</label>
                  <input required type="text" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} placeholder="Patient Name" className="w-full bg-white/5 border border-white/10 p-5 sm:p-7 rounded-[1.5rem] sm:rounded-[2.5rem] text-lg sm:text-xl font-bold text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-800" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 pt-8 sm:pt-12 border-t border-white/5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Age</label>
                  <input type="text" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] text-base sm:text-lg font-bold text-white outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Contact</label>
                  <input type="text" value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] text-base sm:text-lg font-bold text-white outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Weight (kg)</label>
                  <input type="text" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] text-base sm:text-lg font-bold text-white outline-none" />
                </div>
                <div className="space-y-2 relative">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Height</label>
                    <button type="button" onClick={() => setHeightUnit(h => h === 'cm' ? 'ftIn' : 'cm')} className="text-[8px] font-black text-blue-500 uppercase tracking-widest border border-blue-500/30 px-2 py-0.5 rounded-full">{heightUnit}</button>
                  </div>
                  {heightUnit === 'cm' ? (
                    <input type="text" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} placeholder="cm" className="w-full bg-white/5 border border-white/10 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] text-base sm:text-lg font-bold text-white outline-none" />
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="ft" className="w-1/2 bg-white/5 border border-white/10 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] text-base sm:text-lg font-bold text-white outline-none" />
                      <input type="text" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="in" className="w-1/2 bg-white/5 border border-white/10 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] text-base sm:text-lg font-bold text-white outline-none" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-blue-500 uppercase ml-1">BMI</label>
                  <div className="w-full bg-blue-500/10 border border-blue-500/20 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] text-xl sm:text-2xl font-black text-blue-400 text-center">{formData.bmi || '--'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 pt-8 sm:pt-12 border-t border-white/5">
                 {[
                   {l: 'Temp °F', k: 'vitalTemp', c: 'rose-500'},
                   {l: 'BP mmHg', k: 'vitalBp', c: 'blue-500'},
                   {l: 'SpO2 %', k: 'vitalSpo2', c: 'emerald-500'},
                   {l: 'Pulse Rate', k: 'vitalHr', c: 'red-500'},
                   {l: 'Glucose', k: 'vitalRbs', c: 'amber-500'}
                 ].map(vit => (
                   <div key={vit.k} className="space-y-2">
                     <label className={`text-[8px] font-black text-${vit.c} uppercase ml-1`}>{vit.l}</label>
                     <input type="text" value={(formData as any)[vit.k]} onChange={e => setFormData({...formData, [vit.k]: e.target.value})} className="w-full bg-slate-900/50 p-4 sm:p-5 rounded-[1.2rem] sm:rounded-[2rem] border border-white/10 text-white font-black text-center text-sm sm:text-base outline-none focus:border-white/30" />
                   </div>
                 ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 pt-8 sm:pt-12 border-t border-white/5">
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Clinical Findings</label>
                   <textarea value={formData.complaints} onChange={e => setFormData({...formData, complaints: e.target.value})} rows={4} className="w-full bg-white/5 border border-white/10 p-5 sm:p-7 rounded-[1.5rem] sm:rounded-[2.5rem] font-bold text-white outline-none focus:border-blue-500 transition-all resize-none text-sm sm:text-base" placeholder="Chief complaints..." />
                 </div>
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">Medical/Surgical History</label>
                   <textarea value={formData.history} onChange={e => setFormData({...formData, history: e.target.value})} rows={4} className="w-full bg-white/5 border border-white/10 p-5 sm:p-7 rounded-[1.5rem] sm:rounded-[2.5rem] font-bold text-white outline-none focus:border-rose-500 transition-all resize-none text-sm sm:text-base" placeholder="Old history / surgeries..." />
                 </div>
              </div>

              <div className="space-y-4 pt-4 sm:pt-8">
                 <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Medical Tests Required</label>
                 <textarea value={formData.investigationsAdvised} onChange={e => setFormData({...formData, investigationsAdvised: e.target.value})} rows={2} className="w-full bg-white/5 border border-white/10 p-5 sm:p-7 rounded-[1.5rem] sm:rounded-[2.5rem] font-bold text-amber-500 outline-none focus:border-amber-500 transition-all resize-none text-sm sm:text-base" placeholder="Labs, X-ray, ECG..." />
              </div>

              <div className="space-y-8 sm:space-y-10 pt-8 sm:pt-12 border-t border-white/5">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                   <h3 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3 sm:gap-4"><Pill className="text-blue-500 w-8 h-8 sm:w-10 sm:h-10" /> Prescription</h3>
                   <button type="button" onClick={() => setFormData(p => ({...p, medications: [...p.medications, { id: crypto.randomUUID(), route: 'Oral', name: '', dose: '', frequency: 1, timing: '' }]}))} className="bg-blue-600 px-6 sm:px-8 py-3 sm:py-4 rounded-[1.5rem] sm:rounded-[2rem] text-[10px] sm:text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 active:scale-95 transition-all shadow-xl">
                     <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Add Medication
                   </button>
                 </div>
                 
                 <div className="space-y-4">
                   {formData.medications.map(med => (
                     <div key={med.id} className="bg-white/5 border border-white/10 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] flex flex-col md:flex-row gap-6 sm:gap-8 items-center group shadow-xl">
                        <div className="w-full md:w-32">
                          <label className="text-[8px] font-black text-slate-600 uppercase mb-2 block">Route</label>
                          <select value={med.route} onChange={e => updateMedication(med.id, { route: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-xs font-black text-white outline-none">
                            {['Oral', 'IV', 'IM', 'SC', 'Nasal', 'RT', 'Topical'].map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div className="flex-1 w-full">
                          <label className="text-[8px] font-black text-slate-600 uppercase block mb-1">Medicine Name</label>
                          <input type="text" value={med.name} onChange={e => updateMedication(med.id, { name: e.target.value })} className="w-full bg-transparent border-b-2 border-white/10 p-2 sm:p-3 text-lg sm:text-xl font-black text-white outline-none focus:border-blue-500 transition-all" placeholder="Drug Name" />
                        </div>
                        <div className="w-full md:w-48">
                          <label className="text-[8px] font-black text-slate-600 uppercase block mb-1">Schedule</label>
                          <input type="text" value={med.timing} onChange={e => updateMedication(med.id, { timing: e.target.value })} className="w-full bg-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5 outline-none text-xs sm:text-sm font-bold text-blue-400 text-center" placeholder="Time / Dose" />
                        </div>
                        <button type="button" onClick={() => setFormData(p => ({...p, medications: p.medications.filter(m => m.id !== med.id)}))} className="p-4 sm:p-5 text-rose-500/50 hover:text-rose-500 transition-all"><Trash2 size={20} /></button>
                     </div>
                   ))}
                 </div>

                 <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] space-y-4">
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Non-Medicinal Advices</label>
                    <textarea value={formData.nonMedicinalAdvice} onChange={e => setFormData({...formData, nonMedicinalAdvice: e.target.value})} rows={3} className="w-full bg-transparent border border-emerald-500/10 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] font-bold text-white outline-none focus:border-emerald-500 transition-all resize-none text-sm sm:text-base" placeholder="Diet, rest, lifestyle changes..." />
                 </div>
              </div>

              <div className="pt-8 sm:pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10">
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Service Fee</label>
                   <select onChange={handleServiceChange} className="w-full bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] font-black outline-none text-white text-base sm:text-lg">
                      <option value="">-- Choose Category --</option>
                      {SERVICE_GROUPS.map(g => (<optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}</optgroup>))}
                   </select>
                 </div>
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Follow up needed?</label>
                   <div className="flex gap-3 sm:gap-4 items-center">
                      <button type="button" onClick={() => setFormData({...formData, followup: 'Yes'})} className={`flex-1 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] font-black border-2 transition-all text-sm sm:text-base ${formData.followup === 'Yes' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>YES</button>
                      <button type="button" onClick={() => setFormData({...formData, followup: 'No', followupDate: ''})} className={`flex-1 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] font-black border-2 transition-all text-sm sm:text-base ${formData.followup === 'No' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>NO</button>
                   </div>
                   {formData.followup === 'Yes' && (
                     <div className="animate-in slide-in-from-top-4">
                        <input type="date" value={formData.followupDate} onChange={e => setFormData({...formData, followupDate: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] text-lg sm:text-xl font-bold text-white outline-none focus:border-blue-500" />
                     </div>
                   )}
                 </div>
              </div>

              <div className="flex items-center justify-end pt-4">
                  {formData.serviceCharge > 0 && (
                    <div className="text-right bg-emerald-500/5 p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border border-emerald-500/20">
                      <p className="text-4xl sm:text-6xl font-black text-white">₹{formData.serviceCharge}</p>
                    </div>
                  )}
              </div>

              <button type="submit" disabled={isGenerating} className="w-full bg-white text-slate-950 py-8 sm:py-10 rounded-[2.5rem] sm:rounded-[3.5rem] font-black text-xl sm:text-3xl flex items-center justify-center gap-4 sm:gap-6 active:scale-95 transition-all shadow-2xl disabled:opacity-50">
                {isGenerating ? <><Loader2 className="animate-spin" /> COMPILING...</> : <><FileText className="w-8 h-8 sm:w-10 sm:h-10" /> DEPLOY REPORT</>}
              </button>
            </div>
          </form>

          {pdfBlob && (
            <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-4 sm:p-8 animate-in zoom-in duration-500">
               <div className="w-full max-w-5xl bg-slate-900 rounded-[2.5rem] sm:rounded-[4rem] border border-white/10 p-6 sm:p-12 space-y-8 sm:space-y-10 max-h-[92vh] overflow-y-auto shadow-[0_0_100px_rgba(59,130,246,0.1)]">
                  <div className="flex justify-between items-center">
                     <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tighter flex items-center gap-3 sm:gap-4"><CheckCircle2 className="text-emerald-500 w-8 h-8 sm:w-10 sm:h-10" /> Report Ready</h2>
                     <button onClick={() => setPdfBlob(null)} className="p-4 sm:p-6 bg-white/5 rounded-2xl sm:rounded-3xl text-slate-400 hover:text-rose-500 transition-colors"><XCircle className="w-6 h-6 sm:w-8 sm:h-8" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                    <button onClick={() => window.open(URL.createObjectURL(pdfBlob as Blob))} className="p-8 sm:p-10 bg-blue-600 text-white rounded-[2rem] sm:rounded-[3rem] font-black text-xl sm:text-2xl flex items-center justify-center gap-4 sm:gap-6 shadow-2xl active:scale-95 transition-all">
                      <FileDown className="w-8 h-8 sm:w-10 sm:h-10" /> DOWNLOAD PDF
                    </button>
                    <a href="upi://pay?pa=8200095781@pthdfc&pn=KenilShah" className="p-8 sm:p-10 bg-emerald-600 text-white rounded-[2rem] sm:rounded-[3rem] font-black text-xl sm:text-2xl flex items-center justify-center gap-4 sm:gap-6 shadow-2xl active:scale-95 transition-all">
                      <CreditCard className="w-8 h-8 sm:w-10 sm:h-10" /> PAY ₹{formData.serviceCharge}
                    </a>
                  </div>
                  <div className="bg-white rounded-[1.5rem] sm:rounded-[3rem] overflow-hidden border-[8px] sm:border-[12px] border-slate-950 shadow-inner">
                    <iframe src={URL.createObjectURL(pdfBlob as Blob)} title="PDF Preview" className="w-full h-[400px] sm:h-[700px]" />
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {selectedRole === 'patient' && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10 pb-40">
          <header className="flex justify-between items-center bg-white/5 backdrop-blur-3xl p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 sticky top-4 z-[50] shadow-2xl">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-xl"><User size={20} /></div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white">{currentPatientRecord?.patientName || 'Guest'}</h2>
                <p className="text-[8px] sm:text-xs font-black text-blue-500 uppercase tracking-widest">{currentPatientRecord ? `Node ID: ${currentPatientRecord.visitId}` : 'Digital Health Hub'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {currentPatientRecord?.followup === 'Yes' && (
                <div className="hidden sm:flex bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-[10px] font-black items-center gap-2">
                  <Calendar className="w-3 h-3" /> FOLLOW UP: {currentPatientRecord.followupDate}
                </div>
              )}
              <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-3 sm:p-4 bg-white/5 rounded-xl sm:rounded-2xl text-slate-400 border border-white/10"><ArrowLeft size={18} /></button>
            </div>
          </header>

          {!currentPatientRecord ? (
            <div className="bg-white/5 backdrop-blur-3xl border-2 border-dashed border-white/10 p-10 sm:p-16 rounded-[2.5rem] sm:rounded-[3rem] text-center space-y-8 sm:space-y-10 shadow-2xl">
               <div className="w-16 h-16 sm:w-24 sm:h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto"><FileUp className="w-8 h-8 sm:w-10 sm:h-10 text-blue-500" /></div>
               <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-2xl sm:text-3xl font-black text-white">Import Hub Record</h3>
                  <p className="text-slate-500 font-medium text-sm sm:text-lg px-2 sm:px-6 leading-relaxed">Upload your XzeCure PDF to unlock smart trackers and reminders.</p>
               </div>
               <label className="block w-full bg-blue-600 text-white py-6 sm:py-8 rounded-[1.5rem] sm:rounded-[2.5rem] font-black text-lg sm:text-xl cursor-pointer active:scale-95 transition-all shadow-2xl">
                  {isImporting ? <Loader2 className="animate-spin mx-auto" /> : "CHOOSE PDF REPORT"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} />
               </label>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-1000">
               {/* Vitals Summary Row */}
               <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] space-y-2 shadow-xl">
                    <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Blood Pressure</p>
                    <p className="text-2xl sm:text-3xl font-black text-white">{currentPatientRecord.vitalBp || '--'}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] space-y-2 shadow-xl">
                    <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Heart Rate</p>
                    <p className="text-2xl sm:text-3xl font-black text-rose-500">{currentPatientRecord.vitalHr || '--'}</p>
                  </div>
               </div>

               <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] space-y-6 shadow-xl">
                 <div className="flex justify-between items-center">
                    <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3 sm:gap-4"><Pill className="text-blue-500" /> Medications</h3>
                 </div>
                 <div className="grid gap-3 sm:gap-4">
                   {currentPatientRecord.medications.map(med => (
                     <div key={med.id} onClick={() => toggleMed(med.id)} className={`p-4 sm:p-6 rounded-[1.2rem] sm:rounded-[2rem] border transition-all cursor-pointer flex justify-between items-center ${medsStatus[med.id] ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' : 'bg-slate-900 border-white/5 hover:border-white/20'}`}>
                        <div className="flex gap-3 sm:gap-4 items-center">
                          <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${medsStatus[med.id] ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'}`}><Check size={18} /></div>
                          <div>
                            <p className={`text-base sm:text-xl font-bold ${medsStatus[med.id] ? 'text-slate-500 line-through' : 'text-white'}`}>{med.name}</p>
                            <p className="text-[10px] sm:text-xs font-black text-blue-500 uppercase tracking-widest">{med.dose} • {med.timing}</p>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setPrescriptionReminder(med); }} className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${reminders[med.id] ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-600'}`}>
                          <Bell size={18} />
                        </button>
                     </div>
                   ))}
                 </div>
               </div>

               {currentPatientRecord.investigationsAdvised && (
                 <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] space-y-6 shadow-xl">
                   <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3 sm:gap-4"><ClipboardList className="text-amber-500" /> Investigations</h3>
                   <div className="space-y-3">
                     {currentPatientRecord.investigationsAdvised.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0).map((test, idx) => {
                       const isDone = completedInvestigations.includes(test);
                       return (
                         <button 
                           key={idx} 
                           onClick={() => toggleInvestigationItem(test)} 
                           className={`w-full flex items-center justify-between p-4 sm:p-6 rounded-[1.2rem] sm:rounded-[2rem] border-2 transition-all ${isDone ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' : 'bg-slate-900 border-white/10'}`}
                         >
                           <span className={`text-base sm:text-lg font-bold ${isDone ? 'text-slate-500 line-through' : 'text-white'}`}>{test}</span>
                           <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/20'}`}>
                             {isDone && <Check size={14} />}
                           </div>
                         </button>
                       );
                     })}
                   </div>
                 </div>
               )}

               {currentPatientRecord.nonMedicinalAdvice && (
                 <div className="bg-emerald-500/5 backdrop-blur-3xl border border-emerald-500/20 p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] space-y-4 shadow-xl">
                   <h3 className="text-lg sm:text-xl font-black text-emerald-400 flex items-center gap-2 sm:gap-3 uppercase tracking-widest"><HeartPulse size={20} /> Lifestyle & Advice</h3>
                   <p className="text-white text-base sm:text-lg leading-relaxed font-medium bg-slate-950/40 p-5 sm:p-6 rounded-[1.2rem] sm:rounded-[2rem] border border-white/5">{currentPatientRecord.nonMedicinalAdvice}</p>
                 </div>
               )}
            </div>
          )}

          <div className="fixed bottom-6 sm:bottom-10 left-6 sm:left-8 right-6 sm:right-8 flex gap-4 sm:gap-6 z-[60]">
             <button onClick={() => setShowVitalsEntry(true)} className="flex-1 bg-white text-slate-950 p-6 sm:p-8 rounded-[1.8rem] sm:rounded-[2.5rem] font-black text-xl sm:text-2xl flex items-center justify-center gap-3 sm:gap-4 active:scale-95 shadow-2xl transition-all">
               <Activity className="w-6 h-6 sm:w-8 sm:h-8" /> LOG DAILY
             </button>
             <button 
                onClick={() => setShowEmergencyDialog(true)} 
                className="bg-rose-600 text-white p-6 sm:p-8 rounded-[1.8rem] sm:rounded-[2.5rem] active:scale-95 shadow-2xl transition-all"
              >
                <Siren className="w-6 h-6 sm:w-8 sm:h-8" />
              </button>
          </div>

          {showEmergencyDialog && (
            <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
              <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-sm space-y-6 sm:space-y-8 shadow-2xl">
                <div className="text-center space-y-2">
                  <h3 className="text-xl sm:text-2xl font-black text-white">Emergency Support</h3>
                  <p className="text-slate-500 font-medium text-sm sm:text-base">Please select assistance type.</p>
                </div>
                <div className="grid gap-3 sm:gap-4">
                  <button 
                    onClick={() => handleEmergencyAction('ambulance')}
                    className="w-full p-6 sm:p-8 bg-rose-600 text-white rounded-[1.5rem] sm:rounded-[2rem] flex flex-col items-center gap-2 sm:gap-3 active:scale-95 transition-all"
                  >
                    <Siren className="w-8 h-8 sm:w-10 sm:h-10" />
                    <span className="text-lg sm:text-xl font-black uppercase">Ambulance</span>
                  </button>
                  <button 
                    onClick={() => handleEmergencyAction('doctor')}
                    className="w-full p-6 sm:p-8 bg-blue-600 text-white rounded-[1.5rem] sm:rounded-[2rem] flex flex-col items-center gap-2 sm:gap-3 active:scale-95 transition-all"
                  >
                    <Stethoscope className="w-8 h-8 sm:w-10 sm:h-10" />
                    <span className="text-lg sm:text-xl font-black uppercase text-center">Doctor Requirement</span>
                  </button>
                  <button 
                    onClick={() => setShowEmergencyDialog(false)}
                    className="w-full p-3 text-slate-500 font-black uppercase text-[10px] tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {showVitalsEntry && (
            <div className="fixed inset-0 z-[150] bg-slate-950/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
               <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-10 space-y-8 sm:space-y-10 shadow-2xl">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl sm:text-3xl font-black text-white">Record Health</h3>
                    <button onClick={() => setShowVitalsEntry(false)} className="p-3 sm:p-4 bg-white/5 rounded-xl text-slate-500"><XCircle size={24} /></button>
                  </div>
                  <div className="space-y-4 sm:space-y-6">
                    {[
                      {l: 'Blood Pressure', k: 'bp', i: <Activity size={20} />},
                      {l: 'Pulse Rate', k: 'hr', i: <HeartPulse size={20} />},
                      {l: 'Oxygen %', k: 'spo2', i: <Thermometer size={20} />},
                      {l: 'Glucose mg/dL', k: 'rbs', i: <Pill size={20} />},
                      {l: 'Weight kg', k: 'weight', i: <Scale size={20} />}
                    ].map(f => (
                      <div key={f.k} className="relative group">
                         <div className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-500 transition-colors">{f.i}</div>
                         <input 
                           placeholder={f.l} 
                           value={(newVital as any)[f.k]} 
                           onChange={e => setNewVital({...newVital, [f.k]: e.target.value})}
                           className="w-full bg-white/5 p-5 sm:p-7 pl-14 sm:pl-16 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 text-white text-lg sm:text-xl font-bold outline-none focus:border-blue-500 transition-all placeholder:text-slate-800" 
                         />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                     storageService.saveDailyVital(newVital);
                     setDailyVitals(storageService.getDailyVitals());
                     setNewVital({ bp: '', spo2: '', hr: '', rbs: '', weight: '' });
                     setShowVitalsEntry(false);
                     showToast('Record Saved', 'success');
                  }} className="w-full bg-blue-600 text-white py-6 sm:py-8 rounded-[1.5rem] sm:rounded-[2.5rem] font-black text-xl sm:text-2xl shadow-xl active:scale-95 transition-all">SAVE RECORD</button>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
