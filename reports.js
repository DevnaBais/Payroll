async function loadReportSummaries() {
  try {
    const response = await fetch('/api/reports/summary-totals');
    if (!response.ok) throw new Error("Could not fetch summary totals.");

    const totals = await response.json();

    const dailyEl = document.getElementById('sum-daily');
    const weeklyEl = document.getElementById('sum-weekly');
    const monthlyEl = document.getElementById('sum-monthly');

    if (dailyEl) dailyEl.textContent = `₱${totals.daily.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (weeklyEl) weeklyEl.textContent = `₱${totals.weekly.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (monthlyEl) monthlyEl.textContent = `₱${totals.monthly.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  } catch (err) {
    console.error("Report totals load failure:", err);
  }
}

async function runExport(type, value) {
  const banner = document.getElementById('notify');
  
  if (!value) {
    alert(`Please choose a targeted time cycle range before requesting an export query for: ${type}`);
    return;
  }

  try {
    const response = await fetch(`/api/reports/generate?type=${type}&window=${value}`);
    if (!response.ok) throw new Error("Compliance data compilation failure.");
    
    const serverReportData = await response.json();
    
    if (banner) {
      banner.innerHTML = `<strong>SUCCESS:</strong> Processing and downloading legal compliance package for <strong>${type}</strong> window target: <strong>[${value}]</strong>`;
      banner.style.display = "block";
      setTimeout(() => banner.style.display = "none", 4000);
    }

    let csvData = `Target Cycle,Period Stamp,Gross Total Generated,Net Paid,Active Workforce Count\n`;
    csvData += `"${serverReportData.type}","${serverReportData.window}",${serverReportData.grossTotal},${serverReportData.netTotal},${serverReportData.staffCount}\n`;
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvData], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Payroll_Audit_${type}_${value}.csv`;
    link.click();

  } catch (err) {
    console.error("Legal ledger compile failure:", err);
    alert("Connection Error: Server could not aggregate database rows for selected time window.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadReportSummaries();

  const dailyBtn = document.getElementById('btn-exp-daily');
  const weeklyBtn = document.getElementById('btn-exp-weekly');
  const monthlyBtn = document.getElementById('btn-exp-monthly');

  if (dailyBtn) {
    dailyBtn.addEventListener('click', () => {
      runExport('Daily', document.getElementById('d-date').value);
    });
  }
  
  if (weeklyBtn) {
    weeklyBtn.addEventListener('click', () => {
      runExport('Weekly', document.getElementById('w-week').value);
    });
  }
  
  if (monthlyBtn) {
    monthlyBtn.addEventListener('click', () => {
      runExport('Monthly', document.getElementById('m-month').value);
    });
  }
});