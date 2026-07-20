// 🧼 Cleaned for Production Deployment (Mock Data Removed)
let employees = [];
let currentEditId = null;

// Initialize memory state from the database via the Python API
async function loadEmployeesFromDatabase() {
  try {
    const response = await fetch('/api/employees');
    if (!response.ok) throw new Error("Could not fetch workforce records.");
    
    employees = await response.json();
    render();
  } catch (err) {
    console.error("Database connection fault:", err);
    alert("Connection Error: Failed to load employee roster from local server.");
  }
}

function showTab(tabName) {
  const tableWrapper = document.querySelector('.table-wrapper');
  const formElement = document.getElementById('form-anchor');
  
  if (tabName === 'form') {
    tableWrapper.style.display = 'none';
    formElement.style.display = 'block';
    
    if (currentEditId) {
      document.getElementById('form-title').textContent = "Modify Operational Profile Parameter Elements";
      document.getElementById('in-id').disabled = true;
      document.getElementById('in-hire').disabled = true;
    } else {
      document.getElementById('form-title').textContent = "Onboard New Employee";
      document.getElementById('in-id').disabled = false;
      document.getElementById('in-hire').disabled = false;
    }
  } else {
    tableWrapper.style.display = 'block';
    formElement.style.display = 'none';
    currentEditId = null;
  }
}

function render() {
  const tbody = document.getElementById('emp-table-body');
  if(!tbody) return;
  tbody.innerHTML = '';
  
  employees.forEach(e => {
    const displaySite = e.site || 'N/A';
    const displayPos = e.pos || 'N/A';
    
    const hourly = parseFloat(e.hourlyRate) || 0;
    const daily = parseFloat(e.dailyRate) || (hourly * 8) || 0;
    
    const sss = e.sss || 'N/A';
    const philhealth = e.philhealth || 'N/A';
    const pagibig = e.pagibig || 'N/A';
    const status = e.status || 'Active';

    tbody.innerHTML += `<tr>
      <td><button class="btn-utility edit-btn" style="padding:4px 8px; background:#ffb300; color:white; border:none; cursor:pointer;" data-id="${e.id}">Edit</button></td>
      <td style="font-weight:700; color:#1565c0;">${e.id}</td>
      <td style="font-weight:700;">${e.name}</td>
      <td>${displaySite}</td>
      <td>${displayPos}</td>
      <td>₱${daily.toFixed(2)}</td>
      <td style="font-weight:700;">₱${hourly.toFixed(2)}</td>
      <td>${sss}</td>
      <td>${philhealth}</td>
      <td>${pagibig}</td>
      <td><span class="status-tag ${status.toLowerCase()}">${status}</span></td>
    </tr>`;
  });
  
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      startEdit(this.getAttribute('data-id'));
    });
  });
}

function startEdit(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;
  currentEditId = id;

  document.getElementById('in-id').value = emp.id;
  document.getElementById('in-name').value = emp.name;
  document.getElementById('in-site').value = emp.site || '';
  document.getElementById('in-pos').value = emp.pos || '';
  
  const rawHourly = parseFloat(emp.hourlyRate) || 0;
  const rawDaily = rawHourly * 8;
  
  document.getElementById('in-hourly').value = rawHourly || '';
  document.getElementById('in-daily').value = `₱${rawDaily.toFixed(2)}`;
  
  document.getElementById('in-shift').value = emp.shift || "08:00 - 17:00";
  document.getElementById('in-hire').value = emp.hire || '';
  document.getElementById('in-rehire').value = (emp.rehire && emp.rehire !== "N/A") ? emp.rehire : "";
  document.getElementById('in-term').value = (emp.termination && emp.termination !== "N/A") ? emp.termination : "";
  document.getElementById('in-status').value = emp.status || "Active";
  
  document.getElementById('in-sss').value = (emp.sss && emp.sss !== "N/A") ? emp.sss.replace(/[- ]/g, '') : "";
  document.getElementById('in-philhealth').value = (emp.philhealth && emp.philhealth !== "N/A") ? emp.philhealth.replace(/[- ]/g, '') : "";
  document.getElementById('in-pagibig').value = (emp.pagibig && emp.pagibig !== "N/A") ? emp.pagibig.replace(/[- ]/g, '') : "";

  showTab('form');
}

