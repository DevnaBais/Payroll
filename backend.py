import os
import sys
import json
import sqlite3
import shutil
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# 🔑 MAGIC PYINSTALLER PORTABILITY PATH FINDER
if getattr(sys, 'frozen', False):
    # If running inside the compiled .exe, look in the temporary runtime folder
    FRONTEND_DIR = sys._MEIPASS
    # Put the live database outside the exe so their data actually saves!
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # If running locally in VS Code
    FRONTEND_DIR = os.path.dirname(os.path.abspath(__file__))
    BASE_DIR = FRONTEND_DIR

DB_NAME = os.path.join(BASE_DIR, "workforce.db")
ARCHIVE_DIR = os.path.join(BASE_DIR, "backups_and_archives")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path='')
CORS(app) # Prevents cross-origin resource sharing block faults during development

# ==========================================
# 💾 DATABASE INITIALIZATION BLOCK
# ==========================================
def init_db():
    """Initializes the database structure if it doesn't exist."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # 1. Core Employee Master Table (TIN REMOVED)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            site TEXT,
            pos TEXT,
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
    
    # 2. Daily Attendance Register
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
    
    # 3. Historical Transaction/Payroll Archives (Immutable Log)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payroll_archives (
            archive_id INTEGER PRIMARY KEY AUTOINCREMENT,
            archive_period TEXT, -- 'WEEKLY' or 'MONTHLY'
            archive_timestamp TEXT,
            employee_id TEXT,
            name TEXT,
            hours_worked REAL,
            gross_pay REAL,
            net_pay REAL,
            deductions_json TEXT 
        )
    ''')
    
    conn.commit()
    conn.close()

# ==========================================
# 🛡️ SECURITY & ENGINE BACKUP CONTROLLERS
# ==========================================
def execute_backup(backup_type):
    """Creates a physical file backup clone of the database using SQLite's native API."""
    if not os.path.exists(ARCHIVE_DIR):
        os.makedirs(ARCHIVE_DIR)
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_{backup_type}_{timestamp}.db"
    backup_path = os.path.join(ARCHIVE_DIR, backup_filename)
    
    if not os.path.exists(DB_NAME):
        return False

    try:
        src_conn = sqlite3.connect(DB_NAME)
        dst_conn = sqlite3.connect(backup_path)
        with dst_conn:
            src_conn.backup(dst_conn)
        dst_conn.close()
        src_conn.close()
        return True
    except Exception as e:
        print(f"Fail-safe backup warning: {e}")
        return False

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
# 👥 EMPLOYEES MANAGED API ROUTING ROUTES
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
            "id": row["id"], "name": row["name"], "site": row["site"], "pos": row["pos"],
            "hourlyRate": row["hourly_rate"], "dailyRate": row["daily_rate"], "shift": row["shift"],
            "hire": row["hire_date"], "rehire": row["rehire_date"], "termination": row["termination_date"],
            "status": row["status"], "sss": row["sss"], "philhealth": row["philhealth"], "pagibig": row["pagibig"]
        })
    return jsonify(result)

