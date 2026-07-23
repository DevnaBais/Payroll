// ==========================================
// 🚀 INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  fetchSummaryTotals();

  // Dynamic change listeners to update individual card summaries on target selection
  document.getElementById('d-date')?.addEventListener('change', (e) => fetchSpecificSummary('Daily', e.target.value));
  document.getElementById('w-week')?.addEventListener('change', (e) => fetchSpecificSummary('Weekly', parseWeekInputValue(e.target.value)));
  document.getElementById('m-month')?.addEventListener('change', (e) => fetchSpecificSummary('Monthly', e.target.value));

  document.getElementById('btn-exp-daily')?.addEventListener('click', () => {
    const val = document.getElementById('d-date')?.value;
    runExport('Daily', val);
  });

  document.getElementById('btn-exp-weekly')?.addEventListener('click', () => {
    const rawVal = document.getElementById('w-week')?.value;
    const cleanDateVal = parseWeekInputValue(rawVal);
    runExport('Weekly', cleanDateVal);
  });

  document.getElementById('btn-exp-monthly')?.addEventListener('click', () => {
    const val = document.getElementById('m-month')?.value;
    runExport('Monthly', val);
  });
});

// FIXED: Returns a local YYYY-MM-DD string instead of using toISOString(),
// which converts to UTC and can shift the computed Monday back a day for
// PH (UTC+8) users, sending the wrong window date to the backend.
function getLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseWeekInputValue(weekStr) {
    if (!weekStr || !weekStr.includes("-W")) return weekStr || "";

    const [year, week] = weekStr.split("-W").map(Number);

    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);

    monday.setDate(
        jan4.getDate() -
        ((jan4.getDay() + 6) % 7) +
        (week - 1) * 7
    );

    return getLocalDateString(monday);
}

// ↓ OUTSIDE parseWeekInputValue()

async function fetchSummaryTotals() {
    try {
        const response = await fetch("/api/reports/summary-totals");
        const data = await response.json();

        document.getElementById("sum-daily").textContent = formatCurrency(data.daily);
        document.getElementById("sum-weekly").textContent = formatCurrency(data.weekly);
        document.getElementById("sum-monthly").textContent = formatCurrency(data.monthly);

    } catch (err) {
        console.error("Summary totals failed:", err);
    }
}

async function fetchSpecificSummary(type, window) {
    try {
        const response = await fetch(
            `/api/reports/summary-single?type=${encodeURIComponent(type)}&window=${encodeURIComponent(window)}`
        );

        const data = await response.json();

        if (type === "Daily")
            document.getElementById("sum-daily").textContent = formatCurrency(data.total);

        if (type === "Weekly")
            document.getElementById("sum-weekly").textContent = formatCurrency(data.total);

        if (type === "Monthly")
            document.getElementById("sum-monthly").textContent = formatCurrency(data.total);

    } catch (err) {
        console.error("Specific summary failed:", err);
    }
}

async function runExport(type, value) {
  const banner = document.getElementById("notify");

  if (!value) {
    alert(`Please select a valid ${type} period.`);
    return;
  }

  try {
    if (banner) {
      banner.style.display = "block";
      banner.innerHTML = `<strong>PROCESSING:</strong> Generating ${type} report...`;
    }

    const response = await fetch(
      `/api/reports/generate?type=${encodeURIComponent(type)}&window=${encodeURIComponent(value)}`
    );

    if (!response.ok) {
      throw new Error("Failed to generate report.");
    }

    const report = await response.json();

    let csv = "sep=,\r\n";
    csv += "PAYROLL AUDIT & COMPLIANCE REPORT\r\n";
    csv += `Report Type,${report.type || type}\r\n`;
    csv += `Target Period,${report.window || value}\r\n`;
    csv += `Generated On,${new Date().toLocaleString()}\r\n\r\n`;

    csv += "Target Cycle,Period Stamp,Gross Total,Net Total,Employee Count\r\n";
    csv += `"${report.type}","${report.window}",${csvNumber(report.grossTotal)},${csvNumber(report.netTotal)},${report.staffCount}\r\n`;

    if (Array.isArray(report.details) && report.details.length > 0) {
      csv += "\r\nEmployee ID,Employee Name,Hours Worked,Gross Pay,Net Pay,Deductions,Status\r\n";

      report.details.forEach(emp => {

        const gross = Number(emp.gross) || 0;
        const net = Number(emp.net) || 0;
        const deductions = gross - net;

        csv += [
          escapeCSV(emp.id),
          escapeCSV(emp.name),
          Number(emp.hours || 0).toFixed(2),
          csvNumber(gross),
          csvNumber(net),
          csvNumber(deductions),
          escapeCSV(emp.status)
        ].join(",") + "\r\n";

      });
    }

    const blob = new Blob(
      [new Uint8Array([0xEF, 0xBB, 0xBF]), csv],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `Payroll_Audit_${type}_${String(value).replace(/[^\w-]/g, "_")}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    if (banner) {
      banner.innerHTML = `<strong>SUCCESS:</strong> ${type} report exported successfully.`;
      setTimeout(() => {
        banner.style.display = "none";
      }, 4000);
    }

  } catch (err) {
    console.error(err);

    if (banner) banner.style.display = "none";

    alert("Unable to export report.");
  }
}

function csvNumber(value) {
  return Number(value || 0).toFixed(2);
}

function escapeCSV(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}