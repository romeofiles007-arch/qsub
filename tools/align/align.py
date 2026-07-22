#!/usr/bin/env python
"""Forced-align Thai (or any) text to audio -> word timestamps.

Usage: align.py <wav_path> <text_file> <lang_iso3>   (text = space-separated words)
Prints JSON: {"words":[{"text","start","end","score"}]}
"""
import json
import sys

import torch
from ctc_forced_aligner import (
    generate_emissions,
    get_alignments,
    get_spans,
    load_alignment_model,
    load_audio,
    postprocess_results,
    preprocess_text,
)


def main():
    wav_path = sys.argv[1]
    text = open(sys.argv[2], encoding="utf-8").read().strip()
    language = sys.argv[3] if len(sys.argv) > 3 else "tha"

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    model, tokenizer = load_alignment_model(device, dtype=dtype)

    audio = load_audio(wav_path, model.dtype, model.device)
    emissions, stride = generate_emissions(model, audio, batch_size=16)

    tokens_starred, text_starred = preprocess_text(
        text, romanize=True, language=language
    )

    aligned = get_alignments(emissions, tokens_starred, tokenizer)
    # Version-tolerant unpack: (segments, scores, blank_id) or (segments, blank_id)
    if len(aligned) == 3:
        segments, scores, blank_id = aligned
    else:
        segments, blank_id = aligned
        scores = None

    spans = get_spans(tokens_starred, segments, blank_id)
    try:
        results = postprocess_results(text_starred, spans, stride, scores)
    except TypeError:
        results = postprocess_results(text_starred, spans, stride)

    words = []
    for w in results:
        words.append(
            {
                "text": w.get("text", ""),
                "start": round(float(w.get("start", 0)), 3),
                "end": round(float(w.get("end", 0)), 3),
                "score": round(float(w.get("score", 0)), 3),
            }
        )
    print(json.dumps({"words": words, "device": device}, ensure_ascii=False))


if __name__ == "__main__":
    main()
