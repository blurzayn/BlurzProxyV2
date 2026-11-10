#!/usr/bin/env bash
set -eu

cd "$(dirname "$0")/../BlurzProxy"

# Keep the Codespaces forwarded URL on the exact-origin allowlist.
if [ "${CODESPACES:-}" = "true" ]; then
  if [ -z "${ADMIN_PASSWORD:-}" ]; then
    echo "Set ADMIN_PASSWORD as a GitHub Codespaces secret before starting BlurzProxy."
    exit 1
  fi

  if [ -z "${ALLOWED_ORIGINS:-}" ]; then
    if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
      export ALLOWED_ORIGINS="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    else
      echo "Could not determine the Codespaces forwarded origin. Set ALLOWED_ORIGINS explicitly."
      exit 1
    fi
  fi
fi

log_file=/tmp/blurzproxy.log

if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3000/healthz >/dev/null; then
  echo "BlurzProxy is already responding on port 3000."
  exit 0
fi

nohup npm start >"$log_file" 2>&1 </dev/null &
server_pid=$!

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3000/healthz >/dev/null; then
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
