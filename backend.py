import os
import sys
import json
import sqlite3
import io
import csv
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler

# Import your separate backup script (PyInstaller bundles this automatically)
import backup

# ==========================================
# 🔑 PORTABILITY & RUNTIME PATH CONTROLLER
# ==========================================
if getattr(sys, 'frozen', False):
    # PyInstaller bundle execution path
    FRONTEND_DIR = sys._MEIPASS
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # Standard Python execution path
    FRONTEND_DIR = os.path.dirname(os.path.abspath(__file__))
    BASE_DIR = FRONTEND_DIR

# Ensures workforce.db sits outside the temp folder right beside app.exe
DB_NAME = os.path.join(BASE_DIR, "workforce.db")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
CORS(app)


# ==========================================
# 💾 DATABASE INITIALIZATION & MIGRATIONS
# ==========================================
def init_db():
    """Initializes and migrates database schemas if needed."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. Employees Master Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            site TEXT,
            pos TEXT,
            pay_cycle TEXT DEFAULT 'Weekly',
            hourly_rate REAL,
            daily_rate REAL,
            shift TEXT,
            hire_date TEXT,
            rehire_date TEXT,
            termination_date TEXT,
            status TEXT DEFAULT 'Active',
            sss TEXT,
            philhealth TEXT,
            pagibig TEXT
        )
    ''')

    # Schema Migration Check for missing pay_cycle
    cursor.execute("PRAGMA table_info(employees)")
    columns = [col[1] for col in cursor.fetchall()]
    if "pay_cycle" not in columns:
        print("[MIGRATION] Adding 'pay_cycle' column to existing employees table...")
        cursor.execute("ALTER TABLE employees ADD COLUMN pay_cycle TEXT DEFAULT 'Weekly'")
    
    # 2. Attendance Register
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id TEXT,
            log_date TEXT, -- YYYY-MM-DD
            time_in TEXT,
            time_out TEXT,
            break_mins REAL,
            calculated_hours REAL,
            UNIQUE(employee_id, log_date),
            FOREIGN KEY(employee_id) REFERENCES employees(id)
        )
    ''')
    
    # 3. Payroll Transaction Archives
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS payroll_archives (
        archive_id INTEGER PRIMARY KEY AUTOINCREMENT,
        archive_period TEXT,
        archive_window TEXT,
        archive_timestamp TEXT,
        employee_id TEXT,
        name TEXT,
        hours_worked REAL,
        gross_pay REAL,
        net_pay REAL,
        deductions_json TEXT
    )
''')

    cursor.execute("PRAGMA table_info(payroll_archives)")
    columns = [col[1] for col in cursor.fetchall()]

    if "archive_window" not in columns:
        cursor.execute(
            "ALTER TABLE payroll_archives ADD COLUMN archive_window TEXT DEFAULT ''"
        )

    conn.commit()
    conn.close()

# ==========================================
# ⏰ AUTOMATED DAILY BACKUP SCHEDULER
# ==========================================
def init_backup_scheduler():
    """Initializes background auto-backup triggers."""
    scheduler = BackgroundScheduler(daemon=True)
    
    # Option 1: Automatic daily midnight backup
    scheduler.add_job(backup.execute_backup, 'cron', hour=0, minute=0, args=["AUTO_DAILY"])
    
    # Option 2: Automatic backup on app startup (catches forgotten commits)
    backup.execute_backup("APP_STARTUP")
    
    scheduler.start()
    print("⏰ [SCHEDULER] Background auto-backup scheduler active.")


# ==========================================
# 🌐 FRONTEND STATIC ROUTING MAPS
# ==========================================
@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'dashboard.html')

@app.route('/<path:path>')
def serve_pages(path):
    return send_from_directory(FRONTEND_DIR, path)


# ==========================================
# 👥 EMPLOYEES MANAGED API ROUTES
# ==========================================
@app.route('/api/employees', methods=['GET'])
def get_employees():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM employees")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row["id"], 
            "name": row["name"], 
            "site": row["site"], 
            "pos": row["pos"],
            "payCycle": row["pay_cycle"] or "Weekly",
            "hourlyRate": row["hourly_rate"], 
            "dailyRate": row["daily_rate"], 
            "shift": row["shift"],
            "hire": row["hire_date"], 
            "rehire": row["rehire_date"], 
            "termination": row["termination_date"],
            "status": row["status"], 
            "sss": row["sss"], 
            "philhealth": row["philhealth"], 
            "pagibig": row["pagibig"]
        })
    return jsonify(result)

@app.route('/api/employees/add', methods=['POST'])
def add_employee():
    data = request.json
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO employees (
                id, name, site, pos, pay_cycle, hourly_rate, daily_rate, 
                shift, hire_date, rehire_date, termination_date, status, sss, philhealth, pagibig
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['id'], data['name'], data['site'], data['pos'], data.get('payCycle', 'Weekly'),
            data['hourlyRate'], data['dailyRate'], data['shift'], data['hire'], 
            data['rehire'], data['termination'], data['status'], data['sss'], 
            data['philhealth'], data['pagibig']
        ))
        conn.commit()
        conn.close()
        return jsonify({"message": "Successfully added."}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400

@app.route('/api/employees/update/<emp_id>', methods=['POST'])
def update_employee(emp_id):
    data = request.json
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE employees 
            SET name=?, site=?, pos=?, pay_cycle=?, hourly_rate=?, daily_rate=?, 
                shift=?, rehire_date=?, termination_date=?, status=?, sss=?, philhealth=?, pagibig=?
            WHERE id=?
        ''', (
            data['name'], data['site'], data['pos'], data.get('payCycle', 'Weekly'),
            data['hourlyRate'], data['dailyRate'], data['shift'], data['rehire'], 
            data['termination'], data['status'], data['sss'], data['philhealth'], 
            data['pagibig'], emp_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"message": "Successfully updated."}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400


# ==========================================
# ⏰ ATTENDANCE LOGGING ENDPOINTS
# ==========================================
@app.route('/api/attendance/day', methods=['GET'])
def get_attendance_day():
    target_day = request.args.get('day')
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT e.id, e.name, e.pos, a.time_in, a.time_out, a.break_mins, a.calculated_hours 
        FROM employees e
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.log_date = ?
        WHERE e.status = 'Active'
    ''', (target_day,))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row["id"], "name": row["name"], "pos": row["pos"],
            "timeIn": row["time_in"], "timeOut": row["time_out"],
            "breakMins": row["break_mins"], "loggedHours": row["calculated_hours"]
        })
    return jsonify(result)

@app.route('/api/attendance/save-row', methods=['POST'])
def save_attendance_row():
    data = request.json
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO attendance (employee_id, log_date, time_in, time_out, break_mins, calculated_hours)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(employee_id, log_date) DO UPDATE SET
                time_in=excluded.time_in, time_out=excluded.time_out, 
                break_mins=excluded.break_mins, calculated_hours=excluded.calculated_hours
        ''', (data['id'], data['day'], data['timeIn'], data['timeOut'], data['breakMins'], data['calculatedHours']))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400

@app.route('/api/attendance/save-all', methods=['POST'])
def save_attendance_batch():
    data = request.json
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        for log in data['logs']:
            cursor.execute('''
                INSERT INTO attendance (employee_id, log_date, time_in, time_out, break_mins, calculated_hours)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(employee_id, log_date) DO UPDATE SET
                    time_in=excluded.time_in, time_out=excluded.time_out, 
                    break_mins=excluded.break_mins, calculated_hours=excluded.calculated_hours
            ''', (log['id'], log['day'], log['timeIn'], log['timeOut'], log['breakMins'], log['calculatedHours']))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400


# ==========================================
# 💵 PAYROLL CALCULATION & CLOSEOUT
# ==========================================
@app.route('/api/payroll/registry-data', methods=['GET'])
def get_payroll_registry():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT e.id, e.name, e.site, e.pos, e.pay_cycle, e.hourly_rate, e.sss, e.philhealth, e.pagibig,
               IFNULL(SUM(a.calculated_hours), 0) as total_week_hours
        FROM employees e
        LEFT JOIN attendance a ON e.id = a.employee_id
        WHERE e.status = 'Active'
        GROUP BY e.id
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        result.append({
            "id": row["id"], 
            "name": row["name"], 
            "site": row["site"], 
            "pos": row["pos"],
            "payCycle": row["pay_cycle"] or "Weekly",
            "hourlyRate": row["hourly_rate"], 
            "sss": row["sss"], 
            "philhealth": row["philhealth"],
            "pagibig": row["pagibig"], 
            "totalWeekHours": row["total_week_hours"]
        })
    return jsonify(result)

@app.route('/api/payroll/closeout', methods=['POST'])
def closeout_payroll():
    data = request.json
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        timestamp = datetime.now().isoformat()
        period_type = data.get('period_type', 'WEEKLY').upper()
        archive_window = data.get('window', '')
        
        for row in data['current_payroll_rows']:
            deductions_dump = json.dumps(row['deductions_dump'])
            cursor.execute('''
                INSERT INTO payroll_archives (
                  archive_period,
                  archive_window,
                  archive_timestamp,
                  employee_id,
                  name,
                  hours_worked,
                  gross_pay,
                  net_pay,
                  deductions_json
                                   )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (period_type, archive_window, timestamp, row['id'], row['name'], row['hours'], row['gross'], row['net'], deductions_dump))
            
        conn.commit()
        conn.close()

        # Trigger backup on manual closeout
        backup.execute_backup(period_type)

        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400


# ==========================================
# 📊 REPORTS & DASHBOARD METRICS
# ==========================================
@app.route('/api/reports/generate', methods=['GET'])
def generate_report():
    report_type = request.args.get('type', 'Weekly').upper()
    window = request.args.get('window', '')
    
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT IFNULL(SUM(gross_pay), 0) as gross,
           IFNULL(SUM(net_pay), 0) as net,
           COUNT(DISTINCT employee_id) as cnt
    FROM payroll_archives
    WHERE archive_period = ?
      AND archive_window = ?
""", (report_type, window))
    summary_row = cursor.fetchone()
    
    cursor.execute("""
    SELECT employee_id,
           name,
           hours_worked,
           gross_pay,
           net_pay
    FROM payroll_archives
    WHERE archive_period = ?
      AND archive_window = ?
""", (report_type, window))
    archive_rows = cursor.fetchall()
    
    details = []
    for row in archive_rows:
        details.append({
            "id": row["employee_id"],
            "name": row["name"],
            "hours": row["hours_worked"],
            "gross": row["gross_pay"],
            "net": row["net_pay"],
            "status": "Archived"
        })

    if not details:
        cursor.execute("SELECT id, name, hourly_rate FROM employees WHERE status = 'Active'")
        active_staff = cursor.fetchall()
        for emp in active_staff:
            hr_rate = emp["hourly_rate"] or 0.0
            est_gross = round(hr_rate * 48.0, 2)
            details.append({
                "id": emp["id"],
                "name": emp["name"],
                "hours": 48.0,
                "gross": est_gross,
                "net": round(est_gross * 0.9, 2),
                "status": "Pending Closeout"
            })

    conn.close()
    
    return jsonify({
        "type": report_type, 
        "window": window,
        "grossTotal": round(summary_row["gross"], 2) if summary_row["gross"] > 0 else sum(d["gross"] for d in details), 
        "netTotal": round(summary_row["net"], 2) if summary_row["net"] > 0 else sum(d["net"] for d in details), 
        "staffCount": summary_row["cnt"] if summary_row["cnt"] > 0 else len(details),
        "details": details
    }), 200


