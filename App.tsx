
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  User, Users, Stethoscope, CheckCircle2, XCircle, Loader2, 
  Pill, ArrowLeft, Bell, BellOff, Check, FileUp, 
  HeartPulse, Siren, Trash2, 
  Plus, FileText, FileDown, CreditCard, Thermometer, Clock,
  Activity, Scale, Calendar, ClipboardList, ChevronRight
} from 'lucide-react';
import { SECRET_PIN, SERVICE_GROUPS, DEFAULT_LOGO, DEFAULT_LETTERHEAD } from './constants';
import { VisitData, Medication, DailyVital } from './types';
import { storageService } from './services/storageService';
import { generateVisitPdf } from './services/pdfService';
import { notificationService } from './services/notificationService';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@^4.0.379/build/pdf.worker.mjs`;

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [isLocked, setIsLocked] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'doctor' | 'patient' | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  
  // Patient Hub State
  const [currentPatientRecord, setCurrentPatientRecord] = useState<VisitData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [medsStatus, setMedsStatus] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [completedInvestigations, setCompletedInvestigations] = useState<string[]>([]);
  const [showVitalsEntry, setShowVitalsEntry] = useState(false);
  const [dailyVitals, setDailyVitals] = useState<DailyVital[]>([]);
  const [newVital, setNewVital] = useState({ bp: '', spo2: '', hr: '', rbs: '', weight: '' });

  // Practitioner Hub State
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

  const [formData, setFormData] = useState<VisitData>(() => {
    const draft = storageService.getFormDraft();
    return draft || initialFormState;
  });
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftIn'>('cm');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 2000);
    setDailyVitals(storageService.getDailyVitals());
    if ('Notification' in window) setNotificationsEnabled(Notification.permission === 'granted');
    return () => clearTimeout(timer);
  }, []);

  // Sync state to local storage for persistence
  useEffect(() => {
    if (selectedRole === 'doctor' && formData !== initialFormState) {
      storageService.saveFormDraft(formData);
    }
  }, [formData, selectedRole]);

  useEffect(() => {
    if (currentPatientRecord) {
      setCompletedInvestigations(storageService.getCompletedInvestigations(currentPatientRecord.visitId));
    }
  }, [currentPatientRecord]);

  // Real-time BMI Processor
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
      if (formData.bmi !== calculatedBmi) setFormData(prev => ({ ...prev, bmi: calculatedBmi }));
    } else if (formData.bmi !== '') {
      setFormData(prev => ({ ...prev, bmi: '' }));
    }
  }, [formData.weight, formData.height, heightFt, heightIn, heightUnit, formData.bmi]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleEmergencyRequest = () => {
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 500]);
    if ("geolocation" in navigator) {
      showToast('Transmitting Location...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const msg = encodeURIComponent(`🚨 EMERGENCY SOS 🚨\nPatient: ${currentPatientRecord?.patientName || 'Hub User'}\nLocation: https://www.google.com/maps?q=${latitude},${longitude}\nVisit ID: ${currentPatientRecord?.visitId || 'XZ-HUB'}`);
          window.open(`https://wa.me/918200095781?text=${msg}`, "_blank");
        },
        () => window.open(`https://wa.me/918200095781?text=${encodeURIComponent('🚨 EMERGENCY ALERT FROM XZECURE 🚨')}`, "_blank")
      );
    } else {
      window.open(`https://wa.me/918200095781?text=${encodeURIComponent('🚨 EMERGENCY ALERT FROM XZECURE 🚨')}`, "_blank");
    }
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const loadingTask = getDocument({ data: new Uint8Array(buffer) });
      const pdf = await (loadingTask as any).promise;
      const metadataResult = await (pdf as any).getMetadata();
      const info = (metadataResult.info || {}) as any;
      const embeddedData = info.Subject;
      if (!embeddedData) throw new Error("Format Error");
      const decodedJson = decodeURIComponent(escape(atob(embeddedData)));
      const visitData: VisitData = JSON.parse(decodedJson);
      setCurrentPatientRecord(visitData);
      showToast('Secure Sync Success', 'success');
    } catch (err) {
      showToast('Sync Incompatible', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const setPrescriptionReminder = useCallback((med: Medication) => {
    if (!notificationsEnabled) {
      notificationService.requestPermission().then(granted => {
        setNotificationsEnabled(granted);
        if (granted) showToast('Reminders Enabled', 'success');
      });
      return;
    }
    const medId = med.id;
    if (reminders[medId]) {
      setReminders(prev => ({ ...prev, [medId]: false }));
      showToast(`Muted: ${med.name}`, 'info');
    } else {
      setReminders(prev => ({ ...prev, [medId]: true }));
      showToast(`Reminder Scheduled: ${med.timing}`, 'success');
      if (currentPatientRecord) notificationService.scheduleMedicationReminder(currentPatientRecord.patientName, med);
    }
  }, [notificationsEnabled, reminders, currentPatientRecord, showToast]);

  // Fix: Added handleServiceChange to manage service selection and billing
  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    const label = e.target.options[e.target.selectedIndex].text;
    if (!isNaN(value)) {
      setFormData(prev => ({ 
        ...prev, 
        serviceCharge: value, 
        serviceName: label.split(' - ')[0] 
      }));
    }
  };

  // Fix: Added toggleMed to track medication adherence in Patient Hub
  const toggleMed = (medId: string) => {
    setMedsStatus(prev => ({ ...prev, [medId]: !prev[medId] }));
    if ('vibrate' in navigator) navigator.vibrate(20);
  };

  // Fix: Added toggleInvestigationItem to track completed labs/tests
  const toggleInvestigationItem = (itemName: string) => {
    if (!currentPatientRecord) return;
    const updated = storageService.toggleInvestigationItem(currentPatientRecord.visitId, itemName);
    setCompletedInvestigations(updated);
    if ('vibrate' in navigator) navigator.vibrate(30);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    if ('vibrate' in navigator) navigator.vibrate(50);
    try {
      const vId = `XZ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      let normalizedHeight = formData.height;
      if (heightUnit === 'ftIn') {
        const ft = parseFloat(heightFt) || 0;
        const inch = parseFloat(heightIn) || 0;
        normalizedHeight = ((ft * 12 + inch) * 2.54).toFixed(1);
      }
      const finalData = { ...formData, visitId: vId, height: normalizedHeight };
      const blob = await generateVisitPdf(finalData, finalData.photos, DEFAULT_LETTERHEAD);
      setPdfBlob(blob);
      storageService.saveVisit({ visitId: vId, name: finalData.patientName, date: new Date().toISOString(), staff: finalData.staffName, fullData: finalData });
      showToast('Clinical Hub Updated', 'success');
    } catch (err) {
      showToast('Compiler Error', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[200]">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/30 blur-[120px] rounded-full animate-pulse" />
          <HeartPulse className="w-32 h-32 text-blue-500 relative z-10" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tighter mt-12 animate-pulse">XzeCure Hub</h1>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 selection:bg-blue-500">
        <div className="w-full max-sm:px-4 max-w-sm space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-block p-6 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl">
              <img src={DEFAULT_LOGO} className="w-20 h-20 object-contain" alt="XzeCure Logo" />
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter">XzeCure</h1>
            <p className="text-slate-500 font-bold text-lg uppercase tracking-widest text-[10px]">Secure Medical Node</p>
          </div>
          <div className="grid gap-4">
            <button onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} className="group p-8 bg-blue-600 rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all shadow-2xl shadow-blue-500/20">
               <div className="flex items-center gap-4 text-white">
                 <Users className="w-8 h-8" />
                 <span className="text-2xl font-black tracking-tight">Patient Hub</span>
               </div>
               <ChevronRight className="w-6 h-6 text-white/50 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => setSelectedRole('doctor')} className="group p-8 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all shadow-xl">
               <div className="flex items-center gap-4 text-slate-300">
                 <Stethoscope className="w-8 h-8" />
                 <span className="text-2xl font-black tracking-tight">Doctor Hub</span>
               </div>
               <ChevronRight className="w-6 h-6 text-slate-500" />
            </button>
            <button onClick={handleEmergencyRequest} className="p-8 bg-rose-600 rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all shadow-2xl shadow-rose-600/20 group">
               <div className="flex items-center gap-4 text-white">
                 <Siren className="w-8 h-8 group-hover:animate-bounce" />
                 <span className="text-2xl font-black tracking-tight">Emergency SOS</span>
               </div>
               <ChevronRight className="w-6 h-6 text-white/50" />
            </button>
          </div>
          {selectedRole === 'doctor' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <input type="password" maxLength={6} value={pin} onChange={(e) => {
                setPin(e.target.value);
                if (e.target.value === SECRET_PIN) { setIsLocked(false); setPinError(''); }
              }} placeholder="••••••"
              className="w-full bg-slate-900 border-2 border-white/10 text-white text-center py-6 rounded-[2.5rem] text-4xl font-black outline-none focus:border-blue-500 transition-all" />
              {pinError && <p className="text-rose-500 text-center font-bold">{pinError}</p>}
              <button onClick={() => setSelectedRole(null)} className="w-full text-slate-600 font-bold uppercase tracking-widest text-xs">Switch Mode</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-32">
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-white text-slate-950 px-8 py-4 rounded-full shadow-2xl font-black text-xs tracking-[0.2em] animate-in slide-in-from-top-12">
          {toast.message.toUpperCase()}
        </div>
      )}

      {selectedRole === 'doctor' ? (
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
          <header className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="p-5 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl"><img src={DEFAULT_LOGO} className="w-14 h-14" alt="Logo" /></div>
              <div>
                <h1 className="text-4xl font-black text-white tracking-tighter">Clinical Hub</h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Practitioner Access</p>
              </div>
            </div>
            <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-5 bg-white/5 border border-white/10 rounded-[2rem] text-slate-400 hover:text-white transition-colors active:scale-90"><ArrowLeft /></button>
          </header>

          <form onSubmit={handleSubmit} className="space-y-12">
            <div className="bg-white/5 backdrop-blur-3xl rounded-[3.5rem] border border-white/10 p-12 shadow-2xl space-y-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><Stethoscope size={200} /></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Practitioner Profile</label>
                  <input required type="text" value={formData.staffName} onChange={e => setFormData({...formData, staffName: e.target.value})} className="w-full bg-white/5 border border-white/10 p-7 rounded-[2.5rem] text-xl font-bold text-white focus:border-blue-500 outline-none transition-all" placeholder="Dr. Kenil" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Patient Identity</label>
                  <input required type="text" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} className="w-full bg-white/5 border border-white/10 p-7 rounded-[2.5rem] text-xl font-bold text-white focus:border-emerald-500 outline-none transition-all" placeholder="Patient Name" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-12 border-t border-white/5 relative z-10">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Age</label>
                  <input type="text" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-white/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Contact</label>
                  <input type="text" value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-white/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Weight (kg)</label>
                  <input type="text" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-white/20" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Height</label>
                    <button type="button" onClick={() => setHeightUnit(h => h === 'cm' ? 'ftIn' : 'cm')} className="text-[8px] font-black text-blue-500 uppercase tracking-widest px-2 py-0.5 border border-blue-500/20 rounded-full">{heightUnit}</button>
                  </div>
                  {heightUnit === 'cm' ? (
                    <input type="text" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} placeholder="cm" className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-lg font-bold text-white outline-none" />
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" value={heightFt} onChange={e => setHeightFt(e.target.value)} placeholder="ft" className="w-1/2 bg-white/5 border border-white/10 p-5 rounded-[2rem] text-lg font-bold text-white outline-none" />
                      <input type="text" value={heightIn} onChange={e => setHeightIn(e.target.value)} placeholder="in" className="w-1/2 bg-white/5 border border-white/10 p-5 rounded-[2rem] text-lg font-bold text-white outline-none" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-blue-500 uppercase ml-1">BMI Score</label>
                  <div className="w-full bg-blue-500/10 border border-blue-500/20 p-5 rounded-[2rem] text-2xl font-black text-blue-400 text-center">{formData.bmi || '--'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-white/5 relative z-10">
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Clinical Assessment</label>
                   <textarea value={formData.complaints} onChange={e => setFormData({...formData, complaints: e.target.value})} rows={4} className="w-full bg-white/5 border border-white/10 p-7 rounded-[2.5rem] font-bold text-white outline-none focus:border-blue-500 transition-all resize-none" placeholder="Diagnosis / Symptoms..." />
                 </div>
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">Medical History</label>
                   <textarea value={formData.history} onChange={e => setFormData({...formData, history: e.target.value})} rows={4} className="w-full bg-white/5 border border-white/10 p-7 rounded-[2.5rem] font-bold text-white outline-none focus:border-rose-500 transition-all resize-none" placeholder="Past illness / surgeries..." />
                 </div>
              </div>

              <div className="space-y-10 pt-12 border-t border-white/5 relative z-10">
                 <div className="flex justify-between items-center">
                   <h3 className="text-3xl font-black text-white flex items-center gap-4"><Pill className="text-blue-500 w-10 h-10" /> Prescription Hub</h3>
                   <button type="button" onClick={() => setFormData(p => ({...p, medications: [...p.medications, { id: crypto.randomUUID(), route: 'Oral', name: '', dose: '', frequency: 1, timing: '' }]}))} className="bg-blue-600 px-8 py-4 rounded-[2rem] text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 active:scale-95 transition-all shadow-xl">
                     <Plus className="w-5 h-5" /> Add Medication
                   </button>
                 </div>
                 
                 <div className="space-y-4">
                   {formData.medications.map(med => (
                     <div key={med.id} className="bg-white/5 border border-white/10 p-8 rounded-[3rem] flex flex-col md:flex-row gap-8 items-center group shadow-xl hover:bg-white/10 transition-colors">
                        <div className="w-full md:w-32">
                          <label className="text-[8px] font-black text-slate-600 uppercase mb-2 block">Route</label>
                          <select value={med.route} onChange={e => setFormData(p => ({...p, medications: p.medications.map(m => m.id === med.id ? {...m, route: e.target.value} : m)}))} className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-xs font-black text-white outline-none">
                            {['Oral', 'IV', 'IM', 'SC', 'Nasal', 'RT', 'Topical'].map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div className="flex-1 w-full">
                          <label className="text-[8px] font-black text-slate-600 uppercase block mb-1">Medicine</label>
                          <input type="text" value={med.name} onChange={e => setFormData(p => ({...p, medications: p.medications.map(m => m.id === med.id ? {...m, name: e.target.value} : m)}))} className="w-full bg-transparent border-b-2 border-white/10 p-3 text-xl font-black text-white outline-none focus:border-blue-500 transition-all" placeholder="Drug Name" />
                        </div>
                        <div className="w-full md:w-48">
                          <label className="text-[8px] font-black text-slate-600 uppercase block mb-1">Schedule</label>
                          <input type="text" value={med.timing} onChange={e => setFormData(p => ({...p, medications: p.medications.map(m => m.id === med.id ? {...m, timing: e.target.value} : m)}))} className="w-full bg-white/5 p-4 rounded-2xl border border-white/5 outline-none text-sm font-bold text-blue-400 text-center" placeholder="Time / Dose" />
                        </div>
                        <button type="button" onClick={() => setFormData(p => ({...p, medications: p.medications.filter(m => m.id !== med.id)}))} className="p-5 text-rose-500/50 hover:text-rose-500 transition-all"><Trash2 /></button>
                     </div>
                   ))}
                 </div>

                 <div className="bg-emerald-500/5 border border-emerald-500/20 p-10 rounded-[3rem] space-y-6">
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Non-Medicinal Health Advices</label>
                    <textarea value={formData.nonMedicinalAdvice} onChange={e => setFormData({...formData, nonMedicinalAdvice: e.target.value})} rows={3} className="w-full bg-transparent border border-emerald-500/10 p-7 rounded-[2.5rem] font-bold text-white outline-none focus:border-emerald-500 transition-all resize-none" placeholder="Lifestyle, diet, and habits..." />
                 </div>
              </div>

              <div className="pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Consolidated Billing</label>
                   <select onChange={handleServiceChange} className="w-full bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] font-black outline-none text-white text-lg active:scale-95 transition-transform">
                      <option value="">-- Service Tier --</option>
                      {SERVICE_GROUPS.map(g => (<optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}</optgroup>))}
                   </select>
                 </div>
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Follow up Protocol</label>
                   <div className="flex gap-4">
                      <button type="button" onClick={() => setFormData({...formData, followup: 'Yes'})} className={`flex-1 p-6 rounded-[2rem] font-black border-2 transition-all ${formData.followup === 'Yes' ? 'bg-blue-600 border-blue-500' : 'bg-white/5 border-white/10 text-slate-600'}`}>REQUIRED</button>
                      <button type="button" onClick={() => setFormData({...formData, followup: 'No', followupDate: ''})} className={`flex-1 p-6 rounded-[2rem] font-black border-2 transition-all ${formData.followup === 'No' ? 'bg-slate-800 border-slate-700' : 'bg-white/5 border-white/10 text-slate-600'}`}>NONE</button>
                   </div>
                   {formData.followup === 'Yes' && <input type="date" value={formData.followupDate} onChange={e => setFormData({...formData, followupDate: e.target.value})} className="w-full bg-white/5 border border-white/10 p-6 rounded-[2rem] text-xl font-bold text-white focus:border-blue-500 outline-none animate-in zoom-in-95" />}
                 </div>
              </div>

              <div className="flex items-center justify-end pt-8">
                  {formData.serviceCharge > 0 && <div className="text-right bg-emerald-500/5 p-10 rounded-[3.5rem] border border-emerald-500/20 shadow-2xl animate-in fade-in slide-in-from-right-10"><p className="text-7xl font-black text-white">₹{formData.serviceCharge}</p></div>}
              </div>

              <button type="submit" disabled={isGenerating} className="w-full bg-white text-slate-950 py-10 rounded-[3.5rem] font-black text-3xl flex items-center justify-center gap-6 active:scale-95 transition-all shadow-2xl disabled:opacity-50">
                {isGenerating ? <><Loader2 className="animate-spin" /> COMPILING...</> : <><FileText className="w-10 h-10" /> DEPLOY CLINICAL REPORT</>}
              </button>
            </div>
          </form>

          {pdfBlob && (
            <div className="fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-8 animate-in zoom-in duration-500">
               <div className="w-full max-w-5xl bg-slate-900 rounded-[4rem] border border-white/10 p-12 space-y-10 max-h-[92vh] overflow-y-auto">
                  <div className="flex justify-between items-center">
                     <h2 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4"><CheckCircle2 className="text-emerald-500 w-12 h-12" /> Deployment Ready</h2>
                     <button onClick={() => setPdfBlob(null)} className="p-6 bg-white/5 rounded-3xl text-slate-400 hover:text-rose-500 transition-colors"><XCircle className="w-10 h-10" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <button onClick={() => window.open(URL.createObjectURL(pdfBlob as Blob))} className="p-12 bg-blue-600 text-white rounded-[3.5rem] font-black text-2xl flex items-center justify-center gap-6 shadow-2xl active:scale-95 transition-all"><FileDown className="w-10 h-10" /> DOWNLOAD PDF</button>
                    <a href="upi://pay?pa=8200095781@pthdfc&pn=KenilShah" className="p-12 bg-emerald-600 text-white rounded-[3.5rem] font-black text-2xl flex items-center justify-center gap-6 shadow-2xl active:scale-95 transition-all"><CreditCard className="w-10 h-10" /> COLLECT PAYMENT</a>
                  </div>
                  <div className="bg-white rounded-[3rem] overflow-hidden border-[16px] border-slate-950">
                    <iframe src={URL.createObjectURL(pdfBlob as Blob)} title="Preview" className="w-full h-[700px]" />
                  </div>
               </div>
            </div>
          )}
        </div>
      ) : (
        /* PATIENT HUB (PWA EXPERIENCE) */
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
          <header className="flex justify-between items-center bg-white/5 backdrop-blur-3xl p-7 rounded-[3rem] border border-white/10 sticky top-6 z-[50] shadow-2xl">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-blue-600/20"><User size={28} /></div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">{currentPatientRecord?.patientName || 'Hub Guest'}</h2>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{currentPatientRecord ? `Node ID: ${currentPatientRecord.visitId}` : 'Health Node'}</p>
              </div>
            </div>
            <div className="flex gap-3">
              {currentPatientRecord?.followup === 'Yes' && (
                <div className="bg-amber-500 text-slate-950 px-5 py-3 rounded-2xl text-[9px] font-black flex items-center gap-2 animate-pulse shadow-lg shadow-amber-500/10">
                  <Calendar className="w-4 h-4" /> FOLLOW UP: {currentPatientRecord.followupDate}
                </div>
              )}
              <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-5 bg-white/5 rounded-2xl text-slate-500 border border-white/10 active:scale-90 transition-transform"><ArrowLeft /></button>
            </div>
          </header>

          {!currentPatientRecord ? (
            <div className="bg-white/5 backdrop-blur-3xl border-2 border-dashed border-white/10 p-20 rounded-[4rem] text-center space-y-12 shadow-2xl mt-20">
               <div className="w-32 h-32 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto ring-8 ring-blue-600/5 animate-bounce"><FileUp className="w-14 h-14 text-blue-500" /></div>
               <div className="space-y-4">
                  <h3 className="text-4xl font-black text-white tracking-tighter">Sync Patient Record</h3>
                  <p className="text-slate-500 font-medium text-xl px-12 leading-relaxed opacity-80">Import your XzeCure clinical document to unlock intelligent monitoring and automated reminders.</p>
               </div>
               <label className="block w-full bg-blue-600 text-white py-10 rounded-[3.5rem] font-black text-2xl cursor-pointer active:scale-95 transition-all shadow-2xl shadow-blue-500/30">
                  {isImporting ? <Loader2 className="animate-spin mx-auto" /> : "DEPLOY CLINICAL PDF"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} />
               </label>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-1000">
               <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-10 rounded-[3.5rem] space-y-3 shadow-xl hover:bg-white/10 transition-colors">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Blood Pressure</p>
                    <p className="text-5xl font-black text-white">{currentPatientRecord.vitalBp || '--'}</p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-10 rounded-[3.5rem] space-y-3 shadow-xl hover:bg-white/10 transition-colors">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Heart Rate</p>
                    <p className="text-5xl font-black text-rose-500">{currentPatientRecord.vitalHr || '--'}</p>
                  </div>
               </div>

               <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-10 rounded-[4rem] space-y-8 shadow-2xl">
                 <h3 className="text-3xl font-black text-white flex items-center gap-5"><Pill className="text-blue-500 w-10 h-10" /> Active Medications</h3>
                 <div className="grid gap-5">
                   {currentPatientRecord.medications.map(med => (
                     <div key={med.id} onClick={() => toggleMed(med.id)} className={`p-8 rounded-[3rem] border-2 transition-all cursor-pointer flex justify-between items-center ${medsStatus[med.id] ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950 border-white/5 hover:border-white/20 shadow-lg'}`}>
                        <div className="flex gap-6 items-center">
                          <div className={`p-5 rounded-3xl ${medsStatus[med.id] ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-600'} transition-all`}><Check className="w-8 h-8" /></div>
                          <div>
                            <p className={`text-2xl font-black ${medsStatus[med.id] ? 'text-slate-600 line-through' : 'text-white'}`}>{med.name}</p>
                            <p className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] mt-1">{med.dose} • {med.timing}</p>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setPrescriptionReminder(med); }} className={`p-6 rounded-3xl border transition-all ${reminders[med.id] ? 'bg-blue-600 border-blue-500 text-white shadow-xl animate-pulse' : 'bg-white/5 border-white/10 text-slate-700 hover:text-white'}`}>
                          <Bell className="w-6 h-6" />
                        </button>
                     </div>
                   ))}
                 </div>
               </div>

               {currentPatientRecord.investigationsAdvised && (
                 <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-10 rounded-[4rem] space-y-8 shadow-2xl">
                   <h3 className="text-3xl font-black text-white flex items-center gap-5"><ClipboardList className="text-amber-500 w-10 h-10" /> Investigation Log</h3>
                   <div className="space-y-4">
                     {currentPatientRecord.investigationsAdvised.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0).map((test, idx) => {
                       const isDone = completedInvestigations.includes(test);
                       return (
                         <button 
                           key={idx} 
                           onClick={() => toggleInvestigationItem(test)} 
                           className={`w-full flex items-center justify-between p-8 rounded-[3rem] border-2 transition-all ${isDone ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-950 border-white/10 hover:border-white/30 shadow-lg'}`}
                         >
                           <span className={`text-xl font-bold ${isDone ? 'text-slate-600 line-through' : 'text-white'}`}>{test}</span>
                           <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/10'}`}>
                             {isDone && <Check className="w-7 h-7" />}
                           </div>
                         </button>
                       );
                     })}
                   </div>
                 </div>
               )}

               {currentPatientRecord.nonMedicinalAdvice && (
                 <div className="bg-emerald-500/5 backdrop-blur-3xl border-emerald-500/20 p-12 rounded-[4rem] space-y-6 shadow-2xl border-l-[12px]">
                   <h3 className="text-2xl font-black text-emerald-400 flex items-center gap-4 uppercase tracking-[0.2em]"><HeartPulse className="w-7 h-7" /> Lifestyle Protocol</h3>
                   <p className="text-white text-xl leading-relaxed font-bold bg-slate-950/50 p-8 rounded-[3rem] border border-white/5 shadow-inner italic">"{currentPatientRecord.nonMedicinalAdvice}"</p>
                 </div>
               )}
            </div>
          )}

          <div className="fixed bottom-10 left-8 right-8 flex gap-6 z-[60]">
             <button onClick={() => setShowVitalsEntry(true)} className="flex-1 bg-white text-slate-950 p-10 rounded-[3.5rem] font-black text-3xl flex items-center justify-center gap-5 active:scale-95 shadow-2xl shadow-white/10 transition-all">
               <Activity className="w-10 h-10" /> LOG DAILY
             </button>
             <button onClick={handleEmergencyRequest} className="bg-rose-600 text-white p-10 rounded-[3.5rem] active:scale-95 shadow-2xl shadow-rose-600/30 transition-all"><Siren className="w-10 h-10" /></button>
          </div>

          {showVitalsEntry && (
            <div className="fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
               <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[4rem] p-12 space-y-12 shadow-2xl shadow-black/50">
                  <div className="flex justify-between items-center">
                    <h3 className="text-4xl font-black text-white tracking-tighter">Daily Log</h3>
                    <button onClick={() => setShowVitalsEntry(false)} className="p-6 bg-white/5 rounded-3xl text-slate-500"><XCircle size={32} /></button>
                  </div>
                  <div className="space-y-6">
                    {[
                      {l: 'BP Value', k: 'bp', i: <Activity />},
                      {l: 'Pulse Rate', k: 'hr', i: <HeartPulse />},
                      {l: 'Oxygen %', k: 'spo2', i: <Thermometer />},
                      {l: 'Glucose', k: 'rbs', i: <Pill />},
                      {l: 'Weight kg', k: 'weight', i: <Scale />}
                    ].map(f => (
                      <div key={f.k} className="relative group">
                         <div className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-blue-500 transition-colors">{f.i}</div>
                         <input 
                           placeholder={f.l} 
                           value={(newVital as any)[f.k]} 
                           onChange={e => setNewVital({...newVital, [f.k]: e.target.value})}
                           className="w-full bg-white/5 p-8 pl-16 rounded-[2.5rem] border border-white/10 text-white text-2xl font-black outline-none focus:border-blue-500 transition-all placeholder:text-slate-800" 
                         />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                     if (!newVital.bp && !newVital.hr && !newVital.spo2) return showToast('Input Required', 'error');
                     storageService.saveDailyVital(newVital);
                     setDailyVitals(storageService.getDailyVitals());
                     setNewVital({ bp: '', spo2: '', hr: '', rbs: '', weight: '' });
                     setShowVitalsEntry(false);
                     showToast('Progress Logged', 'success');
                  }} className="w-full bg-blue-600 text-white py-10 rounded-[3.5rem] font-black text-3xl shadow-2xl active:scale-95 transition-all">SAVE RECORDS</button>
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
