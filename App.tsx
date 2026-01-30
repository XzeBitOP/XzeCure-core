
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, Users, Stethoscope, CheckCircle2, XCircle, Loader2, 
  Pill, ArrowLeft, Bell, Check, FileUp, 
  HeartPulse, Siren, Trash2, 
  Plus, FileText, FileDown, CreditCard, Thermometer, 
  Activity, Scale, Calendar, ClipboardList, ChevronRight, CalendarPlus, Clock, Share2, AlertTriangle, History, MapPin, Truck, ShieldAlert, Image as ImageIcon, Smartphone, QrCode, TestTube, Search, Hash, UserCheck, Timer, BookmarkCheck, ShoppingCart, Pencil, Ruler, Clipboard, BriefcaseMedical, RefreshCcw, Save, RotateCcw, Settings
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
  const [adviceStatus, setAdviceStatus] = useState<Record<string, boolean>>({});
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

  // Initialize notifications for patients when they load or import a record
  useEffect(() => {
    if (selectedRole === 'patient') {
      notificationService.requestPermission().then(granted => {
        if (granted) {
          notificationService.cancelAllSchedules(); // Avoid double scheduling
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

  useEffect(() => {
    const heightCm = parseFloat(formData.height) || 0;
    const weightKg = parseFloat(formData.weight) || 0;
    if (weightKg > 0 && heightCm > 0) {
      const heightM = heightCm / 100;
      const calculatedBmi = (weightKg / (heightM * heightM)).toFixed(1);
      setFormData(prev => ({ ...prev, bmi: calculatedBmi }));
    } else {
      setFormData(prev => ({ ...prev, bmi: '' }));
    }
  }, [formData.weight, formData.height]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleReset = () => {
    if (window.confirm('Wipe clinical workspace? Unsaved data will be lost.')) {
      setFormData(initialFormState);
      setCheckedServices([]);
      setPdfBlob(null);
      setIcdSuggestions([]);
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
        setFormData({
          ...visitData,
          visitId: '', // Fresh visit
          serviceCharge: 999,
          staffName: formData.staffName || visitData.staffName
        });
        showToast('Clinical Context Restored', 'success');
      } else {
        setCurrentPatientRecord(visitData);
        showToast('Patient Node Connected', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync Failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveVitals = () => {
    if (!currentPatientRecord) {
      showToast('Connect Health Node first', 'error');
      return;
    }

    const vitalsSummary = `BP:${vitalsFormData.bp || '--'}, Temp:${vitalsFormData.temp || '--'}°F, SpO2:${vitalsFormData.spo2 || '--'}%, Pulse:${vitalsFormData.hr || '--'}bpm, Sugar:${vitalsFormData.rbs || '--'}mg/dL`;

    if (editingVitalId) {
      const updated = storageService.updateDailyVital(editingVitalId, vitalsFormData);
      setVitalsHistory(updated);
      setEditingVitalId(null);
      showToast('Vital Record Updated', 'success');
    } else {
      storageService.saveDailyVital(vitalsFormData);
      setVitalsHistory(storageService.getDailyVitals());
      showToast('Vital Node Logged', 'success');

      // Immediate Direct Sharing Options in UI
      const stamp = new Date().toLocaleString('en-IN');
      const msg = `*XzeCure Health Report*\nPatient: ${currentPatientRecord.patientName}\nTime: ${stamp}\n\n*Vitals:*\n${vitalsSummary.split(', ').join('\n')}\nWeight: ${vitalsFormData.weight || '--'}kg\nWaist: ${vitalsFormData.waist || '--'}in`;
      
      // Share with Clinical Hub
      window.open(`https://wa.me/918200095781?text=${encodeURIComponent(msg)}`, "_blank");
      
      // Share with Relative (if set)
      if (relativeNumber.trim()) {
        setTimeout(() => {
          window.open(`https://wa.me/${relativeNumber.trim()}?text=${encodeURIComponent('Family Health Alert:\n' + msg)}`, "_blank");
        }, 1200);
      }
    }

    // Trigger background notification with action buttons for easy sharing later
    notificationService.showVitalsLoggedNotification(
      vitalsSummary,
      '918200095781',
      relativeNumber.trim()
    );

    setVitalsFormData({ bp: '', temp: '', spo2: '', hr: '', rbs: '', weight: '', waist: '' });
    setShowVitalsForm(false);
  };

  const handleMedicineOrder = () => {
    if (!currentPatientRecord) return;
    const medList = currentPatientRecord.medications.map(m => `• ${m.name} (${m.timing})`).join('\n');
    const orderMsg = `*XzeCure Pharmacy Order*\nPatient: ${currentPatientRecord.patientName}\n\n*Required Medicines:*\n${medList}\n\n*Refill Stock:* 30 Days Continuation Requested.`;
    window.open(`https://wa.me/917016583135?text=${encodeURIComponent(orderMsg)}`, "_blank");
  };

  const handlePinInput = (value: string) => {
    setPin(value);
    if (value.length === 6) {
      if (selectedRole === 'doctor' && value === SECRET_PIN) {
        setIsLocked(false);
        setPin('');
      } else {
        showToast('Access Denied: Invalid PIN', 'error');
        setPin('');
      }
    }
  };

  // Fixed: Add handleSaveRelativeNumber to persist emergency contact
  const handleSaveRelativeNumber = (val: string) => {
    setRelativeNumber(val);
    localStorage.setItem('xzecure_relative_number', val);
  };

  // Fixed: Add handleEditVital to populate form for editing existing vitals
  const handleEditVital = (log: DailyVital) => {
    setEditingVitalId(log.id);
    setVitalsFormData({
      bp: log.bp,
      temp: log.temp,
      spo2: log.spo2,
      hr: log.hr,
      rbs: log.rbs,
      weight: log.weight,
      waist: log.waist
    });
    setShowVitalsForm(true);
  };

  // Fixed: Add handleEmergencyAction to trigger SOS alerts via WhatsApp
  const handleEmergencyAction = (type: 'ambulance' | 'doctor') => {
    const msg = type === 'ambulance' 
      ? "EMERGENCY: Ambulance required at my location immediately. XzeCure SOS triggered."
      : "URGENT: Requesting emergency doctor consultation immediately. XzeCure SOS triggered.";
    window.open(`https://wa.me/918200095781?text=${encodeURIComponent(msg)}`, "_blank");
    setShowEmergencyDialog(false);
  };

  const handleIcdSearch = (query: string) => {
    setFormData(prev => ({ ...prev, provisionalDiagnosis: query }));
    if (query.length > 1) {
      const filtered = COMMON_ICD_CODES.filter(item => 
        item.description.toLowerCase().includes(query.toLowerCase()) || 
        item.code.toLowerCase().includes(query.toLowerCase())
      );
      setIcdSuggestions(filtered);
    } else {
      setIcdSuggestions([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const vId = `XZ-DR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const finalData = { ...formData, visitId: vId };
      const blob = await generateVisitPdf(finalData, finalData.photos, DEFAULT_LOGO);
      setPdfBlob(blob);
      storageService.saveVisit({ visitId: vId, name: finalData.patientName, date: new Date().toISOString(), staff: finalData.staffName, fullData: finalData });
      showToast('Clinical Hub Deployed', 'success');
    } catch (err) {
      showToast('PDF Engine Error', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-[#0a0f1d] flex flex-col items-center justify-center z-[200]">
        <HeartPulse className="w-40 h-40 text-blue-500 animate-pulse" />
        <h1 className="text-5xl font-black text-white tracking-tighter mt-8">XzeCure</h1>
        <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px] mt-2">Connecting Care Nodes</p>
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
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">XzeCure</h1>
          </div>
          <div className="grid gap-6">
            <button onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} className="w-full p-8 bg-blue-600 rounded-full flex items-center justify-between shadow-2xl border border-blue-400/20 active:scale-95 transition-all">
               <div className="flex items-center gap-4 text-white">
                 <Users size={32} />
                 <span className="text-2xl font-black tracking-tight">Patient Portal</span>
               </div>
               <ChevronRight size={24} className="text-white/50" />
            </button>
            {selectedRole === null ? (
              <button onClick={() => setSelectedRole('doctor')} className="w-full p-8 bg-slate-900 border border-white/10 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-lg">
                 <div className="flex items-center gap-4 text-slate-300">
                   <Stethoscope size={32} />
                   <span className="text-2xl font-black tracking-tight">Doctor Hub</span>
                 </div>
                 <ChevronRight size={24} className="text-slate-500" />
              </button>
            ) : (
              <div className="animate-in zoom-in duration-300">
                <input autoFocus type="password" maxLength={6} value={pin} onChange={(e) => handlePinInput(e.target.value)} placeholder="••••••" className="w-full bg-[#161e31] border-2 border-blue-500/30 text-white text-center py-7 rounded-full text-5xl font-black outline-none transition-all placeholder:text-slate-800 shadow-2xl" />
                <button onClick={() => { setSelectedRole(null); setPin(''); }} className="w-full text-center mt-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Back to Roles</button>
              </div>
            )}
            <button onClick={() => setShowEmergencyDialog(true)} className="w-full p-8 bg-rose-600 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-2xl border border-rose-400/20">
               <div className="flex items-center gap-4 text-white">
                 <Siren size={32} />
                 <span className="text-2xl font-black tracking-tight uppercase">Emergency SOS</span>
               </div>
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
              <div>
                <h1 className="text-3xl font-black text-white tracking-tighter">Clinical Hub</h1>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Control Center</p>
              </div>
            </div>
            <div className="flex gap-3">
               <button onClick={handleReset} className="p-5 bg-rose-950/30 border border-rose-500/20 rounded-2xl text-rose-500 active:scale-90 shadow-lg"><RotateCcw size={20} /></button>
               <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-5 bg-slate-900 rounded-2xl text-slate-400 active:scale-90 shadow-lg"><ArrowLeft size={20} /></button>
            </div>
          </header>
          {/* Form UI and logic would go here */}
        </div>
      )}

      {selectedRole === 'patient' && (
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-12 pb-80">
          <header className="flex justify-between items-center bg-[#161e31] backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/10 sticky top-4 z-[50] shadow-2xl">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg"><User size={32} /></div>
              <div><h2 className="text-2xl font-black text-white tracking-tight">{currentPatientRecord?.patientName || 'Guest Node'}</h2><p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Active Hub</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPatientSettings(true)} className="p-4 bg-slate-900 rounded-2xl text-slate-400 shadow-lg active:scale-90 transition-all"><Settings size={24} /></button>
              <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-4 bg-slate-900 rounded-2xl text-slate-400 active:scale-90 shadow-lg"><ArrowLeft size={24} /></button>
            </div>
          </header>

          {!currentPatientRecord ? (
            <div className="space-y-12 animate-in fade-in duration-500">
               <div className="bg-[#101726] border-4 border-dashed border-white/10 p-10 sm:p-16 rounded-[4rem] text-center space-y-12 shadow-2xl">
                  <FileUp className="w-24 h-24 text-blue-500 mx-auto animate-bounce" />
                  <div className="space-y-4"><h3 className="text-4xl font-black text-white tracking-tighter uppercase">Connect Node</h3><p className="text-slate-500 font-medium text-xl">Import your XzeCure Clinical PDF.</p></div>
                  <label className="block w-full bg-blue-600 text-white py-10 rounded-full font-black text-2xl cursor-pointer active:scale-95 shadow-lg uppercase tracking-widest">SYNC PDF HUB<input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} /></label>
               </div>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in duration-700">
               <div onClick={() => setShowVitalsForm(true)} className="bg-emerald-600/10 border border-emerald-500/20 p-8 rounded-[3rem] space-y-4 shadow-xl cursor-pointer hover:bg-emerald-600/15 transition-all">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tight"><Activity className="text-emerald-500" /> Log Daily Health</h3>
                    <div className="p-4 bg-emerald-600 text-white rounded-full shadow-lg"><Plus size={24} /></div>
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Logs are shared instantly with your Doctor and Family.</p>
               </div>

               <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] space-y-8 shadow-2xl">
                 <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tight"><Pill className="text-blue-500" /> Medication Plan</h3>
                    <button onClick={handleMedicineOrder} className="p-4 bg-emerald-600/20 text-emerald-400 rounded-2xl active:scale-90 shadow-lg flex items-center gap-2 font-black text-xs uppercase tracking-widest"><ShoppingCart size={18} /> Order Refill</button>
                 </div>
                 <div className="grid gap-4">
                   {currentPatientRecord.medications.map(med => (
                     <div key={med.id} className={`p-7 rounded-[2.5rem] border transition-all bg-[#161e31] border-white/5 shadow-lg flex justify-between items-center`}>
                        <div className="flex gap-6 items-center">
                          <div className={`p-5 rounded-2xl bg-white/5 text-slate-500 shadow-xl`}><Check size={28} strokeWidth={4} /></div>
                          <div>
                            <p className="text-2xl font-black text-white uppercase">{med.name}</p>
                            <p className="text-xs font-black text-blue-500 uppercase tracking-widest mt-1">{med.timing} • {med.dose}</p>
                          </div>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><Bell size={20} /></div>
                     </div>
                   ))}
                 </div>
               </div>

               <button onClick={() => setShowVitalsHistory(true)} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl active:scale-95 transition-all group">
                 <div className="flex items-center gap-6"><div className="p-4 bg-slate-900 rounded-2xl text-slate-500 group-hover:text-blue-500 transition-colors"><History size={24} /></div><span className="text-xl font-black text-slate-300">View Vitals History</span></div>
                 <ChevronRight size={24} className="text-slate-700" />
               </button>
            </div>
          )}
        </div>
      )}

      {/* Patient Settings - Crucial for Relative Sharing */}
      {showPatientSettings && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-md space-y-10 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Node Settings</h3>
              <button onClick={() => setShowPatientSettings(false)} className="p-2 text-slate-500"><XCircle size={32} /></button>
            </div>
            <div className="space-y-8">
               <div className="space-y-3">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Family Emergency Contact (WhatsApp)</label>
                 <div className="flex items-center gap-4 bg-[#161e31] border border-white/5 p-2 rounded-[2rem] shadow-inner focus-within:border-blue-500 transition-all">
                    <Smartphone size={24} className="text-slate-500 ml-4" />
                    <input type="text" value={relativeNumber} onChange={e => handleSaveRelativeNumber(e.target.value)} placeholder="91XXXXXXXXXX" className="w-full bg-transparent p-6 text-white font-black outline-none placeholder:text-slate-800" />
                 </div>
                 <p className="text-[10px] text-slate-600 font-bold ml-4 leading-relaxed">Health updates will be shared with this number alongside your clinical team.</p>
               </div>
            </div>
            <button onClick={() => { setShowPatientSettings(false); showToast('Settings Updated', 'success'); }} className="w-full bg-blue-600 text-white py-9 rounded-full font-black text-2xl active:scale-95 shadow-2xl uppercase tracking-widest">Save Configuration</button>
          </div>
        </div>
      )}

      {/* Vitals Log Form */}
      {showVitalsForm && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-xl space-y-10 my-auto shadow-2xl">
            <div className="flex justify-between items-center">
               <h3 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4"><Activity className="text-emerald-500" /> Daily Vitals</h3>
               <button onClick={() => setShowVitalsForm(false)} className="p-2 text-slate-500"><XCircle size={32} /></button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: 'Blood Pressure', key: 'bp', icon: <Activity size={18} />, color: 'text-blue-400' },
                { label: 'Temp (°F)', key: 'temp', icon: <Thermometer size={18} />, color: 'text-rose-400' },
                { label: 'SpO2 (%)', key: 'spo2', icon: <Check size={18} />, color: 'text-emerald-400' },
                { label: 'Pulse (bpm)', key: 'hr', icon: <HeartPulse size={18} />, color: 'text-rose-500' },
                { label: 'Weight (kg)', key: 'weight', icon: <Scale size={18} />, color: 'text-purple-400' },
                { label: 'Sugar (RBS)', key: 'rbs', icon: <TestTube size={18} />, color: 'text-amber-400' },
              ].map(field => (
                <div key={field.key} className="space-y-2">
                  <label className={`text-[10px] font-black ${field.color} uppercase ml-2 flex items-center gap-2`}>{field.icon} {field.label}</label>
                  <input type="text" value={(vitalsFormData as any)[field.key]} onChange={e => setVitalsFormData({...vitalsFormData, [field.key]: e.target.value})} className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-white font-black text-center outline-none focus:border-emerald-500 shadow-inner" />
                </div>
              ))}
            </div>
            <button onClick={handleSaveVitals} className="w-full bg-emerald-600 text-white py-10 rounded-full font-black text-2xl active:scale-95 shadow-2xl uppercase tracking-widest flex items-center justify-center gap-4">
              <Share2 size={32} /> Save & Share Stats
            </button>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showVitalsHistory && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl">
             <div className="flex justify-between items-center mb-10 shrink-0">
                <h3 className="text-4xl font-black text-white tracking-tighter flex items-center gap-6"><History size={48} className="text-blue-500" /> Log History</h3>
                <button onClick={() => setShowVitalsHistory(false)} className="p-4 bg-white/5 rounded-3xl text-slate-500"><XCircle size={32} /></button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-6 pr-4">
                {vitalsHistory.length > 0 ? vitalsHistory.map(log => (
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
                          { l: 'WT', v: log.weight, c: 'text-purple-400' },
                          { l: 'RBS', v: log.rbs, c: 'text-amber-400' },
                        ].map(item => (
                          <div key={item.l} className="text-center p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                             <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">{item.l}</p>
                             <p className={`font-black ${item.c} text-lg`}>{item.v || '--'}</p>
                          </div>
                        ))}
                     </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-30 py-20">
                    <ClipboardList size={80} />
                    <p className="text-2xl font-black uppercase tracking-widest mt-6">No Records Found</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}

      {showEmergencyDialog && (
        <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 border-4 border-rose-600/30 p-12 rounded-[5rem] w-full max-w-md text-center space-y-12 shadow-[0_0_100px_rgba(225,29,72,0.4)]">
            <div className="relative inline-block">
              <Siren className="w-32 h-32 text-rose-500 mx-auto animate-pulse" />
              <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full"></div>
            </div>
            <h3 className="text-4xl font-black text-white uppercase tracking-tighter">Emergency SOS</h3>
            <div className="grid gap-4">
              <button onClick={() => handleEmergencyAction('ambulance')} className="w-full p-9 bg-rose-600 text-white rounded-full font-black text-2xl active:scale-95 transition-all shadow-2xl">Ambulance Hub</button>
              <button onClick={() => handleEmergencyAction('doctor')} className="w-full p-9 bg-blue-600 text-white rounded-full font-black text-2xl active:scale-95 transition-all shadow-2xl">Urgent Doctor</button>
              <button onClick={() => setShowEmergencyDialog(false)} className="text-slate-600 font-black uppercase text-xs tracking-[0.2em] mt-4">Safe / Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