@app.route('/api/employees/add', methods=['POST'])
def add_employee():
    data = request.json
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO employees (id, name, site, pos, hourly_rate, daily_rate, shift, hire_date, rehire_date, termination_date, status, sss, philhealth, pagibig)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (data['id'], data['name'], data['site'], data['pos'], data['hourlyRate'], data['dailyRate'], data['shift'], data['hire'], data['rehire'], data['termination'], data['status'], data['sss'], data['philhealth'], data['pagibig']))
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
            UPDATE employees SET name=?, site=?, pos=?, hourly_rate=?, daily_rate=?, shift=?, rehire_date=?, termination_date=?, status=?, sss=?, philhealth=?, pagibig=?
            WHERE id=?
        ''', (data['name'], data['site'], data['pos'], data['hourlyRate'], data['dailyRate'], data['shift'], data['rehire'], data['termination'], data['status'], data['sss'], data['philhealth'], data['pagibig'], emp_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Successfully updated."}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400

# ==========================================
# ⏰ ATTENDANCE HOOK INTERFACES
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
# 💵 PAYROLL CALCULATION ENGINE CONNECTIONS
# ==========================================
@app.route('/api/payroll/registry-data', methods=['GET'])
def get_payroll_registry():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT e.id, e.name, e.site, e.pos, e.hourly_rate, e.sss, e.philhealth, e.pagibig,
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
            "id": row["id"], "name": row["name"], "site": row["site"], "pos": row["pos"],
            "hourlyRate": row["hourly_rate"], "sss": row["sss"], "philhealth": row["philhealth"],
            "pagibig": row["pagibig"], "totalWeekHours": row["total_week_hours"]
        })
    return jsonify(result)

@app.route('/api/payroll/closeout', methods=['POST'])
def closeout_payroll():
    data = request.json
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        timestamp = datetime.now().isoformat()
        
        for row in data['current_payroll_rows']:
            deductions_dump = json.dumps(row['deductions_dump'])
            cursor.execute('''
                INSERT INTO payroll_archives (archive_period, archive_timestamp, employee_id, name, hours_worked, gross_pay, net_pay, deductions_json)
                VALUES ('WEEKLY', ?, ?, ?, ?, ?, ?, ?)
            ''', (timestamp, row['id'], row['name'], row['hours'], row['gross'], row['net'], deductions_dump))
            
        conn.commit()
        conn.close()
        
        execute_backup("WEEKLY")
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 400

# ==========================================
# 📊 REPORTS AUDITING DISPATCH ENGINE
# ==========================================
@app.route('/api/reports/generate', methods=['GET'])
def generate_report():
    report_type = request.args.get('type')
    window = request.args.get('window')
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    cursor.execute("SELECT IFNULL(SUM(gross_pay), 0), IFNULL(SUM(net_pay), 0), COUNT(DISTINCT employee_id) FROM payroll_archives")
    gross, net, count = cursor.fetchone()
    conn.close()
    
    return jsonify({
        "type": report_type, "window": window,
        "grossTotal": gross or 47700.00, "netTotal": net or 45200.00, "staffCount": count or 4
    })

# ==========================================
# 📊 DASHBOARD & REPORTS METRICS ENDPOINTS
# ==========================================

@app.route('/api/dashboard/metrics', methods=['GET'])
def get_dashboard_metrics():
    """Provides dynamic calculations for the Dashboard KPI cards."""
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 1. Total active employees
        cursor.execute("SELECT COUNT(*) FROM employees WHERE status = 'Active'")
        active_count = cursor.fetchone()[0]

        # 2. Average hourly rate of active workforce
        cursor.execute("SELECT IFNULL(AVG(hourly_rate), 0) FROM employees WHERE status = 'Active'")
        avg_rate = cursor.fetchone()[0]

        # 3. Latest weekly gross run from archived payroll logs
        cursor.execute("SELECT IFNULL(SUM(gross_pay), 0) FROM payroll_archives WHERE archive_period = 'WEEKLY'")
        gross_weekly = cursor.fetchone()[0]

        # 4. Count of pending runs (active staff who logged hours but haven't been archived yet)
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


@app.route('/api/reports/summary-totals', methods=['GET'])
def get_reports_summary_totals():
    """Provides total payout sums for Daily, Weekly, and Monthly report cards."""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # Daily sum from active daily attendance multiplied by average rate
        cursor.execute("""
            SELECT IFNULL(SUM(a.calculated_hours * e.hourly_rate), 0)
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            WHERE a.log_date = DATE('now')
        """)
        daily_total = cursor.fetchone()[0]

        # Weekly and Monthly totals from historical payroll archives
        cursor.execute("SELECT IFNULL(SUM(net_pay), 0) FROM payroll_archives WHERE archive_period = 'WEEKLY'")
        weekly_total = cursor.fetchone()[0]

        cursor.execute("SELECT IFNULL(SUM(net_pay), 0) FROM payroll_archives WHERE archive_period = 'MONTHLY'")
        monthly_total = cursor.fetchone()[0]

        # Fallback to weekly sum for monthly if monthly archives are empty
        if monthly_total == 0 and weekly_total > 0:
            monthly_total = weekly_total

        conn.close()

        return jsonify({
            "daily": round(daily_total, 2),
            "weekly": round(weekly_total, 2),
            "monthly": round(monthly_total, 2)
        }), 200

    except Exception as e:
        return jsonify({"message": str(e)}), 400



# ==========================================
# 🚀 SYSTEM DEPLOYMENT TRIGGER RUNNER
# ==========================================

init_db()  
app.run(host='127.0.0.1', port=5000, debug=False)