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
          patientName,
          contactNumber,
          email,
          serviceName,
          consultantName: consultantName 
        }).then((success) => {
          if (success) {
            lastSyncedLead.current = currentLeadString;
          }
        }).finally(() => {
          setIsSyncing(false);
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [formData.patientName, formData.contactNumber, formData.email, formData.consultantName, selectedRole]);

  // Sync manual patient info to storage
  useEffect(() => {
    localStorage.setItem('xzecure_manual_name', patientManualName);
  }, [patientManualName]);

  useEffect(() => {
    localStorage.setItem('xzecure_manual_phone', patientManualPhone);
  }, [patientManualPhone]);

  useEffect(() => {
    localStorage.setItem('xzecure_manual_email', patientManualEmail);
  }, [patientManualEmail]);

  // Reminders initialization
  useEffect(() => {
    if (selectedRole === 'patient') {
      notificationService.requestPermission().then(granted => {
        if (granted) {
          notificationService.scheduleVitalsReminders();
          if (currentPatientRecord) {
            notificationService.scheduleAllMedicationReminders(currentPatientRecord);
          }
        }
      });
    }
  }, [selectedRole, currentPatientRecord]);

  // Geolocation Request on Start Screen
  const fetchLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          console.log("Location locked.");
        },
        (err) => console.error("Location error:", err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  useEffect(() => {
    if (isLocked) {
      fetchLocation();
    }
  }, [isLocked, fetchLocation]);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 3000);
    const draft = storageService.getFormDraft();
    if (draft) setFormData(draft);
    setVitalsHistory(storageService.getDailyVitals());
    setSavedVisits(storageService.getVisits());

    const handleClickOutside = (event: MouseEvent) => {
      if (icdRef.current && !icdRef.current.contains(event.target as Node)) {
        setIcdSuggestions([]);
      }
      if (consultantRef.current && !consultantRef.current.contains(event.target as Node)) {
        setShowConsultantList(false);
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

  // Helper to append metadata (Name, Contact, Location) to messages
  const appendMetadata = useCallback((msg: string) => {
    const pName = currentPatientRecord?.patientName || patientManualName || 'Not Provided';
    const contact = currentPatientRecord?.contactNumber || patientManualPhone || 'Not Provided';
    const locStr = userLocation 
      ? `\nLocation: https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}`
      : '\nLocation: Permission Denied';
    return `${msg}\n\nPatient: ${pName}\nContact: ${contact}${locStr}`;
  }, [currentPatientRecord, patientManualName, patientManualPhone, userLocation, formData]);

  const handleReset = () => {
    if (window.confirm('Clear all fields for a new patient entry? This will permanently wipe current unsaved data.')) {
      setFormData(initialFormState);
      setPdfBlob(null);
      setIcdSuggestions([]);
      lastSyncedLead.current = '';
      storageService.saveFormDraft(initialFormState);
      showToast('Form cleared for new patient', 'info');
    }
  };

  const handleLoadVisit = (visit: SavedVisit) => {
    if (visit.fullData) {
      setFormData({
        ...visit.fullData,
        visitId: '' 
      });
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
        setFormData({
          ...visitData,
          visitId: '', 
          serviceCharge: 999, 
          staffName: formData.staffName || visitData.staffName
        });
        showToast('Patient History Restored for Follow-up', 'success');
      } else {
        setCurrentPatientRecord(visitData);
        if (visitData.patientName) setPatientManualName(visitData.patientName);
        if (visitData.contactNumber) setPatientManualPhone(visitData.contactNumber);
        if (visitData.email) setPatientManualEmail(visitData.email);
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
    const baseMsg = `Hello, this is an automated request from XzeCure. Patient requires a home visit for: ${currentPatientRecord.investigationsAdvised}.`;
    const finalMsg = appendMetadata(baseMsg);
    window.open(`https://wa.me/919081736424?text=${encodeURIComponent(finalMsg)}`, "_blank");
  };

  const handleMedicineOrder = () => {
    if (!currentPatientRecord) return;
    showToast('Pharmacy Link...', 'info');
    
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
    
    const baseMsg = `Hi, I need the following medicines from XzeCure: ${combinedList}.${treatmentSuffix}\n\nPlease confirm availability and delivery slot.`;
    const finalMsg = appendMetadata(baseMsg);
    window.open(`https://wa.me/917016583135?text=${encodeURIComponent(finalMsg)}`, "_blank");
  };

  const handleSaveVitals = async () => {
    if (!currentPatientRecord && !patientManualName) {
      showToast('Please enter your identity in settings first', 'error');
      setShowPatientIdentity(true);
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

      setIsSyncing(true);
      googleSheetService.syncDailyVitals({
        patientName: patientManualName || currentPatientRecord?.patientName,
        phone: patientManualPhone || currentPatientRecord?.contactNumber,
        ...vitalsFormData,
        location: userLocation ? `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}` : 'N/A'
      }).finally(() => setIsSyncing(false));

      googleFormService.submitPatientVitals({
        patientName: patientManualName || currentPatientRecord?.patientName || '',
        consultantName: currentPatientRecord?.consultantName || '',
        email: patientManualEmail || currentPatientRecord?.email || '',
        contactNumber: patientManualPhone || currentPatientRecord?.contactNumber || '',
        bp: vitalsFormData.bp,
        temp: vitalsFormData.temp,
        hr: vitalsFormData.hr,
        spo2: vitalsFormData.spo2,
        rbs: vitalsFormData.rbs
      });

      const stamp = new Date().toLocaleString('en-IN');
      const vitalsSummary = `BP:${vitalsFormData.bp || '--'}, Temp:${vitalsFormData.temp || '--'}°F, SpO2:${vitalsFormData.spo2 || '--'}%, HR:${vitalsFormData.hr || '--'}bpm, RBS:${vitalsFormData.rbs || '--'}mg/dL, Weight:${vitalsFormData.weight || '--'}kg`;
      const baseMsg = `My vitals update: ${vitalsSummary} (${stamp}). Diagnosis: ${currentPatientRecord?.provisionalDiagnosis || 'Monitoring'}.`;
      const finalMsg = appendMetadata(baseMsg);
      
      window.open(`https://wa.me/918200095781?text=${encodeURIComponent(finalMsg)}`, "_blank");
      
      if (relativeNumber.trim()) {
        const relativeMsg = appendMetadata(`Alert: Daily health update. Vitals: ${vitalsSummary} at ${stamp}.`);
        setTimeout(() => {
          window.open(`https://wa.me/${relativeNumber.trim()}?text=${encodeURIComponent(relativeMsg)}`, "_blank");
        }, 1000);
      }
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

  const handleConsultantSelection = (entry: any) => {
    setFormData(prev => ({ 
      ...prev, 
      consultantName: entry.name, 
      consultantLogo: entry.logo 
    }));
    setShowConsultantList(false);
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
      setSavedVisits(storageService.getVisits());

      setIsSyncing(true);
      googleSheetService.syncClinicalReport({
        visitId: vId,
        patientName: finalData.patientName,
        contactNumber: finalData.contactNumber,
        diagnosis: finalData.provisionalDiagnosis,
        staffName: finalData.staffName,
        consultant: finalData.consultantName,
        location: userLocation ? `https://www.google.com/maps?q=${userLocation.lat},${userLocation.lng}` : 'N/A'
      }).finally(() => setIsSyncing(false));

      n8nService.triggerWorkflow({
        patientName: finalData.patientName,
        contactNumber: finalData.contactNumber,
        email: finalData.email,
        serviceGiven: finalData.serviceName,
        amount: finalData.serviceCharge
      });

      showToast('Report Captured & Synced', 'success');
    } catch (err) {
      showToast('PDF Engine Error', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmergencyAction = (type: 'ambulance' | 'doctor') => {
    const baseActionText = type === 'ambulance' ? '🚨 SOS: EMERGENCY AMBULANCE REQUIRED' : '🩺 SOS: URGENT DOCTOR REQUIRED';
    const finalMsg = appendMetadata(baseActionText);
    setShowEmergencyDialog(false);
    window.open(`https://wa.me/918200095781?text=${encodeURIComponent(finalMsg)}`, "_blank");
  };

  const handleVideoConsultation = () => {
    let baseMsg = "I would like to request a urgent video consultation.";
    if (currentPatientRecord) {
      baseMsg += ` Diagnosis: ${currentPatientRecord.provisionalDiagnosis || 'Unknown'}. [Note: Please attach your XzeCure PDF to this chat]`;
    }
    const finalMsg = appendMetadata(baseMsg);
    setShowEmergencyDialog(false);
    window.open(`https://wa.me/918200095781?text=${encodeURIComponent(finalMsg)}`, "_blank");
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

  const parseChronicMeds = (treatment: string) => {
    if (!treatment) return [];
    const lines = treatment.split('\n');
    const startIndex = lines.findIndex(l => l.toLowerCase().includes('continue'));
    if (startIndex === -1) return [];
    return lines.slice(startIndex + 1).filter(l => l.trim() !== '' && !l.toLowerCase().includes('chronic medication'));
  };

  const getMappedDisplayTime = (text: string) => {
    const low = text.toLowerCase();
    if (low.includes('after dinner') || low.includes('once a night')) return '10:00 PM';
    if (low.includes('once a morning') || low.includes('once daily morning')) return '08:00 AM';
    if (low.includes('two times a day')) return '09:00 AM & 09:00 PM';
    if (low.includes('before breakfast')) return '07:00 AM';
    return '';
  };

  if (isBooting) {
    return (
      <div className="fixed inset-0 bg-[#0a0f1d] flex flex-col items-center justify-center z-[200]">
        <HeartPulse className="w-32 h-32 md:w-40 md:h-40 text-blue-500 animate-pulse" />
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mt-8">XzeCure</h1>
        <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px] md:text-xs mt-2 text-center px-6">Happy patient is our goal</p>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden">
        <div className="w-full max-w-lg space-y-10 md:space-y-12">
          <div className="text-center space-y-6">
            <div className="inline-block p-4 md:p-6 bg-white/5 border border-white/10 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl">
              <img src={DEFAULT_LOGO} className="w-20 h-20 md:w-24 md:h-24 object-contain" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">XzeCure</h1>
              <p className="text-slate-500 font-medium italic text-base md:text-lg">Happy patient is our goal</p>
              {!userLocation && (
                <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest animate-pulse mt-2">
                  Requesting Location Access...
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-4 md:gap-6">
            <button onClick={() => { setSelectedRole('patient'); setIsLocked(false); }} className="group w-full p-6 md:p-8 bg-blue-600 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-2xl border border-blue-400/20">
               <div className="flex items-center gap-4 text-white">
                 <Users size={28} className="md:w-8 md:h-8" />
                 <span className="text-xl md:text-2xl font-black tracking-tight">Patient Portal</span>
               </div>
               <ChevronRight size={20} className="md:w-6 md:h-6 text-white/50 group-hover:translate-x-1 transition-transform" />
            </button>
            {selectedRole === null ? (
              <button onClick={() => setSelectedRole('doctor')} className="group w-full p-6 md:p-8 bg-slate-900 border border-white/10 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-lg hover:bg-slate-800">
                  <div className="flex items-center gap-4 text-slate-300">
                    <Stethoscope size={28} className="md:w-8 md:h-8" />
                    <span className="text-xl md:text-2xl font-black tracking-tight">Doctor Access</span>
                  </div>
                  <ChevronRight size={20} className="md:w-6 md:h-6 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <div className="animate-in zoom-in duration-300">
                <input autoFocus type="password" maxLength={6} value={pin} onChange={(e) => handlePinInput(e.target.value)} placeholder="••••••" className={`w-full bg-[#161e31] border-2 border-blue-500/30 text-white text-center py-5 md:py-7 rounded-full text-4xl md:text-5xl font-black outline-none transition-all placeholder:text-slate-800 shadow-2xl`} />
                <button onClick={() => { setSelectedRole(null); setPin(''); }} className="w-full text-center mt-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Back to Roles</button>
              </div>
            )}
            <button onClick={() => setShowEmergencyDialog(true)} className="group w-full p-6 md:p-8 bg-rose-600 rounded-full flex items-center justify-between active:scale-95 transition-all shadow-2xl border border-rose-400/20">
               <div className="flex items-center gap-4 text-white">
                 <Siren size={28} className="md:w-8 md:h-8" />
                 <span className="text-xl md:text-2xl font-black tracking-tight uppercase">Emergency SOS</span>
               </div>
               <ChevronRight size={20} className="md:w-6 md:h-6 text-white/50 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-slate-100 selection:bg-blue-500 selection:text-white pb-20">
      {toast && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] bg-white text-slate-950 px-6 md:px-10 py-4 md:py-5 rounded-full shadow-2xl font-black text-[10px] md:text-sm tracking-widest border border-white/20 text-center whitespace-nowrap">{toast.message.toUpperCase()}</div>}

      {selectedRole === 'doctor' && (
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8 md:space-y-12 pb-32">
          <header className="flex flex-col sm:flex-row justify-between items-center bg-[#161e31] border-white/10 p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border shadow-2xl gap-4">
            <div className="flex items-center gap-4 md:gap-6 w-full sm:w-auto">
              <img src={DEFAULT_LOGO} className="w-12 h-12 md:w-16 md:h-16 object-contain" />
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Doctor Hub</h1>
                <p className="text-[8px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                  Clinical Command Center
                  {isSyncing && <Cloud size={10} className="text-blue-400 animate-pulse" />}
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
               <button onClick={() => setShowVisitHistory(true)} title="Visit History" className="p-3 bg-slate-900 rounded-xl text-slate-400 active:scale-90 shadow-lg hover:text-blue-400 transition-colors flex items-center gap-2 group">
                  <History size={18} />
                  <span className="hidden lg:inline font-black text-[10px] tracking-widest uppercase">Visit History</span>
               </button>
               <button onClick={handleReset} title="Reset Form" className="p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl text-rose-500 active:scale-90 shadow-lg hover:bg-rose-900/40 transition-colors flex items-center gap-2 group">
                  <RotateCcw size={18} />
                  <span className="hidden lg:inline font-black text-[10px] tracking-widest uppercase">Clear Form</span>
               </button>
               <label title="Restore Report" className="p-3 bg-slate-900 rounded-xl text-slate-400 active:scale-90 shadow-lg cursor-pointer hover:text-white transition-colors flex items-center gap-2 group">
                  <FileUp size={18} />
                  <span className="hidden lg:inline font-black text-[10px] tracking-widest uppercase">Import hub</span>
                  <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} />
               </label>
               <button onClick={() => { setIsLocked(true); setSelectedRole(null); setPin(''); }} className="p-3 bg-slate-900 rounded-xl text-slate-400 active:scale-90 shadow-lg"><ArrowLeft size={18} /></button>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-8 md:space-y-10">
            {/* Core Patient Identity */}
            <div className="bg-[#101726] rounded-[2rem] md:rounded-[3rem] border border-white/10 p-6 md:p-12 shadow-2xl space-y-8 md:space-y-12">
              <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-4 md:gap-6">
                    <div className="p-3 md:p-4 bg-blue-600/10 text-blue-500 rounded-xl md:rounded-2xl"><User size={20} className="md:w-6 md:h-6" /></div>
                    <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Identity Node</h2>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <div className="space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Practitioner Name</label>
                  <input required type="text" value={formData.staffName} onChange={e => setFormData({...formData, staffName: e.target.value})} className="w-full bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] text-lg md:text-xl font-bold text-white focus:border-blue-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Patient Identity</label>
                  <input required type="text" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} className="w-full bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] text-lg md:text-xl font-bold text-white focus:border-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <div className="space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Email Address</label>
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"><Mail size={18} /></div>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="patient@mail.com" className="w-full bg-[#161e31] border border-white/5 p-4 md:p-6 pl-14 md:pl-16 rounded-[1.2rem] md:rounded-[2rem] text-base md:text-lg font-bold text-white focus:border-blue-500 outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Contact Number</label>
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"><Smartphone size={18} /></div>
                    <input required type="text" value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} className="w-full bg-[#161e31] border border-white/5 p-4 md:p-6 pl-14 md:pl-16 rounded-[1.2rem] md:rounded-[2rem] text-base md:text-lg font-bold text-white focus:border-blue-500 outline-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[
                  { label: 'Age', key: 'age', ph: '' },
                  { label: 'Gender', key: 'gender', ph: 'M/F/O' },
                  { label: 'Weight (kg)', key: 'weight', ph: '' },
                  { label: 'Height (cm)', key: 'height', ph: '' },
                ].map(f => (
                  <div key={f.key} className="space-y-2">
                    <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">{f.label}</label>
                    <input type="text" value={(formData as any)[f.key]} onChange={e => setFormData({...formData, [f.key]: e.target.value})} className="w-full bg-[#161e31] p-4 md:p-6 rounded-[1.2rem] md:rounded-[2rem] border border-white/5 text-white font-black text-center" placeholder={f.ph} />
                  </div>
                ))}
              </div>

              <div className="space-y-2 relative" ref={consultantRef}>
                <label className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4">Consultant (Doctor/Hospital)</label>
                <div className="relative group">
                   <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"><Building2 size={20} /></div>
                   <input 
                     type="text" 
                     value={formData.consultantName} 
                     onFocus={() => setShowConsultantList(true)}
                     onChange={e => setFormData({...formData, consultantName: e.target.value, consultantLogo: ''})} 
                     placeholder="Enter name or click to select" 
                     className="w-full bg-[#161e31] border border-blue-500/10 p-5 md:p-8 pl-14 md:pl-16 rounded-[1.5rem] md:rounded-[2.5rem] text-lg md:text-xl font-bold text-white focus:border-blue-500 outline-none" 
                   />
                   {formData.consultantLogo && (
                     <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/10 p-2 rounded-xl">
                        <img src={formData.consultantLogo} className="w-8 h-8 object-contain" />
                     </div>
                   )}
                </div>
                {showConsultantList && (
                  <div className="absolute z-[110] top-full left-0 right-0 mt-3 bg-[#161e31] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    {CONSULTANTS_DATABASE.map((entry, idx) => (
                      <button key={idx} type="button" onClick={() => handleConsultantSelection(entry)} className="w-full text-left p-6 px-8 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors flex justify-between items-center group">
                        <div className="flex items-center gap-4">
                          {entry.logo ? <img src={entry.logo} className="w-10 h-10 object-contain" /> : <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-slate-600"><User size={20} /></div>}
                          <div>
                            <p className="text-white font-black">{entry.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{entry.hospital}</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-700" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8 md:space-y-10">
                <div className="bg-[#101726] rounded-[2rem] md:rounded-[3rem] border border-white/10 p-6 md:p-12 shadow-2xl space-y-6 md:space-y-10">
                   <div className="flex items-center gap-4 md:gap-6">
                      <div className="p-3 md:p-4 bg-amber-600/10 text-amber-500 rounded-xl md:rounded-2xl"><Clipboard size={20} className="md:w-6 md:h-6" /></div>
                      <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Clinical History</h2>
                   </div>
                   <div className="grid gap-6 md:gap-10">
                      <div className="space-y-2">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Chief Complaints & Duration</label>
                        <textarea value={formData.complaints} onChange={e => setFormData({...formData, complaints: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] text-base md:text-lg font-bold text-white outline-none focus:border-blue-500 resize-none" />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Past Medical History</label>
                          <textarea value={formData.history} onChange={e => setFormData({...formData, history: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] text-base md:text-lg font-bold text-white outline-none focus:border-blue-500 resize-none" />
                      </div>
                   </div>
                </div>

                <div className="bg-[#101726] rounded-[2rem] md:rounded-[3rem] border border-white/10 p-6 md:p-12 shadow-2xl space-y-6 md:space-y-10">
                   <div className="flex items-center gap-4 md:gap-6">
                      <div className="p-3 md:p-4 bg-emerald-600/10 text-emerald-500 rounded-xl md:rounded-2xl"><Activity size={20} className="md:w-6 md:h-6" /></div>
                      <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Examination & Vitals</h2>
                   </div>
                   <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                      {[
                        {l: 'Temp (°F)', k: 'vitalTemp'}, {l: 'BP (mmHg)', k: 'vitalBp'}, 
                        {l: 'SpO2 (%)', k: 'vitalSpo2'}, {l: 'HR (bpm)', k: 'vitalHr'}, {l: 'RBS (mg/dL)', k: 'vitalRbs'}
                      ].map(v => (
                        <div key={v.k} className="space-y-2 text-center">
                          <label className="text-[8px] md:text-[9px] font-black text-slate-600 uppercase tracking-widest">{v.l}</label>
                          <input type="text" value={(formData as any)[v.k]} onChange={e => setFormData({...formData, [v.k]: e.target.value})} className="w-full bg-[#161e31] p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5 text-white font-black text-center" />
                        </div>
                      ))}
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Physical Signs / Observations</label>
                      <textarea value={formData.signs} onChange={e => setFormData({...formData, signs: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] text-base md:text-lg font-bold text-white outline-none focus:border-blue-500 resize-none" />
                   </div>
                </div>

                <div className="bg-[#101726] rounded-[2rem] md:rounded-[3rem] border border-white/10 p-6 md:p-12 shadow-2xl space-y-6 md:space-y-10">
                   <div className="flex items-center gap-4 md:gap-6">
                      <div className="p-3 md:p-4 bg-rose-600/10 text-rose-500 rounded-xl md:rounded-2xl"><BriefcaseMedical size={20} className="md:w-6 md:h-6" /></div>
                      <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Clinical Decision</h2>
                   </div>
                   
                   <div className="space-y-8 md:space-y-10">
                      <div className="space-y-2 relative" ref={icdRef}>
                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Diagnosis / ICD-10 Search</label>
                        <input type="text" value={formData.provisionalDiagnosis} onChange={e => { handleIcdSearch(e.target.value); }} className="w-full bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] text-lg md:text-xl font-black text-white outline-none focus:border-rose-500" />
                        {icdSuggestions.length > 0 && (
                          <div className="absolute z-[100] top-full left-0 right-0 mt-2 bg-[#161e31] border border-white/10 rounded-[1.5rem] md:rounded-[2rem] shadow-2xl overflow-hidden">
                            {icdSuggestions.map((item, idx) => (
                              <button key={idx} type="button" onClick={() => { setFormData(prev => ({ ...prev, provisionalDiagnosis: item.description, icdCode: item.code })); setIcdSuggestions([]); }} className="w-full text-left p-4 md:p-6 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors flex justify-between items-center group">
                                <div><p className="text-white font-black text-sm md:text-base">{item.description}</p><p className="text-[8px] md:text-[10px] text-slate-500 font-bold">ICD: {item.code}</p></div>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Prescribed Medications (Rx)</label>
                          <button type="button" onClick={addMedication} className="p-2 md:p-3 bg-blue-600/20 text-blue-400 rounded-lg md:rounded-xl flex items-center gap-2 font-black text-[9px] md:text-[10px] tracking-widest uppercase"><Plus size={14} /> Add Med</button>
                        </div>
                        <div className="grid gap-3 md:gap-4">
                           {formData.medications.map(med => (
                             <div key={med.id} className="grid grid-cols-1 sm:grid-cols-5 gap-3 md:gap-4 p-4 md:p-6 bg-[#161e31] rounded-[1.5rem] md:rounded-[2rem] border border-white/5 shadow-inner">
                                <input placeholder="Med Name" value={med.name} onChange={e => updateMedication(med.id, 'name', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white text-base md:text-lg outline-none focus:border-blue-500" />
                                <input placeholder="Dose" value={med.dose} onChange={e => updateMedication(med.id, 'dose', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white outline-none focus:border-blue-500" />
                                <input placeholder="Timing" value={med.timing} onChange={e => updateMedication(med.id, 'timing', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white outline-none focus:border-blue-500" />
                                <input placeholder="Days" value={med.days} onChange={e => updateMedication(med.id, 'days', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white outline-none focus:border-blue-500" />
                                <div className="flex justify-between items-center gap-2">
                                  <input placeholder="Route" value={med.route} onChange={e => updateMedication(med.id, 'route', e.target.value)} className="bg-transparent border-b border-white/10 p-2 font-black text-white w-full outline-none focus:border-blue-500" />
                                  <button type="button" onClick={() => removeMedication(med.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={18} /></button>
                                </div>
                             </div>
                           ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Investigations Advised</label>
                        <textarea value={formData.investigationsAdvised} onChange={e => setFormData({...formData, investigationsAdvised: e.target.value})} rows={2} className="w-full bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] text-base md:text-lg font-bold text-white outline-none focus:border-blue-500 resize-none" />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Treatment Plan / Procedures</label>
                        <textarea value={formData.treatment} onChange={e => setFormData({...formData, treatment: e.target.value})} rows={3} className="w-full bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] text-base md:text-lg font-bold text-white outline-none focus:border-blue-500 resize-none" />
                      </div>
                   </div>
                </div>

                <div className="bg-[#101726] rounded-[2rem] md:rounded-[3rem] border border-white/10 p-6 md:p-12 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6 md:gap-10">
                   <div className="flex items-center gap-4 md:gap-6 w-full sm:w-auto">
                      <div className="p-3 md:p-4 bg-purple-600/10 text-purple-500 rounded-xl md:rounded-2xl"><CalendarPlus size={20} className="md:w-6 md:h-6" /></div>
                      <div>
                        <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Follow-up Schedule</h2>
                        <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest">Next clinical encounter</p>
                      </div>
                   </div>
                   <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-8 w-full sm:w-auto">
                      <button type="button" onClick={() => setFormData({...formData, followup: formData.followup === 'Yes' ? 'No' : 'Yes'})} className={`w-full sm:w-auto p-4 md:p-6 px-6 md:px-10 rounded-full font-black uppercase text-[10px] md:text-xs tracking-widest border transition-all ${formData.followup === 'Yes' ? 'bg-purple-600 border-purple-400 text-white shadow-xl' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                        {formData.followup === 'Yes' ? 'Planned' : 'Not Needed'}
                      </button>
                      {formData.followup === 'Yes' && (
                        <div className="flex items-center gap-3 bg-[#161e31] border border-white/10 p-1 md:p-2 rounded-full w-full sm:w-auto">
                          <Calendar size={16} className="text-purple-400 ml-3 md:ml-4" />
                          <input type="text" placeholder="Date" value={formData.followupDate} onChange={e => setFormData({...formData, followupDate: e.target.value})} className="bg-transparent p-3 text-sm md:text-base text-white font-black outline-none placeholder:text-slate-700 w-full" />
                        </div>
                      )}
                   </div>
                </div>
            </div>

            <div className="bg-[#101726] rounded-[2rem] md:rounded-[3rem] border border-white/10 p-6 md:p-12 shadow-2xl">
              <label className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 mb-4 block">Fee Category</label>
              <div className="relative">
                <select value={formData.serviceCharge} onChange={handleServiceChange} className="w-full bg-[#161e31] border border-white/5 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] font-black text-white text-base md:text-xl appearance-none outline-none focus:border-blue-500">
                    <option value="">-- Select Bill Category --</option>
                    {SERVICE_GROUPS.map(g => (<optgroup key={g.label} label={g.label} className="bg-[#0a0f1d]">{g.options.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}</optgroup>))}
                </select>
                <ChevronRight size={20} className="absolute right-6 md:right-8 top-1/2 -translate-y-1/2 text-slate-700 rotate-90" />
              </div>
            </div>

            <button type="submit" disabled={isGenerating} className={`w-full bg-blue-600 py-6 md:py-10 rounded-[1.5rem] md:rounded-[2.5rem] font-black text-xl md:text-3xl flex items-center justify-center gap-4 md:gap-6 active:scale-95 disabled:opacity-50 transition-all shadow-2xl`}>
              {isGenerating ? <><Loader2 className="animate-spin" /> COMPILING...</> : <><Save size={32} className="md:w-10 md:h-10" /> SAVE CLINICAL REPORT</>}
            </button>
          </form>

          {pdfBlob && (
            <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-8 animate-in zoom-in duration-500 overflow-y-auto">
               <div className="w-full max-w-5xl bg-[#101726] rounded-[2rem] md:rounded-[4rem] border border-white/10 p-4 md:p-12 space-y-6 md:space-y-10 shadow-2xl my-auto">
                  <div className="flex justify-between items-center">
                     <h2 className="text-xl md:text-4xl font-black text-white tracking-tighter">Report Captured</h2>
                     <button onClick={() => setPdfBlob(null)} className="p-3 md:p-6 bg-slate-800 rounded-xl md:rounded-3xl text-slate-400 active:scale-90 shadow-xl"><XCircle size={24} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    <button onClick={() => window.open(URL.createObjectURL(pdfBlob as Blob))} className="p-5 md:p-10 bg-blue-600 text-white rounded-full font-black text-lg md:text-2xl flex items-center justify-center gap-3 md:gap-6 shadow-2xl">
                      <FileDown size={24} className="md:w-8 md:h-8" /> SAVE REPORT
                    </button>
                    <button onClick={() => setShowPaymentQR(true)} className="p-5 md:p-10 bg-emerald-600 text-white rounded-full font-black text-lg md:text-2xl flex items-center justify-center gap-3 md:gap-6 shadow-2xl">
                      <CreditCard size={24} className="md:w-8 md:h-8" /> PAY ₹{formData.serviceCharge}
                    </button>
                  </div>
                  <div className="bg-white rounded-[1.2rem] md:rounded-[2rem] overflow-hidden border-[4px] md:border-[12px] border-slate-950 h-[60vh] md:h-[80vh] w-full">
                    <iframe src={URL.createObjectURL(pdfBlob as Blob)} title="PDF Preview" className="w-full h-full border-none" />
                  </div>
               </div>
            </div>
          )}
        </div>
      )}

      {showVisitHistory && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-8 shrink-0">
               <h3 className="text-2xl md:text-4xl font-black text-white tracking-tighter flex items-center gap-4"><History className="text-blue-500" /> Patient Records</h3>
               <button onClick={() => setShowVisitHistory(false)} className="p-3 md:p-6 bg-white/5 rounded-2xl md:rounded-3xl text-slate-500 hover:text-white"><XCircle size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {savedVisits.length === 0 ? (
                <div className="text-center py-20 text-slate-700 font-black uppercase tracking-widest italic opacity-50">No saved visits found</div>
              ) : savedVisits.map(visit => (
                <div key={visit.id} onClick={() => handleLoadVisit(visit)} className="bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] space-y-4 shadow-xl group cursor-pointer hover:border-blue-500/30 transition-all">
                   <div className="flex justify-between items-start">
                     <div>
                       <h4 className="text-lg md:text-2xl font-black text-white group-hover:text-blue-400 transition-colors">{visit.name}</h4>
                       <p className="text-[10px] md:text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">{new Date(visit.date).toLocaleString('en-IN')}</p>
                     </div>
                     <span className="text-[8px] md:text-[10px] font-black text-blue-500 bg-blue-500/10 px-4 py-1 rounded-full uppercase tracking-widest">{visit.visitId}</span>
                   </div>
                   {visit.fullData?.provisionalDiagnosis && (
                     <div className="bg-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5">
                        <p className="text-[8px] md:text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Diagnosis</p>
                        <p className="text-sm md:text-base font-bold text-slate-300 truncate">{visit.fullData.provisionalDiagnosis}</p>
                     </div>
                   )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedRole === 'patient' && (
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-6 md:space-y-8 pb-80">
          <header className="flex justify-between items-center bg-[#161e31] p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-white/10 sticky top-4 z-[50] shadow-2xl">
            <div className="flex items-center gap-4 md:gap-6 overflow-hidden">
              <div className="flex-shrink-0 w-12 h-12 md:w-16 md:h-16 bg-blue-600 rounded-xl md:rounded-[1.5rem] flex items-center justify-center text-white shadow-lg"><User size={24} className="md:w-8 md:h-8" /></div>
              <div className="truncate">
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight truncate">{patientManualName || currentPatientRecord?.patientName || 'Guest User'}</h2>
                <p className="text-[8px] md:text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                  Active Clinical Hub
                  {isSyncing && <Cloud size={10} className="text-blue-400 animate-pulse" />}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setShowPatientIdentity(true)} title="Identity Settings" className="p-2 md:p-3 bg-slate-900 rounded-lg md:rounded-xl text-slate-400 shadow-lg active:scale-95 border border-white/5 hover:border-blue-500/50 transition-all"><Settings size={18} className="md:w-5 md:h-5" /></button>
              <button onClick={() => setShowVitalsHistory(true)} title="Vitals History" className="p-2 md:p-3 bg-slate-900 rounded-lg md:rounded-xl text-slate-400 shadow-lg active:scale-95 border border-white/5 hover:border-blue-500/50 transition-all"><History size={18} className="md:w-5 md:h-5" /></button>
              <button onClick={() => { setIsLocked(true); setSelectedRole(null); }} className="p-3 md:p-4 bg-slate-900 rounded-xl md:rounded-2xl text-slate-400 active:scale-90 shadow-lg"><ArrowLeft size={20} className="md:w-6 md:h-6" /></button>
            </div>
          </header>

          <div className="space-y-8">
             {/* Always Available Vitals Log Card */}
             <div onClick={() => setShowVitalsForm(true)} className="bg-gradient-to-br from-emerald-600/10 to-blue-600/10 border border-emerald-500/20 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] space-y-4 shadow-xl cursor-pointer hover:bg-emerald-600/15 transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500/50"></div>
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <h3 className="text-2xl md:text-3xl font-black text-white flex items-center gap-4 uppercase tracking-tighter"><Activity size={28} className="text-emerald-500 group-hover:animate-pulse" /> Log Daily Vitals</h3>
                    <p className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-widest opacity-60">Sync your health stats now</p>
                  </div>
                  <div className="p-3 md:p-5 bg-emerald-600 text-white rounded-full shadow-2xl group-hover:scale-110 transition-transform"><Plus size={24} className="md:w-8 md:h-8" /></div>
                </div>
                <p className="text-slate-400 text-xs md:text-base font-medium leading-relaxed">Instantly capture BP, Pulse, SPO2 & Sugar to share with your Clinical Hub +91 8200095781.</p>
             </div>

             {!currentPatientRecord ? (
                <div className="bg-[#101726] border-4 border-dashed border-white/10 p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] text-center space-y-10 shadow-2xl">
                   <FileUp className="w-16 h-16 md:w-24 md:h-24 text-blue-500 mx-auto opacity-50" />
                   <div className="space-y-3"><h3 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Clinical Hub Sync</h3><p className="text-slate-500 font-medium text-base md:text-lg">Optionally upload clinical PDF to sync medical advice and medications.</p></div>
                   <label className="block w-full bg-slate-800 text-white/70 py-6 md:py-8 rounded-full font-black text-lg md:text-xl cursor-pointer active:scale-95 shadow-lg uppercase tracking-widest border border-white/5 hover:bg-slate-700 transition-colors">CHOOSE CLINIC PDF<input type="file" accept="application/pdf" className="hidden" onChange={handlePdfImport} /></label>
                </div>
             ) : (
                <>
                  {currentPatientRecord.medicineAdvice && currentPatientRecord.medicineAdvice.length > 0 && (
                    <div className="bg-blue-600/10 border border-blue-500/20 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] space-y-6 shadow-2xl">
                       <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tight"><Timer className="text-blue-400" /> Medicine Advice</h3>
                       <div className="grid gap-4">
                         {currentPatientRecord.medicineAdvice.map(item => (
                           <div key={item.id} onClick={() => toggleAdvice(item.id)} className={`p-5 md:p-7 rounded-[1.5rem] md:rounded-[2.5rem] border transition-all cursor-pointer shadow-lg ${adviceStatus[item.id] ? 'bg-blue-500/5 opacity-60' : 'bg-[#161e31] border-white/5'}`}>
                              <p className="text-xl md:text-2xl font-black text-white">{item.medicineName}</p>
                              <div className="flex gap-2 md:gap-4 mt-3 md:mt-4 flex-wrap">
                                <span className="text-[8px] md:text-[10px] font-black text-blue-400 uppercase bg-blue-400/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-blue-400/10">🕒 {item.time}</span>
                                <span className="text-[8px] md:text-[10px] font-black text-emerald-400 uppercase bg-emerald-400/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-emerald-400/10">⏳ {item.duration}</span>
                                <span className="text-[8px] md:text-[10px] font-black text-amber-400 uppercase bg-amber-400/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-amber-400/10">🗓️ {item.days}</span>
                              </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}

                  <div className="bg-[#101726] border border-white/10 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] space-y-8 md:space-y-10 shadow-2xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                       <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tight"><Pill className="text-blue-500" /> Medication Plan</h3>
                       <button onClick={handleMedicineOrder} className="w-full sm:w-auto p-4 md:p-5 bg-emerald-600 text-white rounded-2xl active:scale-95 shadow-xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest">
                         <ShoppingCart size={20} /> PLACE ORDER
                       </button>
                    </div>

                    <div className="space-y-4">
                      {currentPatientRecord.medications.map(med => (
                        <div key={med.id} onClick={() => toggleMed(med.id)} className={`p-5 md:p-7 rounded-[1.5rem] md:rounded-[2.5rem] border transition-all cursor-pointer flex justify-between items-center shadow-lg ${medsStatus[med.id] ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' : 'bg-[#161e31] border-white/5'}`}>
                           <div className="flex gap-4 md:gap-6 items-center overflow-hidden">
                             <div className={`flex-shrink-0 p-3 md:p-4 rounded-xl md:rounded-2xl ${medsStatus[med.id] ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'} transition-all`}>
                               <Check size={20} strokeWidth={4} className="md:w-6 md:h-6" />
                             </div>
                             <div className="truncate">
                               <p className={`text-lg md:text-2xl font-black truncate ${medsStatus[med.id] ? 'text-slate-500 line-through' : 'text-white'}`}>{med.name}</p>
                               <p className="text-[10px] md:text-xs font-black text-blue-500 uppercase tracking-widest mt-1">
                                   {med.timing} • {med.dose} 
                                   {getMappedDisplayTime(med.timing) && <span className="ml-2 px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20 text-blue-400">🕒 {getMappedDisplayTime(med.timing)}</span>}
                               </p>
                             </div>
                           </div>
                           <button onClick={(e) => { e.stopPropagation(); }} className={`flex-shrink-0 p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all ${reminders[med.id] ? 'bg-blue-600 border-blue-500 text-white shadow-xl scale-110' : 'bg-white/5 border-white/10 text-slate-600'}`}><Bell size={18} className="md:w-5 md:h-5" /></button>
                        </div>
                      ))}
                    </div>

                    {parseChronicMeds(currentPatientRecord.treatment).length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 px-4">
                          <ShieldAlert size={14} className="text-rose-500" />
                          <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Chronic Medication</h4>
                        </div>
                        <div className="grid gap-3 md:gap-4">
                           {parseChronicMeds(currentPatientRecord.treatment).map((medLine, idx) => {
                             const medId = `chronic-${idx}`;
                             const timingLabel = getMappedDisplayTime(medLine);
                             return (
                               <div key={medId} onClick={() => toggleMed(medId)} className={`p-5 md:p-7 rounded-[1.5rem] md:rounded-[2.5rem] border transition-all cursor-pointer flex justify-between items-center shadow-lg ${medsStatus[medId] ? 'bg-rose-500/10 border-rose-500/30 opacity-60' : 'bg-[#161e31] border-white/5'}`}>
                                  <div className="flex gap-4 md:gap-6 items-center overflow-hidden">
                                     <div className={`flex-shrink-0 p-3 md:p-4 rounded-xl md:rounded-2xl ${medsStatus[medId] ? 'bg-rose-500 text-white' : 'bg-white/10 text-slate-500'} transition-all`}>
                                       <Check size={20} strokeWidth={4} className="md:w-6 md:h-6" />
                                     </div>
                                     <div className="truncate">
                                       <p className={`text-lg md:text-xl font-black truncate ${medsStatus[medId] ? 'text-slate-500 line-through' : 'text-white'}`}>{medLine}</p>
                                       <div className="flex items-center gap-2 mt-2">
                                         <span className="text-[8px] font-black text-rose-500 uppercase bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/10">LONG-TERM CARE</span>
                                         {timingLabel && <span className="text-[8px] font-black text-blue-400 uppercase bg-blue-400/10 px-3 py-1 rounded-full border border-blue-400/10">🕒 {timingLabel}</span>}
                                       </div>
                                     </div>
                                  </div>
                               </div>
                             );
                           })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
             )}
          </div>
          
          <div className="fixed bottom-6 md:bottom-10 right-6 md:right-8 z-[60]">
             <button onClick={() => setShowEmergencyDialog(true)} className="w-20 h-20 md:w-24 md:h-24 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 animate-pulse border-4 border-white/20">
                <Siren className="w-10 h-10 md:w-12 md:h-12" />
              </button>
          </div>
        </div>
      )}

      {/* Patient Identity Modal (Mapped to Yellow Circle Settings Button) */}
      {showPatientIdentity && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-6 animate-in fade-in zoom-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] w-full max-w-xl space-y-8 md:space-y-10 my-auto shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <UserCheck className="text-blue-500" /> Patient Identity
              </h3>
              <button onClick={() => setShowPatientIdentity(false)} className="p-3 bg-white/5 rounded-xl text-slate-500 hover:text-white"><XCircle size={24} /></button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Full Patient Name</label>
                <input type="text" value={patientManualName} onChange={e => setPatientManualName(e.target.value)} placeholder="Enter Name" className="w-full bg-[#161e31] border border-white/5 p-5 rounded-[1.5rem] text-lg font-black text-white outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Mobile Number</label>
                <input type="text" value={patientManualPhone} onChange={e => setPatientManualPhone(e.target.value)} placeholder="10-digit number" className="w-full bg-[#161e31] border border-white/5 p-5 rounded-[1.5rem] text-lg font-black text-white outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-4">Email ID</label>
                <input type="email" value={patientManualEmail} onChange={e => setPatientManualEmail(e.target.value)} placeholder="patient@mail.com" className="w-full bg-[#161e31] border border-white/5 p-5 rounded-[1.5rem] text-lg font-black text-white outline-none focus:border-blue-500" />
              </div>
            </div>

            <button onClick={() => setShowPatientIdentity(false)} className="w-full bg-blue-600 text-white py-6 md:py-8 rounded-full font-black text-lg md:text-xl active:scale-95 transition-all shadow-xl uppercase tracking-widest">
               Update Identity
            </button>
          </div>
        </div>
      )}

      {/* Vitals History Modal (Mapped to Blue Circle History Button - Recall Last 30) */}
      {showVitalsHistory && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-6 animate-in fade-in zoom-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-8 shrink-0">
               <h3 className="text-2xl md:text-4xl font-black text-white tracking-tighter flex items-center gap-4"><History className="text-emerald-500" /> Vitals History (Recall)</h3>
               <button onClick={() => setShowVitalsHistory(false)} className="p-3 md:p-6 bg-white/5 rounded-2xl md:rounded-3xl text-slate-500 hover:text-white"><XCircle size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {vitalsHistory.length === 0 ? (
                <div className="text-center py-20 text-slate-700 font-black uppercase tracking-widest italic opacity-50">No logs found. Enter vitals to see history.</div>
              ) : vitalsHistory.map(vital => (
                <div key={vital.id} className="bg-[#161e31] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] space-y-4 shadow-xl">
                   <div className="flex justify-between items-center border-b border-white/5 pb-3">
                     <p className="text-[10px] md:text-xs font-black text-blue-500 uppercase tracking-widest">{vital.timestamp}</p>
                     <div className="flex gap-2">
                        <button onClick={() => handleEditVital(vital)} className="p-2 text-slate-500 hover:text-white"><Pencil size={16} /></button>
                        <button onClick={() => setVitalsHistory(storageService.deleteDailyVital(vital.id))} className="p-2 text-rose-500/50 hover:text-rose-500"><Trash2 size={16} /></button>
                     </div>
                   </div>
                   <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
                      {[
                        { l: 'BP', v: vital.bp, c: 'text-blue-400' },
                        { l: 'Temp', v: vital.temp, c: 'text-rose-400' },
                        { l: 'SpO2', v: vital.spo2, c: 'text-emerald-400' },
                        { l: 'Pulse', v: vital.hr, c: 'text-rose-500' },
                        { l: 'Sugar', v: vital.rbs, c: 'text-amber-400' }
                      ].map(v => (
                        <div key={v.l} className="text-center">
                          <p className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase mb-1">{v.l}</p>
                          <p className={`text-sm md:text-base font-black ${v.c}`}>{v.v || '--'}</p>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vitals Form Modal */}
      {showVitalsForm && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-3xl flex items-center justify-center p-4 md:p-6 animate-in fade-in zoom-in duration-300 overflow-y-auto">
          <div className="bg-[#101726] border border-white/10 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] w-full max-w-xl space-y-8 md:space-y-10 my-auto shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <Activity className="text-emerald-500" /> Daily Vitals
              </h3>
              <button onClick={() => { setShowVitalsForm(false); setEditingVitalId(null); setVitalsFormData({ bp: '', temp: '', spo2: '', hr: '', rbs: '', weight: '', waist: '' }); }} className="p-3 bg-white/5 rounded-xl text-slate-500 hover:text-white"><XCircle size={24} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 md:gap-6">
              {[
                { label: 'B.P.', key: 'bp', icon: <Activity size={16} />, color: 'text-blue-400' },
                { label: 'Temp', key: 'temp', icon: <Thermometer size={16} />, color: 'text-rose-400' },
                { label: 'SpO2', key: 'spo2', icon: <Check size={16} />, color: 'text-emerald-400' },
                { label: 'Pulse', key: 'hr', icon: <HeartPulse size={16} />, color: 'text-rose-500' },
                { label: 'Sugar', key: 'rbs', icon: <Activity size={16} />, color: 'text-amber-400' },
                { label: 'Weight', key: 'weight', icon: <Scale size={16} />, color: 'text-purple-400' },
              ].map(field => (
                <div key={field.key} className="space-y-1">
                  <label className={`text-[9px] font-black ${field.color} uppercase ml-2 flex items-center gap-1`}>{field.icon} {field.label}</label>
                  <input type="text" value={(vitalsFormData as any)[field.key]} onChange={e => setVitalsFormData({...vitalsFormData, [field.key]: e.target.value})} className="w-full bg-[#161e31] p-4 md:p-6 rounded-xl md:rounded-[2rem] border border-white/5 text-white font-black text-center outline-none focus:border-emerald-500" />
                </div>
              ))}
            </div>

            <button onClick={handleSaveVitals} className="w-full bg-emerald-600 text-white py-6 md:py-9 rounded-full font-black text-xl md:text-2xl active:scale-95 transition-all shadow-xl uppercase tracking-widest flex items-center justify-center gap-4">
               <CheckCircle2 size={24} className="md:w-8 md:h-8" /> SAVE & SHARE
            </button>
          </div>
        </div>
      )}

      {showEmergencyDialog && (
        <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border-2 border-white/10 p-8 md:p-10 rounded-[3.5rem] md:rounded-[5rem] w-full max-w-md space-y-8 md:space-y-10 shadow-2xl relative overflow-hidden">
            <div className="text-center space-y-4 md:space-y-6 relative z-10">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-rose-600/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-2 animate-pulse">
                <Siren className="w-10 h-10 md:w-12 md:h-12 text-rose-500" />
              </div>
              <h3 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">SOS Alert</h3>
              <p className="text-slate-500 font-bold text-base md:text-lg">Deploy emergency medical support?</p>
            </div>
            <div className="grid gap-3 md:gap-4 relative z-10">
              <button onClick={handleVideoConsultation} className="w-full p-6 md:p-8 bg-blue-600/10 border-2 border-blue-500/30 text-white rounded-full font-black uppercase text-lg md:text-xl active:scale-95 transition-all shadow-xl flex flex-col items-center justify-center">
                 <div className="flex items-center gap-2"><Video size={20} className="text-blue-400" /><span>Video Call</span></div>
                 <span className="text-[10px] font-black text-blue-500/70 tracking-widest mt-1">Fee: ₹499</span>
              </button>
              <button onClick={() => handleEmergencyAction('ambulance')} className="w-full p-6 md:p-9 bg-rose-600 text-white rounded-full font-black uppercase text-xl md:text-2xl active:scale-95 transition-all shadow-2xl">Ambulance SOS</button>
              <button onClick={() => handleEmergencyAction('doctor')} className="w-full p-6 md:p-9 bg-blue-600 text-white rounded-full font-black uppercase text-xl md:text-2xl active:scale-95 transition-all shadow-2xl">Urgent Doctor</button>
              <button onClick={() => setShowEmergencyDialog(false)} className="w-full p-2 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPaymentQR && (
        <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 md:p-6 animate-in zoom-in duration-300">
          <div className="bg-[#101726] border border-white/10 p-8 md:p-10 rounded-[3rem] md:rounded-[4rem] w-full max-w-md space-y-8 md:space-y-10 shadow-2xl">
            <div className="flex justify-between items-center"><h3 className="text-2xl md:text-3xl font-black text-white">Clinical Payment</h3><button onClick={() => setShowPaymentQR(false)} className="p-3 bg-white/5 rounded-xl text-slate-500 shadow-xl"><XCircle size={24} /></button></div>
            <div className="bg-white p-4 md:p-6 rounded-[2.5rem] md:rounded-[3rem] aspect-square overflow-hidden shadow-2xl flex items-center justify-center border-4 md:border-8 border-slate-950">
              <img src="https://lh3.googleusercontent.com/d/14Ax9aU31Gaja2kAvnLbIFLbhbbAiB4D5" alt="Payment QR" className="w-full h-full object-contain" />
            </div>
            <div className="text-center space-y-2"><p className="text-emerald-400 font-black text-4xl md:text-5xl tracking-tighter">₹{formData.serviceCharge}</p><p className="text-slate-500 font-bold text-[10px] md:text-sm uppercase tracking-widest opacity-60">Scan to finalize clinical session</p></div>
            <button onClick={() => { window.location.href = `upi://pay?pa=8200095781@pthdfc&pn=KenilShah&am=${formData.serviceCharge}&cu=INR`; }} className="w-full bg-emerald-600 text-white py-6 md:py-9 rounded-full font-black text-xl md:text-2xl shadow-lg uppercase tracking-widest">Open UPI App</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;