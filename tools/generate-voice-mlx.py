"""Offline Apple Silicon narration builder; no player data or hosted inference.

Requires mlx-audio==0.5.5, soundfile, opencc-python-reimplemented and ffmpeg.
The game downloads only the resulting MP3 files, never the model.
"""
import argparse
import json
import re
from pathlib import Path
import subprocess
import tempfile
import time

import mlx.core as mx
from mlx_audio.tts.utils import load_model
import soundfile as sf
from opencc import OpenCC

parser = argparse.ArgumentParser()
parser.add_argument("--prefix", default="generated.")
parser.add_argument("--force", action="store_true")
parser.add_argument("--batch", type=int, default=4)
parser.add_argument("--limit", type=int, default=0)
parser.add_argument("--speaker", default="serena", choices=["serena", "vivian"])
parser.add_argument("--output-dir", type=Path)
parser.add_argument("--resume-log", type=Path)
parser.add_argument("--retry-ids", type=Path, help="JSON array of existing recording IDs to replace")
args = parser.parse_args()
if not 1 <= args.batch <= 16:
    parser.error("batch must be between 1 and 16")
root = Path(__file__).resolve().parent.parent
tracks = json.loads(subprocess.check_output(
    ["node", "-e", "console.log(JSON.stringify(require('./assets/voice-pack.js').tracks))"], cwd=root
))
retry_ids = set(json.loads(args.retry_ids.read_text())) if args.retry_ids else set()
entries = [(key, track) for key, track in tracks.items()
           if key.startswith(args.prefix) and (args.force or key in retry_ids or not (root / track["src"]).exists())]
if args.resume_log:
    completed = set(re.findall(r"^完成 \d+/\d+ (\S+)", args.resume_log.read_text(), re.MULTILINE))
    entries = [(key, track) for key, track in entries
               if key not in completed or not (root / track["src"]).exists()]
if args.limit:
    entries = entries[:args.limit]
# Similar lengths within a batch reduce padding and wasted decoder work.
entries.sort(key=lambda pair: len(pair[1].get("spokenText", pair[1]["text"])))
if not entries:
    print("沒有缺少的音檔。", flush=True)
    raise SystemExit(0)
model_id = "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-6bit"
print(f"載入 {model_id}；待生成 {len(entries)} 段", flush=True)
model = load_model(model_id)
mx.set_memory_limit(6 * 1024 ** 3)
print("模型已載入，開始合成。", flush=True)
spoken_chinese = OpenCC("t2s")
instruction = "用温暖自然的女声，像耐心对小朋友说话一样，清晰准确地读出每个字。语速稍慢，标点处自然停顿，不要喊叫，不要唱歌。"
started = time.monotonic()
with tempfile.TemporaryDirectory(prefix="maze-voice-encode-") as temporary:
    for start in range(0, len(entries), args.batch):
        batch = entries[start:start + args.batch]
        print(f"合成 {start + 1}–{start + len(batch)}/{len(entries)}", flush=True)
        mx.random.seed(20260923 + start)
        # Normalize glyph variants for the Mandarin model; on-screen text remains Traditional Chinese.
        texts = [spoken_chinese.convert(track.get("spokenText", track["text"])) for _, track in batch]
        # Slow child-friendly narration needs more than six codec tokens per character.
        # Leave generous headroom and reject capped output instead of saving a cut-off sentence.
        token_limit = max(256, max(len(text) for text in texts) * 12 + 128)
        for result in model.batch_generate(
            texts=texts, voices=[args.speaker] * len(batch), instructs=[instruction] * len(batch),
            lang_code="chinese", temperature=0.65, top_p=0.9,
            max_tokens=token_limit,
            repetition_penalty=1.1, stream=False,
        ):
            key, track = batch[result.sequence_idx]
            if result.token_count >= token_limit - 1:
                raise RuntimeError(f"{key} reached generation limit; existing file was not replaced")
            destination = (root / track["src"]).resolve()
            destination.relative_to(root / "assets" / "voice")
            if args.output_dir:
                destination = args.output_dir.resolve() / destination.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            wav = Path(temporary) / "speech.wav"
            sf.write(wav, result.audio, result.sample_rate)
            # Write atomically: an interrupted encode is never treated as a completed clip.
            encoded = destination.with_suffix(".partial.mp3")
            subprocess.run([
                "ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(wav),
                "-af", "atempo=0.93,highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=9",
                "-ac", "1", "-ar", "24000", "-b:a", "80k", str(encoded),
            ], check=True, timeout=45)
            encoded.replace(destination)
            print(f"完成 {start + result.sequence_idx + 1}/{len(entries)} {key} tokens={result.token_count}/{token_limit} {track['text'][:24]}", flush=True)
        mx.clear_cache()
print(f"完成 {len(entries)} 段，耗時 {time.monotonic() - started:.1f} 秒", flush=True)
