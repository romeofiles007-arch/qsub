#!/usr/bin/env python
"""Whole-audio forced alignment (most accurate). Aligns the full Thai text to the
full audio in one pass, character level. The caller fills any collapse gaps with
Whisper's own timing.

Usage: align_wav2vec2.py <wav_16k_mono> <text_file> [model]
Output JSON: {"chars":[{"text","start","end"}], "device": "..."}
"""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

import torch
import torchaudio
from transformers import AutoModelForCTC, AutoProcessor

WAV = sys.argv[1]
TEXT = open(sys.argv[2], encoding="utf-8").read().strip()
MODEL = sys.argv[3] if len(sys.argv) > 3 else "airesearch/wav2vec2-large-xlsr-53-th"

device = "cuda" if torch.cuda.is_available() else "cpu"
processor = AutoProcessor.from_pretrained(MODEL)
model = AutoModelForCTC.from_pretrained(MODEL).to(device).eval()

wav, sr = torchaudio.load(WAV)
if wav.shape[0] > 1:
    wav = wav.mean(0, keepdim=True)
if sr != 16000:
    wav = torchaudio.functional.resample(wav, sr, 16000)
    sr = 16000

inputs = processor(wav.squeeze(0).numpy(), sampling_rate=16000, return_tensors="pt")
with torch.inference_mode():
    logits = model(inputs.input_values.to(device)).logits
emission = torch.log_softmax(logits, dim=-1)[0].cpu().contiguous()

tok = processor.tokenizer
enc = tok(TEXT, add_special_tokens=False)
targets = torch.tensor(enc.input_ids, dtype=torch.long)
blank = tok.pad_token_id if tok.pad_token_id is not None else 0

aligned, scores = torchaudio.functional.forced_align(
    emission.unsqueeze(0), targets.unsqueeze(0), blank=blank
)
spans = torchaudio.functional.merge_tokens(aligned[0], scores[0])
spans = [sp for sp in spans if sp.token != blank]

ratio = wav.shape[1] / emission.shape[0] / sr
id2tok = {v: k for k, v in tok.get_vocab().items()}
src = list(TEXT)
use_src = len(src) == len(spans)

chars = []
for i, sp in enumerate(spans):
    ch = src[i] if use_src else id2tok.get(sp.token, "")
    if ch == "|":
        ch = " "
    chars.append(
        {
            "text": ch,
            "start": round(sp.start * ratio, 3),
            "end": round(sp.end * ratio, 3),
        }
    )
print(json.dumps({"chars": chars, "device": device}, ensure_ascii=False))
