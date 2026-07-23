import os
import sys
import sqlite3
import shutil
from datetime import datetime

# ==========================================
# 🔑 PORTABILITY & RUNTIME PATH CONTROLLER
# ==========================================
if getattr(sys, 'frozen', False):
    # PyInstaller bundle execution path
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # Standard Python execution path
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_NAME = os.path.join(BASE_DIR, "workforce.db")
BACKUP_DIR = os.path.join(BASE_DIR, "backups_and_archives")


def execute_backup(trigger_reason="MANUAL"):
    """
    Executes a safe SQLite backup into the backups_and_archives folder.
    Supports trigger reasons like 'APP_STARTUP', 'AUTO_DAILY', or 'WEEKLY'.
    """
    try:
        # 1. Ensure backup directory exists next to app.exe
        if not os.path.exists(BACKUP_DIR):
            os.makedirs(BACKUP_DIR)

        # 2. Check if source database exists
        if not os.path.exists(DB_NAME):
            print(f"⚠️ [BACKUP] Database file '{DB_NAME}' not found. Skipping backup.")
            return False

        # 3. Create a unique, timestamped backup filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"workforce_backup_{trigger_reason}_{timestamp}.db"
        backup_path = os.path.join(BACKUP_DIR, backup_filename)

        # 4. Perform an online SQLite backup (safe while app is running)
        src_conn = sqlite3.connect(DB_NAME)
        dest_conn = sqlite3.connect(backup_path)
        
        with dest_conn:
            src_conn.backup(dest_conn)
            
        dest_conn.close()
        src_conn.close()

        print(f"✅ [BACKUP SUCCESS] Backup created ({trigger_reason}): {backup_path}")
        return True

    except Exception as e:
        print(f"❌ [BACKUP ERROR] Failed to create backup: {str(e)}")
        return False


if __name__ == "__main__":
    # Allows manual execution by double-clicking backup.py or running standalone
    execute_backup("MANUAL_RUN")