import express from "express";
import multer from "multer";
import bundledFfmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import {
  copyFile,
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  buildDraftContent,
  buildDraftMeta,
  findTemplates,
  registerInRoot,
  US,
} from "./capcut.mjs";
import { createJanitor } from "./storage.mjs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const app = express();
// Scratch lives on the system drive by default. Point SILENCE_SCRATCH_DIR at a
// roomier disk if C: is tight — analysis writes several GB per clip.
const root =
  process.env.SILENCE_SCRATCH_DIR?.trim() ||
  path.join(os.tmpdir(), "silence-studio-local");
const hyperframesCli = path.resolve(
  "node_modules",
  "hyperframes",
  "bin",
  "hyperframes.mjs",
);
const bundledWhisperDir = path.resolve(
  "tools",
  "whisper",
  "Release",
);
await mkdir(root, { recursive: true });
if (!bundledFfmpegPath) throw new Error("ffmpeg-static runtime not found");
const runtimeRoot = path.join(os.tmpdir(), "silence-studio-runtime");
const runtimeBin = path.join(runtimeRoot, "bin");
const runtimeWhisperDir = path.join(runtimeRoot, "whisper");
await mkdir(runtimeBin, { recursive: true });
await mkdir(runtimeWhisperDir, { recursive: true });
const ffmpegPath = path.join(runtimeBin, "ffmpeg.exe");
await copyFile(bundledFfmpegPath, ffmpegPath);
await cp(bundledWhisperDir, runtimeWhisperDir, {
  recursive: true,
  force: true,
});
const whisperCli = path.join(runtimeWhisperDir, "whisper-cli.exe");
const whisperModelsDir = path.join(
  os.homedir(),
  ".cache",
  "hyperframes",
  "whisper",
  "models",
);
const whisperModel = path.join(whisperModelsDir, "ggml-large-v3-turbo.bin");
const whisperModelChoices = {
  default: whisperModel,
  thai: path.join(whisperModelsDir, "ggml-thonburian-medium.bin"),
};
async function pickWhisperModel(choice) {
  const target = whisperModelChoices[choice] || whisperModel;
  try {
    await import("node:fs/promises").then((fs) => fs.access(target));
    return target;
  } catch {
    return whisperModel;
  }
}
// GPU (CUDA) whisper build lives here after download; falls back to bundled CPU.
let gpuAvailable = false;
const whisperCliGpu = path.resolve(
  "tools",
  "whisper-cuda",
  "Release",
  "whisper-cli.exe",
);
async function fileExists(p) {
  try {
    await import("node:fs/promises").then((fs) => fs.access(p));
    return true;
  } catch {
    return false;
  }
}
// Pick GPU vs CPU whisper-cli. compute: "auto" | "gpu" | "cpu".
async function pickWhisperCli(compute) {
  const wantGpu =
    compute === "gpu" || (compute !== "cpu" && gpuAvailable);
  if (wantGpu && (await fileExists(whisperCliGpu)))
    return { cli: whisperCliGpu, gpu: true };
  return { cli: whisperCli, gpu: false };
}
// wav2vec2 forced aligner (accurate word timing). Local Python venv + torchaudio.
const alignPy = path.resolve("tools", "align", "venv", "Scripts", "python.exe");
const alignScript = path.resolve("tools", "align", "align_wav2vec2.py");
const alignThaiModel = "airesearch/wav2vec2-large-xlsr-53-th";
async function alignerReady() {
  return (await fileExists(alignPy)) && (await fileExists(alignScript));
}
// Run whole-audio forced alignment: returns char-level [{text,start,end}].
async function alignChars(wavPath, thaiText) {
  const fs = await import("node:fs/promises");
  const textFile = wavPath.replace(/\.wav$/i, ".align.txt");
  await fs.writeFile(textFile, thaiText, "utf8");
  const env = { ...process.env, PYTHONIOENCODING: "utf-8" };
  delete env.PYTHONHOME;
  delete env.PYTHONPATH;
  return new Promise((resolve, reject) => {
    const p = spawn(alignPy, [alignScript, wavPath, textFile, alignThaiModel], {
      windowsHide: true,
      shell: false,
      env,
    });
    const chunks = [];
    let err = "";
    p.stdout.on("data", (d) => chunks.push(d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(err.slice(-400) || `align exit ${code}`));
      try {
        const out = Buffer.concat(chunks).toString("utf-8");
        const line = out.trim().split(/\r?\n/).filter(Boolean).pop();
        const parsed = JSON.parse(line);
        resolve(parsed.chars || []);
      } catch (e) {
        reject(new Error(`align parse failed: ${e.message}`));
      }
    });
  });
}
const whisperVadModel = path.join(
  os.homedir(),
  ".cache",
  "hyperframes",
  "whisper",
  "models",
  "ggml-silero-v6.2.0.bin",
);
const upload = multer({
  dest: root,
  limits: { fileSize: 8 * 1024 * 1024 * 1024 },
});
const jobs = new Map();
const capcutDraftRoot = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "CapCut",
  "User Data",
  "Projects",
  "com.lveditor.draft",
);
// A CapCut draft stores an absolute path to its source media, so any upload one
// links to has stopped being scratch. Exports pin their own sources, but drafts
// made before that existed — or after a lost manifest — are found by scanning.
async function capcutSourcesInUse() {
  const found = new Set();
  const prefix = path.resolve(root).toLowerCase();
  const scratchName = path.basename(root).toLowerCase();
  // Walk parsed JSON rather than regexing the text: CapCut writes Windows paths
  // with escaped backslashes, and the parser already handles that for us.
  const collect = (node) => {
    if (typeof node === "string") {
      // Cheap reject first: a draft holds thousands of strings, almost none of
      // which are paths.
      if (!node.toLowerCase().includes(scratchName)) return;
      try {
        const resolved = path.resolve(node);
        if (resolved.toLowerCase().startsWith(prefix)) found.add(resolved);
      } catch {
        // Not a usable path.
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) collect(child);
      return;
    }
    if (node && typeof node === "object")
      for (const child of Object.values(node)) collect(child);
  };
  let drafts = [];
  try {
    drafts = await readdir(capcutDraftRoot, { withFileTypes: true });
  } catch {
    return []; // CapCut not installed, or no drafts yet.
  }
  for (const draft of drafts) {
    if (!draft.isDirectory()) continue;
    for (const name of ["draft_content.json", "draft_meta_info.json"]) {
      try {
        collect(
          JSON.parse(
            await readFile(path.join(capcutDraftRoot, draft.name, name), "utf8"),
          ),
        );
      } catch {
        // Missing or half-written draft file — nothing to adopt from it.
      }
    }
  }
  return [...found];
}
// The scratch folder is temporary by definition: sweep it on boot, on a timer,
// and on exit so uploads can never pile up and choke the system drive.
const janitor = createJanitor({ root, jobs, adopt: capcutSourcesInUse });
app.use(express.json({ limit: "2mb" }));

