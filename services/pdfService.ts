
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

export const generateVisitPdf = async (
  visitData: VisitData, 
  photoDataUrls: string[], 
  letterheadUrl: string
): Promise<Blob> => {
  const letterheadDataUrl = await imageToDataUrl(letterheadUrl);
  const container = document.createElement('div');
  container.id = 'temp-pdf-container';
  
  Object.assign(container.style, {
    width: '210mm',
    minHeight: '297mm',
    backgroundColor: '#0f172a', 
    color: '#ffffff', 
    fontFamily: 'sans-serif',
    padding: '20mm',
    boxSizing: 'border-box',
    position: 'absolute',
    left: '-10000px',
    top: '0',
    backgroundImage: `url('${letterheadDataUrl}')`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    zIndex: '-1'
  });

  const now = new Date();
  const upiLink = `upi://pay?pa=8200095781@pthdfc&pn=KenilShah`;

  // Content Template
  container.innerHTML = `
    <div style="position: relative; z-index: 10; color: #fff; height: 100%; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="text-align: left;">
          <h1 style="margin: 0; font-size: 32pt; text-transform: uppercase; font-weight: 900; color: #fff; letter-spacing: -2px;">XzeCure</h1>
          <p style="margin: 0; font-size: 10pt; opacity: 0.6; font-weight: bold; letter-spacing: 2px;">SMART CLINICAL REPORT</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 16pt; font-weight: 900;">Dr. ${visitData.staffName}</p>
          <p style="margin: 0; font-size: 8pt; opacity: 0.4;">Visit ID: ${visitData.visitId}</p>
        </div>
      </div>
      
      <div style="margin: 30px 0; border-top: 5px solid #fff; padding-top: 20px;">
        <p style="margin: 0; font-size: 22pt; font-weight: 900;">${visitData.patientName}</p>
        <p style="margin: 5px 0; font-size: 12pt; opacity: 0.8;">Age: ${visitData.age || 'N/A'} | Location: ${visitData.address || 'N/A'}</p>
        <p style="margin: 0; font-size: 10pt; opacity: 0.6;">Contact: ${visitData.contactNumber} | Date: ${now.toLocaleDateString()}</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 30px;">
        ${[
          {l: 'TEMP', v: visitData.vitalTemp, u: '°F', c: '#ef4444'},
          {l: 'BP', v: visitData.vitalBp, u: 'mmHg', c: '#3b82f6'},
          {l: 'SpO2', v: visitData.vitalSpo2, u: '%', c: '#10b981'},
          {l: 'HR', v: visitData.vitalHr, u: 'bpm', c: '#f43f5e'},
          {l: 'RBS', v: visitData.vitalRbs, u: 'mg/dL', c: '#f59e0b'},
          {l: 'Weight', v: visitData.weight, u: 'kg', c: '#a855f7'},
          {l: 'Height', v: visitData.height, u: 'cm', c: '#6366f1'},
          {l: 'BMI', v: visitData.bmi, u: 'Index', c: '#14b8a6'}
        ].map(vit => `
          <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 18px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 7pt; opacity: 0.6; font-weight: 900; text-transform: uppercase; color: ${vit.c};">${vit.l}</div>
            <div style="font-size: 14pt; font-weight: 900; margin: 4px 0;">${vit.v || '--'}</div>
            <div style="font-size: 6pt; opacity: 0.4; font-weight: bold;">${vit.u}</div>
          </div>
        `).join('')}
      </div>

      <div style="margin-bottom: 30px;">
        <h4 style="font-size: 10pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 1px;">History & Clinical Findings</h4>
        <p style="font-size: 12pt; line-height: 1.6; white-space: pre-wrap;">${visitData.complaints}</p>
      </div>

      <div style="margin-bottom: 30px;">
        <h4 style="font-size: 10pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 1px;">Prescribed Medications</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="text-align: left; font-size: 9pt; opacity: 0.5;">
              <th style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">Medicine Name</th>
              <th style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">Dosage</th>
              <th style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">Timing / Frequency</th>
            </tr>
          </thead>
          <tbody>
            ${visitData.medications.map(m => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 11pt;">
                <td style="padding: 15px 10px;"><b>${m.name}</b><br/><small style="opacity: 0.6;">${m.route}</small></td>
                <td style="padding: 15px 10px;">${m.dose || '--'}</td>
                <td style="padding: 15px 10px;">${m.timing} <span style="opacity: 0.5;">(${m.frequency}x/day)</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${visitData.treatment ? `
      <div style="margin-bottom: 30px;">
        <h4 style="font-size: 10pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 1px;">Other Advice / Treatment</h4>
        <div style="background: rgba(59, 130, 246, 0.1); padding: 15px; border-radius: 12px; border-left: 5px solid #3b82f6;">
          <p style="font-size: 12pt; margin: 0; color: #fff; font-weight: 500; white-space: pre-wrap;">${visitData.treatment}</p>
        </div>
      </div>` : ''}

      ${visitData.investigationsAdvised ? `
      <div style="margin-bottom: 30px;">
        <h4 style="font-size: 10pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 1px;">Investigations Advised</h4>
        <div style="background: rgba(251, 191, 36, 0.1); padding: 15px; border-radius: 12px; border-left: 5px solid #fbbf24;">
          <p style="font-size: 12pt; margin: 0; color: #fbbf24; font-weight: bold;">${visitData.investigationsAdvised}</p>
        </div>
      </div>` : ''}

      ${visitData.followup === 'Yes' && visitData.followupDate ? `
      <div style="margin-bottom: 30px;">
        <h4 style="font-size: 10pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 8px; margin-bottom: 12px; letter-spacing: 1px;">Follow-up Schedule</h4>
        <div style="background: rgba(16, 185, 129, 0.1); padding: 15px; border-radius: 12px; border-left: 5px solid #10b981;">
          <p style="font-size: 12pt; margin: 0; color: #10b981; font-weight: bold;">Scheduled for: ${new Date(visitData.followupDate).toLocaleDateString()}</p>
        </div>
      </div>` : ''}

      <div style="margin-top: auto; padding: 25px; background: rgba(255,255,255,0.03); border-radius: 25px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h4 style="font-size: 9pt; text-transform: uppercase; opacity: 0.6; margin: 0; letter-spacing: 1px;">Consultation Service</h4>
              <p style="font-size: 14pt; font-weight: 800; margin: 5px 0;">${visitData.serviceName}</p>
            </div>
            <div style="text-align: right;">
              <h4 style="font-size: 9pt; text-transform: uppercase; opacity: 0.6; margin: 0; letter-spacing: 1px;">Total Charge</h4>
              <p style="font-size: 24pt; font-weight: 900; margin: 5px 0; color: #10b981;">₹${visitData.serviceCharge}</p>
            </div>
         </div>
         <div style="background: #10b981; color: #fff; padding: 20px; text-align: center; border-radius: 18px; font-weight: 900; font-size: 14pt; text-transform: uppercase; letter-spacing: 2px; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3);">
            Click to Pay ₹${visitData.serviceCharge} via UPI
         </div>
      </div>
    </div>
    <div style="position: absolute; bottom: 10mm; left: 0; width: 100%; text-align: center; opacity: 0.4; font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">
      © XzeCure Digital Health Node • Not for Medico-Legal Use
    </div>
  `;

  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, { scale: 3, useCORS: true, backgroundColor: '#0f172a' });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const clinicalJson = JSON.stringify(visitData);
    const clinicalBase64 = btoa(unescape(encodeURIComponent(clinicalJson)));
    
    pdf.setProperties({
      title: `XzeCure_Report_${visitData.patientName}`,
      subject: clinicalBase64,
      author: 'XzeCure Health Node'
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

    // Clickable Payment Link Overlay
    // Based on the position of the green button at the bottom
    pdf.link(20, 230, 170, 25, { url: upiLink });

    for (const photoUrl of photoDataUrls) {
      pdf.addPage();
      pdf.setFillColor(15, 23, 42); 
      pdf.rect(0, 0, 210, 297, 'F');
      pdf.addImage(photoUrl, 'JPEG', 10, 10, 190, 277, undefined, 'FAST');
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
};
