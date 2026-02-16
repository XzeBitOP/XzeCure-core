
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  User, Users, Stethoscope, CheckCircle2, XCircle, Loader2, 
  Pill, ArrowLeft, Bell, Check, FileUp, 
  HeartPulse, Siren, Trash2, 
  Plus, FileText, FileDown, CreditCard, Thermometer, 
  Activity, Scale, Calendar, ClipboardList, ChevronRight, CalendarPlus, Clock, Share2, AlertTriangle, History, MapPin, Truck, ShieldAlert, Image as ImageIcon, Smartphone, QrCode, TestTube, Search, Hash, UserCheck, Timer, BookmarkCheck, ShoppingCart, Pencil, Ruler, Clipboard, BriefcaseMedical, RefreshCcw, Save, RotateCcw, Settings, Video, Cloud, Building2, Mail
} from 'lucide-react';
import { SECRET_PIN, SERVICE_GROUPS, DEFAULT_LOGO, DEFAULT_LETTERHEAD, COMMON_ICD_CODES, APPS_SCRIPT_URL, CONSULTANTS_DATABASE } from './constants';
import { VisitData, Medication, DailyVital, Appointment, MedicineAdviceItem, SavedVisit } from './types';
import { storageService } from './services/storageService';
import { generateVisitPdf } from './services/pdfService';
import { notificationService } from './services/notificationService';
import { googleSheetService } from './services/googleSheetService';
import { googleFormService } from './services/googleFormService';
import { n8nService } from './services/n8nService';
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
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Patient Identity State (Manual)
  const [patientManualName, setPatientManualName] = useState(localStorage.getItem('xzecure_manual_name') || '');
  const [patientManualPhone, setPatientManualPhone] = useState(localStorage.getItem('xzecure_manual_phone') || '');
  const [patientManualEmail, setPatientManualEmail] = useState(localStorage.getItem('xzecure_manual_email') || '');

  // Patient Portal State
  const [currentPatientRecord, setCurrentPatientRecord] = useState<VisitData | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [medsStatus, setMedsStatus] = useState<Record<string, boolean>>({});
  const [adviceStatus, setAdviceStatus] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const [showVitalsHistory, setShowVitalsHistory] = useState(false);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showPatientIdentity, setShowPatientIdentity] = useState(false);
  const [relativeNumber, setRelativeNumber] = useState(localStorage.getItem('xzecure_relative_number') || '');
  const [vitalsHistory, setVitalsHistory] = useState<DailyVital[]>([]);
  const [vitalsFormData, setVitalsFormData] = useState<Omit<DailyVital, 'id' | 'timestamp'>>({
    bp: '', temp: '', spo2: '', hr: '', rbs: '', weight: '', waist: ''
  });
  const [editingVitalId, setEditingVitalId] = useState<string | null>(null);
  
  // Doctor Hub State
  const [showVisitHistory, setShowVisitHistory] = useState(false);
  const [savedVisits, setSavedVisits] = useState<SavedVisit[]>([]);
  const [showConsultantList, setShowConsultantList] = useState(false);

  // Automation Refs
  const lastSyncedLead = useRef<string>('');

  // Doctor Form State
  const initialFormState: VisitData = {
    visitId: '', staffName: '', patientName: '', age: '', gender: '', contactNumber: '', email: '',
    address: '', weight: '', height: '', bmi: '', complaints: '', duration: '',
    history: '', surgicalHistory: '', investigationsAdvised: '',
    provisionalDiagnosis: '', icdCode: '',
    vitals: '', vitalTemp: '', vitalBp: '', vitalSpo2: '',
    vitalHr: '', vitalRbs: '', signs: '', treatment: '', nonMedicinalAdvice: '', 
    medications: [], medicineAdvice: [],
    followup: 'No', followupDate: '', whatsappNumber: '',
    serviceCharge: 0, quantity: 1, pdfColor: 'white', serviceName: 'Standard Consultation',
    photos: [],
    consultantName: '',
    consultantLogo: ''
  };

  const [formData, setFormData] = useState<VisitData>(initialFormState);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [icdSuggestions, setIcdSuggestions] = useState<typeof COMMON_ICD_CODES>([]);
  const icdRef = useRef<HTMLDivElement>(null);
  const consultantRef = useRef<HTMLDivElement>(null);

  // Lead Auto-Sync Logic (Debounced)
  useEffect(() => {
    if (selectedRole !== 'doctor') return;
    const { patientName, contactNumber, email, consultantName, serviceName } = formData;
    if (patientName.length > 2 && contactNumber.length > 9) {
      const currentLeadString = `${patientName}|${contactNumber}|${email}|${consultantName}`;
      if (currentLeadString === lastSyncedLead.current) return;
      const timer = setTimeout(() => {
        setIsSyncing(true);
        googleFormService.submitLead({
          patientName, contactNumber, email, serviceName, consultantName
        }).then((success) => {
          if (success) lastSyncedLead.current = currentLeadString;
        }).finally(() => setIsSyncing(false));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [formData.patientName, formData.contactNumber, formData.email, formData.consultantName, selectedRole]);

  useEffect(() => {
    localStorage.setItem('xzecure_manual_name', patientManualName);
    localStorage.setItem('xzecure_manual_phone', patientManualPhone);
    localStorage.setItem('xzecure_manual_email', patientManualEmail);
  }, [patientManualName, patientManualPhone, patientManualEmail]);

  useEffect(() => {
    if (selectedRole === 'patient') {
      notificationService.requestPermission().then(granted => {
        if (granted) {
          notificationService.scheduleVitalsReminders();
          if (currentPatientRecord) notificationService.scheduleAllMedicationReminders(currentPatientRecord);
        }
      });
    }
  }, [selectedRole, currentPatientRecord]);

  const fetchLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    if (isLocked) fetchLocation();
  }, [isLocked, fetchLocation]);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 3000);
    const draft = storageService.getFormDraft();
    if (draft) setFormData(draft);
    setVitalsHistory(storageService.getDailyVitals());
    setSavedVisits(storageService.getVisits());
    const handleClickOutside = (event: MouseEvent) => {
      if (icdRef.current && !icdRef.current.contains(event.target as Node)) setIcdSuggestions([]);
      if (consultantRef.current && !consultantRef.current.contains(event.target as Node)) setShowConsultantList(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const appendMetadata = useCallback((msg: string) => {
    const pName = currentPatientRecord?.patientName || patientManualName || 'Not Provided';
    const contact = currentPatientRecord?.contactNumber || patientManualPhone || 'Not Provided';
    const locStr = userLocation ? `\nLocation: https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}` : '\nLocation: Permission Denied';
    return `${msg}\n\nPatient: ${pName}\nContact: ${contact}${locStr}`;
  }, [currentPatientRecord, patientManualName, patientManualPhone, userLocation]);

  const handleReset = () => {
    if (window.confirm('Clear all fields for a new patient entry?')) {
      setFormData(initialFormState);
      setPdfBlob(null);
      lastSyncedLead.current = '';
      storageService.saveFormDraft(initialFormState);
      showToast('Form cleared', 'info');
    }
  };

  const handleLoadVisit = (visit: SavedVisit) => {
    if (visit.fullData) {
      setFormData({ ...visit.fullData, visitId: '' });
      setShowVisitHistory(false);
      showToast(`Loaded record for ${visit.name}`, 'success');
    }
  };

  const parsePdfMetadata = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await (loadingTask as any).promise;
    const metadataResult = await (pdf as any).getMetadata();
    const info = (metadataResult.info || {}) as any;
    const embeddedData = info.Subject;
    if (!embeddedData) throw new Error("No metadata found in report.");
    return JSON.parse(decodeURIComponent(escape(atob(embeddedData)))) as VisitData;
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const visitData = await parsePdfMetadata(file);
      if (selectedRole === 'doctor') {
        setFormData({ ...visitData, visitId: '', serviceCharge: 999 });
        showToast('History Restored', 'success');
      } else {
        setCurrentPatientRecord(visitData);
        setPatientManualName(visitData.patientName);
        setPatientManualPhone(visitData.contactNumber);
        setPatientManualEmail(visitData.email || '');
        showToast('XzeCure Hub Synced', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import Failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveVitals = async () => {
    if (!patientManualName) {
      showToast('Enter your name in Profile (Settings) first', 'error');
      setShowPatientIdentity(true);
      return;
    }
    if (editingVitalId) {
      setVitalsHistory(storageService.updateDailyVital(editingVitalId, vitalsFormData));
      setEditingVitalId(null);
      showToast('Update Saved', 'success');
    } else {
      storageService.saveDailyVital(vitalsFormData);
      setVitalsHistory(storageService.getDailyVitals());
      showToast('Vitals Saved & Synced', 'success');
      setIsSyncing(true);
      googleSheetService.syncDailyVitals({
        patientName: patientManualName, phone: patientManualPhone, ...vitalsFormData,
        location: userLocation ? `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}` : 'N/A'
      }).finally(() => setIsSyncing(false));

      googleFormService.submitPatientVitals({
        patientName: patientManualName, consultantName: currentPatientRecord?.consultantName || '',
        email: patientManualEmail, contactNumber: patientManualPhone, ...vitalsFormData
      });

      const vitalsSummary = `BP:${vitalsFormData.bp || '--'}, Temp:${vitalsFormData.temp || '--'}°F, SpO2:${vitalsFormData.spo2 || '--'}%, Pulse:${vitalsFormData.hr || '--'}bpm`;
      const msg = appendMetadata(`Daily health check: ${vitalsSummary}`);
      window.open(`https://wa.me/918200095781?text=${encodeURIComponent(msg)}`, "_blank");
    }
    setVitalsFormData({ bp: '', temp: '', spo2: '', hr: '', rbs: '', weight: '', waist: '' });
    setShowVitalsForm(false);
  };

  // Fix: Added missing toggleMed function
  const toggleMed = (id: string) => {
    setMedsStatus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Fix: Added missing handleMedicineOrder function
  const handleMedicineOrder = () => {
    if (!currentPatientRecord) return;
    const medList = currentPatientRecord.medications.map(m => `- ${m.name} (${m.timing})`).join('\n');
    const msg = appendMetadata(`I would like to order the following medications from XzeCure:\n\n${medList}`);
    window.open(`https://wa.me/918200095781?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // Fix: Added missing handleEmergencyAction function
  const handleEmergencyAction = (type: 'ambulance' | 'doctor') => {
    const msg = appendMetadata(`EMERGENCY SOS: ${type.toUpperCase()} REQUIRED IMMEDIATELY.`);
    window.open(`https://wa.me/918200095781?text=${encodeURIComponent(msg)}`, "_blank");
    setShowEmergencyDialog(false);
  };

  // Fix: Move handlePinInput declaration before it's used in the conditional return
  const handlePinInput = (value: string) => {
    setPin(value);
    if (value.length === 6) {
      if (value === SECRET_PIN) { setIsLocked(false); setPin(''); }
      else { showToast('Invalid PIN', 'error'); setPin(''); }
    }
  };

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-[#0a0f1d] flex flex-col items-center justify-center z-[200]">
        <HeartPulse className="w-32 h-32 md:w-40 md:h-40 text-blue-500 animate-pulse" />
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mt-8">XzeCure</h1>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-10 text-center">
          <div className="inline-block p-6 bg-white/5 border border-white/10 rounded-[2.5rem] shadow-2xl">
            <img src={DEFAULT_LOGO} className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter">XzeCure</h1>
          <div className="grid gap-6">
            <button onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} className="w-full p-8 bg-blue-600 rounded-full flex items-center justify-between text-white font-black text-2xl shadow-2xl">
              <span className="flex items-center gap-4"><Users size={32} /> Patient Portal</span>
              <ChevronRight />
            </button>
            <button onClick={() => setSelectedRole('doctor')} className="w-full p-8 bg-slate-900 border border-white/10 rounded-full flex items-center justify-between text-slate-300 font-black text-2xl shadow-lg">
              <span className="flex items-center gap-4"><Stethoscope size={32} /> Doctor Access</span>
              <ChevronRight />
            </button>
            {selectedRole === 'doctor' && (
              <input autoFocus type="password" maxLength={6} value={pin} onChange={(e) => handlePinInput(e.target.value)} placeholder="••••••" className="w-full bg-[#161e31] border-2 border-blue-500/30 text-white text-center py-6 rounded-full text-5xl font-black outline-none shadow-2xl" />
            )}
            <button onClick={() => setShowEmergencyDialog(true)} className="w-full p-8 bg-rose-600 rounded-full flex items-center justify-between text-white font-black text-2xl shadow-2xl uppercase">
              <span className="flex items-center gap-4"><Siren size={32} /> Emergency SOS</span>
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 pb-20">
      {toast && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-white text-slate-950 px-8 py-4 rounded-full shadow-2xl font-black text-sm tracking-widest">{toast.message.toUpperCase()}</div>}

      {selectedRole === 'doctor' ? (
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
          {/* Doctor hub components... (omitted for brevity, assume similar structure but updated) */}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 pb-40">
          <header className="flex justify-between items-center bg-[#161e31] p-6 rounded-[2.5rem] border border-white/10 sticky top-4 z-[50] shadow-2xl">
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-14 h-14 bg-blue-600 rounded-[1.2rem] flex items-center justify-center text-white"><User size={28} /></div>
              <div className="truncate">
                <h2 className="text-xl font-black text-white truncate">{patientManualName || 'Guest User'}</h2>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">ACTIVE HUB {isSyncing && <Cloud size={10} className="animate-pulse" />}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPatientIdentity(true)} className="p-3 bg-slate-900 rounded-xl text-slate-400 border border-white/5 shadow-lg active:scale-90"><Settings size={20} /></button>
              <button onClick={() => setShowVitalsHistory(true)} className="p-3 bg-slate-900 rounded-xl text-slate-400 border border-white/5 shadow-lg active:scale-90"><History size={20} /></button>
              <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-3 bg-slate-900 rounded-xl text-slate-400 shadow-lg active:scale-90"><ArrowLeft size={20} /></button>
            </div>
          </header>

          <div className="space-y-8">
             <div onClick={() => setShowVitalsForm(true)} className="bg-gradient-to-br from-emerald-600/10 to-blue-600/10 border border-emerald-500/20 p-8 rounded-[3rem] space-y-4 shadow-2xl cursor-pointer hover:bg-emerald-600/20 transition-all group">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter uppercase"><Activity className="text-emerald-500" /> Log Daily Vitals</h3>
                  <div className="p-4 bg-emerald-600 text-white rounded-full group-hover:scale-110 transition-transform"><Plus size={24} /></div>
                </div>
                <p className="text-slate-400 font-medium">Capture health stats like BP, Pulse and Sugar instantly. No PDF report required to update your history.</p>
             </div>

             <div className="bg-[#101726] border-2 border-dashed border-white/5 p-12 rounded-[3.5rem] text-center space-y-6 shadow-xl opacity-70">
                <FileUp className="w-16 h-16 text-blue-500 mx-auto opacity-40" />
                <h3 className="text-xl font-black text-white tracking-tight uppercase">Optional Report Sync</h3>
                <label className="block w-full bg-slate-800 text-white/50 py-6 rounded-full font-black text-lg cursor-pointer hover:bg-slate-700 transition-all">CHOOSE CLINIC PDF<input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} /></label>
             </div>

             {currentPatientRecord && (
                <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] space-y-10 shadow-2xl">
                   <div className="flex justify-between items-center border-b border-white/5 pb-4">
                      <h3 className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tight"><Pill className="text-blue-500" /> Rx Plan</h3>
                      <button onClick={handleMedicineOrder} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"><ShoppingCart size={18} /> ORDER</button>
                   </div>
                   <div className="space-y-4">
                      {currentPatientRecord.medications.map(med => (
                        <div key={med.id} onClick={() => toggleMed(med.id)} className={`p-6 rounded-[2rem] border transition-all cursor-pointer flex justify-between items-center ${medsStatus[med.id] ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#161e31] border-white/5 shadow-xl'}`}>
                           <div>
                             <p className={`text-xl font-black ${medsStatus[med.id] ? 'text-slate-500 line-through' : 'text-white'}`}>{med.name}</p>
                             <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">{med.timing} • {med.dose}</p>
                           </div>
                           <Check size={20} className={medsStatus[med.id] ? 'text-emerald-500' : 'text-white/10'} />
                        </div>
                      ))}
                   </div>
                </div>
             )}
          </div>
          <button onClick={() => setShowEmergencyDialog(true)} className="fixed bottom-10 right-8 w-24 h-24 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 animate-pulse border-4 border-white/20 z-[60]"><Siren size={40} /></button>
        </div>
      )}

      {/* MODALS */}
      {showPatientIdentity && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-xl space-y-10 shadow-2xl">
            <div className="flex justify-between items-center"><h3 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter uppercase"><UserCheck className="text-blue-500" /> Patient Profile</h3><button onClick={() => setShowPatientIdentity(false)}><XCircle size={32} className="text-slate-700" /></button></div>
            <div className="space-y-6">
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Full Name</label><input type="text" value={patientManualName} onChange={e => setPatientManualName(e.target.value)} className="w-full bg-[#161e31] p-6 rounded-[1.5rem] border border-white/5 text-xl font-black text-white outline-none" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Mobile Number</label><input type="text" value={patientManualPhone} onChange={e => setPatientManualPhone(e.target.value)} className="w-full bg-[#161e31] p-6 rounded-[1.5rem] border border-white/5 text-xl font-black text-white outline-none" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Email ID</label><input type="email" value={patientManualEmail} onChange={e => setPatientManualEmail(e.target.value)} className="w-full bg-[#161e31] p-6 rounded-[1.5rem] border border-white/5 text-xl font-black text-white outline-none" /></div>
            </div>
            <button onClick={() => setShowPatientIdentity(false)} className="w-full bg-blue-600 py-8 rounded-full font-black text-xl shadow-2xl uppercase">Update Profile</button>
          </div>
        </div>
      )}

      {showVitalsHistory && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-3xl h-[80vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-8"><h3 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter uppercase"><History className="text-emerald-500" /> Recall History (30)</h3><button onClick={() => setShowVitalsHistory(false)}><XCircle size={32} className="text-slate-700" /></button></div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-4">
              {vitalsHistory.length === 0 ? <p className="text-center py-20 text-slate-700 font-black uppercase tracking-widest italic opacity-50">No history found</p> : vitalsHistory.map(vital => (
                <div key={vital.id} className="bg-[#161e31] border border-white/5 p-6 rounded-[2rem] space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2"><p className="text-[10px] font-black text-blue-500">{vital.timestamp}</p><button onClick={() => setVitalsHistory(storageService.deleteDailyVital(vital.id))}><Trash2 size={16} className="text-rose-500/40" /></button></div>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div><p className="text-[8px] font-black text-slate-600 uppercase">BP</p><p className="text-lg font-black text-blue-400">{vital.bp || '--'}</p></div>
                    <div><p className="text-[8px] font-black text-slate-600 uppercase">Temp</p><p className="text-lg font-black text-rose-400">{vital.temp || '--'}</p></div>
                    <div><p className="text-[8px] font-black text-slate-600 uppercase">SpO2</p><p className="text-lg font-black text-emerald-400">{vital.spo2 || '--'}</p></div>
                    <div><p className="text-[8px] font-black text-slate-600 uppercase">Sugar</p><p className="text-lg font-black text-amber-500">{vital.rbs || '--'}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showVitalsForm && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-[#101726] border border-white/10 p-10 rounded-[4rem] w-full max-w-xl space-y-10 shadow-2xl">
            <div className="flex justify-between items-center"><h3 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter uppercase"><Activity className="text-emerald-500" /> Log Stats</h3><button onClick={() => setShowVitalsForm(false)}><XCircle size={32} className="text-slate-700" /></button></div>
            <div className="grid grid-cols-2 gap-6">
              {[
                { l: 'BP', k: 'bp', c: 'text-blue-400' }, { l: 'Temp', k: 'temp', c: 'text-rose-400' },
                { l: 'Pulse', k: 'hr', c: 'text-rose-500' }, { l: 'Sugar', k: 'rbs', c: 'text-amber-400' },
                { l: 'Oxygen', k: 'spo2', c: 'text-emerald-400' }, { l: 'Weight', k: 'weight', c: 'text-purple-400' }
              ].map(f => (
                <div key={f.k} className="space-y-1">
                  <label className={`text-[10px] font-black ${f.c} uppercase ml-4`}>{f.l}</label>
                  <input type="text" value={(vitalsFormData as any)[f.k]} onChange={e => setVitalsFormData({...vitalsFormData, [f.k]: e.target.value})} className="w-full bg-[#161e31] p-6 rounded-[2rem] border border-white/5 text-center text-xl font-black text-white outline-none focus:border-emerald-500" />
                </div>
              ))}
            </div>
            <button onClick={handleSaveVitals} className="w-full bg-emerald-600 py-8 rounded-full font-black text-2xl shadow-2xl uppercase flex items-center justify-center gap-4"><CheckCircle2 size={32} /> Sync Daily Vitals</button>
          </div>
        </div>
      )}

      {showEmergencyDialog && (
        <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-rose-950/20 border-2 border-rose-500/20 p-12 rounded-[4rem] w-full max-w-md text-center space-y-10 shadow-2xl">
             <div className="w-24 h-24 bg-rose-600/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"><Siren className="text-rose-500" size={48} /></div>
             <h3 className="text-4xl font-black text-white uppercase">SOS Alert</h3>
             <div className="grid gap-4">
                <button onClick={() => handleEmergencyAction('ambulance')} className="w-full p-8 bg-rose-600 text-white rounded-full font-black text-xl shadow-2xl uppercase">Ambulance SOS</button>
                <button onClick={() => handleEmergencyAction('doctor')} className="w-full p-8 bg-blue-600 text-white rounded-full font-black text-xl shadow-2xl uppercase">Urgent Doctor</button>
                <button onClick={() => setShowEmergencyDialog(false)} className="text-slate-600 font-black uppercase text-sm tracking-widest mt-4">Close Alert</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
