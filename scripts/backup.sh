#!/bin/bash

BACKUP_DIR="/home/xwei/club-opening-day/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/club_${DATE}.sql"

mkdir -p "$BACKUP_DIR"

source /home/xwei/club-opening-day/.env

pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

gzip "$BACKUP_FILE"

find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"

# ========== 异地备份方案（选择一种启用）==========

# 方案 A: 阿里云 OSS
# ossutil cp "${BACKUP_FILE}.gz" oss://your-bucket/backups/

# 方案 B: 腾讯云 COS  
# coscmd upload "${BACKUP_FILE}.gz" /backups/

# 方案 C: AWS S3
# aws s3 cp "${BACKUP_FILE}.gz" s3://your-bucket/backups/

# 方案 D: rsync 到另一台服务器
# rsync -avz "${BACKUP_FILE}.gz" user@backup-server:/backups/

# 方案 E: 上传到 GitHub 私有仓库（加密后）
# gpg -c --passphrase "your-password" "${BACKUP_FILE}.gz"
# git -C /home/xwei/backups-repo add .
# git -C /home/xwei/backups-repo commit -m "backup ${DATE}"
# git -C /home/xwei/backups-repo push
