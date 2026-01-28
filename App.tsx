import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, Users, Stethoscope, CheckCircle2, XCircle, Loader2, 
  Pill, ArrowLeft, Bell, Check, FileUp, 
  HeartPulse, Siren, Trash2, 
  Plus, FileText, FileDown, CreditCard, Thermometer, 
  Activity, Scale, Calendar, ClipboardList, ChevronRight, CalendarPlus, Clock, Share2, AlertTriangle, History, MapPin, Truck, ShieldAlert, Image as ImageIcon, Smartphone, QrCode, TestTube, Search, Hash, UserCheck, Timer, BookmarkCheck, ShoppingCart, Pencil, Ruler, Clipboard, BriefcaseMedical, RefreshCcw, Save
} from 'lucide-react';
import { SECRET_PIN, SERVICE_GROUPS, DEFAULT_LOGO, DEFAULT_LETTERHEAD, COMMON_ICD_CODES } from './constants';
import { VisitData, Medication, DailyVital, Appointment, MedicineAdviceItem } from './types';
import { storageService } from './services/storageService';
import { generateVisitPdf } from './services/pdfService';
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
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [showVitalsHistory, setShowVitalsHistory] = useState(false);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [vitalsHistory, setVitalsHistory] = useState<DailyVital[]>([]);
  const [vitalsFormData, setVitalsFormData] = useState<Omit<DailyVital, 'id' | 'timestamp'>>({
    bp: '', temp: '', spo2: '', hr: '', rbs: '', weight: '', waist: ''
  });
  const [editingVitalId, setEditingVitalId] = useState<string | null>(null);
  
  // Doctor Hub State
  const [checkedServices, setCheckedServices] = useState<string[]>([]);
  const [otherServices, setOtherServices] = useState('');

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

  const parsePdfMetadata = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await (loadingTask as any).promise;
    const metadataResult = await (pdf as any).getMetadata();
    const info = (metadataResult.info || {}) as any;
    const embeddedData = info.Subject;
    if (!embeddedData) throw new Error("No metadata found in the provided clinical report.");
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
        // Restore for follow-up
        setFormData({
          ...visitData,
          visitId: '', // Generate new ID on save
          serviceCharge: 999, // Reset to standard visit fee
          staffName: formData.staffName || visitData.staffName // Prefer current user name
        });
        showToast('Patient History Restored for Follow-up', 'success');
      } else {
        setCurrentPatientRecord(visitData);
        showToast('XzeCure Hub Synced', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import Failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handlePartnerLabConnect = () => {
    if (!currentPatientRecord) return;
    showToast('Connecting Lab...', 'info');
    const baseMsg = `Hello, this is an automated request from XzeCure. Patient ${currentPatientRecord.patientName} requires a home visit for: ${currentPatientRecord.investigationsAdvised}. Contact: ${currentPatientRecord.contactNumber}`;
    const message = encodeURIComponent(baseMsg);
    window.open(`https://wa.me/919081736424?text=${message}`, "_blank");
  };

  const handleMedicineOrder = () => {
    if (!currentPatientRecord) return;
    showToast('Pharmacy Link...', 'info');
    
    // Prepare meds list including "Continue" (30 days) logic
    const regularMeds = currentPatientRecord.medications.map(m => {
      const duration = m.days ? `${m.days} days` : '30 days (Continue)';
      return `${m.name} [${m.timing}] for ${duration}`;
    });
    
    const adviceMeds = currentPatientRecord.medicineAdvice.map(m => {
       const duration = m.days || 'prescribed cycle';
       return `${m.medicineName} [${m.time}] for ${duration}`;
    });

    const combinedList = [...regularMeds, ...adviceMeds].join(', ');
    const treatmentSuffix = currentPatientRecord.treatment ? `\nTreatment Note: ${currentPatientRecord.treatment}` : '';
    
    const messageText = `Hi I'm patient ${currentPatientRecord.patientName} from XzeCure. I need the following medicines (including 30-day continuation stock): ${combinedList}.${treatmentSuffix}\n\nThis is an automated order request. Please confirm availability and delivery slot.`;
    
    const message = encodeURIComponent(messageText);
    window.open(`https://wa.me/917016583135?text=${message}`, "_blank");
  };

  const handleSaveVitals = () => {
    if (!currentPatientRecord) {
      showToast('Import Patient PDF first', 'error');
      return;
    }

    if (editingVitalId) {
      const updated = storageService.updateDailyVital(editingVitalId, vitalsFormData);
      setVitalsHistory(updated);
      setEditingVitalId(null);
      showToast('Log Updated', 'success');
    } else {
      storageService.saveDailyVital(vitalsFormData);
      setVitalsHistory(storageService.getDailyVitals());
      showToast('Vitals Saved', 'success');

      // WhatsApp Auto-Share
      const stamp = new Date().toLocaleString('en-IN');
      const vitalsSummary = `BP:${vitalsFormData.bp || '--'}, Temp:${vitalsFormData.temp || '--'}°F, SpO2:${vitalsFormData.spo2 || '--'}%, HR:${vitalsFormData.hr || '--'}bpm, RBS:${vitalsFormData.rbs || '--'}mg/dL, Weight:${vitalsFormData.weight || '--'}kg`;
      const msg = `Hi, I'm ${currentPatientRecord.patientName} under your treatment for ${currentPatientRecord.provisionalDiagnosis}. My vitals are ${vitalsSummary} (${stamp}).`;
      window.open(`https://wa.me/918200095781?text=${encodeURIComponent(msg)}`, "_blank");
    }

    setVitalsFormData({ bp: '', temp: '', spo2: '', hr: '', rbs: '', weight: '', waist: '' });
    setShowVitalsForm(false);
  };

  const handlePinInput = (value: string) => {
    setPin(value);
    if (value.length === 6) {
      if (selectedRole === 'doctor' && value === SECRET_PIN) {
        setIsLocked(false);
        setPin('');
      } else {
        showToast('Invalid PIN Access Denied', 'error');
        setPin('');
      }
    }
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

  const toggleAdvice = (id: string) => {
    setAdviceStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleMed = (id: string) => {
    setMedsStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEditVital = (vital: DailyVital) => {
    setEditingVitalId(vital.id);
    setVitalsFormData({
      bp: vital.bp,
      temp: vital.temp,
      spo2: vital.spo2,
      hr: vital.hr,
      rbs: vital.rbs,
      weight: vital.weight,
      waist: vital.waist
    });
    setShowVitalsForm(true);
    setShowVitalsHistory(false);
  };

  const addMedication = () => {
    const newMed: Medication = { id: crypto.randomUUID(), name: '', dose: '', timing: '', route: 'Oral', frequency: 1, days: '' };
    setFormData({ ...formData, medications: [...formData.medications, newMed] });
  };

  const removeMedication = (id: string) => {
    setFormData({ ...formData, medications: formData.medications.filter(m => m.id !== id) });
  };

  const updateMedication = (id: string, field: keyof Medication, value: any) => {
    setFormData({
      ...formData,
      medications: formData.medications.map(m => m.id === id ? { ...m, [field]: value } : m)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const vId = `XZ-DR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const finalComplaints = formData.complaints;
      const finalData = { ...formData, visitId: vId, complaints: finalComplaints };
      
      const blob = await generateVisitPdf(finalData, finalData.photos, DEFAULT_LOGO);
      setPdfBlob(blob);
      storageService.saveVisit({ visitId: vId, name: finalData.patientName, date: new Date().toISOString(), staff: finalData.staffName, fullData: finalData });
      showToast('Report Captured', 'success');
    } catch (err) {
      showToast('PDF Engine Error', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmergencyAction = (type: 'ambulance' | 'doctor') => {
    const actionText = type === 'ambulance' ? '🚨 SOS: EMERGENCY AMBULANCE REQUIRED' : '🩺 SOS: URGENT DOCTOR REQUIRED';
    setShowEmergencyDialog(false);
    window.open(`https://wa.me/918200095781?text=${encodeURIComponent(actionText)}`, "_blank");
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    if (isNaN(value)) return;
    let label = '';
    SERVICE_GROUPS.forEach(group => {
      const opt = group.options.find(o => o.value === value);
      if (opt) label = opt.label;
    });
    setFormData(prev => ({ ...prev, serviceCharge: value, serviceName: label || prev.serviceName }));
  };

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-[#0a0f1d] flex flex-col items-center justify-center z-[200]">
        <HeartPulse className="w-40 h-40 text-blue-500 animate-pulse" />
        <h1 className="text-5xl font-black text-white tracking-tighter mt-8">XzeCure</h1>
        <p className="text-blue-400 font-bold uppercase tracking-widest text-xs mt-2">Happy patient is our goal</p>
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
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">XzeCure</h1>
              <p className="text-slate-500 font-medium italic text-lg">Happy patient is our goal</p>
            </div>
          </div>
          <div className="grid gap-6">
            <button onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} className="group w-full p-8 bg-blue-600 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-2xl border border-blue-400/20">
               <div className="flex items-center gap-4 text-white">
                 <Users size={32} />
                 <span className="text-2xl font-black tracking-tight">Patient Portal</span>
               </div>
               <ChevronRight size={24} className="text-white/50 group-hover:translate-x-1 transition-transform" />
            </button>
            {selectedRole === null ? (
              <div className="grid gap-4">
                <button onClick={() => setSelectedRole('doctor')} className="group w-full p-8 bg-slate-900 border border-white/10 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-lg hover:bg-slate-800">
                   <div className="flex items-center gap-4 text-slate-300">
                     <Stethoscope size={32} />
                     <span className="text-2xl font-black tracking-tight">Doctor Access</span>
                   </div>
                   <ChevronRight size={24} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ) : (
              <div className="animate-in zoom-in duration-300">
                <input autoFocus type="password" maxLength={6} value={pin} onChange={(e) => handlePinInput(e.target.value)} placeholder="••••••" className={`w-full bg-[#161e31] border-2 border-blue-500/30 text-white text-center py-7 rounded-full text-5xl font-black outline-none transition-all placeholder:text-slate-800 shadow-2xl`} />
                <button onClick={() => { setSelectedRole(null); setPin(''); }} className="w-full text-center mt-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Back to Roles</button>
              </div>
            )}
            <button onClick={() => setShowEmergencyDialog(true)} className="group w-full p-8 bg-rose-600 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-2xl border border-rose-400/20">
               <div className="flex items-center gap-4 text-white">
                 <Siren size={32} />
                 <span className="text-2xl font-black tracking-tight uppercase">Emergency SOS</span>
               </div>
               <ChevronRight size={24} className="text-white/50 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 selection:bg-blue-500 selection:text-white pb-20">
      {toast && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-white text-slate-950 px-10 py-5 rounded-full shadow-2xl font-black text-sm tracking-widest border border-white/20">{toast.message.toUpperCase()}</div>}

      {selectedRole === 'doctor' && (
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12 pb-32">
          <header className={`flex justify-between items-center bg-[#161e31] border-white/10 p-6 rounded-[2.5rem] border shadow-2xl`}>
            <div className="flex items-center gap-6">
              <img src={DEFAULT_LOGO} className="w-16 h-16 object-contain" />
              <div>
                <h1 className="text-3xl font-black text-white tracking-tighter">Doctor Hub</h1>
                <p className={`text-[10px] font-black text-blue-500 uppercase tracking-widest`}>
                  Clinical Command Center
                </p>
              </div>
            </div>
            <div className="flex gap-3">
               <label className="p-5 bg-slate-900 rounded-2xl text-slate-400 active:scale-90 shadow-lg cursor-pointer hover:text-white transition-colors flex items-center gap-2 group">
                  <FileUp size={24} />
                  <span className="hidden sm:inline font-black text-[10px] tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">Restore Report</span>
                  <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} />
               </label>
               <button onClick={() => { setIsLocked(true); setSelectedRole(null); setPin(''); }} className="p-5 bg-slate-900 rounded-2xl text-slate-400 active:scale-90 shadow-lg"><ArrowLeft size={24} /></button>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Core Patient Identity */}
            <div className="bg-[#101726] rounded-[3rem] border border-white/10 p-12 shadow-2xl space-y-12">
              <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-6">
                    <div className="p-4 bg-blue-600/10 text-blue-500 rounded-2xl"><User size={24} /></div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Identity Node</h2>
                 </div>
                 {selectedRole === 'doctor' && (
                   <label className="p-4 bg-white/5 text-blue-400 rounded-2xl font-black text-[10px] tracking-widest uppercase cursor-pointer hover:bg-white/10 transition-all flex items-center gap-2">
                     <RefreshCcw size={14} /> Restore Follow-up
                     <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} />
                   </label>
                 )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Practitioner Name</label>
                  <input required type="text" value={formData.staffName} onChange={e => setFormData({...formData, staffName: e.target.value})} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] text-xl font-bold text-white focus:border-blue-500 outline-none" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Patient Identity</label>
                  <input required type="text" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] text-xl font-bold text-white focus:border-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Age</label>
                  <input type="text" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-white font-black text-center" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Gender</label>
                  <input type="text" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-white font-black text-center" placeholder="M/F/O" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Weight (kg)</label>
                  <input type="text" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-white font-black text-center" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Height (cm)</label>
                  <input type="text" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-white font-black text-center" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Contact</label>
                  <input type="text" value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-white font-black text-center" />
                </div>
              </div>
            </div>

            {/* Doctor-Only Comprehensive Sections */}
            {selectedRole === 'doctor' && (
              <div className="space-y-10">
                {/* Clinical History Node */}
                <div className="bg-[#101726] rounded-[3rem] border border-white/10 p-12 shadow-2xl space-y-10">
                   <div className="flex items-center gap-6">
                      <div className="p-4 bg-amber-600/10 text-amber-500 rounded-2xl"><Clipboard size={24} /></div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tight">Clinical History</h2>
                   </div>
                   <div className="grid gap-10">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Chief Complaints & Duration</label>
                        <textarea value={formData.complaints} onChange={e => setFormData({...formData, complaints: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 shadow-inner resize-none" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Past Medical History</label>
                          <textarea value={formData.history} onChange={e => setFormData({...formData, history: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 shadow-inner resize-none" />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Past Surgical History</label>
                          <textarea value={formData.surgicalHistory} onChange={e => setFormData({...formData, surgicalHistory: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 shadow-inner resize-none" />
                        </div>
                      </div>
                   </div>
                </div>

                {/* Physical Examination Node */}
                <div className="bg-[#101726] rounded-[3rem] border border-white/10 p-12 shadow-2xl space-y-10">
                   <div className="flex items-center gap-6">
                      <div className="p-4 bg-emerald-600/10 text-emerald-500 rounded-2xl"><Activity size={24} /></div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tight">Examination & Vitals</h2>
                   </div>
                   <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
                      {[
                        {l: 'Temp (°F)', k: 'vitalTemp'}, {l: 'BP (mmHg)', k: 'vitalBp'}, 
                        {l: 'SpO2 (%)', k: 'vitalSpo2'}, {l: 'HR (bpm)', k: 'vitalHr'}, {l: 'RBS (mg/dL)', k: 'vitalRbs'}
                      ].map(v => (
                        <div key={v.k} className="space-y-2 text-center">
                          <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{v.l}</label>
                          <input type="text" value={(formData as any)[v.k]} onChange={e => setFormData({...formData, [v.k]: e.target.value})} className="w-full bg-[#161e31] p-5 rounded-2xl border border-white/5 text-white font-black text-center" />
                        </div>
                      ))}
                   </div>
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Physical Signs / Observations</label>
                      <textarea value={formData.signs} onChange={e => setFormData({...formData, signs: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 shadow-inner resize-none" />
                   </div>
                </div>

                {/* Treatment & Diagnosis Node */}
                <div className="bg-[#101726] rounded-[3rem] border border-white/10 p-12 shadow-2xl space-y-10">
                   <div className="flex items-center gap-6">
                      <div className="p-4 bg-rose-600/10 text-rose-500 rounded-2xl"><BriefcaseMedical size={24} /></div>
                      <h2 className="text-2xl font-black text-white uppercase tracking-tight">Clinical Decision</h2>
                   </div>
                   
                   <div className="space-y-10">
                      <div className="space-y-3 relative" ref={icdRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Diagnosis / ICD-10 Search</label>
                        <input type="text" value={formData.provisionalDiagnosis} onChange={e => { handleIcdSearch(e.target.value); }} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-xl font-black text-white outline-none focus:border-rose-500 shadow-inner" />
                        {icdSuggestions.length > 0 && (
                          <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-[#161e31] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                            {icdSuggestions.map((item, idx) => (
                              <button key={idx} type="button" onClick={() => { setFormData(prev => ({ ...prev, provisionalDiagnosis: item.description, icdCode: item.code })); setIcdSuggestions([]); }} className="w-full text-left p-6 px-8 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors flex justify-between items-center group">
                                <div><p className="text-white font-black">{item.description}</p><p className="text-[10px] text-slate-500 font-bold">ICD: {item.code}</p></div>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Prescribed Medications (Rx)</label>
                          <button type="button" onClick={addMedication} className="p-3 bg-blue-600/20 text-blue-400 rounded-xl flex items-center gap-2 font-black text-[10px] tracking-widest shadow-lg uppercase"><Plus size={14} /> Add Med</button>
                        </div>
                        <div className="grid gap-4">
                           {formData.medications.map(med => (
                             <div key={med.id} className="grid grid-cols-1 sm:grid-cols-5 gap-4 p-6 bg-[#161e31] rounded-[2rem] border border-white/5 shadow-inner animate-in slide-in-from-left duration-300">
                                <input placeholder="Med Name" value={med.name} onChange={e => updateMedication(med.id, 'name', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white text-lg outline-none focus:border-blue-500" />
                                <input placeholder="Dose (e.g. 500mg)" value={med.dose} onChange={e => updateMedication(med.id, 'dose', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white outline-none focus:border-blue-500" />
                                <input placeholder="Timing (e.g. 1-0-1)" value={med.timing} onChange={e => updateMedication(med.id, 'timing', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white outline-none focus:border-blue-500" />
                                <input placeholder="Days" value={med.days} onChange={e => updateMedication(med.id, 'days', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white outline-none focus:border-blue-500" />
                                <div className="flex justify-between items-center">
                                  <input placeholder="Route" value={med.route} onChange={e => updateMedication(med.id, 'route', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white w-20 outline-none focus:border-blue-500" />
                                  <button type="button" onClick={() => removeMedication(med.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={18} /></button>
                                </div>
                             </div>
                           ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Investigations Advised (Labs / Imaging)</label>
                        <textarea value={formData.investigationsAdvised} onChange={e => setFormData({...formData, investigationsAdvised: e.target.value})} rows={2} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 shadow-inner resize-none" />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Treatment Plan / Procedures</label>
                        <textarea value={formData.treatment} onChange={e => setFormData({...formData, treatment: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 shadow-inner resize-none" />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Non-Medicinal Advice / Diet</label>
                        <textarea value={formData.nonMedicinalAdvice} onChange={e => setFormData({...formData, nonMedicinalAdvice: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 shadow-inner resize-none" />
                      </div>
                   </div>
                </div>

                {/* Follow-up Node */}
                <div className="bg-[#101726] rounded-[3rem] border border-white/10 p-12 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-10">
                   <div className="flex items-center gap-6">
                      <div className="p-4 bg-purple-600/10 text-purple-500 rounded-2xl"><CalendarPlus size={24} /></div>
                      <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Follow-up Schedule</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deploy next clinical node</p>
                      </div>
                   </div>
                   <div className="flex flex-col sm:flex-row items-center gap-8">
                      <button type="button" onClick={() => setFormData({...formData, followup: formData.followup === 'Yes' ? 'No' : 'Yes'})} className={`p-6 px-10 rounded-full font-black uppercase text-xs tracking-widest border transition-all ${formData.followup === 'Yes' ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_25px_rgba(147,51,234,0.4)]' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                        {formData.followup === 'Yes' ? 'Planned' : 'Not Needed'}
                      </button>
                      {formData.followup === 'Yes' && (
                        <div className="flex items-center gap-4 bg-[#161e31] border border-white/10 p-2 rounded-[2rem]">
                          <Calendar size={18} className="text-purple-400 ml-4" />
                          <input type="text" placeholder="e.g. Next Monday / Date" value={formData.followupDate} onChange={e => setFormData({...formData, followupDate: e.target.value})} className="bg-transparent p-4 text-white font-black outline-none placeholder:text-slate-700" />
                        </div>
                      )}
                   </div>
                </div>
              </div>
            )}

            {/* Billing Section (Universal for Hubs) */}
            <div className="bg-[#101726] rounded-[3rem] border border-white/10 p-12 shadow-2xl">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 mb-4 block">Deployment Fee Category</label>
              <div className="relative">
                <select onChange={handleServiceChange} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] font-black text-white text-xl appearance-none shadow-lg outline-none focus:border-blue-500">
                    <option value="">-- Select Bill Category --</option>
                    {SERVICE_GROUPS.map(g => (<optgroup key={g.label} label={g.label} className="bg-[#0a0f1d]">{g.options.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}</optgroup>))}
                </select>
                <ChevronRight size={24} className="absolute right-8 top-8 text-slate-700 rotate-90" />
              </div>
            </div>

            <button type="submit" disabled={isGenerating} className={`w-full bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.3)] py-10 rounded-[2.5rem] font-black text-3xl flex items-center justify-center gap-6 active:scale-95 disabled:opacity-50 transition-all border border-white/10`}>
              {isGenerating ? <><Loader2 className="animate-spin" /> COMPILING...</> : <><Save size={40} /> DEPLOY CLINICAL REPORT</>}
            </button>
          </form>

          {pdfBlob && (
            <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-8 animate-in zoom-in duration-500 overflow-y-auto">
               <div className="w-full max-w-5xl bg-[#101726] rounded-[4rem] border border-white/10 p-12 space-y-10 shadow-2xl my-auto">
                  <div className="flex justify-between items-center">
                     <h2 className="text-4xl font-black text-white tracking-tighter">Health Node Captured</h2>
                     <button onClick={() => setPdfBlob(null)} className="p-6 bg-slate-800 rounded-3xl text-slate-400 active:scale-90 shadow-xl"><XCircle size={32} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <button onClick={() => window.open(URL.createObjectURL(pdfBlob as Blob))} className="p-10 bg-blue-600 text-white rounded-full font-black text-2xl flex items-center justify-center gap-6 shadow-2xl hover:bg-blue-500">
                      <FileDown size={48} /> SAVE HUB PDF
                    </button>
                    <button onClick={() => setShowPaymentQR(true)} className="p-10 bg-emerald-600 text-white rounded-full font-black text-2xl flex items-center justify-center gap-6 shadow-2xl hover:bg-emerald-500">
                      <CreditCard size={48} /> PAY ₹{formData.serviceCharge}
                    </button>
                  </div>
                  <div className="bg-white rounded-[2rem] overflow-hidden border-[12px] border-slate-950 h-[600px]">
                    <iframe src={URL.createObjectURL(pdfBlob as Blob)} title="PDF Preview" className="w-full h-full" />
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {selectedRole === 'patient' && (
        <div className="max-w-2xl mx-auto px-6 py-12 space-y-12 pb-80">
          <header className="flex justify-between items-center bg-[#161e31] backdrop-blur-3xl p-6 rounded-[2.5rem] border border-white/10 sticky top-4 z-[50] shadow-2xl">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg"><User size={32} /></div>
              <div><h2 className="text-2xl font-black text-white tracking-tight">{currentPatientRecord?.patientName || 'Guest User'}</h2><p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Active Clinical Hub</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowVitalsHistory(true)} className="p-3 bg-slate-900 rounded-xl text-slate-400 shadow-lg"><History size={20} /></button>
              <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-4 bg-slate-900 rounded-2xl text-slate-400 active:scale-90 shadow-lg"><ArrowLeft size={24} /></button>
            </div>
          </header>

          {!currentPatientRecord ? (
            <div className="space-y-12 animate-in fade-in duration-500">
               <div className="bg-[#101726] border-4 border-dashed border-white/10 p-10 sm:p-16 rounded-[4rem] text-center space-y-12 shadow-2xl">
                  <FileUp className="w-24 h-24 text-blue-500 mx-auto animate-bounce" />
                  <div className="space-y-4"><h3 className="text-4xl font-black text-white tracking-tighter">Connect Health Node</h3><p className="text-slate-500 font-medium text-xl">Upload clinic report to sync hub.</p></div>
                  <label className="block w-full bg-blue-600 text-white py-10 rounded-full font-black text-2xl cursor-pointer active:scale-95 shadow-lg uppercase tracking-widest">CHOOSE CLINIC PDF<input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} /></label>
               </div>
               <div className="px-4">
                  <a href="https://obe-cure.vercel.app/" target="_blank" rel="noopener noreferrer" className="w-full bg-white text-slate-950 py-10 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 shadow-2xl border-2 border-orange-100 uppercase tracking-tight">your obesity with us</a>
               </div>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in duration-700">
               {/* Quick Vitals Log Card */}
               <div onClick={() => setShowVitalsForm(true)} className="bg-emerald-600/10 border border-emerald-500/20 p-8 rounded-[3rem] space-y-4 shadow-xl cursor-pointer hover:bg-emerald-600/15 transition-all">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tight"><Activity className="text-emerald-500" /> Log Daily Vitals</h3>
                    <div className="p-3 bg-emerald-600 text-white rounded-full shadow-lg"><Plus size={20} /></div>
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Capture health stats and share with clinical hub +91 8200095781.</p>
               </div>

               {currentPatientRecord.medicineAdvice && currentPatientRecord.medicineAdvice.length > 0 && (
                 <div className="bg-blue-600/10 border border-blue-500/20 p-8 rounded-[3.5rem] space-y-6 shadow-2xl">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tight"><Timer className="text-blue-400" /> Medicine Advice</h3>
                    <div className="grid gap-4">
                      {currentPatientRecord.medicineAdvice.map(item => (
                        <div key={item.id} onClick={() => toggleAdvice(item.id)} className={`p-7 rounded-[2.5rem] border transition-all cursor-pointer shadow-lg ${adviceStatus[item.id] ? 'bg-blue-500/5 opacity-60' : 'bg-[#161e31] border-white/5'}`}>
                           <p className="text-2xl font-black text-white">{item.medicineName}</p>
                           <div className="flex gap-4 mt-4 flex-wrap">
                             <span className="text-[10px] font-black text-blue-400 uppercase bg-blue-400/10 px-4 py-2 rounded-full shadow-inner border border-blue-400/10">🕒 {item.time}</span>
                             <span className="text-[10px] font-black text-emerald-400 uppercase bg-emerald-400/10 px-4 py-2 rounded-full shadow-inner border border-emerald-400/10">⏳ {item.duration}</span>
                             <span className="text-[10px] font-black text-amber-400 uppercase bg-amber-400/10 px-4 py-2 rounded-full shadow-inner border border-amber-400/10">🗓️ {item.days}</span>
                           </div>
                        </div>
                      ))}
                    </div>
                 </div>
               )}

               <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] space-y-8 shadow-2xl">
                 <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tight"><Pill className="text-blue-500" /> Medication Plan</h3>
                    <button onClick={handleMedicineOrder} className="p-4 bg-emerald-600 text-white rounded-2xl active:scale-90 shadow-lg flex items-center gap-2 font-black text-xs">
                      <ShoppingCart size={18} /> PLACE ORDER
                    </button>
                 </div>
                 <div className="grid gap-4">
                   {currentPatientRecord.medications.map(med => (
                     <div key={med.id} onClick={() => toggleMed(med.id)} className={`p-7 rounded-[2.5rem] border transition-all cursor-pointer flex justify-between items-center shadow-lg ${medsStatus[med.id] ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' : 'bg-[#161e31] border-white/5'}`}>
                        <div className="flex gap-6 items-center">
                          <div className={`p-4 rounded-2xl ${medsStatus[med.id] ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'} shadow-xl transition-all`}>
                            <Check size={24} strokeWidth={4} />
                          </div>
                          <div>
                            <p className={`text-2xl font-black ${medsStatus[med.id] ? 'text-slate-500 line-through' : 'text-white'}`}>{med.name}</p>
                            <p className="text-xs font-black text-blue-500 uppercase tracking-widest mt-1">{med.timing} • {med.dose}</p>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); }} className={`p-5 rounded-2xl border transition-all ${reminders[med.id] ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-110' : 'bg-white/5 border-white/10 text-slate-600'}`}><Bell size={20} /></button>
                     </div>
                   ))}
                 </div>
                 
                 {/* 30 Days Continuity Instruction Box */}
                 {currentPatientRecord.treatment && (
                   <div className="mt-4 p-7 bg-blue-500/5 border border-blue-500/10 rounded-[2.5rem] shadow-inner animate-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg"><RefreshCcw size={16} /></div>
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">Continuity Instruction</h4>
                      </div>
                      <p className="text-slate-300 font-bold leading-relaxed">{currentPatientRecord.treatment}</p>
                      {currentPatientRecord.treatment.toLowerCase().includes('continue') && (
                        <div className="mt-4 flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-tighter">
                          <CheckCircle2 size={12} /> Cycle Duration: 30 Days (Standard Continuity)
                        </div>
                      )}
                   </div>
                 )}
               </div>

               {currentPatientRecord.investigationsAdvised && currentPatientRecord.investigationsAdvised.trim().length > 0 && (
                 <div className="bg-amber-600/10 border border-amber-500/20 p-8 rounded-[3.5rem] space-y-6 shadow-2xl animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-4">
                       <div className="w-16 h-16 bg-amber-500 rounded-[2rem] flex items-center justify-center text-white"><TestTube size={32} /></div>
                       <div>
                          <h3 className="text-2xl font-black text-white uppercase tracking-tight">Prescribed Investigations</h3>
                          <p className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest">Connect with Partner Labs</p>
                       </div>
                    </div>
                    <div className="p-7 bg-slate-900/50 rounded-[2rem] border border-white/5 shadow-inner">
                       <p className="text-lg text-slate-300 font-bold italic">"{currentPatientRecord.investigationsAdvised}"</p>
                    </div>
                    <button onClick={handlePartnerLabConnect} className="w-full bg-amber-600 text-white py-9 rounded-full font-black text-xl flex items-center justify-center gap-4 shadow-lg uppercase tracking-widest hover:bg-amber-500">
                       <Truck size={32} /> CONNECT PARTNER LAB
                    </button>
                 </div>
               )}

               <div className="px-4">
                  <a href="https://obe-cure.vercel.app/" target="_blank" rel="noopener noreferrer" className="w-full bg-white text-slate-950 py-10 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 shadow-2xl border-2 border-orange-100 uppercase tracking-tight">your obesity with us</a>
               </div>
            </div>
          )}
          
          <div className="fixed bottom-10 right-8 z-[60]">
             <button onClick={() => setShowEmergencyDialog(true)} className="w-24 h-24 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 animate-pulse">
                <Siren className="w-12 h-12" />
              </button>
          </div>
        </div>
      )}

      {/* Daily Vitals Entry Form Modal */}
      {showVitalsForm && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-xl space-y-10 my-auto shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-3xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
                <Activity className="text-emerald-500" /> {editingVitalId ? 'Edit Vitals' : 'Daily Vitals'}
              </h3>
              <button onClick={() => { setShowVitalsForm(false); setEditingVitalId(null); setVitalsFormData({ bp: '', temp: '', spo2: '', hr: '', rbs: '', weight: '', waist: '' }); }} className="p-4 bg-white/5 rounded-2xl text-slate-500 hover:text-white"><XCircle size={28} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              {[
                { label: 'B.P. (mmHg)', key: 'bp', icon: <Activity size={18} />, color: 'text-blue-400' },
                { label: 'Temp (°F)', key: 'temp', icon: <Thermometer size={18} />, color: 'text-rose-400' },
                { label: 'SpO2 (%)', key: 'spo2', icon: <Check size={18} />, color: 'text-emerald-400' },
                { label: 'Pulse (bpm)', key: 'hr', icon: <HeartPulse size={18} />, color: 'text-rose-500' },
                { label: 'Sugar (RBS)', key: 'rbs', icon: <Activity size={18} />, color: 'text-amber-400' },
                { label: 'Weight (kg)', key: 'weight', icon: <Scale size={18} />, color: 'text-purple-400' },
                { label: 'Waist (inch)', key: 'waist', icon: <Ruler size={18} />, color: 'text-indigo-400' },
              ].map(field => (
                <div key={field.key} className="space-y-2">
                  <label className={`text-[10px] font-black ${field.color} uppercase ml-2 flex items-center gap-2`}>{field.icon} {field.label}</label>
                  <input 
                    type="text" 
                    value={(vitalsFormData as any)[field.key]} 
                    onChange={e => setVitalsFormData({...vitalsFormData, [field.key]: e.target.value})} 
                    className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-white font-black text-center outline-none focus:border-emerald-500" 
                  />
                </div>
              ))}
            </div>

            <button 
              onClick={handleSaveVitals} 
              className="w-full bg-emerald-600 text-white py-9 rounded-full font-black text-2xl active:scale-95 transition-all shadow-xl uppercase tracking-widest flex items-center justify-center gap-4"
            >
               <CheckCircle2 size={32} /> {editingVitalId ? 'UPDATE LOG' : 'SAVE & SHARE'}
            </button>
          </div>
        </div>
      )}

      {/* Vitals History Modal */}
      {showVitalsHistory && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-2xl h-[85vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-10 shrink-0">
               <h3 className="text-4xl font-black text-white tracking-tighter flex items-center gap-6"><History className="text-blue-500" /> Vitals History</h3>
               <button onClick={() => setShowVitalsHistory(false)} className="p-6 bg-white/5 rounded-3xl text-slate-500 hover:text-white"><XCircle size={32} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-4 space-y-6">
              {vitalsHistory.length === 0 ? (
                <div className="text-center py-20 text-slate-700 font-black uppercase tracking-widest italic opacity-50">No Vitals Logged Yet</div>
              ) : vitalsHistory.map(log => (
                <div key={log.id} className="bg-[#161e31] border border-white/5 p-8 rounded-[3rem] space-y-6 shadow-xl relative group">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-6 py-2 rounded-full uppercase tracking-widest">{log.timestamp}</span>
                     <button onClick={() => handleEditVital(log)} className="p-3 bg-white/5 rounded-full text-slate-500 hover:text-blue-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"><Pencil size={18} /></button>
                   </div>
                   <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { l: 'BP', v: log.bp, c: 'text-blue-400' },
                        { l: 'TEMP', v: log.temp, c: 'text-rose-400' },
                        { l: 'SpO2', v: log.spo2, c: 'text-emerald-400' },
                        { l: 'HR', v: log.hr, c: 'text-rose-600' },
                        { l: 'RBS', v: log.rbs, c: 'text-amber-400' },
                        { l: 'WT', v: log.weight, c: 'text-purple-400' },
                        { l: 'WAIST', v: log.waist, c: 'text-indigo-400' }
                      ].map(item => (
                        <div key={item.l} className="text-center p-3 bg-slate-900/50 rounded-2xl border border-white/5 shadow-inner">
                           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{item.l}</p>
                           <p className={`text-lg font-black ${item.c}`}>{item.v || '--'}</p>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showEmergencyDialog && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 p-12 rounded-[5rem] w-full max-w-md space-y-12 shadow-2xl">
            <Siren className="w-24 h-24 text-rose-500 mx-auto animate-bounce" />
            <div className="text-center space-y-4">
              <h3 className="text-4xl font-black text-white uppercase tracking-tighter">SOS Alert</h3>
              <p className="text-slate-500 font-bold text-lg">Deploy emergency medical support?</p>
            </div>
            <div className="grid gap-4">
              <button onClick={() => handleEmergencyAction('ambulance')} className="w-full p-9 bg-rose-600 text-white rounded-full font-black uppercase text-2xl shadow-lg">Ambulance SOS</button>
              <button onClick={() => handleEmergencyAction('doctor')} className="w-full p-9 bg-blue-600 text-white rounded-full font-black uppercase text-2xl shadow-lg">Urgent Doctor</button>
              <button onClick={() => setShowEmergencyDialog(false)} className="w-full p-4 text-slate-600 font-black uppercase text-xs tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPaymentQR && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-md space-y-10 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-3xl font-black text-white">Clinical Payment</h3>
              <button onClick={() => setShowPaymentQR(false)} className="p-4 bg-white/5 rounded-2xl text-slate-500 shadow-xl"><XCircle size={24} /></button>
            </div>
            <div className="bg-white p-6 rounded-[3rem] aspect-square overflow-hidden shadow-2xl flex items-center justify-center border-8 border-slate-950">
              <img src="https://lh3.googleusercontent.com/d/14Ax9aU31Gaja2kAvnLbIFLbhbbAiB4D5" alt="Payment QR" className="w-full h-full object-contain" />
            </div>
            <div className="text-center space-y-3">
              <p className="text-emerald-400 font-black text-5xl tracking-tighter">₹{formData.serviceCharge}</p>
              <p className="text-slate-500 font-bold text-sm uppercase tracking-widest opacity-60">Scan to finalize clinical node</p>
            </div>
            <button onClick={() => { window.location.href = `upi://pay?pa=8200095781@pthdfc&pn=KenilShah&am=${formData.serviceCharge}&cu=INR`; }} className="w-full bg-emerald-600 text-white py-9 rounded-full font-black text-2xl shadow-lg uppercase tracking-widest">Open UPI App</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;