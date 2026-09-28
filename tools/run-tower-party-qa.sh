#!/usr/bin/env bash
set -euo pipefail
guard_dir="${PROCESS_GUARD_DIR:?Set PROCESS_GUARD_DIR to the installed process-guard skill directory}"
trap 'bash "$guard_dir/scripts/stop-managed-process.sh" --name tower-party-qa' EXIT
bash "$guard_dir/scripts/start-managed-process.sh" --name tower-party-qa --command 'python3 -m http.server 8795 --bind 127.0.0.1' --port 8795 --health-url http://127.0.0.1:8795/ --timeout 20
bash "$guard_dir/scripts/guarded-run.sh" --timeout 110 --log-name tower-party-browser -- node tools/tower-party-browser-qa.mjs
