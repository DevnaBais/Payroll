// ==========================================
// ⚙️ GLOBAL PAYROLL ENGINE STATE
// ==========================================
let allEmployees = [];
let currentCycle = 'WEEKLY'; // 'WEEKLY' or 'KINSENAS'

// ==========================================
// 🚀 INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  fetchPayrollRegistryData();

  document.getElementById('btn-scan')?.addEventListener('click', fetchPayrollRegistryData);
  document.getElementById('btn-compute')?.addEventListener('click', computeAllRows);
  document.getElementById('btn-export')?.addEventListener('click', exportPayrollToCSV);
  document.getElementById('btn-closeout')?.addEventListener('click', commitAndFreezeCloseout);
});

// ==========================================
// 🔄 TAB SWITCHING CONTROLLER
// ==========================================
function switchPayrollCycle(cycle) {
  currentCycle = cycle.toUpperCase();

  const tabWeekly = document.getElementById('tab-weekly');
  const tabKinsenas = document.getElementById('tab-kinsenas');
  const lblActiveCycle = document.getElementById('lbl-active-cycle');
  const payrollTitle = document.getElementById('payroll-title');
  const tableHeaderTitle = document.getElementById('table-header-title');

  if (currentCycle === 'WEEKLY') {
    tabWeekly?.classList.add('active');
    tabKinsenas?.classList.remove('active');
    if (lblActiveCycle) {
      lblActiveCycle.innerText = 'WEEKLY';
      lblActiveCycle.style.color = '#1565c0';
    }
    if (payrollTitle) payrollTitle.innerText = 'Weekly Payroll Processing';
    if (tableHeaderTitle) tableHeaderTitle.innerText = 'Active Workforce Weekly Calculation Sheet';
  } else {
    tabKinsenas?.classList.add('active');
    tabWeekly?.classList.remove('active');
    if (lblActiveCycle) {
      lblActiveCycle.innerText = 'KINSENAS (SEMI-MONTHLY)';
      lblActiveCycle.style.color = '#2e7d32';
    }
    if (payrollTitle) payrollTitle.innerText = 'Kinsenas Payroll Processing';
    if (tableHeaderTitle) tableHeaderTitle.innerText = 'Active Workforce Semi-Monthly Calculation Sheet';
  }

  renderPayrollTable();
}

// ==========================================
// 📥 FETCH DATA FROM BACKEND API
// ==========================================
async function fetchPayrollRegistryData() {
  try {
    const response = await fetch('/api/payroll/registry-data');
    if (!response.ok) throw new Error("Failed to load payroll registry.");
    
    allEmployees = await response.json();
    renderPayrollTable();
  } catch (err) {
    console.error("Fetch error:", err);
    alert("Connection Error: Unable to fetch payroll registry data.");
  }
}

