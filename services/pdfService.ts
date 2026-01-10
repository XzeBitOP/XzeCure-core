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
  
  pdf.text("Your helping hands in emergency. One of Ahmedabad Mediclaim valid HomeCare", pageWidth / 2, startY, { align: 'center' });
  pdf.text("Contact: +91 63551 37969 | +91 8200095781", pageWidth / 2, startY + 4, { align: 'center' });
  pdf.text("Visit us at XzeCure.co.in", pageWidth / 2, startY + 8, { align: 'center' });

  pdf.setFontSize(8);
  pdf.setTextColor(220, 38, 38); // red-600
  pdf.setFont("helvetica", "normal");
  pdf.text("This report is not valid for medico legal purposes", pageWidth / 2, startY + 12, { align: 'center' });
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
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <img src="${logoDataUrl}" style="width: 70px; height: 70px; object-fit: contain;" />
          <div>
            <h1 style="margin: 0; font-size: 28pt; font-weight: 900; color: #1e3a8a; letter-spacing: -1.5px;">XzeCure</h1>
            <p style="margin: 0; font-size: 9pt; color: #3b82f6; font-weight: 800; letter-spacing: 1.5px;">HAPPY PATIENT IS OUR GOAL</p>
          </div>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 14pt; font-weight: 700; color: #1e3a8a;">Dr. ${visitData.staffName}</p>
          <p style="margin: 2px 0; font-size: 8pt; color: #64748b; font-weight: 600;">Visit ID: ${visitData.visitId}</p>
          <p style="margin: 0; font-size: 8pt; color: #64748b;">${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
      
      <!-- Patient Information -->
      <div style="background: #f1f5f9; border-radius: 8px; padding: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <p style="margin: 0; font-size: 16pt; font-weight: 800; color: #0f172a;">${visitData.patientName}</p>
          <p style="margin: 4px 0; font-size: 10pt; color: #475569;">
            <span style="font-weight: 700;">Age:</span> ${visitData.age || '--'} Yrs | 
            <span style="font-weight: 700;">Gender:</span> ${visitData.gender || '--'} | 
            <span style="font-weight: 700;">Mobile:</span> ${visitData.contactNumber}
          </p>
          ${visitData.address ? `<p style="margin: 4px 0 0 0; font-size: 9pt; color: #64748b;">${visitData.address}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <span style="background: #3b82f6; color: #fff; padding: 6px 15px; border-radius: 20px; font-size: 8pt; font-weight: 800; text-transform: uppercase;">Clinical Node</span>
        </div>
      </div>

      <!-- Vitals Summary Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px;">
        ${[
          {l: 'TEMP', v: visitData.vitalTemp, u: '°F', c: '#ef4444'},
          {l: 'B.P.', v: visitData.vitalBp, u: 'mmHg', c: '#3b82f6'},
          {l: 'SpO2', v: visitData.vitalSpo2, u: '%', c: '#10b981'},
          {l: 'PULSE', v: visitData.vitalHr, u: 'bpm', c: '#f43f5e'},
          {l: 'RBS', v: visitData.vitalRbs, u: 'mg/dL', c: '#f59e0b'},
          {l: 'WEIGHT', v: visitData.weight, u: 'kg', c: '#8b5cf6'},
          {l: 'HEIGHT', v: visitData.height, u: 'cm', c: '#6366f1'},
          {l: 'BMI', v: visitData.bmi, u: 'Score', c: '#06b6d4'}
        ].map(vit => `
          <div style="background: #ffffff; padding: 12px 5px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0; border-bottom: 3px solid ${vit.c};">
            <div style="font-size: 7pt; font-weight: 800; color: #64748b; margin-bottom: 4px; text-transform: uppercase;">${vit.l}</div>
            <div style="font-size: 13pt; font-weight: 900; color: #1e293b;">${vit.v || '--'}</div>
            <div style="font-size: 6pt; color: #94a3b8; font-weight: 600;">${vit.u}</div>
          </div>
        `).join('')}
      </div>

      <!-- Main Clinical Sections -->
      <div style="display: flex; gap: 30px; flex: 1;">
        <div style="flex: 2;">
          <section style="margin-bottom: 25px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; border-left: 4px solid #3b82f6; padding-left: 10px;">
               <h4 style="font-size: 10pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; margin: 0;">Clinical Observations</h4>
               ${visitData.duration ? `<span style="font-size: 8pt; font-weight: 700; color: #64748b;">Duration: ${visitData.duration}</span>` : ''}
            </div>
            <div style="font-size: 11pt; line-height: 1.6; white-space: pre-wrap; color: #334155;">${visitData.complaints || 'Routine clinical assessment.'}</div>
          </section>

          ${visitData.history ? `
          <section style="margin-bottom: 25px;">
            <h4 style="font-size: 10pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; border-left: 4px solid #3b82f6; padding-left: 10px; margin-bottom: 10px;">Past History</h4>
            <div style="font-size: 10pt; line-height: 1.5; white-space: pre-wrap; color: #475569;">${visitData.history}</div>
          </section>` : ''}

          <section>
            <h4 style="font-size: 10pt; text-transform: uppercase; font-weight: 900; color: #1e3a8a; border-left: 4px solid #3b82f6; padding-left: 10px; margin-bottom: 15px;">Medications (Rx)</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #3b82f6;">
                  <th style="padding: 10px; text-align: left; font-size: 8pt; color: #64748b;">Medicine</th>
                  <th style="padding: 10px; text-align: right; font-size: 8pt; color: #64748b;">Timing</th>
                </tr>
              </thead>
              <tbody>
                ${visitData.medications.length > 0 ? visitData.medications.map(m => `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 10px;">
                      <div style="font-size: 11pt; font-weight: 800; color: #1e3a8a;">${m.name}</div>
                      <div style="font-size: 8pt; color: #64748b;">${m.route} | Dose: ${m.dose}</div>
                    </td>
                    <td style="padding: 12px 10px; text-align: right; font-size: 10pt; font-weight: 900; color: #1e3a8a;">${m.timing} <span style="font-size: 8pt; opacity: 0.5;">(${m.frequency}x)</span></td>
                  </tr>
                `).join('') : '<tr><td colspan="2" style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">No medications prescribed.</td></tr>'}
              </tbody>
            </table>
          </section>
        </div>

        <div style="flex: 1; border-left: 1px dashed #cbd5e1; padding-left: 20px;">
          <section style="margin-bottom: 25px;">
            <h4 style="font-size: 9pt; text-transform: uppercase; font-weight: 900; color: #b45309; border-bottom: 2px solid #ffedd5; padding-bottom: 5px; margin-bottom: 10px;">Investigations</h4>
            <div style="font-size: 10pt; font-weight: 800; color: #9a3412; line-height: 1.5; white-space: pre-wrap;">${visitData.investigationsAdvised || 'None advised.'}</div>
          </section>

          <section style="margin-bottom: 25px;">
            <h4 style="font-size: 9pt; text-transform: uppercase; font-weight: 900; color: #15803d; border-bottom: 2px solid #dcfce7; padding-bottom: 5px; margin-bottom: 10px;">General Advice</h4>
            <div style="font-size: 9pt; line-height: 1.5; color: #166534; white-space: pre-wrap;">${visitData.nonMedicinalAdvice || 'Healthy lifestyle maintained.'}</div>
          </section>

          ${visitData.followup === 'Yes' ? `
          <div style="background: #eff6ff; border: 2px solid #3b82f6; border-radius: 12px; padding: 12px; text-align: center; margin-top: 15px;">
            <p style="margin: 0; font-size: 7pt; font-weight: 900; color: #3b82f6; text-transform: uppercase;">Follow-up Date</p>
            <p style="margin: 5px 0 0 0; font-size: 12pt; font-weight: 900; color: #1e3a8a;">${visitData.followupDate}</p>
          </div>` : ''}
        </div>
      </div>

      <!-- Footer Info -->
      <div style="margin-top: 30px; border-top: 2px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div style="max-width: 60%;">
          <p style="margin: 0; font-size: 8pt; color: #64748b;"><b>Service:</b> ${visitData.serviceName}</p>
          <p style="margin: 4px 0 0 0; font-size: 7pt; color: #94a3b8; font-style: italic;">Digitally authenticated summary from XzeCure Clinical Node.</p>
        </div>
        <div style="text-align: right;">
          <div style="background: #10b981; color: #ffffff; padding: 12px 25px; border-radius: 12px; display: inline-block;">
            <p style="margin: 0; font-size: 8pt; font-weight: 900; opacity: 0.9;">TOTAL FEE</p>
            <p style="margin: 0; font-size: 18pt; font-weight: 900;">₹${visitData.serviceCharge}</p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  
  try {
    const canvas = await html2canvas(container, { 
      scale: 2.5, 
      useCORS: true, 
      backgroundColor: '#ffffff',
      logging: false
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    pdf.setProperties({
      title: `XzeCure_${visitData.patientName}`,
      subject: btoa(unescape(encodeURIComponent(JSON.stringify(visitData)))),
      author: 'XzeCure Health'
    });

    // Page 1
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'MEDIUM');
    pdf.link(140, 255, 55, 25, { url: `upi://pay?pa=8200095781@pthdfc&pn=KenilShah&am=${visitData.serviceCharge}&cu=INR` });
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
      pdf.addImage(photoUrl, 'JPEG', x, y, finalW, finalH, undefined, 'MEDIUM');
      drawFooter(pdf);
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
};