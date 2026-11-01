#!/usr/bin/env bash
# Deploy lên server LAN: build image Docker TẠI MÁY LOCAL rồi đẩy image lên server.
# Không build trên server. Máy local arm64 = server aarch64 nên build native, không giả lập.
# Yêu cầu: Docker Desktop đang chạy, SSH key tới server.
set -euo pipefail

HOST="${DEPLOY_HOST:-thaochi@192.168.1.36}"
APP_DIR="${DEPLOY_DIR:-/home/thaochi/edusystem}"
PROJECT=edusystem   # tên project compose trên server → image edusystem-nextjs, edusystem-grading-worker
IMAGES=(edusystem-nextjs:latest edusystem-grading-worker:latest)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker info >/dev/null 2>&1 || { echo "Docker local chưa chạy — mở Docker Desktop rồi chạy lại."; exit 1; }

# NEXT_PUBLIC_* được nhúng vào bundle trình duyệt lúc build → lấy đúng giá trị từ .env của server,
# chỉ giữ trong biến môi trường của tiến trình này, không ghi ra đĩa.
while IFS= read -r line; do
  [ -n "$line" ] && export "${line?}"
done < <(ssh "$HOST" "grep -E '^NEXT_PUBLIC_SUPABASE_(URL|ANON_KEY)=' '$APP_DIR/.env'")
: "${NEXT_PUBLIC_SUPABASE_URL:?Thiếu NEXT_PUBLIC_SUPABASE_URL trong .env server}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?Thiếu NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env server}"

# Compose bị rsync --delete ghi đè trên server: thiếu volume media là mất toàn bộ ảnh/mp3 bài học.
grep -q '/app/public/media' docker-compose.yml || { echo "docker-compose.yml thiếu volume media /app/public/media — dừng deploy."; exit 1; }

echo "==> Build image tại local (linux/arm64)"
DOCKER_DEFAULT_PLATFORM=linux/arm64 docker compose -p "$PROJECT" build nextjs grading-worker

echo "==> Đồng bộ mã nguồn + docker-compose.yml (giữ nguyên .env trên server)"
rsync -az --checksum --delete \
  --exclude=/.env --exclude='/.env.*' --exclude=/.git --exclude=/node_modules/ --exclude=/.next/ \
  --exclude=/handoff/ --exclude=/tests/ --exclude=/.agents/ --exclude=/scripts/ --exclude=/.claude/ \
  --exclude='*.tsbuildinfo' --exclude=.DS_Store \
  --exclude='/scratch*' --exclude=/stitch_english_mock_exam_portal/ --exclude=/task.md \
  --exclude=/e2e/ --exclude=/playwright-report/ --exclude=/test-results/ \
  ./ "$HOST:$APP_DIR/"

echo "==> Đẩy image lên server"
docker save "${IMAGES[@]}" | gzip | ssh "$HOST" 'gunzip | docker load'

echo "==> Khởi động lại container (không build trên server)"
ssh "$HOST" "cd '$APP_DIR' && docker compose up -d --no-build && docker image prune -f >/dev/null"

echo "==> Kiểm tra"
sleep 3
ssh "$HOST" "curl -s -o /dev/null -w '/login → %{http_code}\n' http://localhost:3645/login; curl -s -o /dev/null -w '/media/ej (mẫu) → %{http_code}\n' http://localhost:3645/media/ej/2025/09/03.--3-6a1eae.mp3; docker compose -f '$APP_DIR/docker-compose.yml' -p $PROJECT ps --format '{{.Name}}\t{{.Status}}'"