async function saveHire() {
  const b = document.getElementById('alertBox');
  try {
    const idInput = document.getElementById('in-id').value.trim().toUpperCase();
    const nameInput = document.getElementById('in-name').value.trim().toUpperCase();
    const siteInput = document.getElementById('in-site').value.trim().toUpperCase();
    const posInput = document.getElementById('in-pos').value.trim().toUpperCase();
    const hourlyInput = parseFloat(document.getElementById('in-hourly').value);
    const shiftInput = document.getElementById('in-shift').value.trim().toUpperCase();
    const hireInput = document.getElementById('in-hire').value;
    const rehireInput = document.getElementById('in-rehire').value;
    const termInput = document.getElementById('in-term').value;
    let statusInput = document.getElementById('in-status').value;

    const sssInput = document.getElementById('in-sss').value.replace(/[- ]/g, '');
    const philInput = document.getElementById('in-philhealth').value.replace(/[- ]/g, '');
    const pagInput = document.getElementById('in-pagibig').value.replace(/[- ]/g, '');

    if (!nameInput) throw new Error("Employee full name identifier is required.");
    if (!siteInput) throw new Error("Operational Site deployment field is required.");
    if (!posInput) throw new Error("Position designation parameter is required.");
    if (isNaN(hourlyInput) || hourlyInput <= 0) throw new Error("Please enter a valid hourly rate parameter greater than 0.");
    if (!hireInput) throw new Error("Original initialization entry Hire Date is required.");

    const numericRegex = /^\d+$/;
    if (sssInput && (!numericRegex.test(sssInput) || sssInput.length !== 10)) {
      throw new Error("SSS Number input must be exactly 10 digits containing numbers only.");
    }
    if (philInput && (!numericRegex.test(philInput) || philInput.length !== 12)) {
      throw new Error("PhilHealth Number input must be exactly 12 digits containing numbers only.");
    }
    if (pagInput && (!numericRegex.test(pagInput) || pagInput.length !== 12)) {
      throw new Error("Pag-IBIG Number input must be exactly 12 digits containing numbers only.");
    }

    if (termInput) {
      statusInput = "Inactive";
      document.getElementById('in-status').value = "Inactive";
    }

    const computedDaily = parseFloat((hourlyInput * 8).toFixed(2));

    if (!currentEditId) {
      const lockConfirm = confirm(`⚠️ ATTENTION:\nThe Original Hire Date [${hireInput}] is permanent and cannot be edited after submission.\n\nAre you sure you want to continue?`);
      if (!lockConfirm) return;
    }

    const payload = {
      id: currentEditId || (idInput === "FAS-" || idInput === "" ? `FAS-${String(employees.length + 1).padStart(4, '0')}` : idInput),
      name: nameInput,
      site: siteInput,
      pos: posInput,
      dailyRate: computedDaily,
      hourlyRate: hourlyInput,
      shift: shiftInput || "08:00 - 17:00",
      hire: hireInput,
      rehire: rehireInput || "N/A",
      termination: termInput || "N/A",
      status: statusInput,
      sss: sssInput || "N/A",
      philhealth: philInput || "N/A",
      pagibig: pagInput || "N/A",
    };

    // Forward package data payload directly to the Python server routing maps
    const endpointUrl = currentEditId ? `/api/employees/update/${currentEditId}` : '/api/employees/add';
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Server rejected profile save attempt.");
    }

    await loadEmployeesFromDatabase();
    showTab('list');
    
    b.className = "success-banner";
    b.style.background = "";
    b.style.color = "";
    b.style.borderLeft = "";
    b.innerHTML = "<strong>SUCCESS:</strong> Workforce core parameters safely updated.";
    b.style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => b.style.display = "none", 4000);

  } catch (err) {
    b.className = ""; 
    b.style.background = "#ffebee";
    b.style.color = "#c62828";
    b.style.borderLeft = "5px solid #c62828";
    b.style.padding = "15px";
    b.style.marginBottom = "20px";
    b.style.borderRadius = "4px";
    b.innerHTML = `<strong>VALIDATION ERROR:</strong> ${err.message}`;
    b.style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadEmployeesFromDatabase();
  
  document.getElementById('in-hourly').addEventListener('input', function() {
    const val = parseFloat(this.value);
    document.getElementById('in-daily').value = !isNaN(val) ? `₱${(val * 8).toFixed(2)}` : "₱0.00";
  });

  document.getElementById('in-term').addEventListener('input', function() {
    if (this.value) document.getElementById('in-status').value = "Inactive";
  });

  document.getElementById('in-id').addEventListener('input', function() {
    if (!this.value.toUpperCase().startsWith("FAS-")) this.value = "FAS-";
  });

  document.getElementById('btn-scroll-add').addEventListener('click', () => {
    currentEditId = null;
    document.getElementById('in-id').value = "FAS-";
    document.getElementById('in-name').value = "";
    document.getElementById('in-site').value = "";
    document.getElementById('in-pos').value = "";
    document.getElementById('in-hourly').value = "";
    document.getElementById('in-daily').value = "₱0.00";
    document.getElementById('in-shift').value = "";
    document.getElementById('in-hire').value = "";
    document.getElementById('in-rehire').value = "";
    document.getElementById('in-term').value = "";
    document.getElementById('in-sss').value = "";
    document.getElementById('in-philhealth').value = "";
    document.getElementById('in-pagibig').value = "";
    showTab('form');
  });

  document.getElementById('btn-cancel-add').addEventListener('click', () => showTab('list'));
  document.getElementById('btn-save-hire').addEventListener('click', saveHire);
});