// ==========================================
// 🎨 RENDER TABLE
// ==========================================
function renderPayrollTable() {
  const tbody = document.getElementById('payroll-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  const filteredEmployees = allEmployees.filter(emp => {
    const empCycle = (emp.payCycle || 'Weekly').toUpperCase();
    if (currentCycle === 'WEEKLY') {
      return empCycle === 'WEEKLY';
    } else {
      return empCycle === 'SEMI-MONTHLY' || empCycle === 'KINSENAS';
    }
  });

  if (filteredEmployees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="14" style="text-align:center; padding: 20px; color:#78909c;">
          No active employees assigned to <strong>${currentCycle}</strong> cycle.
        </td>
      </tr>`;
    resetTotals();
    return;
  }

  filteredEmployees.forEach(emp => {
    const tr = document.createElement('tr');
    tr.dataset.empId = emp.id;

    const hourlyRate = emp.hourlyRate || 0;
    const dailyRate = hourlyRate * 8;

    // 💡 Dynamic Hours Credit depending on active cycle view
    let hoursWorked = 0;
    if (currentCycle === 'WEEKLY') {
      hoursWorked = emp.weeklyHours ?? emp.totalWeekHours ?? 48.00;
    } else {
      hoursWorked = emp.kinsenasHours ?? emp.semiMonthlyHours ?? 96.00;
    }

    const daysWorked = (hoursWorked / 8).toFixed(1);

    tr.innerHTML = `
      <td><strong>${emp.id}</strong></td>
      <td>${emp.name}</td>
      <td><small>${emp.site || 'N/A'} / ${emp.pos || 'N/A'}</small></td>
      <td>₱${hourlyRate.toFixed(2)}</td>
      <td><input type="number" class="inp-hours" value="${parseFloat(hoursWorked).toFixed(2)}" style="width:70px;" oninput="syncDaysAndCompute(this.closest('tr'))"></td>
      <td>₱${dailyRate.toFixed(2)}</td>
      <td><input type="number" class="inp-days" value="${daysWorked}" style="width:50px;" oninput="syncHoursAndCompute(this.closest('tr'))"></td>
      <td><input type="number" class="inp-ot" value="0.00" style="width:60px;" oninput="computeRow(this.closest('tr'))"></td>
      <td class="cell-gross" style="font-weight:700; color:#2e7d32;">₱0.00</td>
      
      <!-- Statutory Deductions -->
      <td class="cell-sss" style="color:#c62828;">₱0.00</td>
      <td class="cell-philhealth" style="color:#c62828;">₱0.00</td>
      <td class="cell-pagibig" style="color:#c62828;">₱0.00</td>
      <td class="cell-total-ded" style="font-weight:700; color:#c62828;">₱0.00</td>
      
      <td class="cell-net" style="font-weight:800; color:#1565c0;">₱0.00</td>
    `;

    tr.dataset.hasSss = (emp.sss && emp.sss !== 'N/A') ? 'true' : 'false';
    tr.dataset.hasPhilhealth = (emp.philhealth && emp.philhealth !== 'N/A') ? 'true' : 'false';
    tr.dataset.hasPagibig = (emp.pagibig && emp.pagibig !== 'N/A') ? 'true' : 'false';
    tr.dataset.hourlyRate = hourlyRate;

    tbody.appendChild(tr);
    computeRow(tr);
  });

  updateGrandTotals();
}

// Sync Days Worked when Hours Credited is changed
function syncDaysAndCompute(tr) {
  const hours = parseFloat(tr.querySelector('.inp-hours').value) || 0;
  tr.querySelector('.inp-days').value = (hours / 8).toFixed(1);
  computeRow(tr);
}

// Sync Hours Credited when Days Worked is changed
function syncHoursAndCompute(tr) {
  const days = parseFloat(tr.querySelector('.inp-days').value) || 0;
  tr.querySelector('.inp-hours').value = (days * 8).toFixed(2);
  computeRow(tr);
}

// ==========================================
// 🧮 ROW CALCULATIONS
// ==========================================
function computeRow(tr) {
  const hourlyRate = parseFloat(tr.dataset.hourlyRate) || 0;
  const hoursCredited = parseFloat(tr.querySelector('.inp-hours').value) || 0;
  const otHours = parseFloat(tr.querySelector('.inp-ot').value) || 0;

  const regularPay = hoursCredited * hourlyRate;
  const otPay = otHours * (hourlyRate * 1.25);
  const grossPay = regularPay + otPay;

  let sss = 0.0;
  let philhealth = 0.0;
  let pagibig = 0.0;

  if (grossPay > 0) {
    if (tr.dataset.hasSss === 'true') {
      sss = roundTwoDecimals(grossPay * 0.045);
    }
    if (tr.dataset.hasPhilhealth === 'true') {
      philhealth = roundTwoDecimals(grossPay * 0.025);
    }
    if (tr.dataset.hasPagibig === 'true') {
      pagibig = currentCycle === 'WEEKLY' ? 50.00 : 100.00;
    }
  }

  const totalDeductions = sss + philhealth + pagibig;
  const netPay = Math.max(0, grossPay - totalDeductions);

  tr.querySelector('.cell-gross').innerText = formatCurrency(grossPay);
  tr.querySelector('.cell-sss').innerText = formatCurrency(sss);
  tr.querySelector('.cell-philhealth').innerText = formatCurrency(philhealth);
  tr.querySelector('.cell-pagibig').innerText = formatCurrency(pagibig);
  tr.querySelector('.cell-total-ded').innerText = formatCurrency(totalDeductions);
  tr.querySelector('.cell-net').innerText = formatCurrency(netPay);

  tr.dataset.calculatedGross = grossPay;
  tr.dataset.calculatedSss = sss;
  tr.dataset.calculatedPhilhealth = philhealth;
  tr.dataset.calculatedPagibig = pagibig;
  tr.dataset.calculatedTotalDed = totalDeductions;
  tr.dataset.calculatedNet = netPay;

  updateGrandTotals();
}

function computeAllRows() {
  const rows = document.querySelectorAll('#payroll-body tr');
  rows.forEach(tr => {
    if (tr.dataset.empId) computeRow(tr);
  });
  alert(`All payroll rows re-calculated for ${currentCycle} cycle.`);
}

// ==========================================
// 📊 FOOTER TOTALS
// ==========================================
function updateGrandTotals() {
  let totalHours = 0, totalGross = 0, totalSss = 0, totalPhil = 0, totalPagibig = 0, totalDed = 0, totalNet = 0;

  const rows = document.querySelectorAll('#payroll-body tr');
  rows.forEach(tr => {
    if (!tr.dataset.empId) return;

    totalHours += parseFloat(tr.querySelector('.inp-hours')?.value) || 0;
    totalGross += parseFloat(tr.dataset.calculatedGross) || 0;
    totalSss += parseFloat(tr.dataset.calculatedSss) || 0;
    totalPhil += parseFloat(tr.dataset.calculatedPhilhealth) || 0;
    totalPagibig += parseFloat(tr.dataset.calculatedPagibig) || 0;
    totalDed += parseFloat(tr.dataset.calculatedTotalDed) || 0;
    totalNet += parseFloat(tr.dataset.calculatedNet) || 0;
  });

  document.getElementById('total-hours').innerText = `${totalHours.toFixed(2)} hrs`;
  document.getElementById('total-gross').innerText = formatCurrency(totalGross);
  document.getElementById('total-sss').innerText = formatCurrency(totalSss);
  document.getElementById('total-philhealth').innerText = formatCurrency(totalPhil);
  document.getElementById('total-pagibig').innerText = formatCurrency(totalPagibig);
  document.getElementById('total-deductions').innerText = formatCurrency(totalDed);
  document.getElementById('total-net').innerText = formatCurrency(totalNet);
}

function resetTotals() {
  document.getElementById('total-hours').innerText = '0.00 hrs';
  document.getElementById('total-gross').innerText = '₱0.00';
  document.getElementById('total-sss').innerText = '₱0.00';
  document.getElementById('total-philhealth').innerText = '₱0.00';
  document.getElementById('total-pagibig').innerText = '₱0.00';
  document.getElementById('total-deductions').innerText = '₱0.00';
  document.getElementById('total-net').innerText = '₱0.00';
}

// ==========================================
// 📥 EXPORT & CLOSEOUT
// ==========================================
function exportPayrollToCSV() {
  const rows = document.querySelectorAll('#payroll-body tr');
  if (rows.length === 0 || !rows[0].dataset.empId) {
    alert("No active payroll data available to export.");
    return;
  }

  let csvContent = `=== ${currentCycle} PAYROLL CALCULATION SHEET ===\n`;
  csvContent += `Generated On,${new Date().toLocaleString()}\n\n`;
  csvContent += `Employee ID,Name,Hours Credited,Gross Pay,SSS,PhilHealth,Pag-IBIG,Total Deductions,Net Pay\n`;

  rows.forEach(tr => {
    if (!tr.dataset.empId) return;

    const id = tr.cells[0].innerText;
    const name = tr.cells[1].innerText;
    const hours = tr.querySelector('.inp-hours').value;
    const gross = tr.dataset.calculatedGross;
    const sss = tr.dataset.calculatedSss;
    const phil = tr.dataset.calculatedPhilhealth;
    const pagibig = tr.dataset.calculatedPagibig;
    const ded = tr.dataset.calculatedTotalDed;
    const net = tr.dataset.calculatedNet;

    csvContent += `"${id}","${name}",${hours},"${formatCurrency(gross)}","${formatCurrency(sss)}","${formatCurrency(phil)}","${formatCurrency(pagibig)}","${formatCurrency(ded)}","${formatCurrency(net)}"\n`;
  });

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Payroll_${currentCycle}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function commitAndFreezeCloseout() {
  const rows = document.querySelectorAll('#payroll-body tr');
  if (rows.length === 0 || !rows[0].dataset.empId) {
    alert("No payroll rows to commit.");
    return;
  }

  if (!confirm(`Are you sure you want to commit and freeze the ${currentCycle} payroll?`)) return;

  const payrollPayload = [];
  rows.forEach(tr => {
    if (!tr.dataset.empId) return;

    payrollPayload.push({
      id: tr.dataset.empId,
      name: tr.cells[1].innerText,
      hours: parseFloat(tr.querySelector('.inp-hours').value) || 0,
      gross: parseFloat(tr.dataset.calculatedGross) || 0,
      net: parseFloat(tr.dataset.calculatedNet) || 0,
      deductions_dump: {
        sss: parseFloat(tr.dataset.calculatedSss) || 0,
        philhealth: parseFloat(tr.dataset.calculatedPhilhealth) || 0,
        pagibig: parseFloat(tr.dataset.calculatedPagibig) || 0
      }
    });
  });

  try {
    const response = await fetch('/api/payroll/closeout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_type: currentCycle,
        current_payroll_rows: payrollPayload
      })
    });

    if (!response.ok) throw new Error("Closeout process failed.");

    alert(`SUCCESS: ${currentCycle} payroll closeout completed!`);
    fetchPayrollRegistryData();
  } catch (err) {
    console.error("Closeout error:", err);
    alert("Error executing payroll freeze closeout.");
  }
}

// Helper Utilities
function formatCurrency(amount) {
  return `₱${(parseFloat(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function roundTwoDecimals(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}