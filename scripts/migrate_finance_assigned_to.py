#!/usr/bin/env python3
"""
Migration: Add new columns to existing databases.
New databases get these columns via create_all().

Usage:
    python scripts/migrate_finance_assigned_to.py [path_to_db]

Default DB path: backend/data/tiendaos.db
"""
import sqlite3
import sys
import os


def add_column_if_missing(cursor, table, column, definition):
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    if column not in columns:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        print(f"  Added '{column}' to {table}.")
        return True
    else:
        print(f"  Column '{column}' already exists in {table}.")
        return False


def migrate(db_path: str):
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Migrating finance_entries...")
    add_column_if_missing(cursor, "finance_entries", "assigned_to",
                          "VARCHAR(36) REFERENCES users(id)")
    if add_column_if_missing(cursor, "finance_entries", "updated_at", "DATETIME"):
        cursor.execute(
            "UPDATE finance_entries SET updated_at = created_at WHERE updated_at IS NULL"
        )

    add_column_if_missing(cursor, "finance_entries", "is_personal", "BOOLEAN DEFAULT 0")
    # Mark existing nomina income entries as personal
    cursor.execute(
        "UPDATE finance_entries SET is_personal = 1 "
        "WHERE entry_type = 'income' AND category = 'nomina' AND assigned_to IS NOT NULL AND is_personal = 0"
    )

    print("Migrating products...")
    add_column_if_missing(cursor, "products", "is_favorite", "BOOLEAN DEFAULT 0")

    conn.commit()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "backend", "data", "tiendaos.db"
    )
    migrate(db_path)
