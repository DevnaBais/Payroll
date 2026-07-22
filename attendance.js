// Automatically set the date picker to the current day on load
function setDefaultDate() {
  const dateInput = document.getElementById('attendance-day');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

async function loadAttendanceSheet() {
  const tbody = document.getElementById('attendance-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const selectedDate = document.getElementById('attendance-day').value;
  if (!selectedDate) return;

  try {
    // Queries the live database roster using the clean calendar date
    const response = await fetch(`/api/attendance/day?day=${selectedDate}`);
    if (!response.ok) throw new Error("Could not pull attendance matrix items.");
    
    const activeStaff = await response.json();

    activeStaff.forEach(emp => {
      const savedHours = parseFloat(emp.loggedHours) || 0;
      const timeInValue = emp.timeIn || "08:00";
      const timeOutValue = emp.timeOut || "17:00";
      const breakValue = emp.breakMins !== undefined ? emp.breakMins : 60;

      // ADDED: Renders the active date cleanly right next to the ID token marker 
      tbody.innerHTML += `
        <tr data-id="${emp.id}">
          <td style="font-weight:700; color:#1565c0;">${emp.id}</td>
          <td style="font-weight:600; color:#546e7a;">${selectedDate}</td>
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

    // Rebind calculated dynamically added operational events
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
  const selectedDate = document.getElementById('attendance-day').value;

  if (!timeIn || !timeOut || !selectedDate) return null;

  // Uses the actual selected date calendar baseline for accurate day evaluations
  const dateIn = new Date(`${selectedDate}T${timeIn}`);
  let dateOut = new Date(`${selectedDate}T${timeOut}`);

  // Night shift handling: If Time Out is chronologically earlier than Time In, push it to the next morning
  if (dateOut < dateIn) {
    dateOut.setDate(dateOut.getDate() + 1);
  }

  const timeDiffMs = dateOut - dateIn;
  let totalHours = timeDiffMs / (1000 * 60 * 60); 
  totalHours -= (breakMins / 60); 

  return Math.max(0, totalHours);
}

async function saveEmployeeRow(row) {
  const employeeId = row.getAttribute('data-id');
  const selectedDate = document.getElementById('attendance-day').value;
  const finalHours = calculateRowHours(row);

  if (finalHours === null) {
    alert("Please completely enter both Time-In and Time-Out markers.");
    return;
  }

  const payload = {
    id: employeeId,
    day: selectedDate, // Sends full 'YYYY-MM-DD' structure upstream
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

  const selectedDate = document.getElementById('attendance-day').value;
  const packagePayload = [];
  let hasErrors = false;

  rows.forEach(row => {
    const employeeId = row.getAttribute('data-id');
    const finalHours = calculateRowHours(row);

    if (finalHours !== null) {
      packagePayload.push({
        id: employeeId,
        day: selectedDate,
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
      body: JSON.stringify({ day: selectedDate, logs: packagePayload })
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
  const selectedDate = document.getElementById('attendance-day').value;
  const rows = document.querySelectorAll('#attendance-body tr');
  
  if (rows.length === 0) {
    alert("There are no active shift items to parse into a report.");
    return;
  }

  // UPDATED: Shifted structure headers to now account for the data tracking column
  let csvContent = "EMPLOYEE ID,LOGGED DATE,FULL NAME,DESIGNATED POSITION,TIME IN,TIME OUT,BREAK (MINS),CALCULATED HOURS\n";

  rows.forEach(row => {
    const id = row.cells[0].textContent.trim();
    const loggedDate = row.cells[1].textContent.trim(); // ADDED: Grabs the new column value
    const name = row.cells[2].textContent.trim();       // UPDATED: Shifted from cell 1 to index 2
    const position = row.cells[3].textContent.trim();   // UPDATED: Shifted from cell 2 to index 3
    const timeIn = row.querySelector('.attn-in').value;
    const timeOut = row.querySelector('.attn-out').value;
    const breakMins = row.querySelector('.attn-break').value;
    const computedHours = row.querySelector('.row-calculated-hours').textContent.replace(' hrs', '').trim();

    csvContent += `"${id}","${loggedDate}","${name}","${position}","${timeIn}","${timeOut}","${breakMins}","${computedHours}"\n`;
  });

  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", `Daily_Attendance_Report_${selectedDate}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

document.addEventListener("DOMContentLoaded", () => {
  setDefaultDate();
  loadAttendanceSheet();
  
  document.getElementById('attendance-day').addEventListener('change', loadAttendanceSheet);

  const saveAllBtn = document.getElementById('btn-save-all-attendance');
  if (saveAllBtn) saveAllBtn.addEventListener('click', saveAllRows);

  const exportBtn = document.getElementById('btn-export-csv');
  if (exportBtn) exportBtn.addEventListener('click', exportDailyCSV);
});