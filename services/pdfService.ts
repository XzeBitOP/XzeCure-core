
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { VisitData } from '../types';

const imageToDataUrl = async (url: string): Promise<string> => {
  if (!url) return '';
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
  const startY = pageHeight - 20;

  // Medicolegal Disclaimer
  pdf.setFontSize(10);
  pdf.setTextColor(220, 38, 38); // Tailwind red-600
  pdf.setFont("helvetica", "bold");
  pdf.text("NOT VALID DOCUMENT FOR MEDICOLEGAL PURPOSE", pageWidth / 2, startY, { align: 'center' });

  // Standard Footer Info
  pdf.setFontSize(8.5);
  pdf.setTextColor(30, 41, 59); // slate-800
  pdf.setFont("helvetica", "bold");
  pdf.text("Your helping hands in emergency. Ahmedabad Mediclaim valid HomeCare Provider.", pageWidth / 2, startY + 5, { align: 'center' });
  
  pdf.setFont("helvetica", "normal");
  pdf.text("Contact: +91 63551 37969 | +91 8200095781", pageWidth / 2, startY + 9, { align: 'center' });
  pdf.text("Visit us at XzeCure.co.in", pageWidth / 2, startY + 13, { align: 'center' });
};

export const generateVisitPdf = async (
  visitData: VisitData, 
  photoDataUrls: string[], 
  logoUrl: string
): Promise<Blob> => {
  const logoDataUrl = await imageToDataUrl(logoUrl);
  const consultantLogoDataUrl = visitData.consultantLogo ? await imageToDataUrl(visitData.consultantLogo) : '';
  
  const container = document.createElement('div');
  container.id = 'temp-pdf-container';
  
  Object.assign(container.style, {
    width: '210mm',
    minHeight: '297mm',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    padding: '12mm 15mm 28mm 15mm', // Added padding to prevent bottom overlap
    boxSizing: 'border-box',
    position: 'absolute',
    left: '-10000px',
    top: '0',
    zIndex: '-1'
  });

  const now = new Date();
  const treatmentPlanIncludesContinue = visitData.treatment?.toLowerCase().includes('continue');

  container.innerHTML = `
    <div style="height: 100%; display: flex; flex-direction: column;">
      <!-- Letterhead Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 4px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 25px;">
        <div style="display: flex; align-items: center; gap: 20px;">
          <img src="${logoDataUrl}" style="width: 80px; height: 80px; object-fit: contain;" />
          <div>
            <h1 style="margin: 0; font-size: 32pt; font-weight: 900; color: #1e3a8a; letter-spacing: -2px; line-height: 1;">XzeCure</h1>
          </div>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 14pt; font-weight: 800; color: #1e3a8a;">${visitData.staffName}</p>
          <p style="margin: 4px 0; font-size: 9pt; color: #64748b; font-weight: 700; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; display: inline-block;">ID: ${visitData.visitId}</p>
          <p style="margin: 4px 0 0 0; font-size: 9pt; color: #64748b; font-weight: 600;">${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
      
      <!-- Patient Bio-Data & Consultant Info -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <h2 style="margin: 0; font-size: 18pt; font-weight: 900; color: #0f172a; text-transform: uppercase;">${visitData.patientName}</h2>
          <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 5px; font-size: 10pt; font-weight: 700; color: #475569;">
            <div style="display: flex; gap: 15px;">
              <span>AGE: ${visitData.age || '--'} Yrs</span>
              <span style="color: #cbd5e1;">|</span>
              <span>GENDER: ${visitData.gender || '--'}</span>
              <span style="color: #cbd5e1;">|</span>
              <span>MOB: ${visitData.contactNumber}</span>
            </div>
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; display: flex; align-items: center; gap: 12px;">
              ${consultantLogoDataUrl ? `<img src="${consultantLogoDataUrl}" style="width: 40px; height: 40px; object-fit: contain; background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 2px;" />` : ''}
              <div>
                <div style="color: #64748b; font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Consultant</div>
                <div style="color: #1e3a8a; font-size: 11pt; font-weight: 900;">${visitData.consultantName || 'Standard Care'}</div>
              </div>
            </div>
          </div>
          ${visitData.address ? `<p style="margin: 8px 0 0 0; font-size: 9pt; color: #64748b; line-height: 1.4;">${visitData.address}</p>` : ''}
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
          <section style="margin-bottom: 30px;">
            <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
               <h4 style="font-size: 11pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; margin: 0;">Clinical Assessment</h4>
               ${visitData.duration ? `<span style="font-size: 8.5pt; font-weight: 800; color: #64748b; background: #f8fafc; padding: 2px 10px; border-radius: 4px; border: 1px solid #e2e8f0;">${visitData.duration}</span>` : ''}
            </div>
            <div style="font-size: 11.5pt; line-height: 1.6; white-space: pre-wrap; color: #334155; font-weight: 500;">${visitData.complaints || 'Patient observed for standard health monitoring and care assistance.'}</div>
          </section>

          ${visitData.provisionalDiagnosis ? `
          <section style="margin-bottom: 30px; background: #eff6ff; padding: 18px; border-radius: 12px; border-left: 6px solid #3b82f6;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="font-size: 11pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; margin: 0;">Provisional Diagnosis</h4>
              ${visitData.icdCode ? `<span style="font-size: 9pt; font-weight: 900; color: #ffffff; background: #3b82f6; padding: 3px 10px; border-radius: 6px;">ICD-10: ${visitData.icdCode}</span>` : ''}
            </div>
            <div style="font-size: 13pt; font-weight: 900; color: #1e293b;">${visitData.provisionalDiagnosis}</div>
          </section>` : ''}

          <section>
            <h4 style="font-size: 11pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; margin: 0 0 15px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Prescribed Medications (Rx)</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #3b82f6;">
                  <th style="padding: 12px 10px; text-align: left; font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Item Details</th>
                  <th style="padding: 12px 10px; text-align: right; font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Frequency & Duration</th>
                </tr>
              </thead>
              <tbody>
                ${visitData.medications.length > 0 ? visitData.medications.map(m => `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 14px 10px;">
                      <div style="font-size: 11.5pt; font-weight: 900; color: #1e3a8a;">${m.name}</div>
                      <div style="font-size: 8.5pt; color: #64748b; margin-top: 2px; font-weight: 600;">${m.route} | Dose: ${m.dose}</div>
                    </td>
                    <td style="padding: 14px 10px; text-align: right;">
                      <div style="font-size: 11pt; font-weight: 900; color: #1e3a8a;">${m.timing}</div>
                      <div style="font-size: 8pt; color: #3b82f6; font-weight: 800; text-transform: uppercase; margin-top: 2px;">${m.days ? `FOR ${m.days} DAYS` : 'CONTINUE'}</div>
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="2" style="padding: 30px; text-align: center; color: #94a3b8; font-style: italic; font-weight: 600;">No medications documented.</td></tr>'}
              </tbody>
            </table>
          </section>

          ${visitData.treatment ? `
          <section style="margin-top: 30px; margin-bottom: 30px;">
            <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
               <h4 style="font-size: 11pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; margin: 0;">Treatment Plan / Procedures</h4>
            </div>
            <div style="font-size: 11.5pt; line-height: 1.6; white-space: pre-wrap; color: #334155; font-weight: 500;">
              ${visitData.treatment}
              ${treatmentPlanIncludesContinue ? '<div style="font-size: 9pt; color: #e11d48; font-weight: 800; margin-top: 8px; text-transform: uppercase;">* Continue indicates 30 days unless specified otherwise</div>' : ''}
            </div>
          </section>
          ` : ''}

        </div>

        <div style="flex: 1; border-left: 2px dashed #e2e8f0; padding-left: 25px;">
          <section style="margin-bottom: 30px;">
            <h4 style="font-size: 9.5pt; text-transform: uppercase; font-weight: 900; color: #b45309; border-bottom: 2px solid #ffedd5; padding-bottom: 6px; margin-bottom: 12px;">Investigations Advice</h4>
            <div style="font-size: 10.5pt; font-weight: 800; color: #9a3412; line-height: 1.6; white-space: pre-wrap;">${visitData.investigationsAdvised || 'Routine health screening recommended.'}</div>
          </section>

          <section style="margin-bottom: 30px;">
            <h4 style="font-size: 9.5pt; text-transform: uppercase; font-weight: 900; color: #15803d; border-bottom: 2px solid #dcfce7; padding-bottom: 6px; margin-bottom: 12px;">Special Instructions</h4>
            <div style="font-size: 9.5pt; line-height: 1.6; color: #166534; white-space: pre-wrap; font-weight: 600;">${visitData.nonMedicinalAdvice || 'Monitor vitals daily and maintain hydration.'}</div>
          </section>

          ${visitData.followup === 'Yes' ? `
          <div style="background: #1e3a8a; border-radius: 12px; padding: 15px; text-align: center; margin-top: 20px; box-shadow: 0 4px 6px rgba(30,58,138,0.2);">
            <p style="margin: 0; font-size: 7.5pt; font-weight: 900; color: #bfdbfe; text-transform: uppercase; letter-spacing: 1px;">Follow-up Schedule</p>
            <p style="margin: 6px 0 0 0; font-size: 13pt; font-weight: 900; color: #ffffff;">${visitData.followupDate}</p>
          </div>` : ''}
        </div>
      </div>

      <!-- Financial Summary & Auth - Simplified to Button Only -->
      <div style="margin-top: 40px; border-top: 3px solid #f1f5f9; padding-top: 25px; display: flex; justify-content: flex-end; align-items: flex-end;">
        <div style="text-align: right;">
          <div style="background: #10b981; color: #ffffff; padding: 15px 35px; border-radius: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
            <p style="margin: 0; font-size: 9pt; font-weight: 900; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">TOTAL PAYABLE</p>
            <p style="margin: 0; font-size: 24pt; font-weight: 900;">₹${visitData.serviceCharge}</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#ffffff',
      logging: false
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    pdf.setProperties({
      title: `XzeCure Report - ${visitData.patientName}`,
      subject: btoa(unescape(encodeURIComponent(JSON.stringify({ ...visitData, consultant: visitData.consultantName })))),
      author: 'XzeCure Clinical Hub',
      keywords: 'XzeCure, Medical Prescription'
    });

    // Page 1
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    // UPI Link overlay on the fee area - adjusted to ensure coverage of the green button
    pdf.link(130, 255, 65, 30, { url: `upi://pay?pa=8200095781@pthdfc&pn=KenilShah&am=${visitData.serviceCharge}&cu=INR` });
    drawFooter(pdf);

    // Attachments
    for (const photoUrl of photoDataUrls) {
      pdf.addPage();
      const { w, h } = await getImageDimensions(photoUrl);
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const footerSafety = 35;
      
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