@app.route('/api/dashboard/metrics', methods=['GET'])
def get_dashboard_metrics():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM employees WHERE status = 'Active'")
        active_count = cursor.fetchone()[0]

        cursor.execute("SELECT IFNULL(AVG(hourly_rate), 0) FROM employees WHERE status = 'Active'")
        avg_rate = cursor.fetchone()[0]

        cursor.execute("SELECT IFNULL(SUM(gross_pay), 0) FROM payroll_archives WHERE archive_period = 'WEEKLY'")
        gross_weekly = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(DISTINCT e.id) 
            FROM employees e
            JOIN attendance a ON e.id = a.employee_id
            WHERE e.status = 'Active'
        """)
        pending_runs = cursor.fetchone()[0]

        conn.close()

        return jsonify({
            "activeWorkforce": active_count,
            "grossWeekly": round(gross_weekly, 2),
            "avgHourlyRate": round(avg_rate, 2),
            "pendingRuns": pending_runs
        }), 200

    except Exception as e:
        return jsonify({"message": str(e)}), 400
@app.route('/api/reports/summary-single', methods=['GET'])
def get_summary_single():
    report_type = request.args.get("type", "").upper()
    window = request.args.get("window", "")

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    total = 0

    if report_type == "DAILY":
        cursor.execute("""
            SELECT IFNULL(SUM(a.calculated_hours * e.hourly_rate),0)
            FROM attendance a
            JOIN employees e
            ON a.employee_id=e.id
            WHERE a.log_date=?
        """, (window,))
        total = cursor.fetchone()[0]

    elif report_type == "WEEKLY":
        cursor.execute("""
            SELECT IFNULL(SUM(net_pay),0)
            FROM payroll_archives
            WHERE archive_period='WEEKLY'
        """)
        total = cursor.fetchone()[0]

    elif report_type == "MONTHLY":
        cursor.execute("""
            SELECT IFNULL(SUM(net_pay),0)
            FROM payroll_archives
            WHERE archive_period IN ('MONTHLY','SEMI-MONTHLY')
        """)
        total = cursor.fetchone()[0]

    conn.close()

    return jsonify({
        "total": round(total,2)
    })
@app.route('/api/reports/summary-totals', methods=['GET'])
def get_reports_summary_totals():
    try:
        date = request.args.get("date", "")

        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        if date:
            cursor.execute("""
                SELECT IFNULL(SUM(a.calculated_hours * e.hourly_rate),0)
                FROM attendance a
                JOIN employees e
                ON a.employee_id=e.id
                WHERE a.log_date=?
            """, (date,))
        else:
            cursor.execute("""
                SELECT IFNULL(SUM(a.calculated_hours * e.hourly_rate),0)
                FROM attendance a
                JOIN employees e
                ON a.employee_id=e.id
            """)

        daily_total = cursor.fetchone()[0]

        cursor.execute("""
            SELECT IFNULL(SUM(net_pay),0)
            FROM payroll_archives
            WHERE archive_period='WEEKLY'
        """)
        weekly_total = cursor.fetchone()[0]

        cursor.execute("""
            SELECT IFNULL(SUM(net_pay),0)
            FROM payroll_archives
            WHERE archive_period IN ('MONTHLY','SEMI-MONTHLY')
        """)
        monthly_total = cursor.fetchone()[0]

        conn.close()

        return jsonify({
            "daily": round(daily_total,2),
            "weekly": round(weekly_total,2),
            "monthly": round(monthly_total,2)
        })

    except Exception as e:
        return jsonify({"message": str(e)}), 400
# ==========================================
# 📄 CLIENT-FRIENDLY EXPORT ENDPOINTS
# ==========================================
@app.route('/api/export/text', methods=['GET'])
def export_text_report():
    """Generates a highly readable, human-friendly text report for clients."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    report = []
    now_str = datetime.now().strftime('%B %d, %Y - %I:%M %p')

    # Header Box
    report.append("┌──────────────────────────────────────────────────────────────────────────┐")
    report.append("│                         PAYROLL & WORKFORCE SUMMARY                      │")
    report.append(f"│ Generated: {now_str:<61} │")
    report.append("└──────────────────────────────────────────────────────────────────────────┘")
    report.append("")

    # Section 1: Employee Directory
    report.append("============================================================================")
    report.append(" 👥 1. EMPLOYEE DIRECTORY")
    report.append("============================================================================")
    header = f" {'ID':<10} | {'NAME':<24} | {'POSITION':<15} | {'CYCLE':<12} | {'STATUS':<8}"
    report.append(header)
    report.append("-" * len(header))

    cursor.execute("SELECT id, name, pos, pay_cycle, status FROM employees")
    employees = cursor.fetchall()

    if employees:
        for emp in employees:
            emp_id = emp[0] or "N/A"
            name = emp[1] or "N/A"
            pos = emp[2] or "N/A"
            cycle = emp[3] or "Weekly"
            status = emp[4] or "Active"
            report.append(f" {emp_id:<10} | {name:<24} | {pos:<15} | {cycle:<12} | {status:<8}")
    else:
        report.append(" No employee records found.")

    report.append("\n")

    # Section 2: Attendance Logs
    report.append("============================================================================")
    report.append(" ⏰ 2. RECENT ATTENDANCE LOGS")
    report.append("============================================================================")
    att_header = f" {'DATE':<12} | {'EMPLOYEE NAME':<24} | {'IN':<8} | {'OUT':<8} | {'HRS WORKED':<10}"
    report.append(att_header)
    report.append("-" * len(att_header))

    cursor.execute("""
        SELECT a.log_date, e.name, a.time_in, a.time_out, a.calculated_hours 
        FROM attendance a 
        JOIN employees e ON a.employee_id = e.id
        ORDER BY a.log_date DESC
    """)
    logs = cursor.fetchall()

    if logs:
        for log in logs:
            date = log[0] or "N/A"
            name = log[1] or "N/A"
            time_in = log[2] or "--:--"
            time_out = log[3] or "--:--"
            hrs = f"{log[4]:.2f} hrs" if log[4] is not None else "0.00 hrs"
            report.append(f" {date:<12} | {name:<24} | {time_in:<8} | {time_out:<8} | {hrs:<10}")
    else:
        report.append(" No recent attendance records logged.")

    report.append("\n")

    # Section 3: Payroll Closeout Summary
    report.append("============================================================================")
    report.append(" 💰 3. PAYROLL CLOSEOUT ARCHIVE")
    report.append("============================================================================")
    pay_header = f" {'PERIOD':<10} | {'NAME':<24} | {'HOURS':<8} | {'GROSS PAY':<12} | {'NET PAY':<12}"
    report.append(pay_header)
    report.append("-" * len(pay_header))

    cursor.execute("""
        SELECT archive_period, name, hours_worked, gross_pay, net_pay 
        FROM payroll_archives
        ORDER BY archive_id DESC
    """)
    archives = cursor.fetchall()

    if archives:
        for arch in archives:
            period = arch[0] or "N/A"
            name = arch[1] or "N/A"
            hrs = f"{arch[2]:.1f}" if arch[2] else "0.0"
            gross = f"PHP {arch[3]:,.2f}" if arch[3] else "PHP 0.00"
            net = f"PHP {arch[4]:,.2f}" if arch[4] else "PHP 0.00"
            report.append(f" {period:<10} | {name:<24} | {hrs:<8} | {gross:<12} | {net:<12}")
    else:
        report.append(" No historical payroll closeouts recorded yet.")

    report.append("\n============================================================================")
    report.append("                            *** END OF REPORT ***")
    report.append("============================================================================")

    conn.close()

    return Response(
        "\n".join(report),
        mimetype="text/plain; charset=utf-8",
        headers={"Content-Disposition": "attachment;filename=Payroll_Report.txt"}
    )

@app.route('/api/export/csv', methods=['GET'])
def export_csv_report():
    """Generates a CSV report ready for Excel."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT e.id, e.name, e.site, e.pos, e.pay_cycle, 
               IFNULL(p.gross_pay, 0), IFNULL(p.net_pay, 0), IFNULL(p.archive_period, 'PENDING')
        FROM employees e
        LEFT JOIN payroll_archives p ON e.id = p.employee_id
    """)
    rows = cursor.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Employee ID', 'Name', 'Site', 'Position', 'Pay Cycle', 'Gross Pay', 'Net Pay', 'Status'])

    for row in rows:
        writer.writerow(row)

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=Payroll_Summary.csv"}
    )

import webbrowser
from threading import Timer

def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000/')

# ==========================================
# 🚀 APP STARTUP RUNNER
# ==========================================
init_db()
init_backup_scheduler()

if __name__ == '__main__':
    # Automatically launches browser tab 1.5 seconds after app starts
    Timer(1.5, open_browser).start()
    app.run(host='127.0.0.1', port=5000, debug=False)
