// 🧼 Cleaned for Production Deployment (Mock Data Removed)
async function loadAttendanceSheet() {
  const tbody = document.getElementById('attendance-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const selectedDay = document.getElementById('attendance-day').value;

  try {
    // Queries the live database roster configuration details from your backend maps
    const response = await fetch(`/api/attendance/day?day=${selectedDay}`);
    if (!response.ok) throw new Error("Could not pull attendance matrix items.");
    
    const activeStaff = await response.json();

    activeStaff.forEach(emp => {
      // Pulls dynamic database configurations directly
      const savedHours = parseFloat(emp.loggedHours) || 0;
      const timeInValue = emp.timeIn || "08:00";
      const timeOutValue = emp.timeOut || "17:00";
      const breakValue = emp.breakMins !== undefined ? emp.breakMins : 60;

      tbody.innerHTML += `
        <tr data-id="${emp.id}">
          <td style="font-weight:700; color:#1565c0;">${emp.id}</td>
          <td style="font-weight:700;">${emp.name}</td>
          <td>${emp.pos}</td>
          <td><input type="time" class="input-inline attn-in" value="${timeInValue}"></td>
          <td><input type="time" class="input-inline attn-out" value="${timeOutValue}"></td>
          <td><input type="number" class="input-inline attn-break" value="${breakValue}" min="0" style="width:70px;"></td>
          <td class="row-calculated-hours" style="font-weight:700; color:#2e7d32;">${savedHours.toFixed(2)} hrs</td>
          <td>
            <button class="btn-utility save-row-btn" style="padding: 6px 12px; font-size:0.85em; background:#e8f5e9; border-color:#4caf50; width: auto;">💾 Save Log</button>
          </td>
        </tr>
      `;
    });

    document.querySelectorAll('.save-row-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        saveEmployeeRow(this.closest('tr'));
      });
    });

  } catch (err) {
    console.error("Attendance operational failure:", err);
    alert("Connection Error: Failed to drop attendance log frames from backend database.");
  }
}

function calculateRowHours(row) {
  const timeIn = row.querySelector('.attn-in').value;
  const timeOut = row.querySelector('.attn-out').value;
  const breakMins = parseFloat(row.querySelector('.attn-break').value) || 0;

  if (!timeIn || !timeOut) return null;

  const todayStr = "2026-01-01"; 
  const dateIn = new Date(`${todayStr} ${timeIn}`);
  let dateOut = new Date(`${todayStr} ${timeOut}`);

  if (dateOut < dateIn) {
    dateOut = new Date("2026-01-02 " + timeOut);
  }

  const timeDiffMs = dateOut - dateIn;
  let totalHours = timeDiffMs / (1000 * 60 * 60); 
  totalHours -= (breakMins / 60); 

  return Math.max(0, totalHours);
}

async function saveEmployeeRow(row) {
  const employeeId = row.getAttribute('data-id');
  const selectedDay = document.getElementById('attendance-day').value;
  const finalHours = calculateRowHours(row);

  if (finalHours === null) {
    alert("Please completely enter both Time-In and Time-Out markers.");
    return;
  }

  const payload = {
    id: employeeId,
    day: selectedDay,
    timeIn: row.querySelector('.attn-in').value,
    timeOut: row.querySelector('.attn-out').value,
    breakMins: parseFloat(row.querySelector('.attn-break').value) || 0,
    calculatedHours: parseFloat(finalHours.toFixed(2))
  };

  try {
    const response = await fetch('/api/attendance/save-row', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Database rejected individual row commit request.");

    row.querySelector('.row-calculated-hours').textContent = `${finalHours.toFixed(2)} hrs`;
    row.style.background = "#f1f8e9";
    setTimeout(() => row.style.background = "transparent", 600);
  } catch (err) {
    console.error("Row log transactional error:", err);
    alert("Save Fault: Unable to sync attendance timestamp item changes to backend database.");
  }
}

async function saveAllRows() {
  const rows = document.querySelectorAll('#attendance-body tr');
  if (rows.length === 0) return;

  const selectedDay = document.getElementById('attendance-day').value;
  const packagePayload = [];
  let hasErrors = false;

  rows.forEach(row => {
    const employeeId = row.getAttribute('data-id');
    const finalHours = calculateRowHours(row);

    if (finalHours !== null) {
      packagePayload.push({
        id: employeeId,
        day: selectedDay,
        timeIn: row.querySelector('.attn-in').value,
        timeOut: row.querySelector('.attn-out').value,
        breakMins: parseFloat(row.querySelector('.attn-break').value) || 0,
        calculatedHours: parseFloat(finalHours.toFixed(2))
      });
      
      row.querySelector('.row-calculated-hours').textContent = `${finalHours.toFixed(2)} hrs`;
      row.style.background = "#e3f2fd";
      setTimeout(() => row.style.background = "transparent", 800);
    } else {
      hasErrors = true;
    }
  });

  try {
    const response = await fetch('/api/attendance/save-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day: selectedDay, logs: packagePayload })
    });

    if (!response.ok) throw new Error("Server engine calculation database batch error.");

    if (hasErrors) {
      alert("Some records were skipped because Time-In or Time-Out parameters were incomplete.");
    } else {
      alert("SUCCESS: All active roster timecards have been successfully updated!");
    }
  } catch (err) {
    console.error("Batch tracking pipeline break:", err);
    alert("Sync Fault: Failed to push complete tracking set upstream.");
  }
}

function exportDailyCSV() {
  const selectedDay = document.getElementById('attendance-day').value;
  const rows = document.querySelectorAll('#attendance-body tr');
  
  if (rows.length === 0) {
    alert("There are no active shift items to parse into a report.");
    return;
  }

  let csvContent = "EMPLOYEE ID,FULL NAME,DESIGNATED POSITION,TIME IN,TIME OUT,BREAK (MINS),CALCULATED HOURS\n";

  rows.forEach(row => {
    const id = row.cells[0].textContent.trim();
    const name = row.cells[1].textContent.trim();
    const position = row.cells[2].textContent.trim();
    const timeIn = row.querySelector('.attn-in').value;
    const timeOut = row.querySelector('.attn-out').value;
    const breakMins = row.querySelector('.attn-break').value;
    const computedHours = row.querySelector('.row-calculated-hours').textContent.replace(' hrs', '').trim();

    csvContent += `"${id}","${name}","${position}","${timeIn}","${timeOut}","${breakMins}","${computedHours}"\n`;
  });

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", `Daily_Attendance_Report_${selectedDay}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

document.addEventListener("DOMContentLoaded", () => {
  loadAttendanceSheet();
  
  document.getElementById('attendance-day').addEventListener('change', loadAttendanceSheet);

  const saveAllBtn = document.getElementById('btn-save-all-attendance');
  if (saveAllBtn) saveAllBtn.addEventListener('click', saveAllRows);

  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) exportBtn.addEventListener('click', exportDailyCSV);
});