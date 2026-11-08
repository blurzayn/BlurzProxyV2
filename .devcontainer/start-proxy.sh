#!/usr/bin/env bash
set -eu

cd "$(dirname "$0")/../BlurzProxy"

log_file=/tmp/blurzproxy.log

if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3000/api/status >/dev/null; then
  echo "BlurzProxy is already responding on port 3000."
  exit 0
fi

nohup npm start >"$log_file" 2>&1 </dev/null &
server_pid=$!

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3000/api/status >/dev/null; then
    echo "BlurzProxy is ready on port 3000."
    exit 0
  fi

  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "BlurzProxy exited before becoming ready. Recent log output:"
    tail -n 40 "$log_file"
    exit 1
  fi

  sleep 1
done

echo "BlurzProxy did not become ready on port 3000 within 30 seconds. Recent log output:"
tail -n 40 "$log_file"
exit 1
