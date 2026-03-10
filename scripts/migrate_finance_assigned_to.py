#!/usr/bin/env python3
"""
Migration: Add assigned_to column to finance_entries table.
Run this on existing databases. New databases get the column via create_all().

Usage:
    python scripts/migrate_finance_assigned_to.py [path_to_db]

Default DB path: backend/data/tiendaos.db
"""
import sqlite3
import sys
import os

def migrate(db_path: str):
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(finance_entries)")
    columns = [row[1] for row in cursor.fetchall()]

    if "assigned_to" in columns:
        print("Column 'assigned_to' already exists. Nothing to do.")
    else:
        cursor.execute(
            "ALTER TABLE finance_entries ADD COLUMN assigned_to VARCHAR(36) REFERENCES users(id)"
        )
        conn.commit()
        print("Added 'assigned_to' column to finance_entries.")

    conn.close()

if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "backend", "data", "tiendaos.db"
    )
    migrate(db_path)
