
/**
 * GOOGLE APPS SCRIPT CODE (Paste this into your Google Sheet Script Editor):
 * 
 * function doPost(e) {
 *   var sheetName = "SyncLogs";
 *   var data = JSON.parse(e.postData.contents);
 *   
 *   // Determine which tab to use based on data type
 *   if (data.type === "clinical_report") {
 *     sheetName = "ClinicalReports";
 *   } else if (data.type === "daily_vitals") {
 *     sheetName = "DailyVitals";
 *   }
 *   
 *   var ss = SpreadsheetApp.getActiveSpreadsheet();
 *   var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
 *   
 *   // Create headers if new sheet
 *   if (sheet.getLastRow() === 0) {
 *     if (data.type === "clinical_report") {
 *       sheet.appendRow(["Timestamp", "Visit ID", "Patient Name", "Contact", "Diagnosis", "Staff", "Location URL"]);
 *     } else {
 *       sheet.appendRow(["Timestamp", "Patient Name", "Phone", "BP", "Temp", "SpO2", "HR", "Sugar", "Weight", "Location URL"]);
 *     }
 *   }
 *   
 *   var row = [new Date()];
 *   if (data.type === "clinical_report") {
 *     row.push(data.visitId, data.patientName, data.contactNumber, data.diagnosis, data.staffName, data.location);
 *   } else {
 *     row.push(data.patientName, data.phone, data.bp, data.temp, data.spo2, data.hr, data.rbs, data.weight, data.location);
 *   }
 *   
 *   sheet.appendRow(row);
 *   return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
 * }
 */

import { APPS_SCRIPT_URL } from '../constants';

export const googleSheetService = {
  syncClinicalReport: async (reportData: any) => {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_DEPLOYED_URL')) return;
    
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Apps Script requires no-cors for simple triggers
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clinical_report',
          ...reportData
        })
      });
      console.log('Clinical report synced to cloud');
    } catch (error) {
      console.error('Cloud sync failed:', error);
    }
  },

  syncDailyVitals: async (vitalsData: any) => {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_DEPLOYED_URL')) return;

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'daily_vitals',
          ...vitalsData
        })
      });
      console.log('Daily vitals synced to cloud');
    } catch (error) {
      console.error('Cloud sync failed:', error);
    }
  }
};
