#!/bin/zsh

set -u
unsetopt BG_NICE

PROJECT_DIR="${0:A:h}"
SITE_URL="http://127.0.0.1:8000/"
ADMIN_URL="${SITE_URL}admin/"
PYTHON_BIN="$(command -v python3)"

cd "$PROJECT_DIR" || exit 1

if /usr/bin/curl -fsS "${SITE_URL}api/health" >/dev/null 2>&1; then
  /usr/bin/open "$ADMIN_URL"
  exit 0
fi

"$PYTHON_BIN" scripts/build_database.py || exit 1
"$PYTHON_BIN" scripts/serve.py --host 127.0.0.1 --port 8000 &
SERVER_PID=$!

for attempt in {1..30}; do
  if /usr/bin/curl -fsS "${SITE_URL}api/health" >/dev/null 2>&1; then
    /usr/bin/open "$ADMIN_URL"
    wait "$SERVER_PID"
    exit $?
  fi
  /bin/sleep 0.2
done

echo "資料後台伺服器無法啟動，請檢查上方訊息。"
kill "$SERVER_PID" >/dev/null 2>&1
exit 1
