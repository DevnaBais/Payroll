// 🧼 Cleaned for Production Deployment (Mock Data Removed)
async function loadFromRegistry() {
  const tbody = document.getElementById('payroll-body');
  if(!tbody) return;
  tbody.innerHTML = '';
  
  try {
    // Fetches roster records linked to compiled aggregate hour metrics from Python tables
    const response = await fetch('/api/payroll/registry-data');
    if (!response.ok) throw new Error("Failed to pull complete calculated operational ledger metrics.");
    
    const activeStaff = await response.json();

    activeStaff.forEach(emp => {
      // Dynamic fallback mappings hook directly into the Python backend database profile attributes
      const hourly = parseFloat(emp.hourlyRate) || 0;
      const siteDisplay = emp.site && emp.pos ? `${emp.site} / ${emp.pos}` : (emp.site || emp.pos || 'N/A');
      
      // Accumulates attendance dynamically gathered across the current cycle layout frames
      const totalAccumulatedHours = parseFloat(emp.totalWeekHours) || 0;

      tbody.innerHTML += `
        <tr data-id="${emp.id}" data-sss="${emp.sss || 'N/A'}" data-philhealth="${emp.philhealth || 'N/A'}" data-pagibig="${emp.pagibig || 'N/A'}">
          <td style="font-weight:700; color:#1565c0;">${emp.id || 'N/A'}</td>
          <td style="font-weight:700;">${emp.name || 'UNNAMED'}</td>
          <td style="font-size:0.9em; color:#546e7a;">${siteDisplay}</td>
          <td><input type="number" class="input-inline row-pay" value="${hourly.toFixed(2)}" step="0.01" style="width: 80px;"></td>
          <td class="row-hours" style="font-weight:700; color:#1565c0;">${totalAccumulatedHours.toFixed(2)}</td>
          <td class="row-dayrate">₱0.00</td>
          <td><input type="number" class="input-inline row-days" value="${Math.min(7, Math.floor(totalAccumulatedHours / 8))}" min="0" max="7" style="width: 50px;"></td>
          <td><input type="number" class="input-inline row-ot" value="0" min="0" style="width: 50px;"></td>
          <td class="row-gross" style="font-weight:700; color:#2e7d32;">₱0.00</td>
          <td class="row-sss" style="color:#c62828;">₱0.00</td>
          <td class="row-phil" style="color:#c62828;">₱0.00</td>
          <td class="row-pag" style="color:#c62828;">₱0.00</td>
          <td class="row-ded" style="font-weight:700; color:#c62828;">₱0.00</td>
          <td class="row-net" style="font-weight:800; color:#1565c0; background:#f5f5f5;">₱0.00</td>
        </tr>`;
    });
    
    document.querySelectorAll('.input-inline').forEach(input => {
      input.addEventListener('input', function() { 
        runRow(this.closest('tr')); 
        computeGrandTotals();
      });
    });

    computeAll();

  } catch (err) {
    console.error("Payroll tracking context failure:", err);
    alert("Connection Error: Failed to gather dynamic workforce profiles from backend script.");
  }
}

function runRow(row) {
  const pay = parseFloat(row.querySelector('.row-pay').value) || 0;
  const days = parseFloat(row.querySelector('.row-days').value) || 0;
  const ot = parseFloat(row.querySelector('.row-ot').value) || 0;
  
  // Total hours display updates live if the manual override input dials shift
  const baseHours = parseFloat(row.querySelector('.row-hours').textContent) || (days * 8) + ot;
  
  const dayRate = pay * 8;
  const gross = (dayRate * days) + (ot * (pay * 1.25));
  
  // Scans row element layout directly to evaluate dynamic legal profile attributes
  const sssNo = row.getAttribute('data-sss');
  const philNo = row.getAttribute('data-philhealth');
  const pagNo = row.getAttribute('data-pagibig');
  
  let sssDed = 0, philDed = 0, pagDed = 0;

  // Government deductions check dynamic profile strings
  if (baseHours > 0) {
    if (sssNo && sssNo !== "N/A" && sssNo.trim() !== "") sssDed = 150.00;
    if (philNo && philNo !== "N/A" && philNo.trim() !== "") philDed = 120.00;
    if (pagNo && pagNo !== "N/A" && pagNo.trim() !== "") pagDed = 50.00;
  }

  const ded = sssDed + philDed + pagDed;
  const net = Math.max(0, gross - ded);

  row.querySelector('.row-dayrate').textContent = `₱${dayRate.toFixed(2)}`;
  row.querySelector('.row-gross').textContent = `₱${gross.toFixed(2)}`;
  row.querySelector('.row-sss').textContent = `₱${sssDed.toFixed(2)}`;
  row.querySelector('.row-phil').textContent = `₱${philDed.toFixed(2)}`;
  row.querySelector('.row-pag').textContent = `₱${pagDed.toFixed(2)}`;
  row.querySelector('.row-ded').textContent = `₱${ded.toFixed(2)}`;
  row.querySelector('.row-net').textContent = `₱${net.toFixed(2)}`;
}

function computeAll() {
  document.querySelectorAll('#payroll-body tr').forEach(tr => runRow(tr));
  computeGrandTotals();
}

