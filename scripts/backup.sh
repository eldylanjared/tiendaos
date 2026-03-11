#!/bin/bash
# Daily backup script for TiendaOS database
# Keeps 30 days of backups locally

BACKUP_DIR="/opt/tiendaos/backups"
DB_PATH="/opt/tiendaos/backend/data/tiendaos.db"
DATE=$(date +%Y-%m-%d_%H%M)
MAX_DAYS=30

mkdir -p "$BACKUP_DIR"

# Use sqlite3 .backup for a safe copy (handles WAL mode)
if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/tiendaos_$DATE.db'"
else
    cp "$DB_PATH" "$BACKUP_DIR/tiendaos_$DATE.db"
fi

# Compress
gzip "$BACKUP_DIR/tiendaos_$DATE.db"

# Delete backups older than MAX_DAYS
find "$BACKUP_DIR" -name "tiendaos_*.db.gz" -mtime +$MAX_DAYS -delete

echo "Backup complete: tiendaos_$DATE.db.gz ($(du -h "$BACKUP_DIR/tiendaos_$DATE.db.gz" | cut -f1))"
