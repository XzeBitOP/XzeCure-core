
import React, { useState, useEffect } from 'react';
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

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePinSubmit = () => {
    if (pin === SECRET_PIN) {
      setIsLocked(false);
      setPinError('');
    } else {
      setPinError('Access Denied');
      setPin('');
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    }
  };

  const handleEmergencyRequest = () => {
    if ("geolocation" in navigator) {
      showToast('Locating...', 'info');
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
    if ('vibrate' in navigator) navigator.vibrate([500, 200, 500]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    if ('vibrate' in navigator) navigator.vibrate(100);
    try {
      const vId = `XZ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      // Final height normalization
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
          <HeartPulse className="w-32 h-32 text-blue-500 relative z-10" />
        </div>
        <div className="mt-12 text-center space-y-4 z-10">
          <h1 className="text-4xl font-black text-white tracking-tighter">XzeCure</h1>
          <div className="w-48 h-1.5 bg-white/5 rounded-full overflow-hidden mx-auto border border-white/10">
            <div className="h-full bg-blue-500 w-full animate-[loading_2s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-block p-6 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl">
              <img src={DEFAULT_LOGO} className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter">XzeCure</h1>
            <p className="text-slate-400 font-medium text-lg">Secure Medical Hub</p>
          </div>
          <div className="grid gap-4">
            <button onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} className="group relative overflow-hidden w-full p-8 bg-blue-600 rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all shadow-2xl">
               <div className="flex items-center gap-4 text-white">
                 <Users className="w-8 h-8" />
                 <span className="text-2xl font-black tracking-tight">Patient Portal</span>
               </div>
               <ChevronRight className="w-6 h-6 text-white/50 group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => setSelectedRole('doctor')} className="group w-full p-8 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] flex items-center justify-between active:scale-95 transition-all">
               <div className="flex items-center gap-4 text-slate-300">
                 <Stethoscope className="w-8 h-8" />
                 <span className="text-2xl font-black tracking-tight">Doctor Access</span>
               </div>
               <ChevronRight className="w-6 h-6 text-slate-500" />
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
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white">
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-white text-slate-950 px-8 py-4 rounded-full shadow-2xl font-black text-sm tracking-widest animate-in slide-in-from-top-12 border border-white/20">
          {toast.message.toUpperCase()}
        </div>
      )}

      {selectedRole === 'doctor' && (
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12 pb-32">
          <header className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="p-5 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl"><img src={DEFAULT_LOGO} className="w-14 h-14 object-contain" /></div>
              <div>
                <h1 className="text-4xl font-black text-white tracking-tighter">Clinical Hub</h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Practitioner Node</p>
              </div>
            </div>
            <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-5 bg-white/5 border border-white/10 rounded-2xl text-slate-400 hover:text-white transition-colors active:scale-90"><ArrowLeft /></button>
          </header>

          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="bg-white/5 backdrop-blur-3xl rounded-[3.5rem] border border-white/10 p-12 shadow-2xl space-y-12">
              {/* Profile Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Practitioner Profile</label>
                  <input required type="text" value={formData.staffName} onChange={e => setFormData({...formData, staffName: e.target.value})} placeholder="Dr. Kenil" className="w-full bg-white/5 border border-white/10 p-7 rounded-[2.5rem] text-xl font-bold text-white focus:border-blue-500 outline-none transition-all placeholder:text-slate-800" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Patient Identity</label>
                  <input required type="text" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} placeholder="Patient Name" className="w-full bg-white/5 border border-white/10 p-7 rounded-[2.5rem] text-xl font-bold text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-800" />
                </div>
              </div>

              {/* Bio Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 pt-12 border-t border-white/5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Age</label>
                  <input type="text" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-lg font-bold text-white outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Contact</label>
                  <input type="text" value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-lg font-bold text-white outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Weight (kg)</label>
                  <input type="text" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] text-lg font-bold text-white outline-none" />
                </div>
                <div className="space-y-2 relative">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] font-black text-slate-600 uppercase ml-1">Height</label>
                    <button type="button" onClick={() => setHeightUnit(h => h === 'cm' ? 'ftIn' : 'cm')} className="text-[8px] font-black text-blue-500 uppercase tracking-widest border border-blue-500/30 px-2 py-0.5 rounded-full">{heightUnit}</button>
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
                  <label className="text-[9px] font-black text-blue-500 uppercase ml-1">BMI</label>
                  <div className="w-full bg-blue-500/10 border border-blue-500/20 p-5 rounded-[2rem] text-2xl font-black text-blue-400 text-center">{formData.bmi || '--'}</div>
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-12 border-t border-white/5">
                 {[
                   {l: 'Temp °F', k: 'vitalTemp', c: 'rose-500'},
                   {l: 'BP mmHg', k: 'vitalBp', c: 'blue-500'},
                   {l: 'SpO2 %', k: 'vitalSpo2', c: 'emerald-500'},
                   {l: 'Pulse Rate', k: 'vitalHr', c: 'red-500'},
                   {l: 'Glucose', k: 'vitalRbs', c: 'amber-500'}
                 ].map(vit => (
                   <div key={vit.k} className="space-y-2">
                     <label className={`text-[8px] font-black text-${vit.c} uppercase ml-1`}>{vit.l}</label>
                     <input type="text" value={(formData as any)[vit.k]} onChange={e => setFormData({...formData, [vit.k]: e.target.value})} className="w-full bg-slate-900/50 p-5 rounded-[2rem] border border-white/10 text-white font-black text-center outline-none focus:border-white/30" />
                   </div>
                 ))}
              </div>

              {/* Findings & History Text Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-white/5">
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-1">Clinical Findings</label>
                   <textarea value={formData.complaints} onChange={e => setFormData({...formData, complaints: e.target.value})} rows={4} className="w-full bg-white/5 border border-white/10 p-7 rounded-[2.5rem] font-bold text-white outline-none focus:border-blue-500 transition-all resize-none" placeholder="Chief complaints..." />
                 </div>
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">Medical/Surgical History</label>
                   <textarea value={formData.history} onChange={e => setFormData({...formData, history: e.target.value})} rows={4} className="w-full bg-white/5 border border-white/10 p-7 rounded-[2.5rem] font-bold text-white outline-none focus:border-rose-500 transition-all resize-none" placeholder="Old history / surgeries..." />
                 </div>
              </div>

              {/* Tests */}
              <div className="space-y-4 pt-8">
                 <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Medical Tests Required</label>
                 <textarea value={formData.investigationsAdvised} onChange={e => setFormData({...formData, investigationsAdvised: e.target.value})} rows={2} className="w-full bg-white/5 border border-white/10 p-7 rounded-[2.5rem] font-bold text-amber-500 outline-none focus:border-amber-500 transition-all resize-none" placeholder="Labs, X-ray, ECG..." />
              </div>

              {/* Prescription Module */}
              <div className="space-y-10 pt-12 border-t border-white/5">
                 <div className="flex justify-between items-center">
                   <h3 className="text-3xl font-black text-white flex items-center gap-4"><Pill className="text-blue-500 w-10 h-10" /> Prescription</h3>
                   <button type="button" onClick={() => setFormData(p => ({...p, medications: [...p.medications, { id: crypto.randomUUID(), route: 'Oral', name: '', dose: '', frequency: 1, timing: '' }]}))} className="bg-blue-600 px-8 py-4 rounded-[2rem] text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 hover:bg-blue-500 active:scale-95 transition-all shadow-xl">
                     <Plus className="w-5 h-5" /> Add Medication
                   </button>
                 </div>
                 
                 <div className="space-y-4">
                   {formData.medications.map(med => (
                     <div key={med.id} className="bg-white/5 border border-white/10 p-8 rounded-[3rem] flex flex-col md:flex-row gap-8 items-center group shadow-xl">
                        <div className="w-full md:w-32">
                          <label className="text-[8px] font-black text-slate-600 uppercase mb-2 block">Route</label>
                          <select value={med.route} onChange={e => updateMedication(med.id, { route: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-xs font-black text-white outline-none">
                            {['Oral', 'IV', 'IM', 'SC', 'Nasal', 'RT', 'Topical'].map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div className="flex-1 w-full">
                          <label className="text-[8px] font-black text-slate-600 uppercase block mb-1">Medicine Name</label>
                          <input type="text" value={med.name} onChange={e => updateMedication(med.id, { name: e.target.value })} className="w-full bg-transparent border-b-2 border-white/10 p-3 text-xl font-black text-white outline-none focus:border-blue-500 transition-all" placeholder="Drug Name" />
                        </div>
                        <div className="w-full md:w-48">
                          <label className="text-[8px] font-black text-slate-600 uppercase block mb-1">Schedule</label>
                          <input type="text" value={med.timing} onChange={e => updateMedication(med.id, { timing: e.target.value })} className="w-full bg-white/5 p-4 rounded-2xl border border-white/5 outline-none text-sm font-bold text-blue-400 text-center" placeholder="Time / Dose" />
                        </div>
                        <button type="button" onClick={() => setFormData(p => ({...p, medications: p.medications.filter(m => m.id !== med.id)}))} className="p-5 text-rose-500/50 hover:text-rose-500 transition-all"><Trash2 /></button>
                     </div>
                   ))}
                 </div>

                 {/* Non-Medicinal Advices Section */}
                 <div className="bg-emerald-500/5 border border-emerald-500/20 p-8 rounded-[3rem] space-y-4">
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Non-Medicinal Advices</label>
                    <textarea value={formData.nonMedicinalAdvice} onChange={e => setFormData({...formData, nonMedicinalAdvice: e.target.value})} rows={3} className="w-full bg-transparent border border-emerald-500/10 p-5 rounded-[2rem] font-bold text-white outline-none focus:border-emerald-500 transition-all resize-none" placeholder="Diet, rest, lifestyle changes..." />
                 </div>
              </div>

              {/* Billing Area */}
              <div className="pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-10">
                 <div className="space-y-4">
                   <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-1">Service Fee</label>
                   <select onChange={handleServiceChange} className="w-full bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] font-black outline-none text-white text-lg">
                      <option value="">-- Choose Category --</option>
                      {SERVICE_GROUPS.map(g => (<optgroup key={g.label} label={g.label}>{g.options.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}</optgroup>))}
                   </select>
                 </div>
                 <div className="flex items-center justify-end">
                    {formData.serviceCharge > 0 && (
                      <div className="text-right bg-emerald-500/5 p-8 rounded-[3rem] border border-emerald-500/20">
                        <p className="text-6xl font-black text-white">₹{formData.serviceCharge}</p>
                      </div>
                    )}
                 </div>
              </div>

              <button type="submit" disabled={isGenerating} className="w-full bg-white text-slate-950 py-10 rounded-[3.5rem] font-black text-3xl flex items-center justify-center gap-6 active:scale-95 transition-all shadow-2xl disabled:opacity-50">
                {isGenerating ? <><Loader2 className="animate-spin" /> COMPILING...</> : <><FileText className="w-10 h-10" /> GENERATE CLINICAL REPORT</>}
              </button>
            </div>
          </form>

          {/* PDF Preview Modal */}
          {pdfBlob && (
            <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-8 animate-in zoom-in duration-500">
               <div className="w-full max-w-5xl bg-slate-900 rounded-[4rem] border border-white/10 p-12 space-y-10 max-h-[92vh] overflow-y-auto shadow-[0_0_100px_rgba(59,130,246,0.1)]">
                  <div className="flex justify-between items-center">
                     <h2 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4"><CheckCircle2 className="text-emerald-500" /> Report Optimized</h2>
                     <button onClick={() => setPdfBlob(null)} className="p-6 bg-white/5 rounded-3xl text-slate-400 hover:text-rose-500 transition-colors"><XCircle className="w-8 h-8" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <button onClick={() => window.open(URL.createObjectURL(pdfBlob as Blob))} className="p-10 bg-blue-600 text-white rounded-[3rem] font-black text-2xl flex items-center justify-center gap-6 shadow-2xl active:scale-95 transition-all">
                      <FileDown className="w-10 h-10" /> DOWNLOAD PDF
                    </button>
                    <a href="upi://pay?pa=8200095781@pthdfc&pn=KenilShah" className="p-10 bg-emerald-600 text-white rounded-[3rem] font-black text-2xl flex items-center justify-center gap-6 shadow-2xl active:scale-95 transition-all">
                      <CreditCard className="w-10 h-10" /> PAY ₹{formData.serviceCharge} NOW
                    </a>
                  </div>
                  <div className="bg-white rounded-[3rem] overflow-hidden border-[12px] border-slate-950 shadow-inner">
                    <iframe src={URL.createObjectURL(pdfBlob as Blob)} title="PDF Preview" className="w-full h-[700px]" />
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {selectedRole === 'patient' && (
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-10 pb-40">
          <header className="flex justify-between items-center bg-white/5 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/10 sticky top-4 z-[50] shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl"><User /></div>
              <div>
                <h2 className="text-xl font-black text-white">{currentPatientRecord?.patientName || 'Guest'}</h2>
                <p className="text-xs font-black text-blue-500 uppercase tracking-widest">{currentPatientRecord ? `Node ID: ${currentPatientRecord.visitId}` : 'Digital Health Hub'}</p>
              </div>
            </div>
            <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-4 bg-white/5 rounded-2xl text-slate-400 border border-white/10"><ArrowLeft /></button>
          </header>

          {!currentPatientRecord ? (
            <div className="bg-white/5 backdrop-blur-3xl border-2 border-dashed border-white/10 p-16 rounded-[3rem] text-center space-y-10 shadow-2xl">
               <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto"><FileUp className="w-10 h-10 text-blue-500" /></div>
               <div className="space-y-4">
                  <h3 className="text-3xl font-black text-white">Import Hub Record</h3>
                  <p className="text-slate-500 font-medium text-lg px-6 leading-relaxed">Upload your XzeCure PDF to unlock smart trackers and reminders.</p>
               </div>
               <label className="block w-full bg-blue-600 text-white py-8 rounded-[2.5rem] font-black text-xl cursor-pointer active:scale-95 transition-all shadow-2xl">
                  {isImporting ? <Loader2 className="animate-spin mx-auto" /> : "CHOOSE PDF REPORT"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} />
               </label>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-1000">
               <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-8 rounded-[2.5rem] space-y-6 shadow-xl">
                 <h3 className="text-2xl font-black text-white flex items-center gap-4"><Pill className="text-blue-500" /> Medications</h3>
                 <div className="grid gap-4">
                   {currentPatientRecord.medications.map(med => (
                     <div key={med.id} className="p-6 rounded-[2rem] bg-slate-900/50 border border-white/5 flex justify-between items-center">
                        <div>
                          <p className="text-xl font-bold text-white">{med.name}</p>
                          <p className="text-xs font-black text-blue-500 uppercase tracking-widest">{med.dose} • {med.timing}</p>
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          )}

          <div className="fixed bottom-10 left-8 right-8 flex gap-6">
             <button onClick={() => setShowVitalsEntry(true)} className="flex-1 bg-white text-slate-950 p-8 rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-4 active:scale-95 shadow-2xl transition-all">
               <Activity className="w-8 h-8" /> LOG DAILY
             </button>
             <button onClick={handleEmergencyRequest} className="bg-rose-600 text-white p-8 rounded-[2.5rem] active:scale-95 shadow-2xl transition-all"><Siren className="w-8 h-8" /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
