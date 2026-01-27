import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { VisitData } from '../types';

const imageToDataUrl = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return url;
  }
};

const getImageDimensions = (file: string): Promise<{ w: number, h: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.src = file;
  });
};

const drawFooter = (pdf: jsPDF) => {
  const pageHeight = 297;
  const pageWidth = 210;
  const startY = pageHeight - 18;

  pdf.setFontSize(8.5);
  pdf.setTextColor(30, 41, 59); // slate-800
  pdf.setFont("helvetica", "bold");
  
  pdf.text("Your helping hands in emergency. Ahmedabad Mediclaim valid HomeCare Provider.", pageWidth / 2, startY, { align: 'center' });
  pdf.text("Contact: +91 63551 37969 | +91 8200095781", pageWidth / 2, startY + 4, { align: 'center' });
  pdf.text("Visit us at XzeCure.co.in", pageWidth / 2, startY + 8, { align: 'center' });

  pdf.setFontSize(8);
  pdf.setTextColor(220, 38, 38); // red-600
  pdf.setFont("helvetica", "normal");
  pdf.text("This report is for digital clinical record and not for medico-legal purposes", pageWidth / 2, startY + 12, { align: 'center' });
};

export const generateVisitPdf = async (
  visitData: VisitData, 
  photoDataUrls: string[], 
  logoUrl: string
): Promise<Blob> => {
  const logoDataUrl = await imageToDataUrl(logoUrl);
  const container = document.createElement('div');
  container.id = 'temp-pdf-container';
  
  Object.assign(container.style, {
    width: '210mm',
    minHeight: '297mm',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    padding: '12mm 15mm 25mm 15mm',
    boxSizing: 'border-box',
    position: 'absolute',
    left: '-10000px',
    top: '0',
    zIndex: '-1'
  });

  const now = new Date();

  container.innerHTML = `
    <div style="height: 100%; display: flex; flex-direction: column;">
      <!-- Letterhead Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 4px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px;">
        <div style="display: flex; align-items: center; gap: 20px;">
          <img src="${logoDataUrl}" style="width: 80px; height: 80px; object-fit: contain;" />
          <div>
            <h1 style="margin: 0; font-size: 32pt; font-weight: 900; color: #1e3a8a; letter-spacing: -2px; line-height: 1;">XzeCure</h1>
            <p style="margin: 2px 0 0 0; font-size: 10pt; color: #3b82f6; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">Health Node Deployment</p>
          </div>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 14pt; font-weight: 800; color: #1e3a8a;">${visitData.staffName}</p>
          <p style="margin: 4px 0; font-size: 9pt; color: #64748b; font-weight: 700; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; display: inline-block;">ID: ${visitData.visitId}</p>
          <p style="margin: 4px 0 0 0; font-size: 9pt; color: #64748b; font-weight: 600;">${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
      
      <!-- Patient Bio-Data -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
        <div style="flex: 1;">
          <h2 style="margin: 0; font-size: 18pt; font-weight: 900; color: #0f172a; text-transform: uppercase;">${visitData.patientName}</h2>
          <div style="margin-top: 8px; display: flex; gap: 15px; font-size: 10pt; font-weight: 700; color: #475569;">
            <span>AGE: ${visitData.age || '--'} Yrs</span>
            <span style="color: #cbd5e1;">|</span>
            <span>GENDER: ${visitData.gender || '--'}</span>
            <span style="color: #cbd5e1;">|</span>
            <span>MOB: ${visitData.contactNumber}</span>
          </div>
        </div>
        <div style="text-align: right; min-width: 120px;">
           <div style="display: inline-block; padding: 10px 20px; border: 2px solid #1e3a8a; border-radius: 50px; color: #1e3a8a; font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
             Clinical Report
           </div>
        </div>
      </div>

      <!-- Vital Signs Dashboard -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 35px;">
        ${[
          {l: 'Temperature', v: visitData.vitalTemp, u: '°F', c: '#f43f5e'},
          {l: 'Blood Pressure', v: visitData.vitalBp, u: 'mmHg', c: '#3b82f6'},
          {l: 'Oxygen (SpO2)', v: visitData.vitalSpo2, u: '%', c: '#10b981'},
          {l: 'Pulse Rate', v: visitData.vitalHr, u: 'bpm', c: '#e11d48'},
          {l: 'Sugar (RBS)', v: visitData.vitalRbs, u: 'mg/dL', c: '#f59e0b'},
          {l: 'Body Weight', v: visitData.weight, u: 'kg', c: '#8b5cf6'},
          {l: 'Height', v: visitData.height, u: 'cm', c: '#6366f1'},
          {l: 'Body BMI', v: visitData.bmi, u: 'Score', c: '#0ea5e9'}
        ].map(vit => `
          <div style="background: #ffffff; padding: 15px 10px; border-radius: 12px; text-align: center; border: 1px solid #f1f5f9; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border-top: 4px solid ${vit.c};">
            <div style="font-size: 7.5pt; font-weight: 800; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${vit.l}</div>
            <div style="font-size: 14pt; font-weight: 900; color: #1e293b; line-height: 1;">${vit.v || '--'}</div>
            <div style="font-size: 7pt; color: ${vit.c}; font-weight: 700; margin-top: 4px;">${vit.u}</div>
          </div>
        `).join('')}
      </div>

      <!-- Clinical Findings -->
      <div style="display: flex; gap: 35px; flex: 1;">
        <div style="flex: 2.2;">
          <section style="margin-bottom: 25px;">
            <h4 style="font-size: 11pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">Clinical Assessment / Complaints</h4>
            <div style="font-size: 10.5pt; line-height: 1.5; white-space: pre-wrap; color: #334155; font-weight: 500;">${visitData.complaints || '--'}</div>
          </section>

          ${visitData.history ? `
          <section style="margin-bottom: 25px;">
            <h4 style="font-size: 11pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px;">Medical & Surgical History</h4>
            <div style="font-size: 10.5pt; line-height: 1.5; white-space: pre-wrap; color: #334155; font-weight: 500;">${visitData.history}</div>
          </section>` : ''}

          ${visitData.provisionalDiagnosis ? `
          <section style="margin-bottom: 25px; background: #eff6ff; padding: 15px; border-radius: 10px; border-left: 5px solid #3b82f6;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h4 style="font-size: 10pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; margin: 0;">Provisional Diagnosis</h4>
              ${visitData.icdCode ? `<span style="font-size: 8pt; font-weight: 900; color: #ffffff; background: #3b82f6; padding: 2px 8px; border-radius: 4px;">ICD: ${visitData.icdCode}</span>` : ''}
            </div>
            <div style="font-size: 12pt; font-weight: 900; color: #1e293b;">${visitData.provisionalDiagnosis}</div>
          </section>` : ''}

          ${visitData.treatment ? `
          <section style="margin-bottom: 25px;">
            <h4 style="font-size: 11pt; text-transform: uppercase; font-weight: 900; color: #15803d; border-bottom: 2px solid #dcfce7; padding-bottom: 6px; margin-bottom: 10px;">Treatment & Medications</h4>
            <div style="font-size: 10.5pt; line-height: 1.6; color: #166534; white-space: pre-wrap; font-weight: 700;">${visitData.treatment}</div>
          </section>` : ''}

          ${visitData.investigationsAdvised ? `
          <section style="margin-bottom: 25px;">
            <h4 style="font-size: 11pt; text-transform: uppercase; font-weight: 900; color: #b45309; border-bottom: 2px solid #ffedd5; padding-bottom: 6px; margin-bottom: 10px;">Investigations / Imaging Advice</h4>
            <div style="font-size: 10.5pt; font-weight: 800; color: #9a3412; line-height: 1.5; white-space: pre-wrap;">${visitData.investigationsAdvised}</div>
          </section>` : ''}
        </div>

        <div style="flex: 1; border-left: 1px solid #e2e8f0; padding-left: 20px;">
           <section style="margin-bottom: 25px;">
            <h4 style="font-size: 9.5pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 10px;">Patient Reminders</h4>
            <div style="font-size: 9pt; line-height: 1.4; color: #64748b; font-weight: 600;">
              • Log vitals daily in XzeCure App<br>
              • Follow diet instructions<br>
              • Continue BP/Diabetes meds<br>
              • Emergency contact: +91 8200095781
            </div>
          </section>

          ${visitData.followup === 'Yes' ? `
          <div style="background: #1e3a8a; border-radius: 10px; padding: 12px; text-align: center; margin-top: 20px;">
            <p style="margin: 0; font-size: 7pt; font-weight: 900; color: #bfdbfe; text-transform: uppercase; letter-spacing: 0.5px;">Follow-up Date</p>
            <p style="margin: 4px 0 0 0; font-size: 11pt; font-weight: 900; color: #ffffff;">${visitData.followupDate}</p>
          </div>` : ''}
        </div>
      </div>

      <!-- Financial Summary -->
      <div style="margin-top: 30px; border-top: 2px solid #f1f5f9; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div style="max-width: 60%;">
          <p style="margin: 0; font-size: 8.5pt; color: #1e293b; font-weight: 700;"><b>Primary Service:</b> ${visitData.serviceName}</p>
          <p style="margin: 4px 0 0 0; font-size: 7pt; color: #94a3b8; font-style: italic; line-height: 1.2;">
            Digitally compiled by ${visitData.staffName} for XzeCure Health Hub. Data capture at point-of-care.
          </p>
        </div>
        <div style="text-align: right;">
          <div style="background: #10b981; color: #ffffff; padding: 12px 25px; border-radius: 12px; display: inline-block;">
            <p style="margin: 0; font-size: 18pt; font-weight: 900;">₹${visitData.serviceCharge}</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, { 
      scale: 3, 
      useCORS: true, 
      backgroundColor: '#ffffff',
      logging: false
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    pdf.setProperties({
      title: `XzeCure Report - ${visitData.patientName}`,
      subject: btoa(unescape(encodeURIComponent(JSON.stringify(visitData)))),
      author: 'XzeCure Clinical Hub'
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    pdf.link(140, 260, 55, 25, { url: `upi://pay?pa=8200095781@pthdfc&pn=KenilShah&am=${visitData.serviceCharge}&cu=INR` });
    drawFooter(pdf);

    for (const photoUrl of photoDataUrls) {
      pdf.addPage();
      const { w, h } = await getImageDimensions(photoUrl);
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const footerSafety = 30;
      
      const maxWidth = pageWidth - (margin * 2);
      const maxHeight = pageHeight - (margin * 2) - footerSafety;
      
      let finalW = w;
      let finalH = h;
      const ratio = w / h;
      
      if (finalW > maxWidth) {
        finalW = maxWidth;
        finalH = finalW / ratio;
      }
      if (finalH > maxHeight) {
        finalH = maxHeight;
        finalW = finalH * ratio;
      }
      
      const x = (pageWidth - finalW) / 2;
      const y = (pageHeight - finalH - footerSafety) / 2;

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, 210, 297, 'F');
      pdf.addImage(photoUrl, 'JPEG', x, y, finalW, finalH, undefined, 'FAST');
      drawFooter(pdf);
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
};