// Detect an NVIDIA GPU once at startup.
try {
  await run("nvidia-smi", ["-L"]);
  gpuAvailable = true;
  console.log("GPU detected — CUDA whisper will be used when available");
} catch {
  gpuAvailable = false;
}

function run(bin, args, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, {
      cwd,
      windowsHide: true,
      shell: false,
      env: { ...process.env, ...extraEnv },
    });
    let out = "",
      err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve({ out, err })
        : reject(new Error(err || out || `exit ${code}`)),
    );
  });
}
function runBuffer(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, {
      cwd,
      windowsHide: true,
      shell: false,
    });
    const chunks = [];
    let err = "";
    p.stdout.on("data", (chunk) => chunks.push(chunk));
    p.stderr.on("data", (chunk) => (err += chunk));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error(err || `exit ${code}`)),
    );
  });
}
function parseSilence(log, duration) {
  const events = [];
  for (const m of log.matchAll(/silence_(start|end):\s*([\d.]+)/g))
    events.push({ type: m[1], time: +m[2] });
  const ranges = [];
  let start = null;
  for (const e of events) {
    if (e.type === "start") start = e.time;
    else if (start !== null) {
      ranges.push({ start: +start.toFixed(3), end: +e.time.toFixed(3) });
      start = null;
    }
  }
  if (start !== null)
    ranges.push({ start: +start.toFixed(3), end: +duration.toFixed(3) });
  return ranges;
}
function mergeNearbyRanges(ranges, maxGap = 0.12) {
  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start - previous.end <= maxGap)
      previous.end = range.end;
    else merged.push({ ...range });
  }
  return merged;
}
function cleanSilenceRanges(ranges, duration, minSpeechIsland = 0.45) {
  const cleaned = mergeNearbyRanges(ranges, minSpeechIsland);
  if (!cleaned.length) return cleaned;
  const edgeMinSpeech = Math.max(0.9, minSpeechIsland);
  while (
    cleaned.length >= 2 &&
    cleaned[0].start < edgeMinSpeech &&
    cleaned[1].start - cleaned[0].end < edgeMinSpeech
  ) {
    cleaned[1].start = cleaned[0].start;
    cleaned.shift();
  }
  while (cleaned.length >= 2) {
    const last = cleaned.at(-1);
    const previous = cleaned.at(-2);
    if (
      !last ||
      !previous ||
      duration - last.end >= edgeMinSpeech ||
      last.start - previous.end >= edgeMinSpeech
    )
      break;
    previous.end = last.end;
    cleaned.pop();
  }
  if (cleaned[0].start < edgeMinSpeech) cleaned[0].start = 0;
  const last = cleaned.at(-1);
  if (last && duration - last.end < edgeMinSpeech) last.end = duration;
  return cleaned.map((range) => ({
    start: +range.start.toFixed(3),
    end: +range.end.toFixed(3),
  }));
}
function speechSegments(silences, duration, minSpeech = 0.25) {
  const kept = [];
  let cursor = 0;
  for (const silence of silences) {
    if (silence.start > cursor)
      kept.push({ start: +cursor.toFixed(3), end: +silence.start.toFixed(3) });
    cursor = Math.max(cursor, silence.end);
  }
  if (cursor < duration)
    kept.push({ start: +cursor.toFixed(3), end: +duration.toFixed(3) });
  return kept.filter((range) => range.end - range.start >= minSpeech);
}
function envelopeFromPcm(buffer, bins = 5000) {
  const sampleCount = Math.floor(buffer.length / 2);
  const per = Math.max(1, Math.ceil(sampleCount / bins));
  const peaks = [];
  for (let start = 0; start < sampleCount; start += per) {
    let peak = 0;
    const end = Math.min(sampleCount, start + per);
    for (let i = start; i < end; i++)
      peak = Math.max(peak, Math.abs(buffer.readInt16LE(i * 2)) / 32768);
    peaks.push(+peak.toFixed(5));
  }
  return peaks;
}
function durationFrom(log) {
  const m = log.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}

