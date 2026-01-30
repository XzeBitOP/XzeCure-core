
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, Users, Stethoscope, CheckCircle2, XCircle, Loader2, 
  Pill, ArrowLeft, Bell, Check, FileUp, 
  HeartPulse, Siren, Trash2, 
  Plus, FileText, FileDown, CreditCard, Thermometer, 
  Activity, Scale, Calendar, ClipboardList, ChevronRight, CalendarPlus, Clock, Share2, AlertTriangle, History, MapPin, Truck, ShieldAlert, Image as ImageIcon, Smartphone, QrCode, TestTube, Search, Hash, UserCheck, Timer, BookmarkCheck, ShoppingCart, Pencil, Ruler, Clipboard, BriefcaseMedical, RefreshCcw, Save, RotateCcw, Settings, ShieldCheck
} from 'lucide-react';
import { SECRET_PIN, SERVICE_GROUPS, DEFAULT_LOGO, DEFAULT_LETTERHEAD, COMMON_ICD_CODES } from './constants';
import { VisitData, Medication, DailyVital, Appointment, MedicineAdviceItem } from './types';
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
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [showPaymentQR, setShowPaymentQR] = useState(false);
  
  // Patient Portal State
  const [currentPatientRecord, setCurrentPatientRecord] = useState<VisitData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [medsStatus, setMedsStatus] = useState<Record<string, boolean>>({});
  const [showVitalsHistory, setShowVitalsHistory] = useState(false);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showPatientSettings, setShowPatientSettings] = useState(false);
  const [relativeNumber, setRelativeNumber] = useState(localStorage.getItem('xzecure_relative_number') || '');
  const [vitalsHistory, setVitalsHistory] = useState<DailyVital[]>([]);
  const [vitalsFormData, setVitalsFormData] = useState<Omit<DailyVital, 'id' | 'timestamp'>>({
    bp: '', temp: '', spo2: '', hr: '', rbs: '', weight: '', waist: ''
  });
  const [editingVitalId, setEditingVitalId] = useState<string | null>(null);
  
  // Doctor Hub State
  const [checkedServices, setCheckedServices] = useState<string[]>([]);

  // Doctor Form State
  const initialFormState: VisitData = {
    visitId: '', staffName: '', patientName: '', age: '', gender: '', contactNumber: '',
    address: '', weight: '', height: '', bmi: '', complaints: '', duration: '',
    history: '', surgicalHistory: '', investigationsAdvised: '',
    provisionalDiagnosis: '', icdCode: '',
    vitals: '', vitalTemp: '', vitalBp: '', vitalSpo2: '',
    vitalHr: '', vitalRbs: '', signs: '', treatment: '', nonMedicinalAdvice: '', 
    medications: [], medicineAdvice: [],
    followup: 'No', followupDate: '', whatsappNumber: '',
    serviceCharge: 0, quantity: 1, pdfColor: 'white', serviceName: 'Standard Consultation',
    photos: []
  };

  const [formData, setFormData] = useState<VisitData>(initialFormState);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [icdSuggestions, setIcdSuggestions] = useState<typeof COMMON_ICD_CODES>([]);
  const icdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 3000);
    const draft = storageService.getFormDraft();
    if (draft) setFormData(draft);
    setVitalsHistory(storageService.getDailyVitals());

    const handleClickOutside = (event: MouseEvent) => {
      if (icdRef.current && !icdRef.current.contains(event.target as Node)) {
        setIcdSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (selectedRole === 'patient') {
      notificationService.requestPermission().then(granted => {
        if (granted) {
          notificationService.cancelAllSchedules();
          notificationService.scheduleVitalsReminders();
          if (currentPatientRecord) {
            notificationService.scheduleAllMedicationReminders(currentPatientRecord);
          }
        }
      });
    }
  }, [selectedRole, currentPatientRecord]);

  useEffect(() => {
    if (formData !== initialFormState && !isLocked && selectedRole === 'doctor') {
      storageService.saveFormDraft(formData);
    }
  }, [formData, selectedRole, isLocked]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleReset = () => {
    if (window.confirm('Wipe clinical workspace? Unsaved data will be lost.')) {
      setFormData(initialFormState);
      setPdfBlob(null);
      storageService.saveFormDraft(initialFormState);
      showToast('Clinical Workspace Reset', 'info');
    }
  };

  const parsePdfMetadata = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await (loadingTask as any).promise;
    const metadataResult = await (pdf as any).getMetadata();
    const info = (metadataResult.info || {}) as any;
    const embeddedData = info.Subject;
    if (!embeddedData) throw new Error("Metadata extraction failed: No embedded Clinical Node found.");
    const decodedJson = decodeURIComponent(escape(atob(embeddedData)));
    return JSON.parse(decodedJson) as VisitData;
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const visitData = await parsePdfMetadata(file);
      if (selectedRole === 'doctor') {
        setFormData({ ...visitData, visitId: '', serviceCharge: 999 });
        showToast('Clinical Context Restored', 'success');
      } else {
        setCurrentPatientRecord(visitData);
        showToast('Health Node Synchronized', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync Failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveVitals = () => {
    if (!currentPatientRecord) return;
    const vitalsSummary = `BP:${vitalsFormData.bp || '--'}, Temp:${vitalsFormData.temp || '--'}°F, SpO2:${vitalsFormData.spo2 || '--'}%, Pulse:${vitalsFormData.hr || '--'}bpm`;
    
    if (editingVitalId) {
      setVitalsHistory(storageService.updateDailyVital(editingVitalId, vitalsFormData));
      setEditingVitalId(null);
      showToast('Vital Record Updated', 'success');
    } else {
      storageService.saveDailyVital(vitalsFormData);
      setVitalsHistory(storageService.getDailyVitals());
      showToast('Health Stats Logged', 'success');

      // Immediate WhatsApp Alert
      const stamp = new Date().toLocaleString('en-IN');
      const msg = `*Health Update: ${currentPatientRecord.patientName}*\nTime: ${stamp}\nStats: ${vitalsSummary}`;
      window.open(`https://wa.me/918200095781?text=${encodeURIComponent(msg)}`, "_blank");
      if (relativeNumber.trim()) {
        setTimeout(() => window.open(`https://wa.me/${relativeNumber.trim()}?text=${encodeURIComponent(msg)}`, "_blank"), 1000);
      }
    }
    notificationService.showVitalsLoggedNotification(vitalsSummary, '918200095781', relativeNumber.trim());
    setVitalsFormData({ bp: '', temp: '', spo2: '', hr: '', rbs: '', weight: '', waist: '' });
    setShowVitalsForm(false);
  };

  const handleMedicineOrder = () => {
    if (!currentPatientRecord) return;
    // Extract chronic meds names for ordering
    const medsToOrder = extractChronicMeds(currentPatientRecord.treatment).map(m => `• ${m.name}`).join('\n');
    const orderText = medsToOrder || currentPatientRecord.medications.map(m => `• ${m.name}`).join('\n');
    const msg = `*XzeCure Pharmacy Order*\nPatient: ${currentPatientRecord.patientName}\n\n*Required:*\n${orderText}\n\n*Stock Request:* 30-Day Cycle Refill.`;
    window.open(`https://wa.me/917016583135?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handlePinInput = (value: string) => {
    setPin(value);
    if (value.length === 6 && value === SECRET_PIN) {
      setIsLocked(false);
      setPin('');
    }
  };

  const handleSaveRelativeNumber = (val: string) => {
    setRelativeNumber(val);
    localStorage.setItem('xzecure_relative_number', val);
  };

  const handleEditVital = (log: DailyVital) => {
    setEditingVitalId(log.id);
    setVitalsFormData({ ...log });
    setShowVitalsForm(true);
  };

  const handleEmergencyAction = (type: 'ambulance' | 'doctor') => {
    const msg = type === 'ambulance' ? "🚨 SOS: AMBULANCE REQUIRED" : "🩺 SOS: URGENT DOCTOR CONSULT";
    window.open(`https://wa.me/918200095781?text=${encodeURIComponent(msg)}`, "_blank");
    setShowEmergencyDialog(false);
  };

  const addMedication = () => {
    const newMed: Medication = { id: crypto.randomUUID(), name: '', dose: '', timing: '', route: 'Oral', frequency: 1, days: '' };
    setFormData({ ...formData, medications: [...formData.medications, newMed] });
  };

  const updateMedication = (id: string, field: keyof Medication, value: any) => {
    setFormData({ ...formData, medications: formData.medications.map(m => m.id === id ? { ...m, [field]: value } : m) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const vId = `XZ-DR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const blob = await generateVisitPdf({ ...formData, visitId: vId }, formData.photos, DEFAULT_LOGO);
      setPdfBlob(blob);
      storageService.saveVisit({ visitId: vId, name: formData.patientName, date: new Date().toISOString(), staff: formData.staffName, fullData: formData });
      showToast('Report Captured', 'success');
    } catch (err) {
      showToast('Engine Error', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const extractChronicMeds = (treatmentText: string): { name: string; info: string }[] => {
    if (!treatmentText) return [];
    const continueIndex = treatmentText.toLowerCase().indexOf('continue.');
    if (continueIndex === -1) return [];
    const lines = treatmentText.substring(continueIndex + 9).split('\n');
    const meds = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('–').map(s => s.trim());
      if (parts.length >= 1) {
        meds.push({ name: parts[0], info: parts[1] || 'As prescribed in procedures' });
      }
    }
    return meds;
  };

  const chronicMeds = currentPatientRecord ? extractChronicMeds(currentPatientRecord.treatment) : [];

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-[#0a0f1d] flex flex-col items-center justify-center z-[200]">
        <HeartPulse className="w-40 h-40 text-blue-500 animate-pulse" />
        <h1 className="text-5xl font-black text-white tracking-tighter mt-8">XzeCure</h1>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-12">
          <div className="text-center space-y-6">
            <div className="inline-block p-6 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-2xl">
              <img src={DEFAULT_LOGO} className="w-24 h-24 object-contain" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter">XzeCure</h1>
          </div>
          <div className="grid gap-6">
            <button onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} className="w-full p-8 bg-blue-600 rounded-full flex items-center justify-between shadow-2xl active:scale-95 transition-all">
               <div className="flex items-center gap-4 text-white"><Users size={32} /><span className="text-2xl font-black tracking-tight">Patient Portal</span></div>
               <ChevronRight size={24} className="text-white/50" />
            </button>
            {selectedRole === 'doctor' ? (
              <div className="animate-in zoom-in duration-300">
                <input autoFocus type="password" maxLength={6} value={pin} onChange={(e) => handlePinInput(e.target.value)} placeholder="••••••" className="w-full bg-[#161e31] border-2 border-blue-500/30 text-white text-center py-7 rounded-full text-5xl font-black outline-none placeholder:text-slate-800 shadow-2xl" />
                <button onClick={() => { setSelectedRole(null); setPin(''); }} className="w-full text-center mt-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setSelectedRole('doctor')} className="w-full p-8 bg-slate-900 border border-white/10 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-lg text-slate-400">
                 <div className="flex items-center gap-4"><Stethoscope size={32} /><span className="text-2xl font-black tracking-tight">Doctor Hub</span></div>
                 <ChevronRight size={24} className="text-slate-700" />
              </button>
            )}
            <button onClick={() => setShowEmergencyDialog(true)} className="w-full p-8 bg-rose-600 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-2xl border border-rose-400/20">
               <div className="flex items-center gap-4 text-white"><Siren size={32} /><span className="text-2xl font-black tracking-tight uppercase">Emergency SOS</span></div>
               <ChevronRight size={24} className="text-white/50" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 selection:bg-blue-500 pb-20 overflow-x-hidden font-sans">
      {toast && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-white text-slate-950 px-10 py-5 rounded-full shadow-2xl font-black text-sm tracking-widest border border-white/20 animate-in slide-in-from-top duration-300">{toast.message.toUpperCase()}</div>}

      {selectedRole === 'doctor' && (
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
          <header className="flex justify-between items-center bg-[#161e31] border border-white/10 p-6 rounded-[2.5rem] shadow-2xl">
            <div className="flex items-center gap-6">
              <img src={DEFAULT_LOGO} className="w-16 h-16 object-contain" />
              <div><h1 className="text-3xl font-black text-white tracking-tighter uppercase">Clinical Hub</h1><p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Practitioner Node</p></div>
            </div>
            <div className="flex gap-3">
               <button onClick={handleReset} className="p-5 bg-rose-950/30 border border-rose-500/20 rounded-2xl text-rose-500 active:scale-90"><RotateCcw size={24} /></button>
               <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-5 bg-slate-900 rounded-2xl text-slate-400 active:scale-90 shadow-lg"><ArrowLeft size={24} /></button>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-10 animate-in fade-in duration-500">
            <div className="bg-[#101726] rounded-[3rem] border border-white/10 p-12 shadow-2xl space-y-12">
              <div className="flex items-center gap-6"><div className="p-4 bg-blue-600/10 text-blue-500 rounded-2xl"><User size={24} /></div><h2 className="text-2xl font-black text-white uppercase tracking-tight">Identity Hub</h2></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <input required placeholder="Practitioner Name" type="text" value={formData.staffName} onChange={e => setFormData({...formData, staffName: e.target.value})} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] text-xl font-bold text-white outline-none focus:border-blue-500" />
                <input required placeholder="Patient Name" type="text" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] text-xl font-bold text-white outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="bg-[#101726] rounded-[3rem] border border-white/10 p-12 shadow-2xl space-y-10">
               <div className="flex items-center gap-6"><div className="p-4 bg-rose-600/10 text-rose-500 rounded-2xl"><BriefcaseMedical size={24} /></div><h2 className="text-2xl font-black text-white uppercase tracking-tight">Rx & Treatment</h2></div>
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Investigations Advised</label>
                 <textarea value={formData.investigationsAdvised} onChange={e => setFormData({...formData, investigationsAdvised: e.target.value})} rows={3} placeholder="List advised lab tests here..." className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 shadow-inner resize-none" />
               </div>
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Treatment Procedures / Chronic Meds</label>
                 <textarea value={formData.treatment} onChange={e => setFormData({...formData, treatment: e.target.value})} rows={5} placeholder="Start with 'Continue.' for long-term meds extraction." className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 shadow-inner resize-none" />
               </div>
            </div>

            <button type="submit" disabled={isGenerating} className="w-full bg-blue-600 py-10 rounded-[2.5rem] font-black text-3xl active:scale-95 disabled:opacity-50 transition-all shadow-2xl flex items-center justify-center gap-6">
              {isGenerating ? <Loader2 className="animate-spin" /> : <><Save size={40} /> DEPLOY HUB NODE</>}
            </button>
          </form>
        </div>
      )}

      {selectedRole === 'patient' && (
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-12 pb-80">
          <header className="flex justify-between items-center bg-[#161e31] backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/10 sticky top-4 z-[50] shadow-2xl">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg"><User size={32} /></div>
              <div><h2 className="text-2xl font-black text-white tracking-tight uppercase">{currentPatientRecord?.patientName || 'Guest'}</h2><p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Active Care Hub</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPatientSettings(true)} className="p-4 bg-slate-900 rounded-2xl text-slate-400 active:scale-90 shadow-lg"><Settings size={24} /></button>
              <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-4 bg-slate-900 rounded-2xl text-slate-400 active:scale-90 shadow-lg"><ArrowLeft size={24} /></button>
            </div>
          </header>

          {!currentPatientRecord ? (
            <div className="space-y-12 animate-in fade-in duration-500">
               <div className="bg-[#101726] border-4 border-dashed border-white/10 p-10 sm:p-16 rounded-[4rem] text-center space-y-12 shadow-2xl">
                  <FileUp className="w-24 h-24 text-blue-500 mx-auto animate-bounce" />
                  <div className="space-y-4"><h3 className="text-4xl font-black text-white tracking-tighter uppercase">Sync Health Node</h3><p className="text-slate-500 font-medium text-xl">Import your latest clinical report.</p></div>
                  <label className="block w-full bg-blue-600 text-white py-10 rounded-full font-black text-2xl cursor-pointer active:scale-95 shadow-lg uppercase tracking-widest">CHOOSE PDF FILE<input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} /></label>
               </div>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in duration-700">
               {/* Quick Vitals Log */}
               <div onClick={() => setShowVitalsForm(true)} className="bg-emerald-600/10 border border-emerald-500/20 p-8 rounded-[3rem] space-y-4 shadow-xl cursor-pointer hover:bg-emerald-600/15 transition-all">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tight"><Activity className="text-emerald-500" /> Log Health Stats</h3>
                    <div className="p-4 bg-emerald-600 text-white rounded-full shadow-lg"><Plus size={24} /></div>
                  </div>
               </div>

               {/* Medication Plan */}
               <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] space-y-8 shadow-2xl">
                 <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tight"><Pill className="text-blue-500" /> Prescribed Rx</h3>
                    <button onClick={handleMedicineOrder} className="p-4 bg-emerald-600/20 text-emerald-400 rounded-2xl active:scale-90 shadow-lg flex items-center gap-2 font-black text-xs uppercase tracking-widest"><ShoppingCart size={18} /> Pharmacy</button>
                 </div>
                 <div className="grid gap-4">
                   {currentPatientRecord.medications.map(med => (
                     <div key={med.id} className="p-7 rounded-[2.5rem] border bg-[#161e31] border-white/5 shadow-lg flex justify-between items-center">
                        <div className="flex gap-6 items-center">
                          <div className="p-5 rounded-2xl bg-white/5 text-slate-500 shadow-xl"><Check size={28} strokeWidth={4} /></div>
                          <div><p className="text-2xl font-black text-white uppercase">{med.name}</p><p className="text-xs font-black text-blue-500 uppercase tracking-widest mt-1">{med.timing} • {med.dose} • {med.days || 'Continue'}</p></div>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><Bell size={20} /></div>
                     </div>
                   ))}
                 </div>
               </div>

               <button onClick={() => setShowVitalsHistory(true)} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl active:scale-95 transition-all group">
                 <div className="flex items-center gap-6"><div className="p-4 bg-slate-900 rounded-2xl text-slate-500"><History size={24} /></div><span className="text-xl font-black text-slate-300 uppercase tracking-tight">Vitals History</span></div>
                 <ChevronRight size={24} className="text-slate-700" />
               </button>

               {/* CHRONIC CARE PLAN */}
               <div className="bg-[#101726] border-2 border-blue-600/20 p-10 rounded-[4rem] space-y-10 shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom duration-500">
                  <div className="absolute top-0 right-0 p-8 opacity-10"><ShieldCheck size={120} className="text-blue-500" /></div>
                  <div className="space-y-2 relative z-10">
                    <h3 className="text-3xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
                      <ShieldAlert className="text-blue-500" /> Chronic Care Plan
                    </h3>
                    <div className="flex items-center gap-2">
                       <span className="px-3 py-1 bg-blue-500 text-white text-[9px] font-black rounded-md uppercase tracking-widest">30 Days Refill Cycle</span>
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Synced from Clinical Node</span>
                    </div>
                  </div>
                  <div className="grid gap-6">
                    {chronicMeds.length > 0 ? chronicMeds.map((med, idx) => (
                      <div key={idx} className="bg-[#161e31]/60 p-7 rounded-[2.5rem] border border-white/5 flex items-center gap-6 group hover:border-blue-500/40 transition-all">
                        <div className="p-4 bg-blue-600/10 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform"><Clock size={28} /></div>
                        <div className="flex-1">
                          <p className="text-2xl font-black text-white uppercase tracking-tight">{med.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                             <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">30 Days Refill Cycle</p>
                             <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{med.info}</p>
                          </div>
                        </div>
                        <div className="shrink-0"><CheckCircle2 className="text-emerald-500" size={24} /></div>
                      </div>
                    )) : (
                      <div className="text-center py-10 opacity-30 border border-dashed border-white/10 rounded-[2.5rem]">
                        <BookmarkCheck size={48} className="mx-auto" />
                        <p className="mt-4 font-black uppercase text-xs tracking-widest">No chronic meds extracted</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-blue-600/5 p-8 rounded-[2.5rem] border border-blue-500/10 space-y-6">
                     <div className="flex gap-4">
                        <AlertTriangle className="text-blue-500 shrink-0" size={24} />
                        <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
                           * <span className="text-blue-400 font-black underline underline-offset-4">CONTINUE</span> INDICATES A PERSISTENT MEDICAL SUPPLY OF <span className="text-blue-400 font-black">30 DAYS</span> UNLESS SPECIFIED OTHERWISE BY YOUR PRACTITIONER.
                        </p>
                     </div>
                     <button onClick={handleMedicineOrder} className="w-full bg-blue-600 text-white py-10 rounded-full font-black text-2xl active:scale-95 shadow-2xl uppercase tracking-widest flex items-center justify-center gap-4">
                        <Truck size={32} /> REQUEST 30-DAY STOCK REFILL
                     </button>
                  </div>
               </div>

               {/* LAB INVESTIGATIONS SECTION - REPLACES RAW CLINICAL PROCEDURES */}
               {currentPatientRecord.investigationsAdvised && (
                 <div className="bg-[#101726] border border-amber-500/20 p-10 rounded-[4rem] space-y-8 shadow-2xl animate-in slide-in-from-bottom duration-700">
                    <div className="flex justify-between items-center">
                       <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tight"><TestTube className="text-amber-500" /> Lab Investigations</h3>
                       <div className="px-5 py-2 bg-amber-500/10 rounded-full text-[10px] font-black text-amber-500 uppercase tracking-widest">Advised</div>
                    </div>
                    <div className="bg-[#161e31]/40 p-8 rounded-[3rem] border border-white/5 shadow-inner">
                       <p className="text-lg font-bold text-amber-100/80 leading-relaxed whitespace-pre-wrap font-sans">
                          {currentPatientRecord.investigationsAdvised}
                       </p>
                    </div>
                    <div className="flex items-center gap-3 bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10">
                       <Search className="text-amber-500/50" size={18} />
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Please visit your nearest lab node for testing.</p>
                    </div>
                 </div>
               )}
            </div>
          )}
        </div>
      )}

      {/* History Modal */}
      {showVitalsHistory && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl">
             <div className="flex justify-between items-center mb-10 shrink-0">
                <h3 className="text-4xl font-black text-white tracking-tighter flex items-center gap-6"><History size={48} className="text-blue-500" /> Clinical History</h3>
                <button onClick={() => setShowVitalsHistory(false)} className="p-4 bg-white/5 rounded-3xl text-slate-500"><XCircle size={32} /></button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-6 pr-4">
                {vitalsHistory.map(log => (
                  <div key={log.id} className="bg-[#161e31] border border-white/5 p-8 rounded-[3rem] shadow-xl group">
                     <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-6 py-2 rounded-full uppercase tracking-widest">{log.timestamp}</span>
                        <button onClick={() => handleEditVital(log)} className="p-3 bg-white/5 rounded-xl text-slate-500 opacity-0 group-hover:opacity-100 transition-all"><Pencil size={18} /></button>
                     </div>
                     <div className="grid grid-cols-3 gap-4">
                        {[
                          { l: 'BP', v: log.bp, c: 'text-blue-400' },
                          { l: 'O2', v: log.spo2, c: 'text-emerald-400' },
                          { l: 'HR', v: log.hr, c: 'text-rose-500' },
                          { l: 'TEMP', v: log.temp, c: 'text-rose-400' },
                        ].map(item => (
                          <div key={item.l} className="text-center p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                             <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">{item.l}</p>
                             <p className={`font-black ${item.c} text-lg`}>{item.v || '--'}</p>
                          </div>
                        ))}
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Emergency Alert Modal */}
      {showEmergencyDialog && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 border-4 border-rose-600/40 p-12 rounded-[5rem] w-full max-w-md text-center space-y-12 shadow-[0_0_120px_rgba(225,29,72,0.5)] relative">
            <div className="absolute top-0 left-0 w-full h-full bg-rose-600/5 pointer-events-none animate-pulse"></div>
            <div className="relative"><Siren className="w-32 h-32 text-rose-500 mx-auto animate-bounce" /><div className="absolute inset-0 bg-rose-500/20 blur-3xl"></div></div>
            <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Emergency SOS</h3>
            <div className="grid gap-6">
              <button onClick={() => handleEmergencyAction('ambulance')} className="w-full p-10 bg-rose-600 text-white rounded-full font-black text-2xl active:scale-95 shadow-2xl uppercase tracking-widest">Ambulance Hub</button>
              <button onClick={() => handleEmergencyAction('doctor')} className="w-full p-10 bg-blue-600 text-white rounded-full font-black text-2xl active:scale-95 shadow-2xl uppercase tracking-widest">Urgent Doctor</button>
              <button onClick={() => setShowEmergencyDialog(false)} className="text-slate-600 font-black uppercase text-xs tracking-[0.3em] mt-6">Cancel / Safe Mode</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showPatientSettings && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-md space-y-10 shadow-2xl">
            <div className="flex justify-between items-center"><h3 className="text-3xl font-black text-white uppercase tracking-tighter">Hub Settings</h3><button onClick={() => setShowPatientSettings(false)} className="p-2 text-slate-500"><XCircle size={32} /></button></div>
            <div className="space-y-8">
               <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-4">Family WhatsApp Node (Emergency)</label>
                 <div className="flex items-center gap-4 bg-[#161e31] border border-white/5 p-4 rounded-[2.5rem] shadow-inner focus-within:border-blue-500 transition-all">
                    <Smartphone size={24} className="text-slate-600 ml-2" />
                    <input type="text" value={relativeNumber} onChange={e => handleSaveRelativeNumber(e.target.value)} placeholder="91XXXXXXXXXX" className="w-full bg-transparent p-4 text-white font-black outline-none placeholder:text-slate-800" />
                 </div>
               </div>
            </div>
            <button onClick={() => { setShowPatientSettings(false); showToast('Settings Updated', 'success'); }} className="w-full bg-blue-600 text-white py-9 rounded-full font-black text-2xl active:scale-95 shadow-2xl uppercase tracking-widest">Save Config</button>
          </div>
        </div>
      )}

      {/* Vitals Form Modal */}
      {showVitalsForm && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-xl space-y-10 my-auto shadow-2xl">
            <div className="flex justify-between items-center"><h3 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4"><Activity className="text-emerald-500" /> Stats Node</h3><button onClick={() => setShowVitalsForm(false)} className="p-2 text-slate-500"><XCircle size={32} /></button></div>
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: 'Blood Pressure', key: 'bp', icon: <Activity size={18} />, color: 'text-blue-400' },
                { label: 'Temp (°F)', key: 'temp', icon: <Thermometer size={18} />, color: 'text-rose-400' },
                { label: 'SpO2 (%)', key: 'spo2', icon: <Check size={18} />, color: 'text-emerald-400' },
                { label: 'Pulse (bpm)', key: 'hr', icon: <HeartPulse size={18} />, color: 'text-rose-500' },
              ].map(field => (
                <div key={field.key} className="space-y-2">
                  <label className={`text-[10px] font-black ${field.color} uppercase ml-2 flex items-center gap-2`}>{field.icon} {field.label}</label>
                  <input type="text" value={(vitalsFormData as any)[field.key]} onChange={e => setVitalsFormData({...vitalsFormData, [field.key]: e.target.value})} className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-white font-black text-center outline-none focus:border-emerald-500 shadow-inner" />
                </div>
              ))}
            </div>
            <button onClick={handleSaveVitals} className="w-full bg-emerald-600 text-white py-10 rounded-full font-black text-2xl active:scale-95 shadow-2xl uppercase tracking-widest flex items-center justify-center gap-4"><Share2 size={32} /> Log & Alert Hub</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
