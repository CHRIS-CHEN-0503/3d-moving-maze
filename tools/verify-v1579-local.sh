#!/usr/bin/env bash
set -euo pipefail
maze_guard=/Users/chenziwei/.codex/skills/process-guard/scripts
maze_owned_server=false
maze_cleanup() {
  if [ "$maze_owned_server" = true ]; then bash "$maze_guard/stop-managed-process.sh" --name v1579-local-qa; fi
}
trap maze_cleanup EXIT
if lsof -nP -iTCP:8798 -sTCP:LISTEN >/dev/null 2>&1; then
  echo 'Port 8798 belongs to an existing process; leave it unchanged.' >&2
  exit 1
fi
maze_owned_server=true
bash "$maze_guard/start-managed-process.sh" --name v1579-local-qa --command '/usr/bin/python3 -m http.server 8798 --bind 127.0.0.1' --port 8798 --health-url http://127.0.0.1:8798/ --timeout 30 --cwd "$PWD"
export PLAYWRIGHT_MODULE=/Users/chenziwei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright
export MAZE_QA_GL=metal
MAZE_QA_OUT=.agent-run/v1579-entry-qa bash "$maze_guard/guarded-run.sh" --timeout 240 --log-name v1579-entry-qa -- node tools/profession-proportions-entry-qa.mjs
MAZE_QA_OUT=.agent-run/v1579-music-qa bash "$maze_guard/guarded-run.sh" --timeout 510 --log-name v1579-music-qa -- node tools/orchestra-game-browser-qa.mjs