function wordsFromWhisper(data) {
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  const words = [];
  for (const segment of data?.transcription || []) {
    const timedTokens = [];
    let rawText = "";
    for (const token of segment.tokens || []) {
      const tokenText = String(token.text || "");
      if (!tokenText || tokenText.startsWith("[_") || tokenText.startsWith("[BLANK"))
        continue;
      const charStart = rawText.length;
      rawText += tokenText;
      timedTokens.push({
        charStart,
        charEnd: rawText.length,
        start: Number(token.offsets?.from || segment.offsets?.from || 0) / 1000,
        end: Number(token.offsets?.to || segment.offsets?.to || 0) / 1000,
      });
    }
    // Without --vad, whisper.cpp token offsets are accurate real-timeline
    // timestamps, so they are used directly (no rescale needed).
    if (!rawText.trim()) rawText = String(segment.text || "");
    const parts = [...segmenter.segment(rawText)].filter(
      (part) => part.isWordLike && part.segment.trim(),
    );
    for (const part of parts) {
      const charStart = part.index;
      const charEnd = charStart + part.segment.length;
      const overlaps = timedTokens.filter(
        (token) => token.charEnd > charStart && token.charStart < charEnd,
      );
      const fallbackStart = Number(segment.offsets?.from || 0) / 1000;
      const fallbackEnd = Number(segment.offsets?.to || 0) / 1000;
      const start = overlaps.length ? overlaps[0].start : fallbackStart;
      const end = overlaps.length ? overlaps.at(-1).end : fallbackEnd;
      words.push({
        id: `w${words.length}`,
        text: part.segment.trim(),
        start: +start.toFixed(3),
        end: +Math.max(start + 0.03, end).toFixed(3),
      });
    }
  }
  return words;
}

function cleanupWords(words, silences, duration) {
  // Whisper (no VAD) hallucinates in the leading/trailing silence (before the
  // first word / after the last). Trim only those edge zones, never mid-content.
  const sorted = [...silences].sort((a, b) => a.start - b.start);
  const leadEnd = sorted[0] && sorted[0].start <= 0.1 ? sorted[0].end : 0;
  const tailStart =
    sorted.length && sorted.at(-1).end >= duration - 0.1
      ? sorted.at(-1).start
      : Infinity;
  const out = words.filter((word) => {
    const mid = (word.start + word.end) / 2;
    return mid >= leadEnd - 0.1 && mid <= tailStart + 0.1;
  });
  // Spread runs of words that collapsed onto one timestamp (whisper token-offset gaps).
  for (let i = 0; i < out.length; ) {
    let j = i;
    while (j + 1 < out.length && out[j + 1].start <= out[i].start + 0.001) j++;
    if (j > i) {
      const t0 = out[i].start;
      let t1 = out[j + 1] ? out[j + 1].start : out[j].end;
      if (!(t1 > t0)) t1 = t0 + (j - i + 1) * 0.12;
      const n = j - i + 1;
      for (let k = i; k <= j; k++) {
        out[k].start = +(t0 + ((t1 - t0) * (k - i)) / n).toFixed(3);
        out[k].end = +(t0 + ((t1 - t0) * (k - i + 1)) / n).toFixed(3);
      }
    }
    i = j + 1;
  }
  // Enforce non-decreasing, non-degenerate timing.
  let prev = -1;
  for (const word of out) {
    if (word.start < prev) word.start = +prev.toFixed(3);
    if (word.end <= word.start) word.end = +(word.start + 0.05).toFixed(3);
    prev = word.start;
  }
  // Trim word ends: alignment often stretches the last char into the pause after
  // a word (and Whisper fallback words can be very long), making caption blocks
  // stick out. Clamp end to the next word's start and cap the duration.
  const MAX_WORD = 1.0;
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    let end = out[i].end;
    if (end - out[i].start > MAX_WORD) end = out[i].start + MAX_WORD;
    end = Math.max(out[i].start + 0.05, end);
    // Never overlap the next word (do this last so the min-duration bump above
    // can't push the end past it).
    if (next && end > next.start) end = next.start;
    out[i].end = +Math.max(out[i].start + 0.02, end).toFixed(3);
  }
  return out.map((word, index) => ({ ...word, id: `w${index}` }));
}

