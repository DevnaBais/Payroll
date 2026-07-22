// ==========================================
// 🚀 INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  fetchSummaryTotals();

  // Attach dynamic change listeners to update individual card summaries on target date selection
  document.getElementById('d-date')?.addEventListener('change', (e) => fetchSpecificSummary('Daily', e.target.value));
  document.getElementById('w-week')?.addEventListener('change', (e) => fetchSpecificSummary('Weekly', e.target.value));
  document.getElementById('m-month')?.addEventListener('change', (e) => fetchSpecificSummary('Monthly', e.target.value));

  document.getElementById('btn-exp-daily')?.addEventListener('click', () => {
    runExport('Daily', document.getElementById('d-date').value);
  });

  document.getElementById('btn-exp-weekly')?.addEventListener('click', () => {
    runExport('Weekly', document.getElementById('w-week').value);
  });

  document.getElementById('btn-exp-monthly')?.addEventListener('click', () => {
    runExport('Monthly', document.getElementById('m-month').value);
  });
});

// ==========================================
// 📊 SUMMARY TOTALS CONTROLLER
// ==========================================
async function fetchSummaryTotals() {
  const dDate = document.getElementById('d-date')?.value;
  const wWeek = document.getElementById('w-week')?.value;
  const mMonth = document.getElementById('m-month')?.value;

  try {
    const response = await fetch(`/api/reports/summary-totals?date=${dDate}&week=${wWeek}&month=${mMonth}`);
    if (!response.ok) throw new Error('Failed to fetch summary totals');

    const data = await response.json();

    document.getElementById('sum-daily').innerText = formatCurrency(data.daily);
    document.getElementById('sum-weekly').innerText = formatCurrency(data.weekly);
    document.getElementById('sum-monthly').innerText = formatCurrency(data.monthly);
  } catch (err) {
    console.error("Error loading summary metrics:", err);
  }
}

async function fetchSpecificSummary(type, value) {
  if (!value) return;
  try {
    const response = await fetch(`/api/reports/summary-single?type=${type}&window=${encodeURIComponent(value)}`);
    if (!response.ok) return;

    const data = await response.json();
    const elemId = `sum-${type.toLowerCase()}`;
    const elem = document.getElementById(elemId);
    if (elem) elem.innerText = formatCurrency(data.total);
  } catch (err) {
    console.error(`Failed to refresh ${type} summary:`, err);
  }
}

// ==========================================
// 📥 EXPORT CSV CONTROLLER
// ==========================================
async function runExport(type, value) {
  const banner = document.getElementById('notify');

  if (!value) {
    alert(`Please select a valid date/window before exporting the ${type} report.`);
    return;
  }

  try {
    if (banner) {
      banner.innerHTML = `<strong>PROCESSING:</strong> Aggregating <strong>${type}</strong> ledger target: <strong>[${value}]</strong>...`;
      banner.style.display = 'block';
    }

    const response = await fetch(`/api/reports/generate?type=${encodeURIComponent(type)}&window=${encodeURIComponent(value)}`);
    if (!response.ok) throw new Error("Compliance data compilation failure.");

    const serverReportData = await response.json();

    let csvContent = `=== PAYROLL AUDIT & COMPLIANCE REPORT ===\n`;
    csvContent += `Report Type,${serverReportData.type || type}\n`;
    csvContent += `Target Period,${serverReportData.window || value}\n`;
    csvContent += `Generated On,${new Date().toLocaleString()}\n\n`;

    csvContent += `Target Cycle,Period Stamp,Gross Total Generated,Net Paid,Active Workforce Count\n`;
    csvContent += `"${serverReportData.type}","${serverReportData.window}",${formatCurrency(serverReportData.grossTotal)},${formatCurrency(serverReportData.netTotal)},${serverReportData.staffCount}\n`;

    if (Array.isArray(serverReportData.details) && serverReportData.details.length > 0) {
      csvContent += `\n=== INDIVIDUAL LINE ITEMS ===\n`;
      csvContent += `Employee ID,Employee Name,Hours Worked,Gross Pay,Net Pay,Status\n`;

      serverReportData.details.forEach(item => {
        csvContent += `"${item.id}","${item.name}",${item.hours},${formatCurrency(item.gross)},${formatCurrency(item.net)},"${item.status}"\n`;
      });
    }

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], {
      type: 'text/csv;charset=utf-8;'
    });

    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    const cleanWindowStr = String(value).replace(/[^a-zA-Z0-9]/g, '-');

    link.href = blobUrl;
    link.download = `Payroll_Audit_${type}_${cleanWindowStr}.csv`;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

    if (banner) {
      banner.innerHTML = `<strong>SUCCESS:</strong> Export completed for <strong>${type}</strong> window target: <strong>[${value}]</strong>`;
      setTimeout(() => { banner.style.display = 'none'; }, 4000);
    }

  } catch (err) {
    console.error("Legal ledger compile failure:", err);
    if (banner) banner.style.display = 'none';
    alert("Connection Error: Unable to fetch report data for the selected window.");
  }
}

// Helper Utilities
function formatCurrency(amount) {
  return `₱${(parseFloat(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}