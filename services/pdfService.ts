
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
        <p style="margin: 5px 0; font-size: 11pt; opacity: 0.8;">Age: ${visitData.age || 'N/A'} | Location: ${visitData.address || 'N/A'}</p>
        <p style="margin: 0; font-size: 9pt; opacity: 0.6;">Contact: ${visitData.contactNumber} | Date: ${now.toLocaleDateString()}</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 30px;">
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
            <div style="font-size: 6pt; opacity: 0.6; font-weight: 900; text-transform: uppercase; color: ${vit.c};">${vit.l}</div>
            <div style="font-size: 13pt; font-weight: 900; margin: 4px 0;">${vit.v || '--'}</div>
            <div style="font-size: 5pt; opacity: 0.4;">${vit.u}</div>
          </div>
        `).join('')}
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 9pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 10px;">Clinical Findings</h4>
        <p style="font-size: 11pt; line-height: 1.4; white-space: pre-wrap; margin: 0;">${visitData.complaints}</p>
      </div>

      ${visitData.history ? `
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 9pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 10px;">Medical & Surgical History</h4>
        <p style="font-size: 11pt; line-height: 1.4; white-space: pre-wrap; margin: 0; opacity: 0.9;">${visitData.history}</p>
      </div>` : ''}

      <div style="margin-bottom: 25px;">
        <h4 style="font-size: 9pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 10px;">Prescription</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr style="text-align: left; font-size: 8pt; opacity: 0.5;">
              <th style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">Medicine</th>
              <th style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">Schedule</th>
            </tr>
          </thead>
          <tbody>
            ${visitData.medications.map(m => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 11pt;">
                <td style="padding: 10px 8px;"><b>${m.name}</b><br/><small style="opacity: 0.6;">${m.route}</small></td>
                <td style="padding: 10px 8px;">${m.timing} <span style="opacity: 0.5;">(${m.frequency}x)</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${visitData.nonMedicinalAdvice ? `
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 9pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 10px;">General Advices</h4>
        <div style="background: rgba(16, 185, 129, 0.05); padding: 12px; border-radius: 12px; border-left: 4px solid #10b981;">
          <p style="font-size: 11pt; margin: 0; color: #fff; font-weight: 500; white-space: pre-wrap;">${visitData.nonMedicinalAdvice}</p>
        </div>
      </div>` : ''}

      ${visitData.investigationsAdvised ? `
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 9pt; text-transform: uppercase; font-weight: 900; opacity: 0.6; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 10px;">Labs & Investigations</h4>
        <p style="font-size: 11pt; margin: 0; color: #fbbf24; font-weight: bold;">${visitData.investigationsAdvised}</p>
      </div>` : ''}

      <div style="margin-top: auto; padding: 25px; background: rgba(255,255,255,0.03); border-radius: 25px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div>
              <h4 style="font-size: 8pt; opacity: 0.6; margin: 0; letter-spacing: 1px;">Service: <b>${visitData.serviceName}</b></h4>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 20pt; font-weight: 900; margin: 0; color: #10b981;">₹${visitData.serviceCharge}</p>
            </div>
         </div>
         <!-- CLICKABLE BUTTON AREA -->
         <div id="payment-btn" style="background: #10b981; color: #fff; padding: 18px; text-align: center; border-radius: 18px; font-weight: 900; font-size: 13pt; text-transform: uppercase; letter-spacing: 1px; cursor: pointer;">
            TAP TO PAY ₹${visitData.serviceCharge} VIA UPI
         </div>
      </div>
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
      title: `XzeCure_${visitData.patientName}`,
      subject: clinicalBase64,
      author: 'XzeCure Health'
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

    // Precise Link Overlay for the Payment Button
    // Container Padding (20mm) + Vertical Spacer + Content
    // We position a link roughly over the bottom green button area
    pdf.link(25, 245, 160, 20, { url: upiLink });

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
