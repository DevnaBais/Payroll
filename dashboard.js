async function loadDashboardKPIs() {
  try {
    const response = await fetch('/api/dashboard/metrics');
    if (!response.ok) throw new Error("Could not fetch dashboard metrics.");

    const data = await response.json();

    const activeEl = document.getElementById('kpi-active-workforce');
    const grossEl = document.getElementById('kpi-gross-weekly');
    const avgEl = document.getElementById('kpi-avg-rate');
    const pendingEl = document.getElementById('kpi-pending-runs');

    if (activeEl) activeEl.textContent = `${data.activeWorkforce} Hires`;
    if (grossEl) grossEl.textContent = `₱${data.grossWeekly.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (avgEl) avgEl.textContent = `₱${data.avgHourlyRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    if (pendingEl) pendingEl.textContent = `${data.pendingRuns} Active`;

  } catch (err) {
    console.error("Dashboard metric fetch error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadDashboardKPIs();
});