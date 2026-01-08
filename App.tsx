
import React, { useState, useEffect } from 'react';
import { 
  User, Users, Stethoscope, CheckCircle2, XCircle, Loader2, 
  Pill, ArrowLeft, Bell, BellOff, Check, FileUp, 
  HeartPulse, Siren, Trash2, 
  Plus, FileText, FileDown, CreditCard, Thermometer, Clock,
  Activity, Scale, Calendar, ClipboardList
} from 'lucide-react';
import { SECRET_PIN, SERVICE_GROUPS, DEFAULT_LOGO, DEFAULT_LETTERHEAD } from './constants';
import { VisitData, SavedVisit, Medication, DailyVital } from './types';
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
    vitalHr: '', vitalRbs: '', signs: '', treatment: '', medications: [],
    followup: 'No', followupDate: '', whatsappNumber: '',
    serviceCharge: 0, quantity: 1, pdfColor: 'white', serviceName: 'Standard Consultation',
    photos: []
  };

  const [formData, setFormData] = useState<VisitData>(initialFormState);
  const [letterhead] = useState<string>(DEFAULT_LETTERHEAD);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 3000);
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

  useEffect(() => {
    if (formData.weight && formData.height) {
      const w = parseFloat(formData.weight);
      const h = parseFloat(formData.height) / 100;
      if (w > 0 && h > 0) {
        setFormData(prev => ({ ...prev, bmi: (w / (h * h)).toFixed(1) }));
      }
    }
  }, [formData.weight, formData.height]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const requestNotificationPermission = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      showToast('Notifications Enabled!', 'success');
      if (currentPatientRecord) {
        currentPatientRecord.medications.forEach(med => {
          if (reminders[med.id]) {
            notificationService.scheduleMedicationReminder(currentPatientRecord.patientName, med);
          }
        });
      }
    } else {
      showToast('Notifications are blocked', 'error');
    }
  };

  const setPrescriptionReminder = (med: Medication) => {
    if (!notificationsEnabled) {
      requestNotificationPermission();
      return;
    }
    const medId = med.id;
    const isAlreadyEnabled = reminders[medId];
    if (isAlreadyEnabled) {
      setReminders(prev => ({ ...prev, [medId]: false }));
      showToast(`Reminder removed`, 'info');
    } else {
      setReminders(prev => ({ ...prev, [medId]: true }));
      showToast(`Schedule Sync Done!`, 'success');
      if (currentPatientRecord) {
        notificationService.scheduleMedicationReminder(currentPatientRecord.patientName, med);
      }
    }
  };

  const handlePinSubmit = () => {
    if (pin === SECRET_PIN) {
      setIsLocked(false);
      setPinError('');
    } else {
      setPinError('Wrong PIN.');
      setPin('');
    }
  };

  const handleEmergencyRequest = () => {
    if ("geolocation" in navigator) {
      showToast('Getting Location...', 'info');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          const message = encodeURIComponent(`🚨 EMERGENCY 🚨\nLocation: ${mapsUrl}\nID: ${currentPatientRecord?.visitId || 'XZ-GUEST'}`);
          window.open(`https://wa.me/918200095781?text=${message}`, "_blank");
        },
        () => {
          window.open(`https://wa.me/918200095781?text=${encodeURIComponent('🚨 EMERGENCY ALERT 🚨')}`, "_blank");
        }
      );
    } else {
      window.open(`https://wa.me/918200095781?text=${encodeURIComponent('🚨 EMERGENCY ALERT 🚨')}`, "_blank");
    }
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) resolve(reader.result);
          else reject(new Error("Failed to read PDF"));
        };
        reader.onerror = () => reject(new Error("Failed to read PDF file"));
        reader.readAsArrayBuffer(file);
      });
      const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await (loadingTask as any).promise;
      const metadataResult = await (pdf as any).getMetadata();
      const info = (metadataResult.info || {}) as any;
      const embeddedData = info.Subject;
      if (!embeddedData) throw new Error("No Data Embedded");
      const decodedJson = decodeURIComponent(escape(atob(embeddedData)));
      const visitData: VisitData = JSON.parse(decodedJson);
      setCurrentPatientRecord(visitData);
      showToast('Record Synced!', 'success');
    } catch (err) {
      showToast('Error reading report.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveVitals = () => {
    if (!newVital.bp && !newVital.spo2 && !newVital.hr && !newVital.rbs && !newVital.weight) {
      showToast('Enter data first', 'error');
      return;
    }
    const saved = storageService.saveDailyVital(newVital);
    setDailyVitals([saved, ...dailyVitals].slice(0, 30));
    setNewVital({ bp: '', spo2: '', hr: '', rbs: '', weight: '' });
    setShowVitalsEntry(false);
    showToast('Readings Saved!', 'success');
  };

  const toggleMed = (id: string) => {
    setMedsStatus(prev => ({ ...prev, [id]: !prev[id] }));
    if (!medsStatus[id] && 'vibrate' in navigator) navigator.vibrate(100);
  };

  const toggleInvestigationItem = (itemName: string) => {
    if (!currentPatientRecord) return;
    const nextCompleted = storageService.toggleInvestigationItem(currentPatientRecord.visitId, itemName);
    setCompletedInvestigations(nextCompleted);
    if ('vibrate' in navigator) navigator.vibrate(50);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const vId = `XZ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const finalData = { ...formData, visitId: vId };
      const blob = await generateVisitPdf(finalData, finalData.photos, letterhead);
      setPdfBlob(blob);
      storageService.saveVisit({ visitId: vId, name: finalData.patientName, date: new Date().toISOString(), staff: finalData.staffName, fullData: finalData });
      showToast('Report Generated!', 'success');
    } catch (err) {
      showToast('PDF Engine Error', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-[200]">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-64 h-64 bg-rose-500/20 rounded-full animate-ping" />
          <HeartPulse className="w-40 h-40 text-rose-500 relative z-10 animate-bounce" />
        </div>
        <div className="mt-12 text-center space-y-3 z-10">
          <h1 className="text-5xl font-black text-white tracking-tighter">XzeCure</h1>
          <p className="text-emerald-400 font-black uppercase text-[12px] tracking-[0.4em]">Digital Health Node</p>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4">
        <div className="w-full max-md:max-w-md bg-slate-800 rounded-[3rem] p-12 border border-slate-700 shadow-2xl space-y-10">
          <div className="flex flex-col items-center space-y-6">
            <div className="p-6 bg-slate-900/40 rounded-[2.5rem] shadow-xl border border-slate-700/50 backdrop-blur-md">
              <img src={DEFAULT_LOGO} alt="XzeCure Logo" className="w-24 h-24 object-contain" />
            </div>
            <h1 className="text-4xl font-black text-white">XzeCure</h1>
            <p className="text-slate-400 font-bold text-center text-lg">Secure Personal Medical Hub</p>
          </div>
          {!selectedRole ? (
            <div className="space-y-6">
              <button onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} className="w-full p-8 bg-emerald-600 rounded-[2.5rem] flex items-center gap-6 shadow-xl active:scale-95 transition-all">
                <div className="p-4 bg-emerald-500 rounded-2xl"><Users className="w-8 h-8 text-white" /></div>
                <div className="text-left font-black text-2xl text-white">Patient Portal</div>
              </button>
              <button onClick={() => setSelectedRole('doctor')} className="w-full p-8 bg-slate-700 rounded-[2.5rem] flex items-center gap-6 active:scale-95 transition-all">
                <div className="p-4 bg-slate-600 rounded-2xl"><Stethoscope className="w-8 h-8 text-white" /></div>
                <div className="text-left font-black text-2xl text-white">Doctor Access</div>
              </button>
              <button onClick={handleEmergencyRequest} className="w-full p-6 bg-rose-600 text-white rounded-[2rem] flex flex-col items-center justify-center gap-2 shadow-xl active:scale-95 transition-all group">
                <Siren className="w-10 h-10 group-hover:animate-bounce" />
                <span className="font-black text-xl uppercase tracking-tighter">EMERGENCY SOS</span>
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right">
              <input type="password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} autoFocus placeholder="••••••"
                  className="w-full bg-slate-900 border-4 border-slate-700 text-white text-6xl tracking-[1rem] text-center py-8 rounded-[2rem] outline-none focus:border-emerald-500 font-mono" />
              <button onClick={handlePinSubmit} className="w-full bg-emerald-500 text-white font-black py-6 rounded-[2rem] text-2xl shadow-xl active:scale-95 transition-all">VERIFY PIN</button>
              <button onClick={() => setSelectedRole(null)} className="w-full text-slate-500 font-bold">Back</button>
              {pinError && <p className="text-rose-500 text-center font-bold">{pinError}</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedRole === 'patient') {
    const investigationList = currentPatientRecord?.investigationsAdvised
      ? currentPatientRecord.investigationsAdvised.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0)
      : [];

    return (
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-10 pb-48 relative">
        {toast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-slate-800 border-2 border-slate-700 px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
             <div className={`w-3 h-3 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
             <span className="text-white font-black uppercase text-[10px] tracking-widest">{toast.message}</span>
          </div>
        )}
        <header className="flex justify-between items-center bg-slate-800 p-6 rounded-[2.5rem] border border-slate-700">
           <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center"><User className="w-8 h-8 text-white" /></div>
              <div><h2 className="text-2xl font-black text-white">{currentPatientRecord ? currentPatientRecord.patientName : 'Guest'}</h2><p className="text-emerald-400 font-black uppercase text-[10px] tracking-widest">{currentPatientRecord ? `ID: ${currentPatientRecord.visitId}` : 'Offline Node'}</p></div>
           </div>
           <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-4 bg-slate-700 rounded-2xl text-slate-400"><ArrowLeft className="w-6 h-6" /></button>
        </header>

        {currentPatientRecord && investigationList.length > 0 && (
          <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-2xl space-y-6">
             <h3 className="text-2xl font-black text-white flex items-center gap-4"><FileText className="w-8 h-8 text-amber-500" /> Clinical Tests</h3>
             <div className="space-y-4">
               {investigationList.map((test, idx) => {
                 const isDone = completedInvestigations.includes(test);
                 return (
                   <button key={idx} onClick={() => toggleInvestigationItem(test)} className={`w-full flex items-center gap-4 p-6 rounded-[2rem] border-2 transition-all ${isDone ? 'bg-emerald-900/20 border-emerald-500/50 opacity-60' : 'bg-slate-900 border-slate-700'}`}>
                     <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isDone ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-slate-600'}`}>
                        {isDone && <Check className="w-5 h-5" />}
                     </div>
                     <span className={`text-xl font-bold ${isDone ? 'text-emerald-400 line-through' : 'text-slate-200'}`}>{test}</span>
                   </button>
                 );
               })}
             </div>
          </div>
        )}

        {currentPatientRecord && (
          <div className="bg-slate-800 p-8 rounded-[3rem] border border-slate-700 shadow-2xl space-y-10">
             <div className="flex justify-between items-center">
                <h3 className="text-3xl font-black text-white flex items-center gap-4"><Pill className="w-10 h-10 text-blue-500" /> Meds</h3>
                <button onClick={requestNotificationPermission} className={`p-4 rounded-2xl transition-all ${notificationsEnabled ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-600 bg-slate-900'}`}>{notificationsEnabled ? <Bell className="w-8 h-8" /> : <BellOff className="w-8 h-8" />}</button>
             </div>
             <div className="space-y-6">
                {currentPatientRecord.medications.map(med => (
                  <div key={med.id} className={`p-8 rounded-[2.5rem] border-4 flex flex-col gap-6 transition-all ${medsStatus[med.id] ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-900 border-slate-700'}`}>
                     <div className="flex justify-between items-center">
                        <div>
                          <p className="text-2xl font-black text-white">{med.name}</p>
                          <p className="text-sm font-black text-slate-500 uppercase tracking-widest">{med.dose} • {med.timing}</p>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => setPrescriptionReminder(med)} className={`p-4 rounded-xl ${reminders[med.id] ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-800 text-slate-500'}`}><Bell className="w-6 h-6" /></button>
                           <button onClick={() => toggleMed(med.id)} className={`p-4 rounded-xl ${medsStatus[med.id] ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}><Check className="w-8 h-8" /></button>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {!currentPatientRecord && (
          <div className="bg-slate-800 p-10 rounded-[3rem] border border-slate-700 text-center border-dashed border-2">
             <FileUp className="w-16 h-16 mx-auto text-blue-500 mb-6" />
             <h3 className="text-2xl font-black text-white mb-2">Import Smart Report</h3>
             <p className="text-slate-500 font-bold mb-8">Link your meds and tests instantly</p>
             <label className="w-full block bg-slate-900 border-2 border-slate-700 rounded-[2rem] p-6 cursor-pointer">
                {isImporting ? <Loader2 className="animate-spin w-8 h-8 mx-auto" /> : <p className="text-xl font-black text-white uppercase">Upload Medical PDF</p>}
                <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} disabled={isImporting} />
             </label>
          </div>
        )}

        <div className="flex gap-4 fixed bottom-10 left-6 right-6">
          <button onClick={() => setShowVitalsEntry(true)} className="flex-1 bg-emerald-500 text-white p-8 rounded-[2.5rem] text-2xl font-black flex items-center justify-center gap-4 shadow-2xl active:scale-95"><Activity className="w-8 h-8" /> LOG VITALS</button>
          <button onClick={handleEmergencyRequest} className="bg-rose-600 text-white p-8 rounded-[2.5rem] shadow-2xl active:scale-95"><Siren className="w-8 h-8" /></button>
        </div>

        {showVitalsEntry && (
          <div className="fixed inset-0 z-[150] bg-slate-900 p-8 flex flex-col animate-in slide-in-from-bottom-20">
            <div className="flex justify-between items-center mb-10">
               <button onClick={() => setShowVitalsEntry(false)} className="p-4 bg-slate-800 rounded-2xl"><ArrowLeft className="w-10 h-10" /></button>
               <h3 className="text-3xl font-black text-white">Daily Readings</h3>
               <div className="w-14" />
            </div>
            <div className="space-y-8 flex-1 overflow-y-auto">
               {[
                 {l: 'BP (mmHg)', k: 'bp', i: Activity},
                 {l: 'HR (bpm)', k: 'hr', i: Activity},
                 {l: 'SpO2 (%)', k: 'spo2', i: Thermometer},
                 {l: 'RBS (mg/dL)', k: 'rbs', i: Activity},
                 {l: 'Weight (kg)', k: 'weight', i: Scale}
               ].map(item => (
                 <div key={item.k} className="space-y-2">
                   <label className="flex items-center gap-3 text-slate-500 font-black uppercase text-[10px] tracking-widest"><item.i className="w-4 h-4" /> {item.l}</label>
                   <input type="text" value={(newVital as any)[item.k]} onChange={(e) => setNewVital({...newVital, [item.k]: e.target.value})} className="w-full bg-slate-800 border-4 border-slate-700 p-8 rounded-[2rem] text-4xl font-black text-white focus:border-emerald-500 outline-none" />
                 </div>
               ))}
            </div>
            <button onClick={handleSaveVitals} className="mt-8 bg-emerald-500 text-white p-10 rounded-[3rem] text-3xl font-black">SAVE READINGS</button>
          </div>
        )}
      </div>
    );
  }

  // DOCTOR PORTAL
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 pb-32">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-slate-800 border-2 border-slate-700 px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
           <div className={`w-3 h-3 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
           <span className="text-white font-black uppercase text-[10px] tracking-widest">{toast.message}</span>
        </div>
      )}
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900/40 p-3 rounded-2xl shadow-xl border border-slate-700/50 backdrop-blur-md">
            <img src={DEFAULT_LOGO} alt="XzeCure Logo" className="w-12 h-12 object-contain" />
          </div>
          <div><h1 className="text-3xl font-black tracking-tighter text-white">XzeCure Node</h1><p className="text-slate-500 text-[8px] font-black uppercase tracking-widest opacity-60">Practitioner Terminal</p></div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-4 bg-slate-800 rounded-2xl border border-slate-700 text-rose-500"><ArrowLeft className="w-6 h-6" /></button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-slate-800 p-10 rounded-[3.5rem] border border-slate-700 shadow-2xl space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-1"><label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Practitioner Name</label><input required type="text" value={formData.staffName} onChange={(e) => setFormData({...formData, staffName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-lg font-bold" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Patient Name</label><input required type="text" value={formData.patientName} onChange={(e) => setFormData({...formData, patientName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-lg font-bold" /></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-slate-700/50">
            <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase ml-1">Age</label><input type="text" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold" /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase ml-1">Phone</label><input type="tel" value={formData.contactNumber} onChange={(e) => setFormData({...formData, contactNumber: e.target.value})} className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold" /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase ml-1">Wt (kg)</label><input type="number" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold" /></div>
            <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase ml-1">BMI</label><div className="bg-slate-900 p-4 rounded-2xl border border-slate-700 flex justify-center items-center font-black text-emerald-400">{formData.bmi || '--'}</div></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-8 border-t border-slate-700/50">
             <div className="space-y-1"><label className="text-[9px] font-black text-rose-500 uppercase ml-1">Temp (°F)</label><input type="text" value={formData.vitalTemp} onChange={(e) => setFormData({...formData, vitalTemp: e.target.value})} placeholder="98.6" className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold" /></div>
             <div className="space-y-1"><label className="text-[9px] font-black text-blue-500 uppercase ml-1">BP (mmHg)</label><input type="text" value={formData.vitalBp} onChange={(e) => setFormData({...formData, vitalBp: e.target.value})} placeholder="120/80" className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold" /></div>
             <div className="space-y-1"><label className="text-[9px] font-black text-emerald-500 uppercase ml-1">SpO2 (%)</label><input type="text" value={formData.vitalSpo2} onChange={(e) => setFormData({...formData, vitalSpo2: e.target.value})} placeholder="98" className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold" /></div>
             <div className="space-y-1"><label className="text-[9px] font-black text-red-500 uppercase ml-1">HR (bpm)</label><input type="text" value={formData.vitalHr} onChange={(e) => setFormData({...formData, vitalHr: e.target.value})} placeholder="72" className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold" /></div>
             <div className="space-y-1"><label className="text-[9px] font-black text-amber-500 uppercase ml-1">RBS (mg/dL)</label><input type="text" value={formData.vitalRbs} onChange={(e) => setFormData({...formData, vitalRbs: e.target.value})} placeholder="100" className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold" /></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-8 border-t border-slate-700/50">
             <div className="space-y-2"><label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">History & Findings</label><textarea required value={formData.complaints} onChange={(e) => setFormData({...formData, complaints: e.target.value})} placeholder="Findings..." className="w-full bg-slate-900 border border-slate-700 p-5 rounded-[2rem] font-medium" rows={4} /></div>
             <div className="space-y-2"><label className="text-[10px] font-black text-amber-400 uppercase tracking-widest ml-1">Blood Investigations</label><textarea value={formData.investigationsAdvised} onChange={(e) => setFormData({...formData, investigationsAdvised: e.target.value})} placeholder="Advised tests..." className="w-full bg-slate-900 border border-slate-700 p-5 rounded-[2rem] font-medium" rows={4} /></div>
          </div>

          <div className="pt-10 border-t border-slate-700/50 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex items-center gap-2">
                <Pill className="w-6 h-6 text-blue-400" />
                <h3 className="text-xl font-black text-blue-400 uppercase tracking-tighter">Medications</h3>
              </div>
              
              <div className="flex-1 w-full max-w-md relative">
                <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="text" 
                  value={formData.treatment} 
                  onChange={(e) => setFormData({...formData, treatment: e.target.value})} 
                  placeholder="Other Advice / Treatment Instructions..." 
                  className="w-full bg-slate-900/50 border border-slate-700 p-3 pl-12 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold placeholder:text-slate-600 transition-all" 
                />
              </div>

              <button type="button" onClick={() => setFormData(p => ({...p, medications: [...p.medications, { id: crypto.randomUUID(), route: 'Oral', name: '', dose: '', frequency: 1, timing: '' }]}))} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg">
                <Plus className="w-4 h-4" /> Add Med
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {formData.medications.map(med => (
                  <div key={med.id} className="bg-slate-900/80 p-6 rounded-[2rem] border-2 border-slate-700/50 flex flex-col gap-6 hover:border-blue-500/30 transition-all animate-in slide-in-from-left-2 shadow-xl">
                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                       <div className="md:col-span-3">
                         <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Route</label>
                         <select value={med.route} onChange={e => updateMedication(med.id, { route: e.target.value })} className="w-full bg-slate-800 border-none rounded-xl text-[10px] font-black p-3.5 text-white outline-none focus:ring-2 focus:ring-blue-500/50">
                          {['Oral', 'IV', 'IM', 'SC', 'Nasal', 'RT', 'Topical'].map(r => <option key={r}>{r}</option>)}
                        </select>
                       </div>
                       <div className="md:col-span-9">
                         <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Medicine Name</label>
                         <input type="text" value={med.name} onChange={e => updateMedication(med.id, { name: e.target.value })} placeholder="Enter medication name..." className="w-full bg-slate-800/50 border-b-2 border-slate-700 text-sm font-bold p-3 outline-none text-white focus:border-blue-500 transition-colors rounded-t-xl" />
                       </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                       <div className="md:col-span-3">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Dosage</label>
                        <input type="text" value={med.dose} onChange={e => updateMedication(med.id, { dose: e.target.value })} placeholder="e.g. 500mg" className="w-full bg-slate-800 border-none rounded-xl text-[10px] font-black p-3.5 text-white outline-none" />
                       </div>
                       
                       <div className="md:col-span-3">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block text-center">Frequency</label>
                        <div className="flex gap-1 justify-center bg-slate-800 p-1 rounded-xl">
                          {[1, 2, 3, 4].map(n => <button key={n} type="button" onClick={() => updateMedication(med.id, { frequency: n })} className={`flex-1 h-9 rounded-lg flex items-center justify-center text-[11px] font-black transition-all ${med.frequency >= n ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-700'}`}>{n}x</button>)}
                        </div>
                       </div>

                       <div className="md:col-span-5">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1 block">Timing / Schedule</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                          <input type="text" value={med.timing} onChange={e => updateMedication(med.id, { timing: e.target.value })} placeholder="e.g. 8am, Before Food" className="w-full bg-slate-800 border-none rounded-xl text-[10px] font-black p-3.5 pl-10 text-blue-300 outline-none" />
                        </div>
                       </div>

                       <div className="md:col-span-1 flex justify-center">
                        <button type="button" onClick={() => setFormData(p => ({...p, medications: p.medications.filter(m => m.id !== med.id)}))} className="p-3.5 text-slate-600 hover:text-rose-500 transition-colors"><Trash2 className="w-6 h-6" /></button>
                       </div>
                     </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="pt-8 border-t border-slate-700/50 grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-4">
               <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Billing Service</label>
               <select onChange={handleServiceChange} className="w-full bg-slate-900 border border-slate-700 p-6 rounded-2xl font-black outline-none text-white">
                  <option value="">-- Select Service --</option>
                  {SERVICE_GROUPS.map(g => (<optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}</optgroup>))}
               </select>
               {formData.serviceCharge > 0 && (
                 <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex justify-between items-center">
                   <span className="text-emerald-400 font-black text-[12px] uppercase tracking-widest">Charge</span>
                   <span className="text-2xl font-black text-white">₹{formData.serviceCharge}</span>
                 </div>
               )}
             </div>

             <div className="space-y-4">
               <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Follow-up Required?</label>
               <div className="flex gap-4">
                 <button type="button" onClick={() => setFormData({...formData, followup: 'Yes'})} className={`flex-1 py-4 rounded-2xl font-black border-2 transition-all ${formData.followup === 'Yes' ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>YES</button>
                 <button type="button" onClick={() => setFormData({...formData, followup: 'No', followupDate: ''})} className={`flex-1 py-4 rounded-2xl font-black border-2 transition-all ${formData.followup === 'No' ? 'bg-rose-600 border-rose-400 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>NO</button>
               </div>
               {formData.followup === 'Yes' && (
                 <div className="animate-in slide-in-from-top-2">
                   <input type="date" value={formData.followupDate} onChange={(e) => setFormData({...formData, followupDate: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-white font-bold" />
                 </div>
               )}
             </div>
          </div>

          <div className="space-y-4">
            <button type="submit" disabled={isGenerating} className="w-full bg-white text-slate-900 py-6 rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl disabled:opacity-50">
              {isGenerating ? <><Loader2 className="animate-spin" /> WORKING...</> : <><FileText className="w-8 h-8" /> GENERATE CLINICAL PDF</>}
            </button>
          </div>
        </div>
      </form>

      {pdfBlob && (
        <div className="bg-slate-800 rounded-[3rem] p-10 border border-emerald-500/50 shadow-2xl space-y-8 animate-in zoom-in">
           <div className="flex justify-between items-center">
             <h3 className="text-2xl font-black text-emerald-400 flex items-center gap-3"><CheckCircle2 className="w-8 h-8" /> Smart Report Ready</h3>
             <button onClick={() => setPdfBlob(null)} className="p-4 bg-slate-700 rounded-2xl"><XCircle className="w-6 h-6" /></button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <button onClick={() => window.open(URL.createObjectURL(pdfBlob as Blob))} className="p-6 bg-blue-600 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"><FileDown className="w-8 h-8" /> DOWNLOAD PDF</button>
             <a href="upi://pay?pa=8200095781@pthdfc&pn=KenilShah" className="p-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all"><CreditCard className="w-8 h-8" /> COLLECT PAYMENT</a>
           </div>
           <div className="bg-white rounded-[2rem] overflow-hidden border-8 border-slate-900 shadow-inner">
             <iframe src={URL.createObjectURL(pdfBlob as Blob)} title="PDF Preview" className="w-full h-[700px]" />
           </div>
        </div>
      )}
      <footer className="text-center pb-12">
        <p className="text-slate-700 font-black text-[10px] uppercase tracking-[0.5em]">© XzeCure v2.1</p>
      </footer>
    </div>
  );
};

export default App;
