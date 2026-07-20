// 🧼 Cleaned for Production Deployment (Mock Data Removed)
async function runExport(type, value) {
  const banner = document.getElementById('notify');
  if(!banner) return;
  
  if (!value) {
    alert(`Please choose a targeted time cycle range before requesting an export query for: ${type}`);
    return;
  }

  try {
    // Hits Python server to build dynamic database compliance audit sheets
    const response = await fetch(`/api/reports/generate?type=${type}&window=${value}`);
    if (!response.ok) throw new Error("Compliance data compilation failure.");
    
    const serverReportData = await response.json();
    
    banner.innerHTML = `<strong>SUCCESS:</strong> Processing and downloading legal compliance package for <strong>${type}</strong> window target: <strong>[${value}]</strong>`;
    banner.style.display = "block";
    setTimeout(() => banner.style.display="none", 4000);

    let csvData = `Target Cycle,Period Stamp,Gross Total Generated,Net Paid,Active Workforce Count\n`;
    csvData += `"${serverReportData.type}","${serverReportData.window}",${serverReportData.grossTotal},${serverReportData.netTotal},${serverReportData.staffCount}\n`;
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvData], {type: "text/csv;charset=utf-8;"});
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
  document.getElementById('btn-exp-daily').addEventListener('click', () => {
    runExport('Daily', document.getElementById('d-date').value);
  });
  
  document.getElementById('btn-exp-weekly').addEventListener('click', () => {
    runExport('Weekly', document.getElementById('w-week').value);
  });
  
  document.getElementById('btn-exp-monthly').addEventListener('click', () => {
    runExport('Monthly', document.getElementById('m-month').value);
  });
});