#!/usr/bin/env bash
set -euo pipefail
guard_dir="${PROCESS_GUARD_DIR:?Set PROCESS_GUARD_DIR to the installed process-guard skill directory}"
qa_script="${1:-tools/tower-party-browser-qa.mjs}"
if [ "$qa_script" = tools/tower-robot-browser-qa.mjs ] || [ "$qa_script" = tools/tower-robot-power-browser-qa.mjs ] || [ "$qa_script" = tools/tower-compact-help-browser-qa.mjs ]; then
  trap 'bash "$guard_dir/scripts/stop-managed-process.sh" --name tower-party-qa' EXIT
  bash "$guard_dir/scripts/start-managed-process.sh" --name tower-party-qa --command 'python3 -m http.server 8795 --bind 127.0.0.1' --port 8795 --health-url http://127.0.0.1:8795/ --timeout 20
  bash "$guard_dir/scripts/guarded-run.sh" --timeout 300 --log-name tower-robot-browser -- node "$qa_script"
  exit
fi
if [ "$qa_script" = tools/tower-foraging-browser-qa.mjs ]; then
  trap 'bash "$guard_dir/scripts/stop-managed-process.sh" --name tower-party-qa' EXIT
  bash "$guard_dir/scripts/start-managed-process.sh" --name tower-party-qa --command 'python3 -m http.server 8795 --bind 127.0.0.1' --port 8795 --health-url http://127.0.0.1:8795/ --timeout 20
  bash "$guard_dir/scripts/guarded-run.sh" --timeout 240 --log-name tower-foraging-browser -- node "$qa_script"
  exit
fi
if [ "$qa_script" = tools/tower-arrow-cap-browser-qa.mjs ] || [ "$qa_script" = tools/tower-grocery-browser-qa.mjs ] || [ "$qa_script" = tools/tower-cinematics-browser-qa.mjs ] || [ "$qa_script" = tools/tower-market-art-browser-qa.mjs ] || [ "$qa_script" = tools/tower-v151-entry-browser-qa.mjs ] || [ "$qa_script" = tools/tower-weapon-contact-browser-qa.mjs ]; then
  trap 'bash "$guard_dir/scripts/stop-managed-process.sh" --name tower-party-qa' EXIT
  bash "$guard_dir/scripts/start-managed-process.sh" --name tower-party-qa --command 'python3 -m http.server 8795 --bind 127.0.0.1' --port 8795 --health-url http://127.0.0.1:8795/ --timeout 20
  bash "$guard_dir/scripts/guarded-run.sh" --timeout 240 --log-name tower-supplies-browser -- node "$qa_script"
  exit
fi
case "$qa_script" in tools/tower-exploration-recruitment-browser-qa.mjs|tools/tower-camp-services-browser-qa.mjs|tools/tower-work-progress-browser-qa.mjs|tools/tower-cooperation-browser-qa.mjs|tools/tower-crafting-browser-qa.mjs|tools/story-atlas-browser-qa.mjs|tools/tower-ascension-browser-qa.mjs|tools/underworld-support-browser-qa.mjs|tools/tower-adventure-quality-browser-qa.mjs|tools/tower-visual-polish-browser-qa.mjs|tools/tower-lords-loot-browser-qa.mjs|tools/tower-quest-feedback-browser-qa.mjs|tools/tower-ranged-browser-qa.mjs|tools/tower-roster-browser-qa.mjs|tools/shop-sight-browser-qa.mjs|tools/tower-target-browser-qa.mjs|tools/tower-tactics-browser-qa.mjs|tools/tower-motion-browser-qa.mjs|tools/tower-feedback-browser-qa.mjs|tools/tower-durability-browser-qa.mjs|tools/tower-battle-dock-qa.mjs|tools/tower-party-browser-qa.mjs|tools/tower-companion-browser-qa.mjs|tools/tower-lighting-browser-qa.mjs|tools/tower-objective-browser-qa.mjs|tools/tower-identity-browser-qa.mjs|tools/tower-heroes-browser-qa.mjs|tools/tower-hud-monsters-browser-qa.mjs|tools/tower-polish-browser-qa.mjs|tools/tower-growth-browser-qa.mjs|tools/tower-sight-browser-qa.mjs) ;; *) exit 2 ;; esac
trap 'bash "$guard_dir/scripts/stop-managed-process.sh" --name tower-party-qa' EXIT
bash "$guard_dir/scripts/start-managed-process.sh" --name tower-party-qa --command 'python3 -m http.server 8795 --bind 127.0.0.1' --port 8795 --health-url http://127.0.0.1:8795/ --timeout 20
qa_timeout=110
if [ "$qa_script" = tools/tower-exploration-recruitment-browser-qa.mjs ]; then qa_timeout=300; fi
if [ "$qa_script" = tools/tower-camp-services-browser-qa.mjs ]; then qa_timeout=300; fi
if [ "$qa_script" = tools/tower-work-progress-browser-qa.mjs ]; then qa_timeout=180; fi
bash "$guard_dir/scripts/guarded-run.sh" --timeout "$qa_timeout" --log-name tower-party-browser -- node "$qa_script"