// Map a time in the silence-stripped (concatenated speech) timeline back to the
// original media timeline, using the speech-region layout.
function mapConcatTime(t, layout) {
  for (const seg of layout) {
    if (t <= seg.concatStart + seg.len + 0.0005)
      return seg.origStart + Math.max(0, t - seg.concatStart);
  }
  const last = layout[layout.length - 1];
  return last ? last.origStart + last.len : t;
}

function segmentThaiWords(tokens) {
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  let rawText = "";
  const timed = [];
  for (const token of tokens) {
    const charStart = rawText.length;
    rawText += token.text;
    timed.push({
      charStart,
      charEnd: rawText.length,
      start: token.start,
      end: token.end,
    });
  }
  const words = [];
  for (const part of segmenter.segment(rawText)) {
    if (!part.isWordLike || !part.segment.trim()) continue;
    const charStart = part.index;
    const charEnd = charStart + part.segment.length;
    const overlaps = timed.filter(
      (token) => token.charEnd > charStart && token.charStart < charEnd,
    );
    const start = overlaps.length ? overlaps[0].start : 0;
    const end = overlaps.length ? overlaps.at(-1).end : start;
    words.push({
      id: `w${words.length}`,
      text: part.segment.trim(),
      start: +start.toFixed(3),
      end: +Math.max(start + 0.03, end).toFixed(3),
    });
  }
  return words;
}

