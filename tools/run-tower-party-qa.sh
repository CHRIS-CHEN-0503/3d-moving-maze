#!/usr/bin/env bash
set -euo pipefail
guard_dir="${PROCESS_GUARD_DIR:?Set PROCESS_GUARD_DIR to the installed process-guard skill directory}"
qa_script="${1:-tools/tower-party-browser-qa.mjs}"
case "$qa_script" in tools/tower-feedback-browser-qa.mjs|tools/tower-durability-browser-qa.mjs|tools/tower-battle-dock-qa.mjs|tools/tower-party-browser-qa.mjs|tools/tower-companion-browser-qa.mjs|tools/tower-lighting-browser-qa.mjs|tools/tower-objective-browser-qa.mjs|tools/tower-identity-browser-qa.mjs|tools/tower-heroes-browser-qa.mjs|tools/tower-hud-monsters-browser-qa.mjs|tools/tower-polish-browser-qa.mjs|tools/tower-growth-browser-qa.mjs|tools/tower-sight-browser-qa.mjs) ;; *) exit 2 ;; esac
trap 'bash "$guard_dir/scripts/stop-managed-process.sh" --name tower-party-qa' EXIT
bash "$guard_dir/scripts/start-managed-process.sh" --name tower-party-qa --command 'python3 -m http.server 8795 --bind 127.0.0.1' --port 8795 --health-url http://127.0.0.1:8795/ --timeout 20
bash "$guard_dir/scripts/guarded-run.sh" --timeout 110 --log-name tower-party-browser -- node "$qa_script"
