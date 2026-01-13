import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, Users, Stethoscope, CheckCircle2, XCircle, Loader2, 
  Pill, ArrowLeft, Bell, Check, FileUp, 
  HeartPulse, Siren, Trash2, 
  Plus, FileText, FileDown, CreditCard, Thermometer, 
  Activity, Scale, Calendar, ClipboardList, ChevronRight, CalendarPlus, Clock, Share2, AlertTriangle, History, MapPin, Truck, ShieldAlert, Image as ImageIcon, Smartphone, QrCode, TestTube, Search, Hash
} from 'lucide-react';
import { SECRET_PIN, SERVICE_GROUPS, DEFAULT_LOGO, DEFAULT_LETTERHEAD, COMMON_ICD_CODES } from './constants';
import { VisitData, Medication, DailyVital, Appointment } from './types';
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
  const [showPaymentQR, setShowPaymentQR] = useState(false);
  
  // Patient Portal State
  const [currentPatientRecord, setCurrentPatientRecord] = useState<VisitData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [medsStatus, setMedsStatus] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [showVitalsEntry, setShowVitalsEntry] = useState(false);
  const [showVitalsHistory, setShowVitalsHistory] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [dailyVitals, setDailyVitals] = useState<DailyVital[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  
  // Doctor Form State
  const initialFormState: VisitData = {
    visitId: '', staffName: '', patientName: '', age: '', gender: '', contactNumber: '',
    address: '', weight: '', height: '', bmi: '', complaints: '', duration: '',
    history: '', surgicalHistory: '', investigationsAdvised: '',
    provisionalDiagnosis: '', icdCode: '',
    vitals: '', vitalTemp: '', vitalBp: '', vitalSpo2: '',
    vitalHr: '', vitalRbs: '', signs: '', treatment: '', nonMedicinalAdvice: '', medications: [],
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
    setDailyVitals(storageService.getDailyVitals());
    setAppointments(storageService.getAppointments());
    
    const draft = storageService.getFormDraft();
    if (draft) setFormData(draft);

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
      showToast('XzeCure Synced', 'success');
    } catch (err) {
      showToast('Sync Failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handlePartnerLabConnect = () => {
    if (!currentPatientRecord) return;
    showToast('Capturing location...', 'info');
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const mapsUrl = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
          const message = encodeURIComponent(`this is a auto generate msg from XzeCure, home visit required at ${mapsUrl} ${currentPatientRecord.patientName} needs ${currentPatientRecord.investigationsAdvised} . Please call ${currentPatientRecord.contactNumber} before visit`);
          window.open(`https://wa.me/919081736424?text=${message}`, "_blank");
        },
        () => {
          const message = encodeURIComponent(`this is a auto generate msg from XzeCure, home visit required. (Location not attached - Permission Denied) ${currentPatientRecord.patientName} needs ${currentPatientRecord.investigationsAdvised} . Please call ${currentPatientRecord.contactNumber} before visit`);
          window.open(`https://wa.me/919081736424?text=${message}`, "_blank");
        }
      );
    } else {
      const message = encodeURIComponent(`this is a auto generate msg from XzeCure, home visit required. (Location not attached - Unsupported) ${currentPatientRecord.patientName} needs ${currentPatientRecord.investigationsAdvised} . Please call ${currentPatientRecord.contactNumber} before visit`);
      window.open(`https://wa.me/919081736424?text=${message}`, "_blank");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const vId = `XZ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const finalData = { ...formData, visitId: vId };
      const blob = await generateVisitPdf(finalData, finalData.photos, DEFAULT_LOGO);
      setPdfBlob(blob);
      storageService.saveVisit({ visitId: vId, name: finalData.patientName, date: new Date().toISOString(), staff: finalData.staffName, fullData: finalData });
      showToast('Report Compiled', 'success');
    } catch (err) {
      showToast('Engine Error', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setIsGenerating(true);
    const newAttachments: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          newAttachments.push(dataUrl);
        }
      }
      setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newAttachments] }));
      showToast(`${newAttachments.length} items linked`, 'success');
    } catch (err) {
      showToast('Processing failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmergencyAction = (type: 'ambulance' | 'doctor') => {
    const actionText = type === 'ambulance' ? 'emergency ambulance required' : 'emergency doctor requirement here';
    setShowEmergencyDialog(false);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const mapsUrl = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
          const message = encodeURIComponent(`🚨 SOS ALERT 🚨\n\nMESSAGE: ${actionText.toUpperCase()}\n\nLOCATION: ${mapsUrl}`);
          window.open(`https://wa.me/918200095781?text=${message}`, "_blank");
        },
        () => {
          const message = encodeURIComponent(`🚨 SOS ALERT 🚨\n\nMESSAGE: ${actionText.toUpperCase()}`);
          window.open(`https://wa.me/918200095781?text=${message}`, "_blank");
        }
      );
    } else {
      const message = encodeURIComponent(`🚨 SOS ALERT 🚨\n\nMESSAGE: ${actionText.toUpperCase()}`);
      window.open(`https://wa.me/918200095781?text=${message}`, "_blank");
    }
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    if (isNaN(value)) return;
    
    let label = '';
    SERVICE_GROUPS.forEach(group => {
      const opt = group.options.find(o => o.value === value);
      if (opt) label = opt.label;
    });

    setFormData(prev => ({
      ...prev,
      serviceCharge: value,
      serviceName: label || prev.serviceName
    }));
  };

  const handleIcdSearch = (query: string) => {
    setFormData(prev => ({ ...prev, provisionalDiagnosis: query }));
    if (query.length < 2) {
      setIcdSuggestions([]);
      return;
    }
    const filtered = COMMON_ICD_CODES.filter(item => 
      item.code.toLowerCase().includes(query.toLowerCase()) || 
      item.description.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
    setIcdSuggestions(filtered);
  };

  const toggleMed = (id: string) => {
    setMedsStatus(prev => ({ ...prev, [id]: !prev[id] }));
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
            <button 
              onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} 
              className="group w-full p-8 bg-blue-600 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-[0_0_45px_rgba(37,99,235,0.45)] border border-blue-400/20"
            >
               <div className="flex items-center gap-4 text-white">
                 <Users size={32} />
                 <span className="text-2xl font-black tracking-tight">Patient Portal</span>
               </div>
               <ChevronRight size={24} className="text-white/50 group-hover:translate-x-1 transition-transform" />
            </button>
            
            {selectedRole !== 'doctor' ? (
              <button 
                onClick={() => setSelectedRole('doctor')} 
                className="group w-full p-8 bg-slate-900 border border-white/10 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-[0_0_25px_rgba(255,255,255,0.05)] hover:bg-slate-800"
              >
                 <div className="flex items-center gap-4 text-slate-300">
                   <Stethoscope size={32} />
                   <span className="text-2xl font-black tracking-tight">Doctor Access</span>
                 </div>
                 <ChevronRight size={24} className="text-slate-500 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <div className="animate-in zoom-in duration-300">
                <input 
                  autoFocus
                  type="password" 
                  maxLength={6} 
                  value={pin} 
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (e.target.value === SECRET_PIN) { setIsLocked(false); setPinError(''); }
                  }} 
                  placeholder="••••••"
                  className="w-full bg-[#161e31] border-2 border-white/10 text-white text-center py-7 rounded-full text-5xl font-black outline-none focus:border-blue-500 transition-all placeholder:text-slate-800 shadow-[0_0_30px_rgba(255,255,255,0.1)]" 
                />
                <button onClick={() => setSelectedRole(null)} className="w-full text-center mt-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Back to Roles</button>
              </div>
            )}
            
            <button 
              onClick={() => setShowEmergencyDialog(true)} 
              className="group w-full p-8 bg-rose-600 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-[0_0_50px_rgba(225,29,72,0.45)] border border-rose-400/20"
            >
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
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 selection:bg-blue-500 selection:text-white">
      {toast && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-white text-slate-950 px-10 py-5 rounded-full shadow-2xl font-black text-sm tracking-widest border border-white/20">{toast.message.toUpperCase()}</div>}

      {selectedRole === 'doctor' && (
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-12 pb-32">
          <header className="flex justify-between items-center bg-[#161e31] p-6 rounded-[2.5rem] border border-white/10">
            <div className="flex items-center gap-6">
              <img src={DEFAULT_LOGO} className="w-16 h-16 object-contain" />
              <div><h1 className="text-3xl font-black text-white tracking-tighter">Clinical Hub</h1><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Medical practitioner console</p></div>
            </div>
            <button onClick={() => { setIsLocked(true); setSelectedRole(null); setPin(''); }} className="p-5 bg-slate-900 rounded-2xl text-slate-400 active:scale-90"><ArrowLeft size={24} /></button>
          </header>

          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="bg-[#101726] rounded-[3rem] border border-white/10 p-12 shadow-2xl space-y-12">
              {/* Identities */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-4">Practitioner Name</label>
                  <input required type="text" value={formData.staffName} onChange={e => setFormData({...formData, staffName: e.target.value})} placeholder="Dr. Kenil" className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] text-xl font-bold text-white focus:border-blue-500 outline-none transition-all placeholder:opacity-30" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-4">Patient Identity</label>
                  <input required type="text" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} placeholder="Patient Name" className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] text-xl font-bold text-white focus:border-emerald-500 outline-none transition-all placeholder:opacity-30" />
                </div>
              </div>

              {/* Patient Attributes */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-12 border-t border-white/5">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Age</label>
                  <input type="text" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} placeholder="Years" className="w-full bg-[#161e31] border border-white/5 p-6 rounded-[2rem] text-lg font-black text-white outline-none focus:border-blue-500 text-center placeholder:opacity-30" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Gender</label>
                  <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-[#161e31] border border-white/5 p-6 rounded-[2rem] text-lg font-black text-white outline-none focus:border-blue-500 appearance-none text-center">
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Height (cm)</label>
                  <input type="text" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} placeholder="cm" className="w-full bg-[#161e31] border border-white/5 p-6 rounded-[2rem] text-lg font-black text-white outline-none focus:border-blue-500 text-center placeholder:opacity-30" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Weight (kg)</label>
                  <input type="text" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} placeholder="kg" className="w-full bg-[#161e31] border border-white/5 p-6 rounded-[2rem] text-lg font-black text-white outline-none focus:border-blue-500 text-center placeholder:opacity-30" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4">Calculated BMI</label>
                  <div className="w-full bg-slate-900 border border-white/5 p-6 rounded-[2rem] text-lg font-black text-blue-400 text-center shadow-inner">
                    {formData.bmi || '--'}
                  </div>
                </div>
              </div>

              {/* Vitals */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-12 border-t border-white/5">
                {[
                  {l: 'Temp °F', k: 'vitalTemp', c: 'text-rose-500'},
                  {l: 'BP mmHg', k: 'vitalBp', c: 'text-blue-500'},
                  {l: 'SpO2 %', k: 'vitalSpo2', c: 'text-emerald-500'},
                  {l: 'Pulse Rate', k: 'vitalHr', c: 'text-rose-600'},
                  {l: 'Glucose', k: 'vitalRbs', c: 'text-amber-500'}
                ].map(vit => (
                  <div key={vit.k} className="space-y-2">
                    <label className={`text-[8px] font-black ${vit.c} uppercase ml-4`}>{vit.l}</label>
                    <input type="text" value={(formData as any)[vit.k]} onChange={e => setFormData({...formData, [vit.k]: e.target.value})} className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-white font-black text-center outline-none focus:border-white/20" />
                  </div>
                ))}
              </div>

              {/* Clinical Description */}
              <div className="space-y-10 pt-12 border-t border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Current Complaints / Signs</label>
                    <textarea value={formData.complaints} onChange={e => setFormData({...formData, complaints: e.target.value})} placeholder="Describe symptoms and signs observed..." rows={3} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 resize-none placeholder:opacity-20 shadow-inner" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Duration</label>
                    <input type="text" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} placeholder="e.g. 2 days" className="w-full bg-[#161e31] border border-white/5 p-8 h-[122px] rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 text-center placeholder:opacity-20" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Previous History (Medical / Surgical)</label>
                  <textarea value={formData.history} onChange={e => setFormData({...formData, history: e.target.value})} placeholder="Paste medical history, previous operations, allergies..." rows={2} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 resize-none placeholder:opacity-20" />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">General Advice (Non-Medicinal)</label>
                  <textarea value={formData.nonMedicinalAdvice} onChange={e => setFormData({...formData, nonMedicinalAdvice: e.target.value})} placeholder="Dietary habits, rest instructions, exercise..." rows={2} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 resize-none placeholder:opacity-20" />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-4">Blood / Radiology Investigations</label>
                  <textarea value={formData.investigationsAdvised} onChange={e => setFormData({...formData, investigationsAdvised: e.target.value})} placeholder="List required tests (CBC, USG, X-Ray)..." rows={2} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-amber-500 resize-none placeholder:opacity-20" />
                </div>

                {/* Provisional Diagnosis with Matching ICD Codes */}
                <div className="space-y-3 relative" ref={icdRef}>
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4">Provisional Diagnosis (ICD Search)</label>
                  <div className="relative">
                    <textarea 
                      value={formData.provisionalDiagnosis} 
                      onChange={e => handleIcdSearch(e.target.value)} 
                      placeholder="Type diagnosis to match ICD-10 codes..." 
                      rows={2} 
                      className="w-full bg-[#161e31] border border-white/5 p-8 pr-16 rounded-[2rem] text-lg font-bold text-white outline-none focus:border-blue-500 resize-none placeholder:opacity-20" 
                    />
                    <div className="absolute right-6 top-6 flex flex-col gap-2">
                       <div className="p-3 bg-blue-600/10 text-blue-500 rounded-full"><Search size={20} /></div>
                       {formData.icdCode && <div className="p-3 bg-emerald-600/10 text-emerald-500 rounded-full flex items-center gap-2 font-black text-xs px-4"><Hash size={14} /> {formData.icdCode}</div>}
                    </div>
                  </div>
                  
                  {icdSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-[#161e31] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-4 bg-blue-600/5 border-b border-white/5 text-[8px] font-black uppercase tracking-widest text-blue-400 px-8">Matching ICD-10 Codes</div>
                      {icdSuggestions.map((item, idx) => (
                        <button 
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, provisionalDiagnosis: item.description, icdCode: item.code }));
                            setIcdSuggestions([]);
                            showToast(`Linked: ${item.code}`, 'success');
                          }}
                          className="w-full text-left p-6 px-8 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors flex justify-between items-center group"
                        >
                          <div>
                            <p className="text-white font-black">{item.description}</p>
                            <p className="text-[10px] text-slate-500 font-bold group-hover:text-blue-400 transition-colors uppercase">ICD: {item.code}</p>
                          </div>
                          <ChevronRight size={16} className="text-slate-700 group-hover:text-white transition-all" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Medications */}
              <div className="space-y-8 pt-12 border-t border-white/5">
                 <div className="flex justify-between items-center">
                   <h3 className="text-3xl font-black text-white flex items-center gap-4"><Pill className="text-blue-500" /> Medication Plan</h3>
                   <button type="button" onClick={() => setFormData(p => ({...p, medications: [...p.medications, { id: crypto.randomUUID(), route: 'Oral', name: '', dose: '', frequency: 1, timing: '' }]}))} className="bg-blue-600 px-8 py-4 rounded-full text-xs font-black text-white uppercase tracking-widest active:scale-95 shadow-xl">Add Drug</button>
                 </div>
                 <div className="space-y-4">
                   {formData.medications.map(med => (
                     <div key={med.id} className="bg-[#161e31] border border-white/5 p-6 rounded-[2.5rem] flex flex-col md:flex-row gap-6 items-center shadow-lg">
                        <select value={med.route} onChange={e => setFormData(p => ({...p, medications: p.medications.map(m => m.id === med.id ? {...m, route: e.target.value} : m)}))} className="w-full md:w-32 bg-slate-800 border border-white/10 rounded-xl p-3 text-xs font-black text-white">
                          {['Oral', 'IV', 'IM', 'SC', 'Nasal', 'RT', 'Topical'].map(r => <option key={r}>{r}</option>)}
                        </select>
                        <input type="text" value={med.name} onChange={e => setFormData(p => ({...p, medications: p.medications.map(m => m.id === med.id ? {...m, name: e.target.value} : m)}))} className="flex-1 bg-transparent border-b-2 border-white/10 p-2 text-xl font-black text-white outline-none focus:border-blue-500" placeholder="Drug Name" />
                        <input type="text" value={med.timing} onChange={e => setFormData(p => ({...p, medications: p.medications.map(m => m.id === med.id ? {...m, timing: e.target.value} : m)}))} className="w-full md:w-48 bg-white/5 p-4 rounded-xl border border-white/5 outline-none text-xs font-bold text-blue-400 text-center" placeholder="Time / Dose" />
                        <button type="button" onClick={() => setFormData(p => ({...p, medications: p.medications.filter(m => m.id !== med.id)}))} className="p-4 text-rose-500 active:scale-90"><Trash2 size={24} /></button>
                     </div>
                   ))}
                 </div>
              </div>

              {/* Attachments */}
              <div className="space-y-6 pt-12 border-t border-white/5">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <h3 className="text-3xl font-black text-white flex items-center gap-4"><ImageIcon className="text-emerald-500" /> Documents</h3>
                  <label className="bg-slate-800 px-8 py-4 rounded-full text-xs font-black text-white uppercase tracking-widest cursor-pointer active:scale-95 shadow-xl">
                    Attach Files / PDF
                    <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleAttachmentUpload} />
                  </label>
                </div>
                {formData.photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
                    {formData.photos.map((url, idx) => (
                      <div key={idx} className="relative aspect-[3/4] rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900 shadow-2xl">
                         <img src={url} className="w-full h-full object-cover" />
                         <button type="button" onClick={() => setFormData(p => ({ ...p, photos: p.photos.filter((_, i) => i !== idx) }))} className="absolute top-2 right-2 p-2 bg-rose-600 text-white rounded-lg shadow-lg"><Trash2 size={16} /></button>
                         <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] font-black text-white">PAGE {idx + 2}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Service Fee */}
              <div className="pt-12 border-t border-white/5">
                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest ml-4 mb-4 block">Fee Selection</label>
                <div className="relative">
                  <select onChange={handleServiceChange} className="w-full bg-[#161e31] border border-white/5 p-8 rounded-[2.5rem] font-black text-white text-xl appearance-none shadow-lg">
                      <option value="">-- Choose Category --</option>
                      {SERVICE_GROUPS.map(g => (<optgroup key={g.label} label={g.label} className="bg-[#0a0f1d]">{g.options.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}</optgroup>))}
                  </select>
                  <ChevronRight size={24} className="absolute right-8 top-8 text-slate-700 rotate-90" />
                </div>
              </div>

              <button type="submit" disabled={isGenerating} className="w-full bg-white text-slate-950 py-10 rounded-[2.5rem] font-black text-3xl flex items-center justify-center gap-6 active:scale-95 shadow-[0_0_50px_rgba(255,255,255,0.1)] disabled:opacity-50 mt-10 transition-all hover:bg-slate-100">
                {isGenerating ? <><Loader2 className="animate-spin" /> DEPLOYING...</> : <><FileText size={40} /> DEPLOY CLINICAL HUB</>}
              </button>
            </div>
          </form>

          {pdfBlob && (
            <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-8 animate-in zoom-in duration-500 overflow-y-auto">
               <div className="w-full max-w-5xl bg-[#101726] rounded-[4rem] border border-white/10 p-12 space-y-10 shadow-2xl my-auto">
                  <div className="flex justify-between items-center">
                     <h2 className="text-4xl font-black text-white tracking-tighter flex items-center gap-6"><CheckCircle2 className="text-emerald-500 w-12 h-12" /> Report Ready</h2>
                     <button onClick={() => setPdfBlob(null)} className="p-6 bg-slate-800 rounded-3xl text-slate-400 active:scale-90"><XCircle size={32} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <button onClick={() => window.open(URL.createObjectURL(pdfBlob as Blob))} className="p-10 bg-blue-600 text-white rounded-full font-black text-2xl flex items-center justify-center gap-6 active:scale-95 shadow-[0_0_40px_rgba(37,99,235,0.4)]">
                      <FileDown size={48} /> SAVE PDF
                    </button>
                    <button onClick={() => setShowPaymentQR(true)} className="p-10 bg-emerald-600 text-white rounded-full font-black text-2xl flex items-center justify-center gap-6 active:scale-95 shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                      <CreditCard size={48} /> PAY ₹{formData.serviceCharge}
                    </button>
                  </div>
                  <div className="bg-white rounded-[2rem] overflow-hidden border-[12px] border-slate-950 shadow-inner h-[600px]">
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
              <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"><User size={32} /></div>
              <div><h2 className="text-2xl font-black text-white">{currentPatientRecord?.patientName || 'Guest User'}</h2><p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Active Clinical Link</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowVitalsHistory(true)} className="p-3 bg-slate-900 rounded-xl text-slate-400"><History size={20} /></button>
              <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-4 bg-slate-900 rounded-2xl text-slate-400 active:scale-90"><ArrowLeft size={24} /></button>
            </div>
          </header>

          {!currentPatientRecord ? (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="bg-[#101726] border-4 border-dashed border-white/10 p-10 sm:p-16 rounded-[4rem] text-center space-y-12 shadow-2xl">
                  <FileUp className="w-20 h-20 text-blue-500 mx-auto" />
                  <div className="space-y-4"><h3 className="text-4xl font-black text-white tracking-tighter">Import Health Node</h3><p className="text-slate-500 font-medium text-xl">Upload report to sync your hub.</p></div>
                  <label className="block w-full bg-blue-600 text-white py-10 rounded-full font-black text-2xl cursor-pointer active:scale-95 shadow-[0_0_40px_rgba(37,99,235,0.4)]">CHOOSE PDF REPORT<input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} /></label>
               </div>
               {/* Obesity Clinic CTA Button */}
               <div className="px-4">
                  <a 
                    href="https://obe-cure.vercel.app/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-white text-slate-950 py-8 rounded-full font-black text-xl flex items-center justify-center gap-4 shadow-[0_0_35px_rgba(249,115,22,0.65)] hover:shadow-[0_0_55px_rgba(249,115,22,0.9)] transition-all active:scale-95 text-center border-2 border-orange-100 uppercase tracking-tight"
                  >
                    your obesity with us
                  </a>
               </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-700">
               {/* Automated Partner Lab Connect */}
               {currentPatientRecord.investigationsAdvised && currentPatientRecord.investigationsAdvised.trim().length > 0 && (
                 <div className="bg-amber-600/10 border border-amber-500/20 p-8 rounded-[3rem] space-y-6 shadow-xl animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-amber-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-lg shadow-amber-500/20"><TestTube size={28} /></div>
                       <div>
                          <h3 className="text-2xl font-black text-white">Lab Node Active</h3>
                          <p className="text-xs font-medium text-amber-500/80 uppercase tracking-widest">Connect with Partner Labs</p>
                       </div>
                    </div>
                    <div className="p-6 bg-slate-900/50 rounded-[1.5rem] border border-white/5">
                       <p className="text-sm text-slate-300 font-bold italic">"{currentPatientRecord.investigationsAdvised}"</p>
                    </div>
                    <button 
                      onClick={handlePartnerLabConnect}
                      className="w-full bg-amber-600 text-white py-8 rounded-full font-black text-xl flex items-center justify-center gap-4 active:scale-95 transition-all shadow-[0_0_30px_rgba(245,158,11,0.2)]"
                    >
                       <Truck size={28} /> CONNECT WITH PARTNER LAB
                    </button>
                 </div>
               )}

               <div className="bg-[#101726] border border-white/10 p-8 rounded-[3rem] space-y-8 shadow-xl">
                 <h3 className="text-2xl font-black text-white flex items-center gap-4"><Pill className="text-blue-500" /> Medication Plan</h3>
                 <div className="grid gap-4">
                   {currentPatientRecord.medications.map(med => (
                     <div key={med.id} onClick={() => toggleMed(med.id)} className={`p-6 rounded-[2rem] border transition-all cursor-pointer flex justify-between items-center ${medsStatus[med.id] ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' : 'bg-[#161e31] border-white/5 hover:border-white/20'}`}>
                        <div className="flex gap-4 items-center">
                          <div className={`p-3 rounded-xl ${medsStatus[med.id] ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'}`}><Check size={20} /></div>
                          <div>
                            <p className={`text-xl font-black ${medsStatus[med.id] ? 'text-slate-500 line-through' : 'text-white'}`}>{med.name}</p>
                            <p className="text-xs font-black text-blue-500 uppercase tracking-widest">{med.timing}</p>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); }} className={`p-4 rounded-2xl border transition-all ${reminders[med.id] ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-600'}`}><Bell size={18} /></button>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Obesity Clinic CTA Button (Always visible for patients) */}
               <div className="px-4">
                  <a 
                    href="https://obe-cure.vercel.app/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full bg-white text-slate-950 py-8 rounded-full font-black text-xl flex items-center justify-center gap-4 shadow-[0_0_35px_rgba(249,115,22,0.65)] hover:shadow-[0_0_55px_rgba(249,115,22,0.9)] transition-all active:scale-95 text-center border-2 border-orange-100 uppercase tracking-tight"
                  >
                    your obesity with us
                  </a>
               </div>
            </div>
          )}
          
          <div className="h-40" />

          {/* Compact SOS FAB */}
          <div className="fixed bottom-10 right-8 z-[60]">
             <button 
                onClick={() => setShowEmergencyDialog(true)} 
                className="w-20 h-20 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(225,29,72,0.6)] active:scale-90 transition-all border-2 border-white/20"
              >
                <Siren className="w-10 h-10" />
              </button>
          </div>
        </div>
      )}

      {showEmergencyDialog && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-white/10 p-12 rounded-[4rem] w-full max-w-sm space-y-10 shadow-2xl">
            <Siren className="w-20 h-20 text-rose-500 mx-auto animate-bounce" />
            <div className="text-center space-y-4">
              <h3 className="text-3xl font-black text-white uppercase">SOS Alert</h3>
              <p className="text-slate-500 font-medium">Notify medical emergency team?</p>
            </div>
            <div className="grid gap-4">
              <button onClick={() => handleEmergencyAction('ambulance')} className="w-full p-8 bg-rose-600 text-white rounded-full font-black uppercase text-xl active:scale-95 shadow-[0_0_30px_rgba(225,29,72,0.4)]">Ambulance Request</button>
              <button onClick={() => handleEmergencyAction('doctor')} className="w-full p-8 bg-blue-600 text-white rounded-full font-black uppercase text-xl active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.4)]">Urgent Doctor</button>
              <button onClick={() => setShowEmergencyDialog(false)} className="w-full p-4 text-slate-600 font-black uppercase text-xs tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPaymentQR && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#101726] border border-white/10 p-8 rounded-[3rem] w-full max-w-md space-y-8 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-black text-white flex items-center gap-4"><QrCode className="text-emerald-500" /> Payment Terminal</h3>
              <button onClick={() => setShowPaymentQR(false)} className="p-3 bg-white/5 rounded-xl text-slate-500"><XCircle size={20} /></button>
            </div>
            <div className="bg-white p-4 rounded-[2rem] aspect-square overflow-hidden shadow-inner flex items-center justify-center">
              <img 
                src="https://lh3.googleusercontent.com/d/14Ax9aU31Gaja2kAvnLbIFLbhbbAiB4D5" 
                alt="Payment QR Code" 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-center space-y-2">
              <p className="text-emerald-400 font-black text-4xl">₹{formData.serviceCharge}</p>
              <p className="text-slate-500 font-medium text-sm">Scan to finalize clinical node</p>
            </div>
            <button 
              onClick={() => {
                const upiLink = `upi://pay?pa=8200095781@pthdfc&pn=KenilShah&am=${formData.serviceCharge}&cu=INR`;
                window.location.href = upiLink;
              }}
              className="w-full bg-emerald-600 text-white py-8 rounded-full font-black text-xl active:scale-95 transition-all shadow-lg uppercase tracking-widest"
            >
              Open UPI App
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default App;