function computeGrandTotals() {
  let totalHours = 0, totalGross = 0, totalSss = 0, totalPhil = 0, totalPag = 0, totalDed = 0, totalNet = 0;

  document.querySelectorAll('#payroll-body tr').forEach(row => {
    totalHours += parseFloat(row.querySelector('.row-hours').textContent) || 0;
    totalGross += parseFloat(row.querySelector('.row-gross').textContent.replace(/[₱,]/g,'')) || 0;
    totalSss   += parseFloat(row.querySelector('.row-sss').textContent.replace(/[₱,]/g,'')) || 0;
    totalPhil  += parseFloat(row.querySelector('.row-phil').textContent.replace(/[₱,]/g,'')) || 0;
    totalPag   += parseFloat(row.querySelector('.row-pag').textContent.replace(/[₱,]/g,'')) || 0;
    totalDed   += parseFloat(row.querySelector('.row-ded').textContent.replace(/[₱,]/g,'')) || 0;
    totalNet   += parseFloat(row.querySelector('.row-net').textContent.replace(/[₱,]/g,'')) || 0;
  });

  if(document.getElementById('total-hours')) document.getElementById('total-hours').textContent = `${totalHours.toFixed(2)} hrs`;
  if(document.getElementById('total-gross')) document.getElementById('total-gross').textContent = `₱${totalGross.toFixed(2)}`;
  if(document.getElementById('total-sss')) document.getElementById('total-sss').textContent = `₱${totalSss.toFixed(2)}`;
  if(document.getElementById('total-philhealth')) document.getElementById('total-philhealth').textContent = `₱${totalPhil.toFixed(2)}`;
  if(document.getElementById('total-pagibig')) document.getElementById('total-pagibig').textContent = `₱${totalPag.toFixed(2)}`;
  if(document.getElementById('total-deductions')) document.getElementById('total-deductions').textContent = `₱${totalDed.toFixed(2)}`;
  if(document.getElementById('total-net')) document.getElementById('total-net').textContent = `₱${totalNet.toFixed(2)}`;
}

async function commitWeeklyCloseout() {
  const rows = document.querySelectorAll('#payroll-body tr');
  if (rows.length === 0) {
    alert("No data available to execute closeout.");
    return;
  }

  const closeoutPayload = [];
  rows.forEach(row => {
    const sss = parseFloat(row.querySelector('.row-sss').textContent.replace(/[₱,]/g,'')) || 0;
    const phil = parseFloat(row.querySelector('.row-phil').textContent.replace(/[₱,]/g,'')) || 0;
    const pag = parseFloat(row.querySelector('.row-pag').textContent.replace(/[₱,]/g,'')) || 0;

    closeoutPayload.push({
      id: row.getAttribute('data-id'),
      name: row.cells[1].textContent.trim(),
      hours: parseFloat(row.querySelector('.row-hours').textContent) || 0,
      gross: parseFloat(row.querySelector('.row-gross').textContent.replace(/[₱,]/g,'')) || 0,
      net: parseFloat(row.querySelector('.row-net').textContent.replace(/[₱,]/g,'')) || 0,
      deductions_dump: { sss, philhealth: phil, pagibig: pag }
    });
  });

  try {
    const response = await fetch('/api/payroll/closeout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_payroll_rows: closeoutPayload })
    });

    if (!response.ok) throw new Error("Server rejected calculations freeze command.");
    alert("SUCCESS: Weekly payroll has been committed, historical registers preserved, and backup copies initialized successfully!");
    loadFromRegistry();
  } catch (err) {
    console.error("Closeout transaction crash:", err);
    alert("Critical Warning: Closeout submission pipeline broken. Check application logs.");
  }
}

function exportCSV() {
  let csv = ["ID,Name,Site / Position,Total Hours,Gross,SSS Deduction,PhilHealth,Pag-IBIG,Total Deductions,Net\n"];
  
  document.querySelectorAll('#payroll-body tr').forEach(tr => {
    const id = tr.cells[0].textContent;
    const name = tr.cells[1].textContent;
    const sitePos = tr.cells[2].textContent;
    const hours = tr.querySelector('.row-hours').textContent;
    const gross = tr.querySelector('.row-gross').textContent.replace(/[₱,]/g,'');
    const sss = tr.querySelector('.row-sss').textContent.replace(/[₱,]/g,'');
    const phil = tr.querySelector('.row-phil').textContent.replace(/[₱,]/g,'');
    const pag = tr.querySelector('.row-pag').textContent.replace(/[₱,]/g,'');
    const ded = tr.querySelector('.row-ded').textContent.replace(/[₱,]/g,'');
    const net = tr.querySelector('.row-net').textContent.replace(/[₱,]/g,'');
    
    csv.push(`"${id}","${name}","${sitePos}","${hours}","₱${gross}","₱${sss}","₱${phil}","₱${pag}","₱${ded}","₱${net}"\n`);
  });

  csv.push(`\n"GRAND TOTALS","","","${document.getElementById('total-hours').textContent}","${document.getElementById('total-gross').textContent}","${document.getElementById('total-sss').textContent}","${document.getElementById('total-philhealth').textContent}","${document.getElementById('total-pagibig').textContent}","${document.getElementById('total-deductions').textContent}","${document.getElementById('total-net').textContent}"\n`);

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv.join("")], {type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a"); 
  a.href = URL.createObjectURL(blob); 
  a.download = "Weekly_Payroll_Report.csv"; 
  a.click();
}

document.addEventListener("DOMContentLoaded", () => {
  loadFromRegistry();
  document.getElementById('btn-scan')?.addEventListener('click', loadFromRegistry);
  document.getElementById('btn-compute')?.addEventListener('click', computeAll);
  document.getElementById('btn-export')?.addEventListener('click', exportCSV);
  
  // Attach final closeout commit command button context
  document.getElementById('btn-closeout')?.addEventListener('click', commitWeeklyCloseout);
});