app.get("/api/health", async (_, res) => {
  const fs = await import("node:fs/promises");
  const has = async (p) => {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  };
  res.json({
    ok: true,
    ffmpeg: Boolean(ffmpegPath),
    local: true,
    models: {
      default: await has(whisperModelChoices.default),
      thai: await has(whisperModelChoices.thai),
    },
    gpu: gpuAvailable,
    gpuReady: gpuAvailable && (await has(whisperCliGpu)),
    alignReady: await alignerReady(),
    storage: await janitor.stats(),
  });
});
// Manual trigger, mostly for "why is my disk full" moments.
app.post("/api/storage/sweep", async (_, res) => {
  const result = await janitor.sweep();
  res.json({ ...result, storage: await janitor.stats() });
});
app.post("/api/analyze", upload.single("media"), janitor.guardUpload, async (req, res) => {
  let target = "";
  try {
    if (!req.file) throw new Error("ไม่พบไฟล์");
    const id = crypto.randomUUID();
    const ext = path.extname(req.file.originalname) || ".mp4";
    target = req.file.path + ext;
    await import("node:fs/promises").then((fs) =>
      fs.rename(req.file.path, target),
    );
    // Hold the renamed path before releasing the multer one, so the file is
    // never unprotected between the two names.
    janitor.holdUpload(target);
    janitor.releaseUpload(req.file.path);
    const threshold = req.body.threshold || "-30dB";
    const min = req.body.minSilence || "0.45";
    const padding = Math.max(0, Number(req.body.padding || 0.15));
    const minSpeechIsland = Math.max(
      0,
      Math.min(2, Number(req.body.minSpeechIsland || 0.45)),
    );
    const noiseReduce = String(req.body.noiseReduce || "off");
    const denoiseBeforeCut = noiseReduce === "light" || noiseReduce === "strong";
    const analysisFilter = denoiseBeforeCut
      ? `aformat=channel_layouts=mono,highpass=f=75,afftdn=nr=${noiseReduce === "strong" ? 24 : 13}:nf=-25:tn=1,silencedetect=noise=${threshold}:d=${min}`
      : `aformat=channel_layouts=mono,silencedetect=noise=${threshold}:d=${min}`;
    const result = await run(ffmpegPath, [
      "-hide_banner",
      "-i",
      target,
      "-map",
      "0:a:0",
      "-vn",
      "-af",
      analysisFilter,
      "-f",
      "null",
      "-",
    ]);
    const duration = durationFrom(result.err);
    const rawSilences = parseSilence(result.err, duration);
    const waveformArgs = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      target,
      "-map",
      "0:a:0",
      "-vn",
    ];
    if (denoiseBeforeCut)
      waveformArgs.push(
        "-af",
        `highpass=f=75,afftdn=nr=${noiseReduce === "strong" ? 24 : 13}:nf=-25:tn=1`,
      );
    waveformArgs.push(
      "-ac",
      "1",
      "-ar",
      "8000",
      "-f",
      "s16le",
      "-",
    );
    const pcm = await runBuffer(ffmpegPath, waveformArgs);
    const waveformBins = Math.max(
      12000,
      Math.min(60000, Math.ceil(duration * 240)),
    );
    const peaks = envelopeFromPcm(pcm, waveformBins);
    const silences = cleanSilenceRanges(
      rawSilences
        .map((range) => ({
          start: +(range.start + padding).toFixed(3),
          end: +(range.end - padding).toFixed(3),
        }))
        .filter((range) => range.end - range.start >= 0.05),
      duration,
      minSpeechIsland,
    );
    const keepSegments = speechSegments(silences, duration);
    jobs.set(id, {
      file: target,
      name: req.file.originalname,
      duration,
      silences,
      keepSegments,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    });
    res.json({
      id,
      duration,
      silences,
      keepSegments,
      peaks,
      rawSilences,
      padding,
      minSpeechIsland,
      name: req.file.originalname,
      noiseReduce,
    });
    // The job entry now keeps the file alive; the upload hold can go.
    janitor.releaseUpload(target);
  } catch (e) {
    // Nothing will ever reference this upload — do not let it linger.
    janitor.releaseUpload(target, req.file?.path);
    void janitor.discard(target, req.file?.path);
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/transcribe/:id", async (req, res) => {
  const job = janitor.touch(req.params.id);
  if (!job)
    return res.status(404).json({ error: "ไม่พบงาน กรุณาวิเคราะห์ไฟล์ใหม่" });
  const dir = path.join(root, req.params.id);
  try {
    await mkdir(dir, { recursive: true });
    const wavPath = path.join(dir, "speech.wav");
    const outputBase = path.join(dir, "whisper-result");
    // Feed Whisper only the speech regions (silences stripped) so it runs much
    // faster; we map word times back to the original timeline ourselves, so
    // timing stays accurate (unlike Whisper's own --vad).
    const segs = (
      job.keepSegments && job.keepSegments.length
        ? job.keepSegments
        : [{ start: 0, end: job.duration || 0 }]
    ).filter((s) => s.end - s.start >= 0.1);
    if (!segs.length) segs.push({ start: 0, end: job.duration || 0 });
    let cursor = 0;
    const layout = segs.map((s) => {
      const entry = { origStart: s.start, concatStart: cursor, len: s.end - s.start };
      cursor += entry.len;
      return entry;
    });
    const speechOnly = segs.length > 1 || segs[0].start > 0.05;
    if (speechOnly) {
      const parts = segs.map(
        (s, i) => `[0:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS[s${i}]`,
      );
      const concatIn = segs.map((_, i) => `[s${i}]`).join("");
      const filter = `${parts.join(";")};${concatIn}concat=n=${segs.length}:v=0:a=1[out]`;
      await run(
        ffmpegPath,
        ["-hide_banner", "-loglevel", "error", "-y", "-i", job.file,
          "-filter_complex", filter, "-map", "[out]", "-ac", "1", "-ar", "16000", wavPath],
        dir,
      );
    } else {
      await run(
        ffmpegPath,
        ["-hide_banner", "-loglevel", "error", "-y", "-i", job.file,
          "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", wavPath],
        dir,
      );
    }
    const modelPath = await pickWhisperModel(req.body.model);
    const { cli, gpu } = await pickWhisperCli(req.body.compute);
    await run(
      cli,
      [
        "--model",
        modelPath,
        "--language",
        "th",
        "--output-json-full",
        "--output-file",
        outputBase,
        "--suppress-nst",
        "--no-speech-thold",
        "0.6",
        "--entropy-thold",
        "2.6",
        // GPU build benefits from a larger beam; CPU stays greedy for speed.
        "--beam-size",
        gpu ? "5" : "1",
        wavPath,
      ],
      dir,
    );
    const raw = JSON.parse(await readFile(`${outputBase}.json`, "utf8"));
    let words = wordsFromWhisper(raw);
    // Optional: replace Whisper's approximate token times with wav2vec2 forced
    // alignment (accurate to the audio). Keeps Whisper's text.
    if (req.body.align && words.length && (await alignerReady())) {
      try {
        // Whole-audio forced alignment (most accurate): align all Whisper text
        // to the full speech audio in one pass. Where the aligner "collapses"
        // (crams a stretch of words at one instant, leaving a long gap), fall
        // back to Whisper's own timing so no stretch is left without subtitles.
        const thaiText = words.map((w) => w.text).join("");
        const chars = await alignChars(wavPath, thaiText);
        let aligned = segmentThaiWords(
          chars
            .filter((c) => c.text && c.text.trim())
            .map((c) => ({ text: c.text, start: c.start, end: c.end })),
        );
        // Drop collapse artifacts: words crammed into <40ms are align failures.
        aligned = aligned.filter((w) => w.end - w.start >= 0.04);
        if (aligned.length) {
          const filled = [...aligned];
          // Fill gaps > 1.2s (concat audio has no real silence, so a gap that
          // large means the aligner collapsed there) with Whisper words that
          // fall strictly inside the gap.
          for (let i = 0; i < aligned.length - 1; i++) {
            const gap = aligned[i + 1].start - aligned[i].end;
            if (gap > 1.2) {
              const lo = aligned[i].end + 0.1;
              const hi = aligned[i + 1].start - 0.1;
              filled.push(...words.filter((w) => w.start >= lo && w.start <= hi));
            }
          }
          // Leading/trailing speech the aligner dropped entirely.
          const first = aligned[0].start;
          const last = aligned[aligned.length - 1].end;
          filled.push(
            ...words.filter((w) => w.end <= first - 1.2 || w.start >= last + 1.2),
          );
          filled.sort((a, b) => a.start - b.start);
          words = filled;
        }
      } catch (e) {
        console.error("forced align failed, using whisper times:", e.message);
      }
    }
    if (speechOnly) {
      words = words.map((w) => {
        const start = mapConcatTime(w.start, layout);
        const end = mapConcatTime(w.end, layout);
        return {
          ...w,
          start: +start.toFixed(3),
          end: +Math.max(end, start + 0.03).toFixed(3),
        };
      });
    }
    words = cleanupWords(words, job.silences || [], job.duration || 0);
    await rm(wavPath, { force: true });
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(path.join(dir, "transcript.json"), JSON.stringify(words, null, 2)),
    );
    if (!words.length)
      throw new Error("Whisper ไม่พบคำพูดในแทร็กเสียงของไฟล์นี้");
    res.json({ words });
  } catch (e) {
    const unavailable = String(e.message || e).includes("whisper_unavailable");
    res.status(500).json({
      error: unavailable
        ? "ยังไม่พบ Whisper runtime กรุณารีสตาร์ต npm run dev แล้วลองใหม่"
        : `ถอดเสียงไม่สำเร็จ: ${e.message}`,
    });
  }
});
app.post("/api/transcribe-eleven/:id", async (req, res) => {
  const job = janitor.touch(req.params.id);
  if (!job)
    return res.status(404).json({ error: "ไม่พบงาน กรุณาวิเคราะห์ไฟล์ใหม่" });
  const apiKey = String(req.body.apiKey || "").trim();
  if (!apiKey)
    return res.status(400).json({ error: "กรุณาวาง ElevenLabs API Key ก่อน" });
  const dir = path.join(root, req.params.id);
  const wavPath = path.join(dir, "speech-eleven.wav");
  try {
    await mkdir(dir, { recursive: true });
    await run(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        job.file,
        "-map",
        "0:a:0",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        wavPath,
      ],
      dir,
    );
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append(
      "file",
      new Blob([await readFile(wavPath)], { type: "audio/wav" }),
      "speech.wav",
    );
    form.append("language_code", "th");
    form.append("timestamps_granularity", "word");
    const response = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      { method: "POST", headers: { "xi-api-key": apiKey }, body: form },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        data?.detail?.message ||
        (typeof data?.detail === "string" ? data.detail : "") ||
        `ElevenLabs ตอบกลับ ${response.status}`;
      throw new Error(
        response.status === 401
          ? "API Key ไม่ถูกต้องหรือหมดสิทธิ์ใช้งาน"
          : detail,
      );
    }
    const rawTokens = (data.words || [])
      .filter((word) => word.type === "word" && String(word.text || "").trim())
      .map((word) => {
        const start = Number(word.start || 0);
        return {
          text: String(word.text),
          start,
          end: Math.max(start + 0.01, Number(word.end || 0)),
        };
      });
    const words = segmentThaiWords(rawTokens);
    if (!words.length)
      throw new Error("ElevenLabs ไม่พบคำพูดในแทร็กเสียงของไฟล์นี้");
    await import("node:fs/promises").then((fs) =>
      fs.writeFile(
        path.join(dir, "transcript.json"),
        JSON.stringify(words, null, 2),
      ),
    );
    res.json({ words });
  } catch (e) {
    res
      .status(500)
      .json({ error: `ถอดเสียง (ElevenLabs) ไม่สำเร็จ: ${e.message}` });
  } finally {
    await rm(wavPath, { force: true });
  }
});
app.post("/api/export-cut/:id", async (req, res) => {
  const job = janitor.touch(req.params.id);
  if (!job)
    return res.status(404).json({ error: "ไม่พบงาน กรุณาวิเคราะห์ไฟล์ใหม่" });
  const ranges = (req.body.silences || [])
    .map((range) => ({ start: Number(range.start), end: Number(range.end) }))
    .filter(
      (range) =>
        Number.isFinite(range.start) &&
        Number.isFinite(range.end) &&
        range.start >= 0 &&
        range.end > range.start &&
        range.end <= job.duration + 0.1,
    )
    .sort((a, b) => a.start - b.start);
  const requestedSegments = (req.body.keepSegments || [])
    .map((range) => ({ start: Number(range.start), end: Number(range.end) }))
    .filter(
      (range) =>
        Number.isFinite(range.start) &&
        Number.isFinite(range.end) &&
        range.start >= 0 &&
        range.end > range.start &&
        range.end <= job.duration + 0.1,
    );
  if (!ranges.length && !requestedSegments.length)
    return res.status(400).json({ error: "Timeline ไม่มีช่วงวิดีโอสำหรับส่งออก" });
  const output = path.join(root, `${req.params.id}-cut.mp4`);
  const resolutionMatch = String(
    req.body.sequence?.resolution || "1920×1080",
  ).match(/^(\d+)[×x](\d+)$/);
  const outputWidth = Math.max(2, Number(resolutionMatch?.[1] || 1920));
  const outputHeight = Math.max(2, Number(resolutionMatch?.[2] || 1080));
  const outputFps = Math.max(1, Math.min(120, Number(req.body.sequence?.fps || 30)));
  const kept = requestedSegments.length
    ? requestedSegments
    : speechSegments(ranges, job.duration);
  if (!kept.length)
    return res.status(400).json({ error: "ไม่มีช่วงคำพูดเหลือหลังตัด" });
  const filters = kept.flatMap((range, index) => [
    `[0:v]trim=start=${range.start}:end=${range.end},setpts=PTS-STARTPTS,scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:black,fps=${outputFps}[v${index}]`,
    `[0:a]atrim=start=${range.start}:end=${range.end},asetpts=PTS-STARTPTS[a${index}]`,
  ]);
  const inputs = kept.map((_, index) => `[v${index}][a${index}]`).join("");
  const noise = String(req.body.noiseReduce || "");
  const denoiseAudio = noise === "light" || noise === "strong";
  filters.push(
    `${inputs}concat=n=${kept.length}:v=1:a=1[v][${denoiseAudio ? "araw" : "a"}]`,
  );
  if (denoiseAudio) {
    // Cut low rumble, then adaptive FFT denoise (afftdn) — bundled, no model.
    const nr = noise === "strong" ? 24 : 13;
    filters.push(
      `[araw]highpass=f=75,afftdn=nr=${nr}:nf=-25:tn=1,alimiter=limit=0.98[a]`,
    );
  }
  const quality = String(req.body.quality || "high");
  const crf = quality === "maximum" ? "16" : quality === "balanced" ? "23" : "19";
  const preset = quality === "maximum" ? "slow" : quality === "balanced" ? "veryfast" : "medium";
  try {
    await run(ffmpegPath, [
      "-hide_banner",
      "-y",
      "-i",
      job.file,
      "-filter_complex",
      filters.join(";"),
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-c:v",
      "libx264",
      "-preset",
      preset,
      "-crf",
      crf,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      output,
    ]);
    const base = path.parse(job.name).name.replace(/[\\/:*?"<>|]/g, "-");
    // The browser owns the file once it has been saved; the render is scratch.
    janitor.dropAfterSend(res, output);
    res.download(output, `${base}-export.mp4`);
  } catch (e) {
    res.status(500).json({ error: `ตัดวิดีโอไม่สำเร็จ: ${e.message}` });
  }
});
app.post("/api/export-srt", async (req, res) => {
  const caps = req.body.captions || [];
  const tc = (s) => {
    const ms = Math.round(s * 1000);
    const h = Math.floor(ms / 3600000),
      m = Math.floor((ms % 3600000) / 60000),
      ss = Math.floor((ms % 60000) / 1000),
      x = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")},${String(x).padStart(3, "0")}`;
  };
  const srt = caps
    .map((c, i) => `${i + 1}\n${tc(c.start)} --> ${tc(c.end)}\n${c.text}\n`)
    .join("\n");
  res
    .type("application/x-subrip")
    .set("Content-Disposition", 'attachment; filename="subtitles-th.srt"')
    .send(srt);
});
app.post("/api/export-capcut/:id", async (req, res) => {
  const job = janitor.touch(req.params.id);
  if (!job)
    return res.status(404).json({ error: "ไม่พบงาน กรุณาวิเคราะห์ไฟล์ใหม่" });
  try {
    const requestedSources = Array.isArray(req.body.sources)
      ? req.body.sources
      : [];
    const sourceJobs = requestedSources.length
      ? requestedSources.map((source) => janitor.touch(String(source.jobId || "")))
      : [job];
    if (sourceJobs.some((source) => !source))
      return res.status(404).json({ error: "ไฟล์ต้นฉบับบางก้อนไม่พร้อม กรุณาวิเคราะห์ Media ใหม่" });
    const sourceDuration = sourceJobs.reduce(
      (total, source) => total + (Number(source.duration) || 0),
      0,
    );
    const rawSegments = Array.isArray(req.body.segments) && req.body.segments.length
      ? req.body.segments
      : [{ start: 0, end: sourceDuration }];
    const segments = rawSegments
      .map((s) => ({
        start: Number(s.start),
        end: Number(s.end),
        sourceIndex: Math.max(
          0,
          Math.min(sourceJobs.length - 1, Number(s.sourceIndex || 0)),
        ),
      }))
      .filter(
        (s) =>
          Number.isFinite(s.start) &&
          Number.isFinite(s.end) &&
          s.end > s.start,
      );
    if (!segments.length)
      return res.status(400).json({ error: "ไม่มีคลิปสำหรับส่งออก" });
    const captions = (req.body.captions || [])
      .map((c) => ({
        text: String(c.text || ""),
        start: Number(c.start),
        end: Number(c.end),
      }))
      .filter((c) => c.text.trim() && Number.isFinite(c.start) && c.end > c.start);
    const resMatch = String(req.body.resolution || "1920×1080").match(
      /^(\d+)[×x](\d+)$/,
    );
    const canvasW = Math.max(2, Number(resMatch?.[1] || 1920));
    const canvasH = Math.max(2, Number(resMatch?.[2] || 1080));
    const fps = Math.max(1, Math.min(120, Number(req.body.fps || 30)));
    const width = Math.max(2, Number(req.body.width || canvasW));
    const height = Math.max(2, Number(req.body.height || canvasH));
    const mediaSources = sourceJobs.map((source) => ({
      path: source.file,
      name: source.name || path.basename(source.file),
      durationUs: Math.round((Number(source.duration) || 0) * US),
      width,
      height,
      hasAudio: true,
    }));

    const draftRoot = capcutDraftRoot;
    const { contentRef, textRef } = await findTemplates(draftRoot, "0722");

    const baseName = path
      .parse(job.name || "silence-studio")
      .name.replace(/[\\/:*?"<>|]/g, "-")
      .slice(0, 40);
    const projectName = `${baseName}-jumpcut`;
    const foldPath = path.join(draftRoot, projectName);

    const draftId = crypto.randomUUID().toUpperCase();
    const timelineId = crypto.randomUUID().toUpperCase();
    const { draft, totalUs } = buildDraftContent({
      contentDraft: contentRef.draft,
      textDraft: textRef?.draft || null,
      videoPath: job.file,
      videoName: job.name || path.basename(job.file),
      width,
      height,
      sourceDurationUs: Math.round(sourceDuration * US),
      hasAudio: true,
      canvasW,
      canvasH,
      fps,
      segments,
      captions,
      timelineId,
      mediaSources,
    });

    const createUs = Date.now() * 1000;
    const refMeta = JSON.parse(
      await readFile(path.join(contentRef.dir, "draft_meta_info.json"), "utf8"),
    );
    const meta = buildDraftMeta(refMeta, {
      draftId,
      draftName: projectName,
      foldPath,
      rootPath: draftRoot.replace(/\//g, "\\"),
      durationUs: totalUs,
      createUs,
      media: {
        path: job.file,
        name: job.name,
        width,
        height,
        durationUs: Math.round(sourceDuration * US),
      },
      medias: mediaSources,
    });

    // Clone the reference project folder, then overwrite the draft files.
    await rm(foldPath, { recursive: true, force: true });
    await cp(contentRef.dir, foldPath, { recursive: true });

    // A cloned CapCut draft still points at the template's timeline folder.
    // Rename that folder and rewrite Timelines/project.json so the generated
    // draft is internally consistent and opens instead of merely appearing.
    const timelinesDir = path.join(foldPath, "Timelines");
    const projectJsonPath = path.join(timelinesDir, "project.json");
    const timelineProject = JSON.parse(await readFile(projectJsonPath, "utf8"));
    const oldTimelineId = timelineProject.main_timeline_id;
    if (!oldTimelineId)
      throw new Error("template 0722 ไม่มี main_timeline_id");
    const oldTimelineDir = path.join(timelinesDir, oldTimelineId);
    const newTimelineDir = path.join(timelinesDir, timelineId);
    await rename(oldTimelineDir, newTimelineDir);
    const timelineNowUs = Date.now() * 1000;
    timelineProject.main_timeline_id = timelineId;
    timelineProject.update_time = timelineNowUs;
    timelineProject.timelines = [
      {
        ...(timelineProject.timelines || []).find((t) => t.id === oldTimelineId),
        id: timelineId,
        is_marked_delete: false,
        update_time: timelineNowUs,
      },
    ];
    const timelineProjectJson = JSON.stringify(timelineProject);
    await writeFile(projectJsonPath, timelineProjectJson, "utf8");
    await writeFile(
      path.join(timelinesDir, "project.json.bak"),
      timelineProjectJson,
      "utf8",
    );

    const draftJson = JSON.stringify(draft);
    const targets = [
      path.join(foldPath, "draft_content.json"),
      path.join(foldPath, "template-2.tmp"),
      path.join(foldPath, "draft_content.json.bak"),
      path.join(newTimelineDir, "draft_content.json"),
      path.join(newTimelineDir, "template-2.tmp"),
      path.join(newTimelineDir, "draft_content.json.bak"),
    ];
    for (const target of targets) {
      try {
        await writeFile(target, draftJson, "utf8");
      } catch {}
    }
    await writeFile(
      path.join(foldPath, "draft_meta_info.json"),
      JSON.stringify(meta),
      "utf8",
    );

    // Register the project so CapCut lists it (backup the index first).
    const rootMetaPath = path.join(draftRoot, "root_meta_info.json");
    try {
      const rootMeta = JSON.parse(await readFile(rootMetaPath, "utf8"));
      await writeFile(
        `${rootMetaPath}.silence-studio.bak`,
        JSON.stringify(rootMeta),
        "utf8",
      );
      const { root } = registerInRoot(rootMeta, {
        draftId,
        draftName: projectName,
        foldPath,
        rootPath: draftRoot.replace(/\//g, "\\"),
        durationUs: totalUs,
        createUs,
      });
      await writeFile(rootMetaPath, JSON.stringify(root), "utf8");
    } catch (e) {
      // Registration is best-effort; CapCut usually rescans the folder anyway.
    }

    // The draft stores absolute paths into the scratch folder, so these source
    // files stop being disposable the moment CapCut links to them.
    await janitor.pin(
      sourceJobs.map((source) => source.file),
      projectName,
    );

    res.json({
      project: projectName,
      folder: foldPath,
      template: contentRef.name,
      draftId,
      timelineId,
      clips: segments.length,
      captions: captions.length,
      duration: +(totalUs / US).toFixed(2),
    });
  } catch (e) {
    res
      .status(500)
      .json({ error: `สร้าง CapCut draft ไม่สำเร็จ: ${e.message}` });
  }
});
await janitor.start();
app.listen(5174, "127.0.0.1", () =>
  console.log("Local media API http://127.0.0.1:5174"),
);
