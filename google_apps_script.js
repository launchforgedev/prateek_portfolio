/**
 * Google Apps Script for Portfolio Waitlist
 * This script handles form submissions from your portfolio website
 */

// Configuration
const SHEET_NAME = 'Waitlist'; // Name of the sheet tab
const NOTIFICATION_EMAIL = 'prateekact17@gmail.com'; // Your email for notifications

/**
 * Main function to handle POST requests
 */
function doPost(e) {
  try {
    // Parse the request data
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields
    if (!data.email) {
      return ContentService
        .createTextOutput(JSON.stringify({
          result: 'error',
          message: 'Email is required'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Get or create the spreadsheet
    const sheet = getOrCreateSheet();
    
    // Add headers if this is the first entry
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 4).setValues([
        ['Timestamp', 'Email', 'Source', 'Status']
      ]);
      
      // Format headers
      const headerRange = sheet.getRange(1, 1, 1, 4);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('white');
    }

    // Check for duplicate emails
    const emailColumn = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
    const isDuplicate = emailColumn.some(row => row[0] === data.email);

    // Prepare row data
    const timestamp = new Date();
    const rowData = [
      timestamp,
      data.email,
      data.source || 'Portfolio Waitlist',
      isDuplicate ? 'Duplicate' : 'New'
    ];

    // Add data to sheet
    sheet.appendRow(rowData);

    // Send notification email (only for new subscribers)
    if (!isDuplicate) {
      sendNotificationEmail(data.email, timestamp);
    }

    // Log the submission
    console.log(`Waitlist submission: ${data.email} at ${timestamp}`);

    return ContentService
      .createTextOutput(JSON.stringify({
        result: 'success',
        message: isDuplicate ? 'Email already exists in waitlist' : 'Successfully added to waitlist'
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error processing submission:', error);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        result: 'error',
        message: 'Internal server error'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      message: 'Portfolio Waitlist API is running',
      timestamp: new Date(),
      status: 'active'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get or create the spreadsheet and sheet
 */
function getOrCreateSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  let sheet;
  try {
    sheet = spreadsheet.getSheetByName(SHEET_NAME);
  } catch (error) {
    sheet = null;
  }
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    
    // Set up the sheet formatting
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange('B:B').setNumberFormat('@'); // Text format for emails
    
    // Set column widths
    sheet.setColumnWidth(1, 150); // Timestamp
    sheet.setColumnWidth(2, 250); // Email
    sheet.setColumnWidth(3, 120); // Source
    sheet.setColumnWidth(4, 100); // Status
  }
  
  return sheet;
}

/**
 * Send notification email when someone joins the waitlist
 */
function sendNotificationEmail(email, timestamp) {
  try {
    const subject = '🚀 New Waitlist Signup - LaunchForge Dev';
    const body = `
Hello Prateek,

You have a new waitlist signup!

📧 Email: ${email}
🕒 Time: ${timestamp.toLocaleString()}
🌐 Source: Portfolio Website

You can view all waitlist entries in your Google Sheet.

Best regards,
Your Portfolio Bot
    `;

    GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
    console.log(`Notification sent for new signup: ${email}`);
    
  } catch (error) {
    console.error('Failed to send notification email:', error);
  }
}

/**
 * Get waitlist statistics (useful for dashboard)
 */
function getWaitlistStats() {
  try {
    const sheet = getOrCreateSheet();
    const totalEntries = Math.max(0, sheet.getLastRow() - 1); // Subtract header row
    
    // Get unique emails count
    if (totalEntries === 0) {
      return {
        total: 0,
        unique: 0,
        duplicates: 0,
        lastSignup: 'None'
      };
    }
    
    const data = sheet.getRange(2, 1, totalEntries, 4).getValues();
    const uniqueEmails = new Set();
    let duplicateCount = 0;
    let lastSignup = null;
    
    data.forEach(row => {
      const [timestamp, email, source, status] = row;
      
      if (uniqueEmails.has(email)) {
        duplicateCount++;
      } else {
        uniqueEmails.add(email);
      }
      
      if (!lastSignup || timestamp > lastSignup) {
        lastSignup = timestamp;
      }
    });
    
    return {
      total: totalEntries,
      unique: uniqueEmails.size,
      duplicates: duplicateCount,
      lastSignup: lastSignup ? lastSignup.toLocaleString() : 'None'
    };
    
  } catch (error) {
    console.error('Error getting waitlist stats:', error);
    return { error: error.message };
  }
}

/**
 * Clean up duplicate entries (run manually if needed)
 */
function removeDuplicates() {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Keep track of seen emails and their first occurrence
    const seenEmails = new Map();
    const uniqueRows = [];
    
    rows.forEach((row, index) => {
      const email = row[1]; // Email is in column B (index 1)
      
      if (!seenEmails.has(email)) {
        seenEmails.set(email, index);
        uniqueRows.push(row);
      }
    });
    
    // Clear the sheet and rewrite with unique data
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    if (uniqueRows.length > 0) {
      sheet.getRange(2, 1, uniqueRows.length, headers.length).setValues(uniqueRows);
    }
    
    console.log(`Removed ${rows.length - uniqueRows.length} duplicate entries`);
    return `Cleaned up: ${rows.length - uniqueRows.length} duplicates removed`;
    
  } catch (error) {
    console.error('Error removing duplicates:', error);
    return `Error: ${error.message}`;
  }
}

/**
 * Export waitlist to CSV (for backup or external use)
 */
function exportWaitlistToCsv() {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    
    let csv = '';
    data.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    return csv;
    
  } catch (error) {
    console.error('Error exporting CSV:', error);
    return null;
  }
}