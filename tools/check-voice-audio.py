"""Decode and independently transcribe a chosen set of locally generated clips.

Usage: python tools/check-voice-audio.py shop.sale.clear. --output report.json
Transcripts are QA evidence, not proof of perceived clarity or pronunciation.
"""
import argparse
import json
from pathlib import Path
import subprocess

import mlx_whisper

parser = argparse.ArgumentParser()
parser.add_argument("prefix", nargs="?", default="shop.sale.clear.")
parser.add_argument("--output", required=True)
parser.add_argument("--limit", type=int, default=0)
parser.add_argument("--audio-dir", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
tracks = json.loads(subprocess.check_output(
    ["node", "-e", "console.log(JSON.stringify(require('./assets/voice-pack.js').tracks))"], cwd=root
))
selected = [(key, track) for key, track in tracks.items() if key.startswith(tuple(args.prefix.split(",")))]
if args.limit:
    selected = selected[:args.limit]
reports = []
for key, track in selected:
    path = args.audio_dir / Path(track["src"]).name if args.audio_dir else root / track["src"]
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,sample_rate,channels",
        "-of", "json", str(path),
    ], timeout=20))
    result = mlx_whisper.transcribe(
        str(path), path_or_hf_repo="mlx-community/whisper-small-mlx", language="zh",
        condition_on_previous_text=False, temperature=0,
    )
    report = {"id": key, "expected": track.get("spokenText", track["text"]),
              "heard": result["text"].strip(), "probe": probe}
    reports.append(report)
    print(json.dumps(report, ensure_ascii=False), flush=True)
Path(args.output).write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n")
