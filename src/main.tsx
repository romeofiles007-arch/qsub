import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Upload,
  Play,
  Pause,
  Scissors,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  SkipBack,
  SkipForward,
  Search,
  Square,
  Magnet,
  Maximize2,
  Trash2,
} from "lucide-react";
import "./styles.css";

type Word = { text: string; start: number; end: number };
type CaptionBlock = { text: string; start: number; end: number };
type MediaBinItem = {
  id: string;
  file: File;
  url: string;
  name: string;
  duration: number;
  thumbnail: string;
};
type EditorSnapshot = {
  timelineMedia: string[];
  editSegments: Array<{ start: number; end: number }>;
  transcript: Word[];
  captionEdits: CaptionBlock[] | null;
  silences: Array<{ start: number; end: number; enabled: boolean }>;
  appliedSilences: Array<{ start: number; end: number }>;
  duration: number;
  noiseReduce: "off" | "light" | "strong";
  count: number;
  captionPosition: { x: number; y: number };
  captionSize: number;
};
type DragType =
  | "playhead"
  | "caption"
  | "left"
  | "right"
  | "preview"
  | "caption-scale"
  | "timeline-height"
  | "layout-left"
  | "layout-right"
  | "silence-move"
  | "silence-left"
  | "silence-right";
const CAPTION_ANIMS = [
  { id: "none", name: "ไม่มี" },
  { id: "pop", name: "Pop" },
  { id: "fade", name: "Fade" },
  { id: "rise", name: "Slide ขึ้น" },
  { id: "zoom", name: "Zoom" },
  { id: "bounce", name: "Bounce" },
];
const THAI_FONTS = [
  { name: "Kanit", family: "Kanit, sans-serif" },
  { name: "Prompt", family: "Prompt, sans-serif" },
  { name: "Sarabun", family: "Sarabun, sans-serif" },
  { name: "Noto Sans Thai", family: "'Noto Sans Thai', sans-serif" },
  { name: "IBM Plex Sans Thai", family: "'IBM Plex Sans Thai', sans-serif" },
];
const PRESETS = [
  {
    name: "Creator",
    fg: "oklch(1 0 0)",
    active: "oklch(.87 .18 95)",
    stroke: "oklch(.12 0 0)",
    bg: "transparent",
    font: 800,
    transform: "none",
  },
  {
    name: "Minimal",
    fg: "oklch(1 0 0)",
    active: "oklch(1 0 0)",
    stroke: "transparent",
    bg: "oklch(0 0 0 / .62)",
    font: 600,
    transform: "none",
  },
  {
    name: "Electric",
    fg: "oklch(.95 .04 205)",
    active: "oklch(.8 .14 210)",
    stroke: "oklch(.14 .025 220)",
    bg: "transparent",
    font: 900,
    transform: "uppercase",
  },
  {
    name: "Punch",
    fg: "oklch(1 0 0)",
    active: "oklch(.7 .2 25)",
    stroke: "oklch(.16 .04 25)",
    bg: "transparent",
    font: 900,
    transform: "none",
  },
];
const STYLE_LIBRARY = [
  {
    name: "ขาวคม",
    sample: "คำพูด",
    fg: "oklch(1 0 0)",
    active: "oklch(1 0 0)",
    stroke: "oklch(.08 0 0)",
    bg: "transparent",
    font: 800,
    transform: "none",
  },
  {
    name: "ฟ้านีออน",
    sample: "คำพูด",
    fg: "oklch(.9 .08 205)",
    active: "oklch(.8 .14 210)",
    stroke: "oklch(.12 .03 220)",
    bg: "transparent",
    font: 900,
    transform: "none",
  },
  {
    name: "เหลืองป๊อป",
    sample: "คำพูด",
    fg: "oklch(.88 .18 96)",
    active: "oklch(.72 .2 38)",
    stroke: "oklch(.11 0 0)",
    bg: "transparent",
    font: 900,
    transform: "none",
  },
  {
    name: "แดงพลัง",
    sample: "คำพูด",
    fg: "oklch(.68 .22 27)",
    active: "oklch(.82 .16 60)",
    stroke: "oklch(.13 .03 27)",
    bg: "transparent",
    font: 900,
    transform: "none",
  },
  {
    name: "มินิมอล",
    sample: "คำพูด",
    fg: "oklch(.16 0 0)",
    active: "oklch(.16 0 0)",
    stroke: "transparent",
    bg: "oklch(.95 0 0 / .92)",
    font: 700,
    transform: "none",
  },
  {
    name: "ม่วงคาราโอเกะ",
    sample: "คำพูด",
    fg: "oklch(.95 .03 300)",
    active: "oklch(.73 .2 300)",
    stroke: "oklch(.15 .04 300)",
    bg: "transparent",
    font: 900,
    transform: "none",
  },
  {
    name: "กล่องดำ",
    sample: "คำพูด",
    fg: "oklch(1 0 0)",
    active: "oklch(.87 .18 95)",
    stroke: "transparent",
    bg: "oklch(.08 0 0 / .82)",
    font: 700,
    transform: "none",
  },
  {
    name: "ขาวแดง",
    sample: "คำพูด",
    fg: "oklch(1 0 0)",
    active: "oklch(.67 .22 25)",
    stroke: "oklch(.1 0 0)",
    bg: "transparent",
    font: 900,
    transform: "none",
  },
  {
    name: "เขียวเกม",
    sample: "คำพูด",
    fg: "oklch(.82 .2 145)",
    active: "oklch(.9 .17 105)",
    stroke: "oklch(.13 .04 145)",
    bg: "transparent",
    font: 900,
    transform: "uppercase",
  },
  {
    name: "Creator Pro",
    sample: "คำพูด",
    fg: "oklch(1 0 0)",
    active: "oklch(.87 .18 95)",
    stroke: "oklch(.12 0 0)",
    bg: "transparent",
    font: 900,
    transform: "none",
  },
];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const f = Math.floor((s % 1) * 30);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}
function resampleWaveform(source: number[], targetBins: number) {
  const result: number[] = [];
  const count = Math.max(1, targetBins);
  if (!source.length) return new Array(count).fill(0);
  for (let bin = 0; bin < count; bin++) {
    const from = Math.floor((bin / count) * source.length);
    const to = Math.max(
      from + 1,
      Math.ceil(((bin + 1) / count) * source.length),
    );
    let peak = 0;
    for (let index = from; index < Math.min(source.length, to); index++)
      peak = Math.max(peak, source[index]);
    result.push(peak);
  }
  return result;
}
function blocks(words: Word[], count: number): CaptionBlock[] {
  const out = [];
  for (let i = 0; i < words.length; i += count) {
    const group = words.slice(i, i + count);
    out.push({
      text: group.map((w) => w.text).join(""),
      start: group[0].start,
      end: group.at(-1)!.end,
    });
  }
  return out;
}

// Remove only the portion of a caption that overlaps the next caption.
// Starts are deliberately never moved: C1 [1.0, 3.0] + C2 [2.5, 4.0]
// becomes C1 [1.0, 2.5] + C2 [2.5, 4.0].
function trimCaptionOverlaps(captions: CaptionBlock[]): CaptionBlock[] {
  return captions.map((caption, index) => {
    const next = captions[index + 1];
    if (!next || caption.end <= next.start) return caption;
    // Strict one-word timing: remove the entire covered tail. If Whisper gives
    // two consecutive words the same start, the earlier block becomes zero
    // length instead of being allowed to overlap the later word.
    return {
      ...caption,
      end: +Math.max(caption.start, next.start).toFixed(3),
    };
  });
}

function App() {
  const video = useRef<HTMLVideoElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const pendingPreviewRef = useRef<{ localTime: number; play: boolean } | null>(
    null,
  );
  const previewSyncLockUntilRef = useRef(0);
  const dragRef = useRef<{
    type: DragType;
    index?: number;
    startX: number;
    startY: number;
    startTime: number;
    startEnd?: number;
    startHeight?: number;
    startWidth?: number;
    startPos?: { x: number; y: number };
    startSize?: number;
    group?: Array<{ index: number; start: number; end: number }>;
    resumePlayback?: boolean;
    moved?: boolean;
  } | null>(null);
  const [src, setSrc] = useState("");
  const [activePreviewMediaId, setActivePreviewMediaId] = useState("");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [sequenceResolution, setSequenceResolution] = useState("1920×1080");
  const [sequenceRatio, setSequenceRatio] = useState("16 / 9");
  const [sequenceFps, setSequenceFps] = useState(30);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportName, setExportName] = useState("video-final");
  const [exportQuality, setExportQuality] = useState("high");
  const [noiseReduce, setNoiseReduce] = useState<"off" | "light" | "strong">(
    "off",
  );
  const [exportWithSrt, setExportWithSrt] = useState(true);
  const [exportDirectory, setExportDirectory] = useState<any>(null);
  const [exportDirectoryName, setExportDirectoryName] = useState("Downloads");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(15);
  const [sourceDuration, setSourceDuration] = useState(15);
  const [zoom, setZoom] = useState(1);
  const [count, setCount] = useState(4);
  const [selectedFont, setSelectedFont] = useState(0);
  const [captionSize, setCaptionSize] = useState(64);
  const [captionAnim, setCaptionAnim] = useState("pop");
  const [preset, setPreset] = useState(0);
  const [rightTab, setRightTab] = useState<"caption" | "silence">("caption");
  const [libraryStyle, setLibraryStyle] = useState(9);
  const [styleSource, setStyleSource] = useState<"library" | "preset">(
    "library",
  );
  const [transcript, setTranscript] = useState<Word[]>([]);
  const [selected, setSelected] = useState(0);
  const [checkedCaps, setCheckedCaps] = useState<number[]>([]);
  const [capMarquee, setCapMarquee] = useState<{
    left: number;
    width: number;
  } | null>(null);
  const capMarqueeRef = useRef<{
    startX: number;
    currentX: number;
    rect: DOMRect;
  } | null>(null);
  const listSelRef = useRef<number | null>(null);
  const [thaiModel, setThaiModel] = useState(false);
  const [gpuReady, setGpuReady] = useState(false);
  const [alignReady, setAlignReady] = useState(false);
  const [alignOn, setAlignOn] = useState(
    () => localStorage.getItem("alignOn") !== "0",
  );
  const [compute, setCompute] = useState<"auto" | "gpu" | "cpu">(
    () =>
      (localStorage.getItem("compute") as "auto" | "gpu" | "cpu") || "auto",
  );
  const [subEngine, setSubEngine] = useState<"whisper" | "whisper-th" | "eleven">(
    () =>
      (localStorage.getItem("subEngine") as
        | "whisper"
        | "whisper-th"
        | "eleven") || "whisper",
  );
  const [elevenKey, setElevenKey] = useState(
    () => localStorage.getItem("elevenKey") || "",
  );
  const [subSync, setSubSync] = useState(0);
  const [trackVisible, setTrackVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaBin, setMediaBin] = useState<MediaBinItem[]>([]);
  const [timelineMedia, setTimelineMedia] = useState<string[]>([]);
  const [selectedTimelineMedia, setSelectedTimelineMedia] = useState<number[]>([]);
  const [selectedBinIds, setSelectedBinIds] = useState<string[]>([]);
  const mediaBinListRef = useRef<HTMLDivElement>(null);
  const [binMarquee, setBinMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const binMarqueeRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    rect: DOMRect;
    additive: boolean;
  } | null>(null);
  const [mediaDropActive, setMediaDropActive] = useState(false);
  const [jobId, setJobId] = useState("");
  const [silences, setSilences] = useState<
    Array<{ start: number; end: number; enabled: boolean }>
  >([]);
  const [threshold, setThreshold] = useState(-32);
  const [minSilence, setMinSilence] = useState(0.6);
  const [padding, setPadding] = useState(0.15);
  const minSpeechIsland = 0.45;
  const [previewCuts, setPreviewCuts] = useState(false);
  const [processing, setProcessing] = useState("");
  const [notice, setNotice] = useState("");
  const [peaks, setPeaks] = useState<number[]>([]);
  const [mediaWaveforms, setMediaWaveforms] = useState<Record<string, number[]>>({});
  const [mediaJobIds, setMediaJobIds] = useState<Record<string, string>>({});
  const [analyzedMediaIds, setAnalyzedMediaIds] = useState<string[]>([]);
  const [editSegments, setEditSegments] = useState<
    Array<{ start: number; end: number }>
  >([]);
  const [selectedEditSegment, setSelectedEditSegment] = useState<number | null>(null);
  const [selectedEditSegments, setSelectedEditSegments] = useState<number[]>([]);
  const [marquee, setMarquee] = useState<{ left: number; width: number } | null>(null);
  const marqueeRef = useRef<{
    startX: number;
    currentX: number;
    rect: DOMRect;
    onClip: boolean;
    moved: boolean;
  } | null>(null);
  const [extraVideoTracks, setExtraVideoTracks] = useState(0);
  const [selectedExtraTrack, setSelectedExtraTrack] = useState<number | null>(null);
  const [appliedSilences, setAppliedSilences] = useState<
    Array<{ start: number; end: number }>
  >([]);
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [captionEdits, setCaptionEdits] = useState<CaptionBlock[] | null>(null);
  const [captionPosition, setCaptionPosition] = useState({ x: 50, y: 82 });
  const [timelineHeight, setTimelineHeight] = useState(330);
  const [leftPanelWidth, setLeftPanelWidth] = useState(310);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(980);
  const syncedWords = useMemo(
    () =>
      subSync
        ? transcript.map((word) => ({
            ...word,
            start: Math.max(0, +(word.start + subSync).toFixed(3)),
            end: Math.max(0.03, +(word.end + subSync).toFixed(3)),
          }))
        : transcript,
    [transcript, subSync],
  );
  const generatedCaps = useMemo(
    () => trimCaptionOverlaps(blocks(syncedWords, count)),
    [syncedWords, count],
  );
  const caps = useMemo(
    () => trimCaptionOverlaps(captionEdits ?? generatedCaps),
    [captionEdits, generatedCaps],
  );
  const historyRef = useRef<EditorSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextHistoryRef = useRef(false);
  const [, setHistoryRevision] = useState(0);
  const makeSnapshot = (): EditorSnapshot =>
    structuredClone({
      timelineMedia,
      editSegments,
      transcript,
      captionEdits,
      silences,
      appliedSilences,
      duration,
      noiseReduce,
      count,
      captionPosition,
      captionSize,
    });
  const commitHistory = () => {
    const snapshot = makeSnapshot();
    const current = historyRef.current[historyIndexRef.current];
    if (current && JSON.stringify(current) === JSON.stringify(snapshot)) return;
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 80) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    setHistoryRevision((value) => value + 1);
  };
  const restoreSnapshot = (snapshot: EditorSnapshot) => {
    skipNextHistoryRef.current = true;
    setTimelineMedia(snapshot.timelineMedia);
    setEditSegments(snapshot.editSegments);
    setTranscript(snapshot.transcript);
    setCaptionEdits(snapshot.captionEdits);
    setSilences(snapshot.silences);
    setAppliedSilences(snapshot.appliedSilences);
    setDuration(snapshot.duration);
    setNoiseReduce(snapshot.noiseReduce);
    setCount(snapshot.count);
    setCaptionPosition(snapshot.captionPosition);
    setCaptionSize(snapshot.captionSize);
  };
  const undo = () => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    commitHistory();
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    setHistoryRevision((value) => value + 1);
  };
  const redo = () => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    restoreSnapshot(historyRef.current[historyIndexRef.current]);
    setHistoryRevision((value) => value + 1);
  };
  useEffect(() => {
    if (skipNextHistoryRef.current) {
      skipNextHistoryRef.current = false;
      return;
    }
    if (!historyRef.current.length) {
      commitHistory();
      return;
    }
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(commitHistory, 180);
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    };
  }, [
    timelineMedia,
    editSegments,
    transcript,
    captionEdits,
    silences,
    appliedSilences,
    duration,
    noiseReduce,
    count,
    captionPosition,
    captionSize,
  ]);
  // Whisper word times run slightly behind the audio; lead both the caption and
  // the karaoke highlight so they land on / just before the spoken word.
  const SUB_LEAD = 0.18;
  const active = caps.findIndex(
    (c) => time >= c.start - SUB_LEAD && time <= c.end,
  );
  const insideEnabledSilence = silences.some(
    (silence) => silence.enabled && time >= silence.start && time < silence.end,
  );
  const current = insideEnabledSilence ? "" : caps[active]?.text || "";
  const activeCaptionWords = active >= 0
    ? syncedWords.filter(
        (word) =>
          word.end > caps[active].start && word.start < caps[active].end,
      )
    : [];
  // Exactly one word is "active" at a time: the last word whose start has passed.
  const activeWordIndex = (() => {
    let idx = -1;
    for (let i = 0; i < activeCaptionWords.length; i++) {
      if (time >= activeCaptionWords[i].start - SUB_LEAD) idx = i;
      else break;
    }
    return idx;
  })();
  const changeSubSync = (next: number) => {
    const clamped = Math.max(-2, Math.min(2, +next.toFixed(2)));
    const delta = clamped - subSync;
    if (!delta) return;
    setCaptionEdits((list) =>
      list
        ? list.map((caption) => ({
            ...caption,
            start: Math.max(0, +(caption.start + delta).toFixed(3)),
            end: Math.max(0.06, +(caption.end + delta).toFixed(3)),
          }))
        : list,
    );
    setSubSync(clamped);
  };
  const updateCaptionText = (index: number, text: string) => {
    setCaptionEdits((currentEdits) => {
      const list = [...(currentEdits ?? generatedCaps)];
      if (!list[index]) return list;
      list[index] = { ...list[index], text };
      return list;
    });
  };
  const updateSelectedCaptionText = (text: string) =>
    updateCaptionText(selected, text);
  const updateSelectedCaptionTime = (field: "start" | "end", value: number) => {
    setCaptionEdits((currentEdits) => {
      const list = [...(currentEdits ?? generatedCaps)];
      const item = list[selected];
      if (!item || !Number.isFinite(value)) return list;
      list[selected] = {
        ...item,
        [field]:
          field === "start"
            ? Math.max(0, Math.min(item.end - 0.03, value))
            : Math.min(duration, Math.max(item.start + 0.03, value)),
      };
      return list;
    });
  };
  const captionIssues = useMemo(
    () =>
      caps.map((caption, index) => {
        const issues: string[] = [];
        const text = caption.text.trim();
        const length = caption.end - caption.start;
        const next = caps[index + 1];
        if (!text) issues.push("ข้อความว่าง");
        else if (text.length / Math.max(0.1, length) > 25)
          issues.push("อ่านไม่ทัน");
        if (length < 0.3) issues.push("สั้นเกินไป");
        else if (length > 7) issues.push("ยาวเกินไป");
        if (next && next.start < caption.end - 0.001)
          issues.push("เวลาซ้อนก้อนถัดไป");
        return issues;
      }),
    [caps],
  );
  const captionIssueCount = captionIssues.filter((list) => list.length).length;
  const deleteCheckedCaps = () => {
    if (!checkedCaps.length) return setNotice("ยังไม่ได้เลือกซับ");
    const ranges = checkedCaps.map((index) => caps[index]).filter(Boolean);
    setTranscript((words) =>
      words.filter((word) => {
        const wordStart = word.start + subSync;
        const wordEnd = word.end + subSync;
        return !ranges.some(
          (range) => wordEnd > range.start && wordStart < range.end,
        );
      }),
    );
    setCheckedCaps([]);
    setNotice(`ลบซับที่เลือก ${ranges.length} ก้อนแล้ว`);
  };
  const deleteAllCaps = () => {
    setTranscript([]);
    setCaptionEdits(null);
    setCheckedCaps([]);
    setNotice('ลบซับทั้งหมดแล้ว · กด "สร้างซับ" เพื่อทำใหม่');
  };
  const beginCapMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".caption-track button")) return;
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const startX = Math.max(rect.left, Math.min(rect.right, event.clientX));
    capMarqueeRef.current = { startX, currentX: startX, rect };
    setCapMarquee({ left: ((startX - rect.left) / rect.width) * 100, width: 0 });
    document.body.classList.add("is-dragging");
  };
  const enabledSilences = silences.filter((silence) => silence.enabled);
  const removedDuration = enabledSilences.reduce(
    (total, silence) => total + silence.end - silence.start,
    0,
  );
  const editSegmentLayout = useMemo(() => {
    let cursor = 0;
    return editSegments.map((segment) => {
      const outputStart = cursor;
      const length = segment.end - segment.start;
      cursor += length;
      return { ...segment, outputStart, length };
    });
  }, [editSegments]);
  useEffect(() => {
    if (!timelineMedia.length) return;
    const total = timelineMedia.reduce(
      (sum, id) => sum + (mediaBin.find((item) => item.id === id)?.duration || 0),
      0,
    );
    if (total > 0) setDuration(total);
  }, [timelineMedia, mediaBin]);
  useEffect(() => {
    if (!timelineMedia.length) return;
    const combined: number[] = [];
    let totalDuration = 0;
    for (const mediaId of timelineMedia) {
      const item = mediaBin.find((entry) => entry.id === mediaId);
      const itemDuration = item?.duration || 0;
      if (itemDuration <= 0) continue;
      totalDuration += itemDuration;
      const source = mediaWaveforms[mediaId] || [];
      const targetBins = Math.max(1, Math.round(itemDuration * 240));
      // Copy bin by bin. Spreading into push() passes every bin as a separate
      // function argument, which overflows the stack past ~124k of them — only
      // about 8.5 minutes at 240 bins per second. A single longer clip used to
      // throw here, and because this runs in an effect React tore the whole
      // editor down and left a black screen.
      const bins = resampleWaveform(source, targetBins);
      for (let index = 0; index < bins.length; index++) combined.push(bins[index]);
    }
    if (combined.length) setPeaks(combined);
    if (totalDuration > 0) setSourceDuration(totalDuration);
  }, [timelineMedia, mediaBin, mediaWaveforms]);
  const style =
    styleSource === "library" ? STYLE_LIBRARY[libraryStyle] : PRESETS[preset];
  const mediaTimelineLayout = useMemo(() => {
    let start = 0;
    return timelineMedia.map((mediaId, index) => {
      const item = mediaBin.find((entry) => entry.id === mediaId);
      const length = item?.duration || 0;
      const segment = { mediaId, index, item, start, length };
      start += length;
      return segment;
    });
  }, [timelineMedia, mediaBin]);
  const detectedVideoLayout = useMemo(() => {
    if (!analyzedMediaIds.length || editSegments.length) return [];
    const enabled = silences
      .filter((silence) => silence.enabled)
      .sort((a, b) => a.start - b.start);
    return mediaTimelineLayout.flatMap((media) => {
      const mediaEnd = media.start + media.length;
      const analyzed = analyzedMediaIds.includes(media.mediaId);
      if (!analyzed)
        return [{
          start: media.start,
          end: mediaEnd,
          outputStart: media.start,
          length: media.length,
          analyzed: false,
          mediaIndex: media.index,
        }];
      const kept: Array<{ start: number; end: number }> = [];
      let cursor = media.start;
      for (const silence of enabled) {
        const silenceStart = Math.max(media.start, silence.start);
        const silenceEnd = Math.min(mediaEnd, silence.end);
        if (silenceEnd <= media.start || silenceStart >= mediaEnd) continue;
        if (silenceStart > cursor)
          kept.push({ start: cursor, end: silenceStart });
        cursor = Math.max(cursor, silenceEnd);
      }
      if (cursor < mediaEnd) kept.push({ start: cursor, end: mediaEnd });
      return kept.map((segment) => ({
        ...segment,
        outputStart: segment.start,
        length: +(segment.end - segment.start).toFixed(3),
        analyzed: true,
        mediaIndex: media.index,
      }));
    });
  }, [silences, editSegments.length, analyzedMediaIds, mediaTimelineLayout]);
  const locatePreviewSource = (globalSourceTime: number) => {
    if (!mediaTimelineLayout.length)
      return { index: 0, localTime: Math.max(0, globalSourceTime) };
    const clamped = Math.max(0, Math.min(sourceDuration, globalSourceTime));
    const foundIndex = mediaTimelineLayout.findIndex(
      (media) => clamped < media.start + media.length - 0.001,
    );
    const index = foundIndex >= 0 ? foundIndex : mediaTimelineLayout.length - 1;
    const media = mediaTimelineLayout[index];
    return {
      index,
      localTime: Math.max(0, Math.min(media.length, clamped - media.start)),
    };
  };
  const showGlobalSourceTime = (globalSourceTime: number, play = false) => {
    previewSyncLockUntilRef.current = performance.now() + 300;
    const target = locatePreviewSource(globalSourceTime);
    const item = mediaTimelineLayout[target.index]?.item;
    if (item && item.id !== activePreviewMediaId) {
      pendingPreviewRef.current = { localTime: target.localTime, play };
      setActivePreviewMediaId(item.id);
      setSrc(item.url);
      return;
    }
    if (!video.current) return;
    video.current.currentTime = target.localTime;
    if (play) video.current.play().catch(() => setPlaying(false));
  };
  // Keep every lane on one shared time scale. A newly placed clip occupies a
  // compact part of the visible timeline, while the remainder stays empty for
  // clips that will be appended later.
  const mediaOccupancy = timelineMedia.length
    ? Math.min(1, Math.max(0.28, timelineMedia.length * 0.28))
    : 1;
  // Everything on the timeline — ruler ticks, widths, waveform bins — is
  // derived from this, and several of those allocate arrays from it. One
  // non-finite value anywhere upstream would throw RangeError mid-render and
  // unmount the editor, so it gets clamped once, here, rather than at each use.
  const timelineDisplayDuration = Math.min(
    24 * 3600,
    Math.max(
      0.001,
      Math.max(duration, duration / Math.max(0.01, mediaOccupancy)) || 0.001,
    ),
  );
  const occupiedPercent = (duration / timelineDisplayDuration) * 100;
  const px = Math.max(96, timelineDisplayDuration * 72 * zoom);
  // Space ruler ticks by zoom so timecodes never overlap: pick the smallest
  // "nice" interval that leaves ~64px between labels.
  const rulerPxPerSecond = px / Math.max(0.001, timelineDisplayDuration);
  const rulerStep =
    [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].find(
      (step) => step * rulerPxPerSecond >= 64,
    ) ?? 3600;
  const fmtRuler = (t: number) => {
    const total = Math.round(t);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const fitZoom = Math.min(
    1,
    Math.max(0.03, (timelineViewportWidth - 4) / Math.max(1, timelineDisplayDuration * 72)),
  );
  const minZoom = 0.005;
  const fitTimeline = () => {
    setZoom(fitZoom);
    timelineScrollRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };
  const zoomTimelineWithWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const pointerX = Math.max(0, event.clientX - rect.left);
    const oldWidth = Math.max(1, timelineContentRef.current?.offsetWidth || 1);
    const anchor = (element.scrollLeft + pointerX) / oldWidth;
    const factor = Math.exp(-event.deltaY * 0.0015);
    const nextZoom = Math.max(minZoom, Math.min(8, zoom * factor));
    if (Math.abs(nextZoom - zoom) < 0.0001) return;
    const nextWidth = Math.max(96, timelineDisplayDuration * 72 * nextZoom);
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      element.scrollLeft = Math.max(0, anchor * nextWidth - pointerX);
    });
  };
  const beginMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    // Never rubber-band from the ruler/playhead/caption lane (it has its own
    // marquee) or a clip's drag handle. Clips themselves ARE allowed — a drag
    // over them makes a box, a plain click still selects one (threshold below).
    if (
      target.closest(
        ".caption-track,.playhead,.range-marker,.trim-handle,.silence-handle,.silence-zone",
      )
    )
      return;
    const onClip = Boolean(
      target.closest(".jump-segment,.media-sequence-clip"),
    );
    const rect = event.currentTarget.getBoundingClientRect();
    const startX = Math.max(rect.left, Math.min(rect.right, event.clientX));
    marqueeRef.current = { startX, currentX: startX, rect, onClip, moved: false };
  };
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = marqueeRef.current;
      if (!drag) return;
      drag.currentX = Math.max(
        drag.rect.left,
        Math.min(drag.rect.right, event.clientX),
      );
      if (!drag.moved && Math.abs(drag.currentX - drag.startX) < 4) return;
      if (!drag.moved) document.body.classList.add("is-dragging");
      drag.moved = true;
      const left = Math.min(drag.startX, drag.currentX);
      const width = Math.abs(drag.currentX - drag.startX);
      setMarquee({
        left: ((left - drag.rect.left) / drag.rect.width) * 100,
        width: (width / drag.rect.width) * 100,
      });
    };
    const up = () => {
      const drag = marqueeRef.current;
      if (!drag) return;
      const start = ((Math.min(drag.startX, drag.currentX) - drag.rect.left) /
        drag.rect.width) * timelineDisplayDuration;
      const end = ((Math.max(drag.startX, drag.currentX) - drag.rect.left) /
        drag.rect.width) * timelineDisplayDuration;
      if (!drag.moved) {
        // A plain click: on empty space seek + clear; on a clip let that clip's
        // own handler keep the selection it just made.
        if (!drag.onClip) {
          seek(Math.min(duration, start));
          setSelectedEditSegments([]);
          setSelectedEditSegment(null);
        }
      } else {
        let indexes: number[];
        if (timelineMedia.length && !editSegments.length) {
          const mediaDurations = timelineMedia.map(
            (id) => mediaBin.find((item) => item.id === id)?.duration || 0,
          );
          let cursor = 0;
          indexes = mediaDurations.flatMap((length, index) => {
            const hit = cursor < end && cursor + length > start;
            cursor += length;
            return hit ? [index] : [];
          });
          setSelectedTimelineMedia(indexes);
          setSelectedEditSegments([]);
          setSelectedEditSegment(null);
        } else {
          const selectableLayout = editSegmentLayout.length
            ? editSegmentLayout
            : detectedVideoLayout;
          indexes = selectableLayout.flatMap((segment, index) =>
            segment.outputStart < end && segment.outputStart + segment.length > start
              ? [index]
              : [],
          );
          setSelectedEditSegments(indexes);
          setSelectedEditSegment(indexes.at(-1) ?? null);
        }
        setSelectedExtraTrack(null);
        setNotice(`เลือกด้วยกรอบ ${indexes.length} ก้อน`);
      }
      marqueeRef.current = null;
      setMarquee(null);
      document.body.classList.remove("is-dragging");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [duration, timelineDisplayDuration, editSegmentLayout, detectedVideoLayout, timelineMedia, mediaBin]);
  const deleteSelectedEditSegment = () => {
    if (!editSegments.length) {
      setNotice('วิดีโอยังไม่ถูกตัด · กด "ตัดชิด (Ripple)" ก่อนจึงจะแก้ไขก้อนที่ตัดแล้วได้');
      return;
    }
    const indexes = selectedEditSegments.length
      ? selectedEditSegments
      : selectedEditSegment === null
        ? []
        : [selectedEditSegment];
    if (!indexes.length) return;
    const selectedSet = new Set(indexes);
    const baseSegments = editSegments;
    if (baseSegments.length - selectedSet.size < 1) {
      setNotice("ต้องเหลือคลิปบน Timeline อย่างน้อย 1 ก้อน");
      return;
    }
    let layoutCursor = 0;
    const baseLayout = baseSegments.map((segment) => {
      const outputStart = layoutCursor;
      const length = segment.end - segment.start;
      layoutCursor += length;
      return { ...segment, outputStart, length };
    });
    const removedLayouts = baseLayout
      .filter((_, index) => selectedSet.has(index))
      .sort((a, b) => b.outputStart - a.outputStart);
    const next = baseSegments.filter((_, index) => !selectedSet.has(index));
    const nextDuration = next.reduce(
      (total, segment) => total + segment.end - segment.start,
      0,
    );
    setEditSegments(next);
    if (!editSegments.length) {
      setSilences([]);
      setAppliedSilences([]);
      setPreviewCuts(false);
    }
    if (removedLayouts.length) {
      setTranscript((items) => {
        let result = [...items];
        for (const removedLayout of removedLayouts) {
          const cutStart = removedLayout.outputStart;
          const cutEnd = cutStart + removedLayout.length;
          result = result
            .filter((word) => word.end > cutEnd || word.start < cutStart)
            .map((word) =>
              word.start >= cutEnd
                ? {
                    ...word,
                    start: word.start - removedLayout.length,
                    end: word.end - removedLayout.length,
                  }
                : {
                    ...word,
                    start: Math.min(word.start, cutStart),
                    end: Math.min(word.end, cutStart),
                  },
            )
            .filter((word) => word.end - word.start >= 0.03);
        }
        return result;
      });
      setCaptionEdits(null);
    }
    setDuration(nextDuration);
    setTime((current) => Math.min(current, nextDuration));
    setSelectedEditSegment(null);
    setSelectedEditSegments([]);
    setNotice(
      `ลบ ${indexes.length} ก้อนแล้ว · Ripple ชิดอัตโนมัติ`,
    );
  };
  const deleteSelectedTrack = () => {
    if (selectedExtraTrack === null) return;
    setExtraVideoTracks((count) => Math.max(0, count - 1));
    setSelectedExtraTrack(null);
    setNotice(`ลบ Video Track V${selectedExtraTrack + 2} แล้ว`);
  };
  const deleteTimelineSelection = () => {
    if (selectedEditSegment !== null || selectedEditSegments.length)
      deleteSelectedEditSegment();
    else if (selectedTimelineMedia.length) removeSelectedTimelineMedia();
    else if (selectedExtraTrack !== null) deleteSelectedTrack();
  };
  const splitAtPlayhead = () => {
    const cutTime = Math.round(time * sequenceFps) / sequenceFps;
    const segments = editSegments.length
      ? editSegments
      : mediaTimelineLayout.length
        ? mediaTimelineLayout.map((media) => ({
            start: media.start,
            end: media.start + media.length,
          }))
        : [{ start: 0, end: sourceDuration }];
    let cursor = 0;
    const index = segments.findIndex((segment) => {
      const length = segment.end - segment.start;
      const inside =
        cutTime > cursor + 1 / sequenceFps &&
        cutTime < cursor + length - 1 / sequenceFps;
      cursor += length;
      return inside;
    });
    if (index < 0) {
      setNotice("เลื่อน Playhead ให้อยู่ภายในก้อนก่อนแบ่ง");
      return;
    }
    const segment = segments[index];
    const outputStart = segments
      .slice(0, index)
      .reduce((total, item) => total + item.end - item.start, 0);
    const sourceCut = segment.start + (cutTime - outputStart);
    const next = [
      ...segments.slice(0, index),
      { start: segment.start, end: +sourceCut.toFixed(3) },
      { start: +sourceCut.toFixed(3), end: segment.end },
      ...segments.slice(index + 1),
    ];
    setEditSegments(next);
    setSelectedEditSegment(index + 1);
    setSelectedEditSegments([index + 1]);
    setTime(cutTime);
    setNotice(`แบ่งก้อนตรง ${fmt(cutTime)} แล้ว (ตรงเฟรม)`);
  };
  const timelineToSource = (timelineTime: number) => {
    if (!editSegments.length) return timelineTime;
    let cursor = 0;
    for (const segment of editSegments) {
      const length = segment.end - segment.start;
      if (timelineTime <= cursor + length)
        return segment.start + Math.max(0, timelineTime - cursor);
      cursor += length;
    }
    return editSegments.at(-1)?.end || 0;
  };
  const sourceToTimeline = (sourceTime: number) => {
    if (!editSegments.length) return sourceTime;
    let cursor = 0;
    for (const segment of editSegments) {
      const length = segment.end - segment.start;
      if (sourceTime < segment.start) return cursor;
      if (sourceTime <= segment.end)
        return cursor + Math.max(0, sourceTime - segment.start);
      cursor += length;
    }
    return cursor;
  };
  useEffect(() => {
    const element = timelineScrollRef.current;
    if (!element) return;
    const update = () => setTimelineViewportWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const snapTime = (
    value: number,
    rectWidth: number,
    excludeIndex?: number,
  ) => {
    const frame = Math.round(value * sequenceFps) / sequenceFps;
    if (!snapEnabled) return frame;
    const threshold = (8 / rectWidth) * timelineDisplayDuration;
    const points = [
      0,
      duration,
      inPoint ?? -1,
      outPoint ?? -1,
      ...caps.flatMap((c, i) => (i === excludeIndex ? [] : [c.start, c.end])),
    ].filter((x) => x >= 0);
    let closest = frame,
      distance = Infinity;
    for (const point of points) {
      const d = Math.abs(point - value);
      if (d <= threshold && d < distance) {
        closest = point;
        distance = d;
      }
    }
    return Math.max(0, Math.min(duration, closest));
  };
  useEffect(() => {
    setCaptionEdits(null);
    setCheckedCaps([]);
  }, [transcript, count]);
  useEffect(() => setSubSync(0), [transcript]);
  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      fetch("/api/health")
        .then((response) => response.json())
        .then((data) => {
          setThaiModel(Boolean(data?.models?.thai));
          setGpuReady(Boolean(data?.gpuReady));
          setAlignReady(Boolean(data?.alignReady));
          tries += 1;
          // Keep polling briefly in case the server is still starting up.
          if (!data?.gpuReady && tries < 6)
            timer = setTimeout(check, 2500);
        })
        .catch(() => {
          tries += 1;
          if (tries < 6) timer = setTimeout(check, 2500);
        });
    };
    check();
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (caps.length) setSelected((index) => Math.min(index, caps.length - 1));
    else setSelected(0);
    setCheckedCaps((list) => list.filter((index) => index < caps.length));
  }, [caps.length]);
  useEffect(() => {
    const row = reviewRef.current?.querySelector<HTMLElement>(".sub-grow.playing");
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [active]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (listSelRef.current === null) return;
      const row = (
        document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
      )?.closest<HTMLElement>(".sub-grow");
      if (!row) return;
      const index = Number(row.dataset.index);
      if (Number.isNaN(index)) return;
      const from = Math.min(listSelRef.current, index);
      const to = Math.max(listSelRef.current, index);
      setCheckedCaps(
        Array.from({ length: to - from + 1 }, (_, offset) => from + offset),
      );
    };
    const up = () => {
      if (listSelRef.current === null) return;
      listSelRef.current = null;
      document.body.classList.remove("is-dragging");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = capMarqueeRef.current;
      if (!drag) return;
      drag.currentX = Math.max(
        drag.rect.left,
        Math.min(drag.rect.right, event.clientX),
      );
      const left = Math.min(drag.startX, drag.currentX);
      const width = Math.abs(drag.currentX - drag.startX);
      setCapMarquee({
        left: ((left - drag.rect.left) / drag.rect.width) * 100,
        width: (width / drag.rect.width) * 100,
      });
    };
    const up = () => {
      const drag = capMarqueeRef.current;
      if (!drag) return;
      if (Math.abs(drag.currentX - drag.startX) >= 4) {
        const t0 =
          ((Math.min(drag.startX, drag.currentX) - drag.rect.left) /
            drag.rect.width) *
          timelineDisplayDuration;
        const t1 =
          ((Math.max(drag.startX, drag.currentX) - drag.rect.left) /
            drag.rect.width) *
          timelineDisplayDuration;
        const indexes = caps.flatMap((caption, index) =>
          caption.end > t0 && caption.start < t1 ? [index] : [],
        );
        setCheckedCaps(indexes);
        setNotice(`เลือกซับด้วยกรอบ ${indexes.length} ก้อน`);
      }
      capMarqueeRef.current = null;
      setCapMarquee(null);
      document.body.classList.remove("is-dragging");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [timelineDisplayDuration, caps]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = binMarqueeRef.current;
      if (!drag) return;
      drag.currentX = event.clientX;
      drag.currentY = event.clientY;
      setBinMarquee({
        left: Math.min(drag.startX, drag.currentX),
        top: Math.min(drag.startY, drag.currentY),
        width: Math.abs(drag.currentX - drag.startX),
        height: Math.abs(drag.currentY - drag.startY),
      });
    };
    const up = () => {
      const drag = binMarqueeRef.current;
      if (!drag) return;
      const moved =
        Math.abs(drag.currentX - drag.startX) +
        Math.abs(drag.currentY - drag.startY);
      if (moved >= 4) {
        const minX = Math.min(drag.startX, drag.currentX);
        const maxX = Math.max(drag.startX, drag.currentX);
        const minY = Math.min(drag.startY, drag.currentY);
        const maxY = Math.max(drag.startY, drag.currentY);
        const hitIds: string[] = [];
        mediaBinListRef.current
          ?.querySelectorAll<HTMLElement>(".media-bin-item")
          .forEach((el) => {
            const r = el.getBoundingClientRect();
            const intersects =
              r.left < maxX && r.right > minX && r.top < maxY && r.bottom > minY;
            if (intersects && el.dataset.id) hitIds.push(el.dataset.id);
          });
        setSelectedBinIds((current) =>
          drag.additive ? [...new Set([...current, ...hitIds])] : hitIds,
        );
        if (hitIds.length) setNotice(`เลือกสื่อ ${hitIds.length} ไฟล์`);
      } else if (!drag.additive) {
        setSelectedBinIds([]);
      }
      binMarqueeRef.current = null;
      setBinMarquee(null);
      document.body.classList.remove("is-dragging");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const timelineToSourceTime = (timelineTime: number) => {
      if (!editSegments.length) return timelineTime;
      let cursor = 0;
      for (const segment of editSegments) {
        const length = segment.end - segment.start;
        if (timelineTime <= cursor + length)
          return segment.start + Math.max(0, timelineTime - cursor);
        cursor += length;
      }
      return editSegments.at(-1)?.end || sourceDuration;
    };
    const raf = requestAnimationFrame(() => {
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW <= 0 || cssH <= 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // full-width backing store, capped to stay within canvas limits
      const backingW = Math.min(32000, Math.max(1, Math.round(cssW * dpr)));
      const backingH = Math.max(1, Math.round(cssH * dpr));
      canvas.width = backingW;
      canvas.height = backingH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, backingW, backingH);
      const mid = backingH / 2;
      ctx.strokeStyle = "rgba(150,190,205,0.32)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid + 0.5);
      ctx.lineTo(backingW, mid + 0.5);
      ctx.stroke();
      if (!peaks.length || sourceDuration <= 0 || duration <= 0) return;
      const amps = new Array<number>(backingW);
      for (let x = 0; x < backingW; x++) {
        const tlA = (x / backingW) * duration;
        const tlB = ((x + 1) / backingW) * duration;
        const sA = timelineToSourceTime(tlA);
        const sB = timelineToSourceTime(tlB);
        let iA = Math.floor((Math.min(sA, sB) / sourceDuration) * peaks.length);
        let iB = Math.ceil((Math.max(sA, sB) / sourceDuration) * peaks.length);
        iA = Math.max(0, Math.min(peaks.length - 1, iA));
        iB = Math.max(iA, Math.min(peaks.length - 1, iB));
        let peak = 0;
        for (let i = iA; i <= iB; i++) if (peaks[i] > peak) peak = peaks[i];
        amps[x] = Math.pow(peak, 0.72);
      }
      const grad = ctx.createLinearGradient(0, 0, 0, backingH);
      grad.addColorStop(0, "#6fe0f0");
      grad.addColorStop(0.5, "#22b6d0");
      grad.addColorStop(1, "#6fe0f0");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      for (let x = 0; x < backingW; x++)
        ctx.lineTo(x, mid - Math.max(0.5, amps[x] * (mid - 1)));
      for (let x = backingW - 1; x >= 0; x--)
        ctx.lineTo(x, mid + Math.max(0.5, amps[x] * (mid - 1)));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(210,250,255,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < backingW; x++) {
        const y = mid - Math.max(0.5, amps[x] * (mid - 1));
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    return () => cancelAnimationFrame(raf);
  }, [peaks, px, duration, editSegments, sourceDuration, timelineViewportWidth]);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      if (video.current) {
        if (
          dragRef.current?.type === "playhead" ||
          video.current.seeking ||
          pendingPreviewRef.current ||
          performance.now() < previewSyncLockUntilRef.current
        ) {
          id = requestAnimationFrame(tick);
          return;
        }
        const localTime = video.current.currentTime;
        const resolvedActiveIndex = Math.max(
          0,
          mediaTimelineLayout.findIndex(
            (media) => media.mediaId === activePreviewMediaId,
          ),
        );
        const activeMedia = mediaTimelineLayout[resolvedActiveIndex];
        const currentTime = activeMedia
          ? activeMedia.start + localTime
          : localTime;
        if (editSegments.length) {
          let outputCursor = 0;
          let matched = false;
          for (let index = 0; index < editSegments.length; index++) {
            const segment = editSegments[index];
            const length = segment.end - segment.start;
            if (currentTime >= segment.start && currentTime < segment.end) {
              setTime(outputCursor + currentTime - segment.start);
              matched = true;
              if (
                !video.current.paused &&
                segment.end - currentTime <= 0.04
              ) {
                const next = editSegments[index + 1];
                if (next) {
                  showGlobalSourceTime(next.start, true);
                  setTime(outputCursor + length);
                } else {
                  video.current.pause();
                  setTime(duration);
                }
              }
              break;
            }
            if (currentTime < segment.start) {
              if (
                !video.current.seeking &&
                Math.abs(currentTime - segment.start) > 0.04
              )
                showGlobalSourceTime(segment.start, !video.current.paused);
              setTime(outputCursor);
              matched = true;
              break;
            }
            outputCursor += length;
          }
          if (!matched) {
            video.current.pause();
            setTime(duration);
          }
          id = requestAnimationFrame(tick);
          return;
        }
        const skipped = previewCuts
          ? silences.find(
              (silence) =>
                silence.enabled &&
                currentTime >= silence.start &&
                currentTime < silence.end - 0.01,
            )
          : undefined;
        if (
          skipped &&
          !video.current.seeking &&
          Math.abs(currentTime - skipped.end) > 0.04
        )
          showGlobalSourceTime(skipped.end, !video.current.paused);
        setTime(skipped ? skipped.end : currentTime);
        if (
          activeMedia &&
          !video.current.paused &&
          localTime >= activeMedia.length - 0.04 &&
          resolvedActiveIndex < mediaTimelineLayout.length - 1
        ) {
          showGlobalSourceTime(activeMedia.start + activeMedia.length, true);
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [
    previewCuts,
    silences,
    editSegments,
    duration,
    mediaTimelineLayout,
    activePreviewMediaId,
  ]);
  const syncTimelineTimeFromVideo = (element: HTMLVideoElement) => {
    if (
      dragRef.current?.type === "playhead" ||
      element.seeking ||
      pendingPreviewRef.current ||
      performance.now() < previewSyncLockUntilRef.current
    )
      return;
    const activeMedia = mediaTimelineLayout.find(
      (media) => media.mediaId === activePreviewMediaId,
    );
    const sourceTime = (activeMedia?.start || 0) + element.currentTime;
    setTime(Math.max(0, Math.min(duration, sourceToTimeline(sourceTime))));
  };
  useEffect(() => {
    if (dragRef.current?.type === "playhead") return;
    const scroller = timelineScrollRef.current;
    const content = timelineContentRef.current;
    if (!scroller || !content) return;
    const contentWidth = content.clientWidth;
    const playheadX =
      (Math.max(0, Math.min(timelineDisplayDuration, time)) /
        Math.max(0.001, timelineDisplayDuration)) *
      contentWidth;
    const safeLeft = scroller.scrollLeft + 56;
    const safeRight = scroller.scrollLeft + scroller.clientWidth - 72;
    if (playheadX < safeLeft || playheadX > safeRight) {
      const nextLeft = Math.max(
        0,
        Math.min(
          contentWidth - scroller.clientWidth,
          playheadX - scroller.clientWidth * 0.28,
        ),
      );
      scroller.scrollTo({ left: nextLeft, behavior: "auto" });
    }
  }, [time, timelineDisplayDuration]);
  const toggle = async () => {
    if (!video.current) {
      setNotice(
        "กรุณานำเข้าวิดีโออีกครั้ง ไฟล์ในเครื่องจะไม่คงอยู่หลัง reload",
      );
      return;
    }
    try {
      if (!video.current.paused) {
        video.current.pause();
        return;
      }
      const startTime = time >= duration - 0.02 ? 0 : time;
      setTime(startTime);
      showGlobalSourceTime(timelineToSource(startTime), true);
    } catch {
      setNotice("เล่นไฟล์นี้ไม่ได้ กรุณาตรวจสอบ codec หรือเลือกไฟล์ใหม่");
    }
  };
  const handlePreviewEnded = () => {
    if (time >= duration - 0.02) {
      setPlaying(false);
      return;
    }
    const nextTime = Math.min(duration, time + Math.max(0.05, 2 / sequenceFps));
    showGlobalSourceTime(timelineToSource(nextTime), true);
    setTime(nextTime);
  };
  const stop = () => {
    if (video.current) video.current.pause();
    seek(0);
  };
  const frameStep = (frames: number) => {
    if (video.current) video.current.pause();
    seek(Math.max(0, Math.min(duration, time + frames / sequenceFps)));
  };
  const seek = (t: number) => {
    const nextTime = Math.max(0, Math.min(duration, t));
    const shouldResume = Boolean(video.current && !video.current.paused);
    showGlobalSourceTime(timelineToSource(nextTime), shouldResume);
    setTime(nextTime);
  };
  const smpte = (seconds: number) => {
    const total = Math.max(0, seconds);
    const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
    const frame = Math.min(
      sequenceFps - 1,
      Math.floor((total % 1) * sequenceFps),
    );
    return `${pad(total / 3600)}:${pad((total % 3600) / 60)}:${pad(total % 60)}:${pad(frame)}`;
  };
  const toggleFullscreen = () => {
    const el = canvasRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      el.requestFullscreen?.().catch(() =>
        setNotice("เปิดเต็มจอไม่สำเร็จในเบราว์เซอร์นี้"),
      );
  };
  const importFile = (f?: File) => {
    if (!f) return;
    if (src) URL.revokeObjectURL(src);
    const mediaUrl = URL.createObjectURL(f);
    setSrc(mediaUrl);
    setMediaFile(f);
    setJobId("");
    setSilences([]);
    setAnalyzedMediaIds([]);
    setAppliedSilences([]);
    setEditSegments([]);
    setTranscript([]);
    setCaptionEdits(null);
    setSelected(0);
    setPreviewCuts(false);
    setTime(0);
    setNotice("กำลังสร้าง waveform จากเสียงจริง…");
    setThumbnails([]);
    const thumbVideo = document.createElement("video");
    thumbVideo.src = mediaUrl;
    thumbVideo.muted = true;
    thumbVideo.preload = "metadata";
    thumbVideo.onloadedmetadata = async () => {
      const frameCount = Math.max(
        12,
        Math.min(30, Math.ceil(thumbVideo.duration / 2)),
      );
      const images: string[] = [];
      const canvas = document.createElement("canvas");
      canvas.width = 180;
      canvas.height = 102;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (thumbVideo.readyState < 2)
        await new Promise<void>((resolve) =>
          thumbVideo.addEventListener("loadeddata", () => resolve(), {
            once: true,
          }),
        );
      for (let i = 0; i < frameCount; i++) {
        const target = Math.min(
          Math.max(0, thumbVideo.duration - 0.05),
          (i / (frameCount - 1)) * thumbVideo.duration,
        );
        if (Math.abs(thumbVideo.currentTime - target) > 0.01)
          await new Promise<void>((resolve) => {
            thumbVideo.addEventListener("seeked", () => resolve(), {
              once: true,
            });
            thumbVideo.currentTime = target;
          });
        const sourceRatio = thumbVideo.videoWidth / thumbVideo.videoHeight,
          targetRatio = canvas.width / canvas.height;
        let sx = 0,
          sy = 0,
          sw = thumbVideo.videoWidth,
          sh = thumbVideo.videoHeight;
        if (sourceRatio > targetRatio) {
          sw = sh * targetRatio;
          sx = (thumbVideo.videoWidth - sw) / 2;
        } else {
          sh = sw / targetRatio;
          sy = (thumbVideo.videoHeight - sh) / 2;
        }
        ctx.drawImage(
          thumbVideo,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        images.push(canvas.toDataURL("image/jpeg", 0.62));
      }
      setThumbnails(images);
    };
    // Decoding a multi-GB video in the browser requires another full copy of
    // the file plus decoded PCM and can exhaust memory, leaving the waveform
    // empty. Let ffmpeg stream large media on the local backend instead.
    if (f.size > 256 * 1024 * 1024) {
      setPeaks([]);
      setNotice("วางคลิปบน Timeline แล้ว · เลือกการวิเคราะห์เสียงก่อนเริ่มตรวจ");
      return;
    }
    f.arrayBuffer().then(async (buffer) => {
      const context = new AudioContext();
      try {
        const audio = await context.decodeAudioData(buffer.slice(0));
        const channel = audio.getChannelData(0);
        const bins = Math.min(
          48000,
          Math.max(8000, Math.round(audio.duration * 160)),
        );
        const size = Math.max(1, Math.floor(channel.length / bins));
        const next = Array.from({ length: bins }, (_, i) => {
          let max = 0;
          const start = i * size;
          const end = Math.min(channel.length, start + size);
          for (let j = start; j < end; j++)
            max = Math.max(max, Math.abs(channel[j]));
          return Math.min(1, max * 1.35);
        });
        setPeaks(next);
        setNotice("สร้าง waveform จากเสียงจริงแล้ว");
      } catch {
        setPeaks([]);
        setNotice("อ่าน waveform ไม่สำเร็จ แต่ยังเล่นและวิเคราะห์ไฟล์ได้");
      } finally {
        context.close();
      }
    }).catch(() => {
      setPeaks([]);
      setNotice("สร้าง waveform ในเบราว์เซอร์ไม่สำเร็จ · เลือกวิเคราะห์เสียงผ่านระบบ local");
    });
  };
  const addMediaFiles = (files: File[]) => {
    const accepted = files.filter((file) =>
      /^(video|audio)\//.test(file.type),
    );
    if (!accepted.length) return;
    const known = new Set(
      mediaBin.map((item) => `${item.name}:${item.file.size}:${item.file.lastModified}`),
    );
    const additions = accepted
      .filter(
        (file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`),
      )
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        duration: 0,
        thumbnail: "",
      }));
    if (!additions.length) return;
    setMediaBin((items) => [...items, ...additions]);
    for (const item of additions) {
      const probe = document.createElement(item.file.type.startsWith("audio/") ? "audio" : "video");
      probe.preload = "metadata";
      probe.src = item.url;
      probe.onloadedmetadata = () => {
        const mediaDuration = Number.isFinite(probe.duration) ? probe.duration : 0;
        setMediaBin((items) =>
          items.map((entry) =>
            entry.id === item.id ? { ...entry, duration: mediaDuration } : entry,
          ),
        );
        if (probe instanceof HTMLVideoElement) {
          const capture = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 180;
            canvas.height = 102;
            const ctx = canvas.getContext("2d");
            if (!ctx || !probe.videoWidth || !probe.videoHeight) return;
            ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL("image/jpeg", 0.64);
            setMediaBin((items) =>
              items.map((entry) =>
                entry.id === item.id ? { ...entry, thumbnail } : entry,
              ),
            );
          };
          probe.onseeked = capture;
          probe.currentTime = Math.min(0.2, Math.max(0, mediaDuration / 2));
          if (probe.readyState >= 2) capture();
        }
      };
    }
    setNotice(`เพิ่มสื่อ ${additions.length} ไฟล์ · ลากลง V1 เพื่อวางต่อกัน`);
  };
  const appendMediaToTimeline = (mediaId: string) => {
    const item = mediaBin.find((entry) => entry.id === mediaId);
    if (!item) return;
    if (!timelineMedia.length) {
      setActivePreviewMediaId(item.id);
      importFile(item.file);
      requestAnimationFrame(() => timelineScrollRef.current?.scrollTo({ left: 0 }));
    }
    // Every placed media item owns its waveform. Silence detection must stay
    // behind the explicit button in the silence-cut panel.
    if (!mediaWaveforms[item.id])
      queueMicrotask(() =>
        void analyze(false, item.file, noiseReduce, false, item.id),
      );
    setTimelineMedia((items) => {
      const next = [...items, mediaId];
      setSelectedTimelineMedia([next.length - 1]);
      return next;
    });
    setNotice(`วาง ${item.name} ต่อท้ายบน V1 แล้ว`);
  };
  const appendManyToTimeline = (ids: string[]) => {
    const valid = ids.filter((id) => mediaBin.some((entry) => entry.id === id));
    if (!valid.length) return;
    if (valid.length === 1) {
      appendMediaToTimeline(valid[0]);
      return;
    }
    if (!timelineMedia.length) {
      const first = mediaBin.find((entry) => entry.id === valid[0]);
      if (first) {
        setActivePreviewMediaId(first.id);
        importFile(first.file);
        requestAnimationFrame(() =>
          timelineScrollRef.current?.scrollTo({ left: 0 }),
        );
      }
    }
    for (const id of valid) {
      const item = mediaBin.find((entry) => entry.id === id);
      if (item && !mediaWaveforms[id])
        queueMicrotask(() =>
          void analyze(false, item.file, noiseReduce, false, id),
        );
    }
    setTimelineMedia((items) => {
      const next = [...items, ...valid];
      setSelectedTimelineMedia(valid.map((_, offset) => items.length + offset));
      return next;
    });
    setNotice(`วางสื่อ ${valid.length} ไฟล์ต่อท้ายบน V1 แล้ว`);
  };
  const beginBinMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    // Only rubber-band from empty space so per-item click and drag-to-V1 keep working.
    if ((event.target as HTMLElement).closest(".media-bin-item")) return;
    const list = mediaBinListRef.current;
    if (!list) return;
    binMarqueeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      rect: list.getBoundingClientRect(),
      additive: event.ctrlKey || event.metaKey || event.shiftKey,
    };
    document.body.classList.add("is-dragging");
  };
  const deleteMediaFromBin = (ids: string[]) => {
    const removeSet = new Set(ids);
    if (!removeSet.size) return;
    for (const item of mediaBin)
      if (removeSet.has(item.id) && item.url) URL.revokeObjectURL(item.url);
    if (removeSet.has(activePreviewMediaId)) {
      setActivePreviewMediaId("");
      setSrc("");
    }
    setMediaBin((items) => items.filter((item) => !removeSet.has(item.id)));
    setTimelineMedia((items) => items.filter((id) => !removeSet.has(id)));
    setSelectedBinIds((items) => items.filter((id) => !removeSet.has(id)));
    setSelectedTimelineMedia([]);
    setAnalyzedMediaIds((items) => items.filter((id) => !removeSet.has(id)));
    setMediaWaveforms((map) => {
      const next = { ...map };
      for (const id of removeSet) delete next[id];
      return next;
    });
    setMediaJobIds((map) => {
      const next = { ...map };
      for (const id of removeSet) delete next[id];
      return next;
    });
    setNotice(`ลบสื่อ ${removeSet.size} ไฟล์แล้ว`);
  };
  const removeSelectedTimelineMedia = () => {
    if (!selectedTimelineMedia.length) return;
    const selectedSet = new Set(selectedTimelineMedia);
    setTimelineMedia((items) =>
      items.filter((_, index) => !selectedSet.has(index)),
    );
    setSelectedTimelineMedia([]);
    setNotice(`นำ Media ออกจาก Timeline ${selectedSet.size} ก้อน`);
  };
  const analyze = async (
    cutImmediately = false,
    fileOverride?: File,
    noiseOverride?: "off" | "light" | "strong",
    detectSilence = true,
    mediaId?: string,
  ): Promise<string | undefined> => {
    const inputFile = fileOverride || mediaFile;
    if (!inputFile) {
      setNotice("กรุณานำเข้าวิดีโอก่อน");
      return;
    }
    setProcessing("กำลังวิเคราะห์เสียง…");
    setNotice("");
    try {
      const form = new FormData();
      form.append("media", inputFile);
      form.append("threshold", `${threshold}dB`);
      form.append("minSilence", String(minSilence));
      form.append("padding", String(padding));
      form.append("minSpeechIsland", String(minSpeechIsland));
      form.append("noiseReduce", noiseOverride ?? noiseReduce);
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setJobId(data.id);
      if (data.peaks?.length) {
        setPeaks(data.peaks);
        if (mediaId)
          setMediaWaveforms((items) => ({ ...items, [mediaId]: data.peaks }));
      }
      if (mediaId)
        setMediaJobIds((items) => ({ ...items, [mediaId]: data.id }));
      const verifiedSilences = data.silences || [];
      const nextSegments: Array<{ start: number; end: number }> =
        data.keepSegments || [];
      if (detectSilence) {
        setAppliedSilences(verifiedSilences);
        setSilences(
          cutImmediately
            ? []
            : verifiedSilences.map(
                (silence: { start: number; end: number }) => ({
                  ...silence,
                  enabled: true,
                }),
              ),
        );
      } else {
        setAppliedSilences([]);
        setSilences([]);
      }
      setPreviewCuts(false);
      if (data.duration) setSourceDuration(data.duration);
      const seconds = verifiedSilences.reduce(
        (total: number, silence: { start: number; end: number }) =>
          total + silence.end - silence.start,
        0,
      );
      setNotice(
        !detectSilence
          ? "สร้าง waveform แล้ว — ยังไม่ได้ตรวจจับหรือตัดช่วงเงียบ"
          : cutImmediately
          ? `ตรวจยืนยันกับ waveform แล้ว ${verifiedSilences.length} ช่วง ตัดออกได้ประมาณ ${seconds.toFixed(1)} วินาที`
          : `พบช่วงเงียบ ${verifiedSilences.length} ช่วง · ตัดออกได้ประมาณ ${seconds.toFixed(1)} วินาที · คลิกพื้นที่สีแดงบน waveform เพื่อเปิด/ปิดก่อนตัด`,
      );
      if (detectSilence && cutImmediately && nextSegments.length) {
        const editedDuration = nextSegments.reduce(
          (total, segment) => total + segment.end - segment.start,
          0,
        );
        setEditSegments(nextSegments);
        setTranscript([]);
        setCaptionEdits(null);
        setDuration(editedDuration);
        setTime(0);
        if (video.current) video.current.currentTime = nextSegments[0].start;
        const nextFit = Math.min(
          1,
          Math.max(
            0.03,
            (timelineViewportWidth - 4) / Math.max(1, editedDuration * 72),
          ),
        );
        setZoom(nextFit);
        requestAnimationFrame(() =>
          timelineScrollRef.current?.scrollTo({ left: 0 }),
        );
        setNotice(
          `Ripple Delete แล้ว ${verifiedSilences.length} ช่วง · เหลือ ${nextSegments.length} คลิป · ลด ${seconds.toFixed(1)} วินาที`,
        );
      }
      return data.id;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "วิเคราะห์ไม่สำเร็จ");
    } finally {
      setProcessing("");
    }
  };
  const analyzeTimelineSelection = async () => {
    let indexes = [...selectedTimelineMedia].sort((a, b) => a - b);
    if (!indexes.length) {
      const visibleSegments = editSegments.length
        ? editSegmentLayout
        : detectedVideoLayout;
      const selectedSegmentIndexes = [
        ...selectedEditSegments,
        ...(selectedEditSegment === null ? [] : [selectedEditSegment]),
      ];
      indexes = [
        ...new Set(
          selectedSegmentIndexes.flatMap((segmentIndex) => {
            const segment = visibleSegments[segmentIndex];
            if (!segment) return [];
            const media = mediaTimelineLayout.find(
              (item) =>
                segment.start >= item.start - 0.001 &&
                segment.start < item.start + item.length - 0.001,
            );
            return media ? [media.index] : [];
          }),
        ),
      ].sort((a, b) => a - b);
    }
    if (!indexes.length) {
      indexes = timelineMedia.map((_, index) => index);
    }
    if (!indexes.length) {
      setNotice("ลาก Media ลง V1 ก่อนตรวจจับช่วงเงียบ");
      return;
    }
    setProcessing(`กำลังวิเคราะห์ Media ${indexes.length} ก้อน…`);
    setNotice("");
    try {
      const combinedSilences: Array<{ start: number; end: number; enabled: boolean }> = [];
      const selectedMediaIds = indexes
        .map((index) => timelineMedia[index])
        .filter(Boolean);
      const selectedRanges = indexes
        .map((index) => mediaTimelineLayout[index])
        .filter(Boolean)
        .map((media) => ({ start: media.start, end: media.start + media.length }));
      const nextWaveforms = { ...mediaWaveforms };
      const nextJobIds = { ...mediaJobIds };
      let lastJobId = "";
      let effectiveThreshold = threshold;
      let removedTransientFragments = 0;
      let protectedSpeechIslands = 0;
      let timelineOffset = 0;
      for (let timelineIndex = 0; timelineIndex < timelineMedia.length; timelineIndex++) {
        const mediaId = timelineMedia[timelineIndex];
        const item = mediaBin.find((entry) => entry.id === mediaId);
        const itemDuration = item?.duration || 0;
        if (item && indexes.includes(timelineIndex)) {
          const form = new FormData();
          form.append("media", item.file);
          form.append("threshold", `${threshold}dB`);
          form.append("minSilence", String(minSilence));
          form.append("padding", String(padding));
          form.append("minSpeechIsland", String(minSpeechIsland));
          form.append("noiseReduce", noiseReduce);
          const response = await fetch("/api/analyze", { method: "POST", body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || `วิเคราะห์ ${item.name} ไม่สำเร็จ`);
          lastJobId = data.id;
          nextJobIds[mediaId] = data.id;
          effectiveThreshold = Number(data.effectiveThreshold ?? threshold);
          removedTransientFragments += Number(data.removedTransientFragments || 0);
          protectedSpeechIslands += Number(data.protectedSpeechIslands || 0);
          combinedSilences.push(
            ...(data.silences || []).map((range: { start: number; end: number }) => ({
              start: +(timelineOffset + range.start).toFixed(3),
              end: +(timelineOffset + range.end).toFixed(3),
              enabled: true,
            })),
          );
          if (data.peaks?.length) nextWaveforms[mediaId] = data.peaks;
        }
        timelineOffset += itemDuration;
      }
      const combinedPeaks = timelineMedia.flatMap((mediaId) => {
        const item = mediaBin.find((entry) => entry.id === mediaId);
        const targetBins = Math.max(1, Math.round((item?.duration || 0) * 240));
        return resampleWaveform(nextWaveforms[mediaId] || [], targetBins);
      });
      if (indexes.length === 1 && lastJobId) setJobId(lastJobId);
      setMediaWaveforms(nextWaveforms);
      setMediaJobIds(nextJobIds);
      const preservedSilences = silences.filter(
        (silence) =>
          !selectedRanges.some(
            (range) => silence.end > range.start && silence.start < range.end,
          ),
      );
      const allSilences = [...preservedSilences, ...combinedSilences].sort(
        (a, b) => a.start - b.start,
      );
      setSilences(allSilences);
      setAnalyzedMediaIds((current) => [
        ...new Set([...current, ...selectedMediaIds]),
      ]);
      setPeaks(combinedPeaks);
      setSourceDuration(Math.max(0.001, timelineOffset));
      if (!editSegments.length) setDuration(Math.max(0.001, timelineOffset));
      setNotice(
        `วิเคราะห์ Media ที่เลือก ${indexes.length} ก้อนแล้ว · พบช่วงเงียบใหม่ ${combinedSilences.length} ช่วง · รวมทั้งหมด ${allSilences.length} ช่วง · ป้องกันคำพูดสั้น ${protectedSpeechIslands} จุด · เก็บกวาดเสียงคลิก ${removedTransientFragments} จุด`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "วิเคราะห์ Media ไม่สำเร็จ");
    } finally {
      setProcessing("");
    }
  };
  const transcribe = async () => {
    if (subEngine === "eleven" && !elevenKey.trim()) {
      setNotice("กรุณาวาง ElevenLabs API Key ในช่องด้านบนก่อน");
      return;
    }
    setProcessing(
      subEngine === "eleven"
        ? "กำลังสร้างซับไทยด้วย ElevenLabs…"
        : subEngine === "whisper-th"
          ? "กำลังสร้างซับด้วย Whisper ไทย (Thonburian)…"
          : "กำลังสร้างซับไทยด้วย Whisper…",
    );
    setNotice("");
    try {
      // Resolve one job per clip across the whole timeline. Transcribing a
      // single jobId only captioned the first clip, so multi-clip projects
      // lost captions everywhere except that clip (they bunched to the left).
      const units =
        mediaTimelineLayout.length > 0
          ? mediaTimelineLayout.map((media) => ({
              start: media.start,
              jobId: mediaJobIds[media.mediaId] || "",
              file: media.item?.file as File | undefined,
              name: media.item?.name || `media-${media.index + 1}`,
            }))
          : [
              {
                start: 0,
                jobId,
                file: (mediaFile ?? undefined) as File | undefined,
                name: "media",
              },
            ];
      // Any clip that never got analyzed has no job yet — analyze it now so it
      // is not silently skipped.
      for (const unit of units) {
        if (unit.jobId || !unit.file) continue;
        const form = new FormData();
        form.append("media", unit.file);
        form.append("threshold", `${threshold}dB`);
        form.append("minSilence", String(minSilence));
        form.append("padding", String(padding));
        form.append("minSpeechIsland", String(minSpeechIsland));
        form.append("noiseReduce", noiseReduce);
        const analyzeResponse = await fetch("/api/analyze", {
          method: "POST",
          body: form,
        });
        const analyzeData = await analyzeResponse.json();
        if (!analyzeResponse.ok)
          throw new Error(analyzeData.error || `วิเคราะห์ ${unit.name} ไม่สำเร็จ`);
        unit.jobId = analyzeData.id;
      }
      const jobs = units.filter((unit) => unit.jobId);
      if (!jobs.length) {
        const fallback = jobId || (await analyze(false, undefined, undefined, false));
        if (!fallback) return;
        jobs.push({ start: 0, jobId: fallback, file: undefined, name: "media" });
      }
      // Transcribe every clip and shift its local word times onto the global
      // timeline (each clip's Whisper output starts at 0).
      const sourceWords: Word[] = [];
      for (const job of jobs) {
        const response =
          subEngine === "eleven"
            ? await fetch(`/api/transcribe-eleven/${job.jobId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey: elevenKey.trim() }),
              })
            : await fetch(`/api/transcribe/${job.jobId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: subEngine === "whisper-th" ? "thai" : "default",
                  compute,
                  align: alignReady && alignOn,
                }),
              });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        for (const word of (data.words || []) as Word[]) {
          sourceWords.push({
            ...word,
            start: +(job.start + word.start).toFixed(3),
            end: +(job.start + word.end).toFixed(3),
          });
        }
      }
      sourceWords.sort((a, b) => a.start - b.start);
      const timelineWords = editSegmentLayout.length
        ? sourceWords.flatMap((word) => {
            let best:
              | (typeof editSegmentLayout)[number]
              | undefined;
            let bestOverlap = 0;
            for (const segment of editSegmentLayout) {
              const overlap = Math.max(
                0,
                Math.min(word.end, segment.end) -
                  Math.max(word.start, segment.start),
              );
              if (overlap > bestOverlap) {
                best = segment;
                bestOverlap = overlap;
              }
            }
            if (!best || bestOverlap <= 0) return [];
            return [{
              ...word,
              start:
                best.outputStart + Math.max(0, word.start - best.start),
              end:
                best.outputStart +
                Math.min(best.length, word.end - best.start),
            }];
          })
        : sourceWords;
      setTranscript(timelineWords);
      setNotice(`สร้างซับแล้ว ${timelineWords.length} คำ · จัดเวลาเข้ากับ Timeline แล้ว`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "สร้างซับไม่สำเร็จ");
    } finally {
      setProcessing("");
    }
  };
  const exportSrt = async () => {
    const response = await fetch("/api/export-srt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captions: caps }),
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles-th.srt";
    a.click();
    URL.revokeObjectURL(url);
  };
  const keepFromSilences = (
    ranges: Array<{ start: number; end: number }>,
    total: number,
  ) => {
    const kept: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
      if (range.start > cursor)
        kept.push({ start: +cursor.toFixed(3), end: +range.start.toFixed(3) });
      cursor = Math.max(cursor, range.end);
    }
    if (cursor < total)
      kept.push({ start: +cursor.toFixed(3), end: +total.toFixed(3) });
    return kept.filter((range) => range.end - range.start >= 0.05);
  };
  const applySilenceCuts = () => {
    if (!enabledSilences.length)
      return setNotice("กรุณาเลือกช่วงเงียบอย่างน้อย 1 ช่วง");
    // Detection already protects both sides of every cut with padding. Do not
    // run a second peak-based tail trim here; that could remove quiet speech
    // which the user never approved as silence.
    const allCutRanges = [...appliedSilences, ...enabledSilences]
      .sort((a, b) => a.start - b.start)
      .reduce<Array<{ start: number; end: number }>>((ranges, range) => {
        const previous = ranges.at(-1);
        if (previous && range.start <= previous.end + 0.001)
          previous.end = Math.max(previous.end, range.end);
        else ranges.push({ start: range.start, end: range.end });
        return ranges;
      }, []);
    const keptAcrossTimeline = keepFromSilences(allCutRanges, sourceDuration);
    const mediaBoundaries = mediaTimelineLayout
      .slice(0, -1)
      .map((segment) => segment.start + segment.length);
    // A visual/export clip may never span two source media files. Split at
    // every media boundary so deleting and CapCut export retain source identity.
    const kept = keptAcrossTimeline.flatMap((segment) => {
      const cuts = mediaBoundaries.filter(
        (boundary) => boundary > segment.start && boundary < segment.end,
      );
      const points = [segment.start, ...cuts, segment.end];
      return points.slice(0, -1).map((start, index) => ({
        start: +start.toFixed(3),
        end: +points[index + 1].toFixed(3),
      }));
    });
    if (!kept.length) return setNotice("ไม่มีช่วงคำพูดเหลือหลังตัด");
    let cursor = 0;
    const layout = kept.map((segment) => {
      const outputStart = cursor;
      const length = segment.end - segment.start;
      cursor += length;
      return { ...segment, outputStart, length };
    });
    const editedDuration = layout.reduce((total, seg) => total + seg.length, 0);
    setTranscript((words) =>
      words.flatMap((word) => {
        let best: (typeof layout)[number] | undefined;
        let bestOverlap = 0;
        for (const segment of layout) {
          const overlap = Math.max(
            0,
            Math.min(word.end, segment.end) -
              Math.max(word.start, segment.start),
          );
          if (overlap > bestOverlap) {
            best = segment;
            bestOverlap = overlap;
          }
        }
        if (!best || bestOverlap <= 0) return [];
        return [
          {
            ...word,
            start: best.outputStart + Math.max(0, word.start - best.start),
            end: best.outputStart + Math.min(best.length, word.end - best.start),
          },
        ];
      }),
    );
    setEditSegments(kept);
    setSelectedEditSegment(null);
    setSelectedEditSegments([]);
    setSelectedTimelineMedia([]);
    setCaptionEdits(null);
    setSilences([]);
    setAppliedSilences(allCutRanges);
    setPreviewCuts(false);
    setDuration(editedDuration);
    setTime(0);
    showGlobalSourceTime(kept[0].start, false);
    const nextFit = Math.min(
      1,
      Math.max(
        0.03,
        (timelineViewportWidth - 4) / Math.max(1, editedDuration * 72),
      ),
    );
    setZoom(nextFit);
    requestAnimationFrame(() =>
      timelineScrollRef.current?.scrollTo({ left: 0 }),
    );
    setNotice(
      `ตัดชิด Media รอบนี้ ${enabledSilences.length} ช่วง · ตัดสะสม ${allCutRanges.length} ช่วง · เหลือ ${kept.length} คลิป`,
    );
  };
  const exportToCapCut = async () => {
    let activeJobId = jobId || (await analyze(false, undefined, undefined, false));
    if (!activeJobId) return;
    const segments = editSegments.length
      ? editSegments
      : [{ start: 0, end: sourceDuration }];
    let capcutSources = mediaTimelineLayout.map((media) => ({
      jobId: mediaJobIds[media.mediaId] || "",
      name: media.item?.name || `media-${media.index + 1}`,
      duration: media.length,
    }));
    if (capcutSources.length > 1 && capcutSources.some((source) => !source.jobId)) {
      setNotice("Waveform ของบาง Media ยังประมวลผลไม่เสร็จ กรุณารอแล้วส่งไป CapCut อีกครั้ง");
      return;
    }
    const capcutSegments = segments.flatMap((segment) =>
      mediaTimelineLayout.flatMap((media) => {
        const overlapStart = Math.max(segment.start, media.start);
        const overlapEnd = Math.min(segment.end, media.start + media.length);
        if (overlapEnd <= overlapStart) return [];
        return [{
          sourceIndex: media.index,
          start: +(overlapStart - media.start).toFixed(3),
          end: +(overlapEnd - media.start).toFixed(3),
        }];
      }),
    );
    setExportOpen(false);
    setProcessing("กำลังสร้างโปรเจกต์ CapCut…");
    setNotice("");
    try {
      const makeExportBody = () => JSON.stringify({
          segments: capcutSegments.length ? capcutSegments : segments,
          sources: capcutSources,
          captions: caps,
          resolution: sequenceResolution,
          fps: sequenceFps,
          width: video.current?.videoWidth || 0,
          height: video.current?.videoHeight || 0,
      });
      const sendToCapCut = (id: string) =>
        fetch(`/api/export-capcut/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: makeExportBody(),
        });
      let response = await sendToCapCut(activeJobId);
      let data = await response.json();

      // The local API keeps uploaded media jobs in memory. If it was restarted,
      // transparently upload the same source again and retry the exact Timeline
      // export without rebuilding or changing the user's edits/captions.
      if (response.status === 404 && (timelineMedia.length || mediaFile)) {
        setProcessing("กำลังเชื่อมไฟล์ต้นฉบับใหม่เพื่อส่งไป CapCut…");
        const sourceItems = mediaTimelineLayout.length
          ? mediaTimelineLayout.map((media) => media.item).filter(Boolean)
          : mediaFile
            ? [{ file: mediaFile, name: mediaFile.name }]
            : [];
        const refreshedSources = [];
        const refreshedIds: Record<string, string> = {};
        for (let index = 0; index < sourceItems.length; index++) {
          const item = sourceItems[index]!;
          const form = new FormData();
          form.append("media", item.file);
          form.append("threshold", `${threshold}dB`);
          form.append("minSilence", String(minSilence));
          form.append("padding", String(padding));
          form.append("noiseReduce", noiseReduce);
          const analyzeResponse = await fetch("/api/analyze", {
            method: "POST",
            body: form,
          });
          const analyzeData = await analyzeResponse.json();
          if (!analyzeResponse.ok || !analyzeData.id)
            throw new Error(analyzeData.error || `เชื่อม ${item.name} ใหม่ไม่สำเร็จ`);
          const media = mediaTimelineLayout[index];
          if (media) refreshedIds[media.mediaId] = analyzeData.id;
          refreshedSources.push({
            jobId: analyzeData.id,
            name: item.name,
            duration: media?.length || analyzeData.duration || 0,
          });
        }
        capcutSources = refreshedSources;
        activeJobId = refreshedSources[0]?.jobId || activeJobId;
        setJobId(activeJobId);
        if (Object.keys(refreshedIds).length)
          setMediaJobIds((items) => ({ ...items, ...refreshedIds }));
        response = await sendToCapCut(activeJobId);
        data = await response.json();
      }
      if (!response.ok)
        throw new Error(data.error || "สร้าง CapCut draft ไม่สำเร็จ");
      setNotice(
        `สร้างโปรเจกต์ CapCut "${data.project}" แล้ว · ${data.clips} คลิป · ${data.captions} ซับ — ปิดแล้วเปิด CapCut ใหม่ จะเห็นในหน้าโปรเจกต์`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "สร้าง CapCut draft ไม่สำเร็จ",
      );
    } finally {
      setProcessing("");
    }
  };
  const exportProject = async () => {
    const activeJobId = jobId || (await analyze(false, undefined, undefined, false));
    if (!activeJobId) return;
    const keepSegments = editSegments.length
      ? editSegments
      : [{ start: 0, end: sourceDuration }];
    setExportOpen(false);
    setProcessing("กำลัง Render วิดีโอจาก Timeline…");
    setNotice(
      `กำลังส่งออก ${sequenceResolution} · ${sequenceFps}fps กรุณาอย่าปิดหน้านี้`,
    );
    try {
      const response = await fetch(`/api/export-cut/${activeJobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keepSegments,
          quality: exportQuality,
          noiseReduce: noiseReduce === "off" ? "" : noiseReduce,
          sequence: { resolution: sequenceResolution, fps: sequenceFps },
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Render ไม่สำเร็จ");
      }
      const blob = await response.blob();
      const safeName = (exportName.trim() || "video-final").replace(/[\\/:*?"<>|]/g, "-");
      if (exportDirectory) {
        const videoHandle = await exportDirectory.getFileHandle(`${safeName}.mp4`, {
          create: true,
        });
        const videoWriter = await videoHandle.createWritable();
        await videoWriter.write(blob);
        await videoWriter.close();
        if (exportWithSrt && caps.length) {
          const srtResponse = await fetch("/api/export-srt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ captions: caps }),
          });
          const srtHandle = await exportDirectory.getFileHandle(`${safeName}.srt`, {
            create: true,
          });
          const srtWriter = await srtHandle.createWritable();
          await srtWriter.write(await srtResponse.blob());
          await srtWriter.close();
        }
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${safeName}.mp4`;
        anchor.click();
        URL.revokeObjectURL(url);
        if (exportWithSrt && caps.length) await exportSrt();
      }
      setNotice(
        `ส่งออกสำเร็จ · ${sequenceResolution} · ${sequenceFps}fps · ${(blob.size / 1048576).toFixed(1)} MB`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setProcessing("");
    }
  };
  const chooseExportDirectory = async () => {
    const picker = (window as any).showDirectoryPicker;
    if (!picker) {
      setNotice("เบราว์เซอร์นี้ไม่รองรับการเลือกโฟลเดอร์ ระบบจะบันทึกใน Downloads");
      return;
    }
    try {
      const directory = await picker({ mode: "readwrite" });
      setExportDirectory(directory);
      setExportDirectoryName(directory.name || "โฟลเดอร์ที่เลือก");
    } catch (error: any) {
      if (error?.name !== "AbortError")
        setNotice("เปิดโฟลเดอร์ปลายทางไม่สำเร็จ");
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input,textarea,select,[contenteditable="true"]'))
        return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      const physicalX = event.code === "KeyX";
      if (
        [
          " ",
          "j",
          "k",
          "l",
          "arrowleft",
          "arrowright",
          "home",
          "end",
          "i",
          "o",
          "c",
          "x",
          "\\",
          "-",
          "=",
          "delete",
          "backspace",
        ].includes(key) || physicalX
      )
        event.preventDefault();
      if (key === " ") toggle();
      else if (key === "k") video.current?.pause();
      else if (key === "j") {
        video.current?.pause();
        frameStep(event.shiftKey ? -5 : -1);
      } else if (key === "l") {
        if (video.current) {
          video.current.playbackRate = event.shiftKey ? 2 : 1;
          video.current.play().catch(() => setNotice("กรุณานำเข้าวิดีโอก่อน"));
        }
      } else if (key === "arrowleft") frameStep(event.shiftKey ? -5 : -1);
      else if (key === "arrowright") frameStep(event.shiftKey ? 5 : 1);
      else if (key === "home") seek(0);
      else if (key === "end") seek(duration);
      else if (key === "i") {
        setInPoint(time);
        setNotice(`ตั้ง In ที่ ${fmt(time)}`);
      } else if (key === "o") {
        setOutPoint(time);
        setNotice(`ตั้ง Out ที่ ${fmt(time)}`);
      } else if (key === "c" || key === "x" || physicalX) splitAtPlayhead();
      else if (key === "\\") fitTimeline();
      else if (key === "-") setZoom((z) => Math.max(minZoom, z / 1.3));
      else if (key === "=") setZoom((z) => Math.min(8, z * 1.3));
      else if (key === "delete" || key === "backspace")
        deleteTimelineSelection();
      else if (key === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [time, duration, src, sourceDuration, minZoom, selectedEditSegment, selectedExtraTrack, editSegments, selectedTimelineMedia, timelineMedia, transcript, captionEdits, silences, appliedSilences, noiseReduce, count, captionPosition, captionSize]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.type === "layout-left") {
        setLeftPanelWidth(
          Math.max(220, Math.min(520, (drag.startWidth || 310) + event.clientX - drag.startX)),
        );
        return;
      }
      if (drag.type === "layout-right") {
        setRightPanelWidth(
          Math.max(240, Math.min(560, (drag.startWidth || 300) + drag.startX - event.clientX)),
        );
        return;
      }
      if (drag.type === "timeline-height") {
        setTimelineHeight(
          Math.max(
            220,
            Math.min(
              Math.max(260, window.innerHeight - 360),
              (drag.startHeight || 330) + (drag.startY - event.clientY),
            ),
          ),
        );
        return;
      }
      if (drag.type === "caption-scale") {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        // Drag up = bigger. Scale relative to canvas height for feel.
        const delta = ((drag.startY - event.clientY) / rect.height) * 1080;
        setCaptionSize(
          Math.max(12, Math.min(220, Math.round((drag.startSize ?? 64) + delta))),
        );
        return;
      }
      if (drag.type === "preview") {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || !drag.startPos) return;
        setCaptionPosition({
          x: Math.max(
            5,
            Math.min(
              95,
              drag.startPos.x +
                ((event.clientX - drag.startX) / rect.width) * 100,
            ),
          ),
          y: Math.max(
            10,
            Math.min(
              94,
              drag.startPos.y +
                ((event.clientY - drag.startY) / rect.height) * 100,
            ),
          ),
        });
        return;
      }
      const rect = timelineContentRef.current?.getBoundingClientRect();
      if (!rect) return;
      const delta =
        ((event.clientX - drag.startX) / rect.width) * timelineDisplayDuration;
      if (drag.type === "playhead") {
        seek(snapTime(drag.startTime + delta, rect.width));
        return;
      }
      if (drag.index === undefined) return;
      if (
        drag.type === "silence-move" ||
        drag.type === "silence-left" ||
        drag.type === "silence-right"
      ) {
        drag.moved = true;
        setSilences((items) =>
          items.map((silence, idx) => {
            if (idx !== drag.index) return silence;
            if (drag.type === "silence-left") {
              const start = Math.max(
                0,
                Math.min(silence.end - 0.05, drag.startTime + delta),
              );
              return { ...silence, start: +start.toFixed(3) };
            }
            if (drag.type === "silence-right") {
              const end = Math.min(
                sourceDuration,
                Math.max(silence.start + 0.05, (drag.startEnd || silence.end) + delta),
              );
              return { ...silence, end: +end.toFixed(3) };
            }
            const length = (drag.startEnd || silence.end) - drag.startTime;
            const start = Math.max(
              0,
              Math.min(sourceDuration - length, drag.startTime + delta),
            );
            return {
              ...silence,
              start: +start.toFixed(3),
              end: +(start + length).toFixed(3),
            };
          }),
        );
        return;
      }
      if (drag.type === "caption" && drag.group && drag.group.length > 1) {
        const minStart = Math.min(...drag.group.map((member) => member.start));
        const maxEnd = Math.max(...drag.group.map((member) => member.end));
        const clampShift = (value: number) =>
          Math.max(-minStart, Math.min(duration - maxEnd, value));
        const framed =
          Math.round((drag.startTime + clampShift(delta)) * sequenceFps) /
          sequenceFps;
        const shift = clampShift(framed - drag.startTime);
        const group = drag.group;
        setCaptionEdits((current) => {
          const list = [...(current ?? generatedCaps)];
          for (const member of group) {
            if (!list[member.index]) continue;
            list[member.index] = {
              ...list[member.index],
              start: +(member.start + shift).toFixed(3),
              end: +(member.end + shift).toFixed(3),
            };
          }
          return list;
        });
        return;
      }
      setCaptionEdits((current) => {
        const list = [...(current ?? generatedCaps)];
        const item = { ...list[drag.index!] };
        if (drag.type === "caption") {
          const length = (drag.startEnd || item.end) - drag.startTime;
          item.start = snapTime(
            Math.max(0, Math.min(duration - length, drag.startTime + delta)),
            rect.width,
            drag.index,
          );
          item.end = item.start + length;
        } else if (drag.type === "left")
          item.start = snapTime(
            Math.max(0, Math.min(item.end - 0.05, drag.startTime + delta)),
            rect.width,
            drag.index,
          );
        else
          item.end = snapTime(
            Math.min(
              duration,
              Math.max(item.start + 0.05, (drag.startEnd || item.end) + delta),
            ),
            rect.width,
            drag.index,
          );
        list[drag.index!] = item;
        return list;
      });
    };
    const up = () => {
      const finishedDrag = dragRef.current;
      dragRef.current = null;
      document.body.classList.remove("is-dragging");
      if (
        finishedDrag?.type === "silence-move" &&
        !finishedDrag.moved &&
        finishedDrag.index !== undefined
      ) {
        setSilences((items) =>
          items.map((silence, idx) =>
            idx === finishedDrag.index
              ? { ...silence, enabled: !silence.enabled }
              : silence,
          ),
        );
      }
      if (finishedDrag?.type === "playhead" && finishedDrag.resumePlayback) {
        if (pendingPreviewRef.current)
          pendingPreviewRef.current.play = true;
        else video.current?.play().catch(() => setPlaying(false));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [duration, timelineDisplayDuration, generatedCaps, snapEnabled, caps, inPoint, outPoint, sequenceFps, sourceDuration]);
  const beginDrag = (
    event: React.PointerEvent,
    type: DragType,
    index?: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const resumePlayback =
      type === "playhead" && Boolean(video.current && !video.current.paused);
    if (type === "playhead") video.current?.pause();
    document.body.classList.add("is-dragging");
    const isSilenceDrag =
      type === "silence-move" ||
      type === "silence-left" ||
      type === "silence-right";
    const item =
      index === undefined
        ? undefined
        : isSilenceDrag
          ? silences[index]
          : caps[index];
    dragRef.current = {
      type,
      index,
      startX: event.clientX,
      startY: event.clientY,
      startTime: type === "playhead" ? time : (item?.start ?? 0),
      startEnd: item?.end,
      startSize: captionSize,
      startHeight: timelineHeight,
      startWidth:
        type === "layout-left"
          ? leftPanelWidth
          : type === "layout-right"
            ? rightPanelWidth
            : undefined,
      startPos: captionPosition,
      group:
        type === "caption" &&
        index !== undefined &&
        checkedCaps.includes(index) &&
        checkedCaps.length > 1
          ? checkedCaps
              .filter((checkedIndex) => caps[checkedIndex])
              .map((checkedIndex) => ({
                index: checkedIndex,
                start: caps[checkedIndex].start,
                end: caps[checkedIndex].end,
              }))
          : undefined,
      resumePlayback,
    };
  };
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brandmark">S</span>
          <span>Silence Studio</span>
          <span className="local">LOCAL</span>
        </div>
        <div
          className={`project ${processing ? "processing" : ""}`}
          role={processing ? "status" : undefined}
          aria-live="polite"
        >
          {processing ? (
            <>
              <span className="project-processing-row">
                <i className="processing-spinner" />
                <strong>{processing}</strong>
              </span>
              <span className="saved">ประมวลผลในเครื่อง</span>
            </>
          ) : (
            <>
              <span>โปรเจกต์ใหม่</span>
              <span className="saved">บันทึกแล้ว</span>
            </>
          )}
        </div>
        <div className="top-actions">
          <button
            className="icon-btn"
            title="ย้อนกลับ (Ctrl+Z)"
            onClick={undo}
            disabled={historyIndexRef.current <= 0}
          >
            <Undo2 />
          </button>
          <button
            className="icon-btn"
            title="ทำซ้ำ (Ctrl+Shift+Z / Ctrl+Y)"
            onClick={redo}
            disabled={historyIndexRef.current >= historyRef.current.length - 1}
          >
            <Redo2 />
          </button>
          <label className="import">
            <Upload /> นำเข้าวิดีโอ
            <input
              type="file"
              multiple
              accept="video/*,audio/*"
              onChange={(e) => addMediaFiles(Array.from(e.target.files || []))}
            />
          </label>
          <button
            className="export"
            onClick={() => setExportOpen(true)}
            title="ส่งออกวิดีโอและคำบรรยาย"
          >
            <Download /> ส่งออก
          </button>
        </div>
      </header>
      {exportOpen && (
        <div className="export-overlay" onPointerDown={() => setExportOpen(false)}>
          <section
            className="export-dialog"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="export-dialog-heading">
              <div>
                <strong>ส่งออกโปรเจกต์</strong>
                <span>Render จาก Timeline ปัจจุบัน</span>
              </div>
              <button onClick={() => setExportOpen(false)}>×</button>
            </div>
            <label>
              ชื่อไฟล์
              <input
                value={exportName}
                onChange={(event) => setExportName(event.target.value)}
              />
              <i>.mp4</i>
            </label>
            <div className="export-folder-row">
              <span>โฟลเดอร์</span>
              <div>
                <b>{exportDirectoryName}</b>
                <small>
                  {exportDirectory
                    ? "บันทึก MP4 และ SRT ลงโฟลเดอร์นี้"
                    : "ค่าเริ่มต้นของเบราว์เซอร์"}
                </small>
              </div>
              <button onClick={() => void chooseExportDirectory()}>
                เลือกโฟลเดอร์
              </button>
            </div>
            <div className="export-summary">
              <div><span>ความละเอียด</span><b>{sequenceResolution}</b></div>
              <div><span>Frame rate</span><b>{sequenceFps} fps</b></div>
              <div><span>ระยะเวลา</span><b>{fmt(duration)}</b></div>
              <div><span>จำนวนคลิป</span><b>{editSegments.length || 1} ก้อน</b></div>
            </div>
            <label>
              คุณภาพ
              <select
                value={exportQuality}
                onChange={(event) => setExportQuality(event.target.value)}
              >
                <option value="maximum">สูงสุด · ไฟล์ใหญ่</option>
                <option value="high">คุณภาพสูง · แนะนำ</option>
                <option value="balanced">สมดุล · Render เร็ว</option>
              </select>
            </label>
            <label className="export-check">
              <input
                type="checkbox"
                checked={exportWithSrt}
                onChange={(event) => setExportWithSrt(event.target.checked)}
              />
              ส่งออกคำบรรยายเป็นไฟล์ SRT แยก
            </label>
            <p>
              วิดีโอจะใช้ลำดับก้อน การลบ Ripple ความละเอียด และ FPS จาก
              Timeline ล่าสุด
            </p>
            <button
              className="capcut-button"
              onClick={() => void exportToCapCut()}
              disabled={!mediaFile || Boolean(processing)}
              title="สร้างโปรเจกต์ CapCut ที่แก้ต่อได้ (คลิป + ซับแยก track)"
            >
              ↗ ส่งต่อไป CapCut (แก้ต่อได้ ไม่ Render)
            </button>
            <p className="capcut-note">
              เขียนโปรเจกต์ลง CapCut โดยตรง — คลิปที่ตัดชิดและซับจะเป็น track
              แยกให้แก้ต่อได้ · อ้างอิงไฟล์วิดีโอต้นฉบับในเครื่อง
            </p>
            <div className="export-actions">
              <button onClick={() => setExportOpen(false)}>ยกเลิก</button>
              <button
                className="render-button"
                onClick={() => void exportProject()}
                disabled={!mediaFile || Boolean(processing)}
              >
                <Download /> เริ่ม Render
              </button>
            </div>
          </section>
        </div>
      )}
      <main
        className="workspace"
        style={
          {
            "--left-panel-width": `${leftPanelWidth}px`,
            "--right-panel-width": `${rightPanelWidth}px`,
          } as React.CSSProperties
        }
      >
        <div
          className="panel-resizer panel-resizer-left"
          onPointerDown={(event) => beginDrag(event, "layout-left")}
          title="ลากเพื่อปรับความกว้าง Media Panel"
          onDoubleClick={() => setLeftPanelWidth(310)}
        />
        <div
          className="panel-resizer panel-resizer-right"
          onPointerDown={(event) => beginDrag(event, "layout-right")}
          title="ลากเพื่อปรับความกว้าง Inspector"
          onDoubleClick={() => setRightPanelWidth(300)}
        />
        <aside className="rail">
          <button
            className="rail-item active"
          >
            <Upload />
            <span>สื่อ</span>
          </button>
        </aside>
        <section className="media-panel">
              <div className="panel-title">
                <span>สื่อของคุณ</span>
                <button className="icon-btn">
                  <Search />
                </button>
              </div>
              <label className="dropzone">
                <Upload />
                <strong>เพิ่มวิดีโอหรือเสียง</strong>
                <span>ไฟล์จะอยู่ในเครื่องนี้เท่านั้น</span>
                <input
                  type="file"
                  multiple
                  accept="video/*,audio/*"
                  onChange={(e) => addMediaFiles(Array.from(e.target.files || []))}
                />
              </label>
              <div
                className="media-bin-list"
                ref={mediaBinListRef}
                onPointerDown={beginBinMarquee}
              >
                {mediaBin.length ? (
                  mediaBin.map((item) => (
                    <div
                      key={item.id}
                      data-id={item.id}
                      className={`media-info media-bin-item ${selectedBinIds.includes(item.id) ? "selected" : ""}`}
                      draggable
                      onClick={(event) => {
                        setSelectedBinIds((current) => {
                          if (event.ctrlKey || event.metaKey)
                            return current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id];
                          if (event.shiftKey && current.length) {
                            const ids = mediaBin.map((entry) => entry.id);
                            const anchor = ids.indexOf(current[current.length - 1]);
                            const target = ids.indexOf(item.id);
                            if (anchor >= 0 && target >= 0) {
                              const [lo, hi] =
                                anchor < target ? [anchor, target] : [target, anchor];
                              return [
                                ...new Set([...current, ...ids.slice(lo, hi + 1)]),
                              ];
                            }
                          }
                          return [item.id];
                        });
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "copy";
                        const many =
                          selectedBinIds.includes(item.id) && selectedBinIds.length > 1
                            ? selectedBinIds
                            : [item.id];
                        if (many.length > 1)
                          event.dataTransfer.setData(
                            "application/x-silence-media-multi",
                            JSON.stringify(many),
                          );
                        event.dataTransfer.setData(
                          "application/x-silence-media",
                          item.id,
                        );
                      }}
                      onDoubleClick={() =>
                        appendManyToTimeline(
                          selectedBinIds.includes(item.id) && selectedBinIds.length > 1
                            ? selectedBinIds
                            : [item.id],
                        )
                      }
                      title="คลิกเลือก · ลากคลุมเลือกหลายไฟล์ · ลากลง V1 หรือดับเบิลคลิกเพื่อวางต่อท้าย"
                    >
                      <div className="media-thumb">
                        <video src={item.url} muted draggable={false} />
                        <span>{fmt(item.duration)}</span>
                      </div>
                      <div>
                        <strong>{item.name}</strong>
                        <span>ลากลง V1 · พร้อมตัดต่อ</span>
                      </div>
                      <button
                        className="media-delete"
                        title="ลบสื่อออกจากโปรเจกต์"
                        draggable={false}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteMediaFromBin(
                            selectedBinIds.includes(item.id) && selectedBinIds.length > 1
                              ? selectedBinIds
                              : [item.id],
                          );
                        }}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-media">ยังไม่มีสื่อในโปรเจกต์</div>
                )}
                {binMarquee && (
                  <div
                    className="bin-marquee"
                    style={{
                      left: binMarquee.left,
                      top: binMarquee.top,
                      width: binMarquee.width,
                      height: binMarquee.height,
                    }}
                  />
                )}
              </div>
        </section>
        <section className="stage">
          <div
            className="canvas"
            ref={canvasRef}
            onDoubleClick={() => toggle()}
          >
            {src ? (
              <div
                className="preview-media"
                style={{ aspectRatio: sequenceRatio }}
              >
                <video
                  ref={video}
                  src={src}
                  muted={muted}
                  onLoadedMetadata={(e) => {
                    const pending = pendingPreviewRef.current;
                    if (pending) {
                      pendingPreviewRef.current = null;
                      e.currentTarget.currentTime = Math.min(
                        e.currentTarget.duration || pending.localTime,
                        pending.localTime,
                      );
                      if (pending.play)
                        e.currentTarget.play().catch(() => setPlaying(false));
                      return;
                    }
                    if (timelineMedia.length) return;
                    // duration reads back as Infinity for files that carry no
                    // length in their metadata (fragmented MP4, some WebM, a
                    // recording still being written). Infinity is truthy, so
                    // `|| 15` let it through and the ruler below then tried to
                    // allocate an infinite array, which takes the whole app
                    // down. The media bin already guards this the same way.
                    const probed = e.currentTarget.duration;
                    const nextDuration =
                      Number.isFinite(probed) && probed > 0 ? probed : 15;
                    setSourceDuration(nextDuration);
                    setDuration(nextDuration);
                    setZoom(
                      Math.min(
                        1,
                        Math.max(
                          0.03,
                          (timelineViewportWidth - 4) /
                            Math.max(1, nextDuration * 72),
                        ),
                      ),
                    );
                    requestAnimationFrame(() =>
                      timelineScrollRef.current?.scrollTo({ left: 0 }),
                    );
                  }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={(event) =>
                    syncTimelineTimeFromVideo(event.currentTarget)
                  }
                  onSeeked={() => {
                    previewSyncLockUntilRef.current = 0;
                  }}
                  onEnded={handlePreviewEnded}
                />
              </div>
            ) : (
              <div className="placeholder">
                <div className="placeholder-icon">
                  <Play />
                </div>
                <strong>นำเข้าวิดีโอเพื่อเริ่มตัดต่อ</strong>
                <span>Preview และ timeline จะปรากฏที่นี่</span>
              </div>
            )}
            {src && current && (
              <div
                key={active}
                className={`caption-preview anim-${captionAnim}`}
                onPointerDown={(e) => beginDrag(e, "preview")}
                style={{
                  color: style.fg,
                  background: style.bg,
                  fontWeight: style.font,
                  textTransform: style.transform as any,
                  WebkitTextStroke: `2px ${style.stroke}`,
                  fontFamily: THAI_FONTS[selectedFont].family,
                  fontSize: `${((captionSize / 1080) * 100).toFixed(2)}cqh`,
                  left: `${captionPosition.x}%`,
                  top: `${captionPosition.y}%`,
                  bottom: "auto",
                }}
              >
                {activeCaptionWords.length > 0 &&
                activeCaptionWords.map((word) => word.text).join("") === current
                  ? activeCaptionWords.map((word, i) => (
                      <span
                        key={i}
                        style={{
                          color: i === activeWordIndex ? style.active : undefined,
                        }}
                      >
                        {word.text}
                      </span>
                    ))
                  : current}
                <i
                  className="caption-resize"
                  title="ลากเพื่อย่อ/ขยายขนาดซับ"
                  onPointerDown={(e) => beginDrag(e, "caption-scale")}
                />
              </div>
            )}
          </div>
          <div className="transport">
            <button onClick={() => frameStep(-1)} title="ถอย 1 เฟรม (← / J)">
              <SkipBack />
            </button>
            <button
              className="play"
              onClick={toggle}
              title="เล่น/หยุดชั่วคราว (Space)"
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <button onClick={stop} title="หยุดและกลับจุดเริ่มต้น">
              <Square />
            </button>
            <button
              onClick={() => frameStep(1)}
              title="เดินหน้า 1 เฟรม (→ / L)"
            >
              <SkipForward />
            </button>
            <span className="timecode" title="ชั่วโมง:นาที:วินาที:เฟรม">
              {smpte(time)} <i>/</i> {smpte(duration)}
            </span>
            <div className="transport-spacer" />
            <button onClick={toggleFullscreen} title="พรีวิวเต็มจอ (F)">
              <Maximize2 />
            </button>
            <button
              className={muted ? "active" : ""}
              onClick={() => setMuted((value) => !value)}
              title={muted ? "เปิดเสียง" : "ปิดเสียง"}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </button>
            <button
              className="quality"
              onClick={() => setSequenceOpen((value) => !value)}
            >
              {sequenceResolution} · {sequenceFps}fps <ChevronDown />
            </button>
            {sequenceOpen && (
              <div className="sequence-settings">
                <strong>Sequence Settings</strong>
                <label>
                  ความละเอียด
                  <select
                    value={sequenceResolution}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSequenceResolution(value);
                      if (value === "1080×1920") setSequenceRatio("9 / 16");
                      else if (value === "1080×1080") setSequenceRatio("1 / 1");
                      else if (value === "1080×1350") setSequenceRatio("4 / 5");
                      else setSequenceRatio("16 / 9");
                    }}
                  >
                    <option>3840×2160</option>
                    <option>1920×1080</option>
                    <option>1280×720</option>
                    <option>1080×1920</option>
                    <option>1080×1080</option>
                    <option>1080×1350</option>
                  </select>
                </label>
                <label>
                  อัตราส่วน
                  <select
                    value={sequenceRatio}
                    onChange={(event) => {
                      const value = event.target.value;
                      setSequenceRatio(value);
                      if (value === "9 / 16") setSequenceResolution("1080×1920");
                      else if (value === "1 / 1") setSequenceResolution("1080×1080");
                      else if (value === "4 / 5") setSequenceResolution("1080×1350");
                      else if (!["3840×2160", "1920×1080", "1280×720"].includes(sequenceResolution))
                        setSequenceResolution("1920×1080");
                    }}
                  >
                    <option value="16 / 9">16:9 แนวนอน</option>
                    <option value="9 / 16">9:16 แนวตั้ง</option>
                    <option value="1 / 1">1:1 จัตุรัส</option>
                    <option value="4 / 5">4:5</option>
                  </select>
                </label>
                <label>
                  Frame rate
                  <select
                    value={sequenceFps}
                    onChange={(event) => setSequenceFps(+event.target.value)}
                  >
                    {[23.976, 24, 25, 30, 50, 60].map((fps) => (
                      <option value={fps} key={fps}>{fps} fps</option>
                    ))}
                  </select>
                </label>
                <button
                  className="sequence-apply"
                  onClick={() => setSequenceOpen(false)}
                >
                  ใช้การตั้งค่านี้
                </button>
              </div>
            )}
          </div>
        </section>
        <aside className="inspector">
          <div className="inspector-tabs">
            <button
              className={rightTab === "caption" ? "active" : ""}
              onClick={() => setRightTab("caption")}
            >
              คำบรรยาย
            </button>
            <button
              className={rightTab === "silence" ? "active" : ""}
              onClick={() => setRightTab("silence")}
            >
              ตัดเสียงเงียบ
            </button>
          </div>
          {rightTab === "caption" ? (
            <>
              <section className="control-section">
                <div className="section-heading">
                  <span>คำต่อหนึ่งซับ</span>
                  <output>{count} คำ</output>
                </div>
                <input
                  className="range"
                  type="range"
                  min="1"
                  max="10"
                  value={count}
                  onChange={(e) => setCount(+e.target.value)}
                />
                <div className="word-count-buttons">
                  {Array.from({ length: 10 }, (_, index) => index + 1).map(
                    (amount) => (
                      <button
                        key={amount}
                        className={count === amount ? "selected" : ""}
                        onClick={() => setCount(amount)}
                      >
                        {amount}
                      </button>
                    ),
                  )}
                </div>
                <div className="ticks">
                  <span>1</span>
                  <span>5</span>
                  <span>10</span>
                </div>
                <p>จัดกลุ่มใหม่โดยรักษาเวลาในระดับคำไว้</p>
                <div className="engine-row">
                  <button
                    className={subEngine === "whisper" ? "selected" : ""}
                    onClick={() => {
                      setSubEngine("whisper");
                      localStorage.setItem("subEngine", "whisper");
                    }}
                  >
                    Whisper ทั่วไป
                  </button>
                  {thaiModel && (
                    <button
                      className={subEngine === "whisper-th" ? "selected" : ""}
                      onClick={() => {
                        setSubEngine("whisper-th");
                        localStorage.setItem("subEngine", "whisper-th");
                      }}
                      title="Whisper fine-tune ภาษาไทย (Thonburian medium) — ฟรี ในเครื่อง"
                    >
                      Whisper ไทย ⭐
                    </button>
                  )}
                  <button
                    className={subEngine === "eleven" ? "selected" : ""}
                    onClick={() => {
                      setSubEngine("eleven");
                      localStorage.setItem("subEngine", "eleven");
                    }}
                  >
                    ElevenLabs
                  </button>
                </div>
                {subEngine === "whisper-th" && (
                  <p className="engine-note">
                    โมเดลไทย Thonburian (fine-tune ภาษาไทยโดยเฉพาะ) · ฟรี
                    ในเครื่อง · เหมาะกับคอนเทนต์ภาษาไทย
                  </p>
                )}
                {subEngine !== "eleven" && (
                  <div className="compute-row">
                    <span className="compute-label">ประมวลผล</span>
                    {(
                      [
                        ["auto", gpuReady ? "อัตโนมัติ (GPU)" : "อัตโนมัติ (CPU)"],
                        ["gpu", "GPU"],
                        ["cpu", "CPU"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        className={compute === value ? "selected" : ""}
                        disabled={value === "gpu" && !gpuReady}
                        title={
                          value === "gpu" && !gpuReady
                            ? "ยังไม่พบ GPU build (ดาวน์โหลดอยู่ หรือไม่มีการ์ดจอ)"
                            : ""
                        }
                        onClick={() => {
                          setCompute(value);
                          localStorage.setItem("compute", value);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    {gpuReady && (
                      <em className="gpu-badge" title="พบ NVIDIA GPU">
                        ⚡ GPU พร้อม
                      </em>
                    )}
                  </div>
                )}
                {subEngine !== "eleven" && alignReady && (
                  <label className="align-toggle">
                    <input
                      type="checkbox"
                      checked={alignOn}
                      onChange={(event) => {
                        setAlignOn(event.target.checked);
                        localStorage.setItem(
                          "alignOn",
                          event.target.checked ? "1" : "0",
                        );
                      }}
                    />
                    จับเวลาแม่นด้วย wav2vec2 (Forced Alignment) — ไฮไลต์ตรงปาก
                  </label>
                )}
                {subEngine === "eleven" && (
                  <>
                    <input
                      className="api-key-input"
                      type="password"
                      placeholder="วาง ElevenLabs API Key ที่นี่"
                      value={elevenKey}
                      onChange={(event) => {
                        setElevenKey(event.target.value);
                        localStorage.setItem("elevenKey", event.target.value);
                      }}
                    />
                    <p className="engine-note">
                      Key เก็บในเครื่องนี้เท่านั้น · เสียงจะถูกส่งไปถอดที่
                      ElevenLabs (แม่นระดับคำสูง)
                    </p>
                  </>
                )}
                <button
                  className="primary-wide"
                  onClick={transcribe}
                  disabled={Boolean(processing)}
                >
                  <Sparkles />{" "}
                  {processing ||
                    (subEngine === "eleven"
                      ? "สร้างซับไทยด้วย ElevenLabs"
                      : subEngine === "whisper-th"
                        ? "สร้างซับด้วย Whisper ไทย"
                        : "สร้างซับไทยด้วย Whisper")}
                </button>
                {notice && <div className="process-notice">{notice}</div>}
              </section>
              {transcript.length > 0 && (
                <section className="control-section">
                  <div className="section-heading">
                    <span>Sync ซับกับเสียง</span>
                    <output>
                      {subSync >= 0
                        ? `+${subSync.toFixed(2)}`
                        : subSync.toFixed(2)}{" "}
                      วิ
                    </output>
                  </div>
                  <input
                    className="range"
                    type="range"
                    min={-2}
                    max={2}
                    step={0.05}
                    value={subSync}
                    onChange={(event) => changeSubSync(+event.target.value)}
                  />
                  <div className="sync-buttons">
                    <button onClick={() => changeSubSync(subSync - 0.1)}>
                      ◀ เร็วขึ้น 0.1
                    </button>
                    <button onClick={() => changeSubSync(0)}>รีเซ็ต</button>
                    <button onClick={() => changeSubSync(subSync + 0.1)}>
                      ช้าลง 0.1 ▶
                    </button>
                  </div>
                  <p>
                    ถ้าไฮไลต์คำมาช้ากว่าเสียงพูด กด "เร็วขึ้น" จนตรงปาก —
                    มีผลทั้งไฮไลต์ ก้อนซับ และไฟล์ SRT
                  </p>
                </section>
              )}
              {caps.length > 0 && caps[selected] && (
                <section className="control-section caption-editor">
                  <div className="section-heading">
                    <span>แก้ไขซับก้อนที่ {selected + 1}</span>
                    <output>{fmt(caps[selected].start)}</output>
                  </div>
                  <textarea
                    value={caps[selected].text}
                    onChange={(event) =>
                      updateSelectedCaptionText(event.target.value)
                    }
                    onFocus={() => seek(caps[selected].start)}
                    rows={3}
                  />
                  <div className="caption-time-fields">
                    <label>
                      เริ่ม
                      <input
                        type="number"
                        step={1 / sequenceFps}
                        value={caps[selected].start.toFixed(3)}
                        onChange={(event) =>
                          updateSelectedCaptionTime("start", +event.target.value)
                        }
                      />
                    </label>
                    <label>
                      จบ
                      <input
                        type="number"
                        step={1 / sequenceFps}
                        value={caps[selected].end.toFixed(3)}
                        onChange={(event) =>
                          updateSelectedCaptionTime("end", +event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <small>คลิกก้อนซับ C1 เพื่อเลือก แล้วแก้ข้อความหรือเวลาได้ทันที</small>
                </section>
              )}
              {caps.length > 0 && (
                <section className="control-section sub-review">
                  <div className="section-heading">
                    <span>ตรวจทานซับ · {caps.length} ก้อน</span>
                    <output className={captionIssueCount ? "issue" : "ok"}>
                      {captionIssueCount
                        ? `${captionIssueCount} จุดควรแก้`
                        : "ครบถ้วน"}
                    </output>
                  </div>
                  <div className="sub-review-actions">
                    <label className="tick-all">
                      <input
                        type="checkbox"
                        checked={
                          caps.length > 0 && checkedCaps.length === caps.length
                        }
                        onChange={(event) =>
                          setCheckedCaps(
                            event.target.checked
                              ? caps.map((_, index) => index)
                              : [],
                          )
                        }
                      />
                      ติ๊กทั้งหมด
                    </label>
                    <button
                      className="sub-del"
                      disabled={!checkedCaps.length}
                      onClick={deleteCheckedCaps}
                    >
                      <Trash2 /> ลบที่เลือก ({checkedCaps.length})
                    </button>
                    <button className="sub-del-all" onClick={deleteAllCaps}>
                      <Trash2 /> ลบทั้งหมด
                    </button>
                  </div>
                  <div className={`sub-now ${active >= 0 ? "live" : ""}`}>
                    {active >= 0 ? (
                      <>
                        <b>▶ เล่นอยู่</b>
                        <span className="sub-now-id">C{active + 1}</span>
                        <span className="sub-now-time">
                          {fmt(caps[active].start)} → {fmt(caps[active].end)}
                        </span>
                        <em>{caps[active].text || "—"}</em>
                      </>
                    ) : (
                      <span className="sub-now-idle">
                        เลื่อน Playhead เพื่อดูซับที่กำลังเล่น
                      </span>
                    )}
                  </div>
                  <div className="sub-grid-head">
                    <span />
                    <span>#</span>
                    <span>เริ่ม</span>
                    <span>ข้อความ</span>
                    <span title="จุดที่ควรแก้">⚠</span>
                  </div>
                  <div className="sub-grid" ref={reviewRef}>
                    {caps.map((caption, index) => (
                      <div
                        key={index}
                        data-index={index}
                        className={`sub-grow ${
                          selected === index ? "selected" : ""
                        } ${active === index ? "playing" : ""} ${
                          captionIssues[index].length ? "has-issue" : ""
                        }`}
                        onPointerDown={() => {
                          setSelected(index);
                          seek(caption.start);
                        }}
                      >
                        <input
                          type="checkbox"
                          className="sub-check"
                          checked={checkedCaps.includes(index)}
                          onPointerDown={(event) => event.stopPropagation()}
                          onChange={() =>
                            setCheckedCaps((list) =>
                              list.includes(index)
                                ? list.filter((item) => item !== index)
                                : [...list, index],
                            )
                          }
                        />
                        <span
                          className="sub-row-index"
                          title="ลากขึ้น/ลงเพื่อเลือกหลายก้อน"
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            listSelRef.current = index;
                            setCheckedCaps([index]);
                            document.body.classList.add("is-dragging");
                          }}
                        >
                          {index + 1}
                        </span>
                        <span className="sub-gtime">{fmt(caption.start)}</span>
                        <input
                          className="sub-gtext"
                          value={caption.text}
                          onPointerDown={(event) => event.stopPropagation()}
                          onFocus={() => {
                            setSelected(index);
                            seek(caption.start);
                          }}
                          onChange={(event) => {
                            setSelected(index);
                            updateCaptionText(index, event.target.value);
                          }}
                        />
                        <span
                          className="sub-gstatus"
                          title={captionIssues[index].join(" · ")}
                        >
                          {captionIssues[index].length ? "⚠" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                  <small>
                    ลากที่เลข <b>#</b> เพื่อเลือกหลายก้อน · แถวสีฟ้าคือซับที่กำลังเล่น
                  </small>
                </section>
              )}
              <section className="control-section">
                <div className="section-heading">
                  <span>สไตล์คำบรรยาย</span>
                  <button>จัดการ Preset</button>
                </div>
                <div className="style-grid inspector-style-grid">
                  {STYLE_LIBRARY.map((item, i) => (
                    <button
                      key={item.name}
                      className={
                        styleSource === "library" && libraryStyle === i
                          ? "selected"
                          : ""
                      }
                      onClick={() => {
                        setLibraryStyle(i);
                        setStyleSource("library");
                      }}
                      title={`ใช้สไตล์ ${item.name}`}
                    >
                      <strong
                        style={{
                          color: item.fg,
                          background: item.bg,
                          WebkitTextStroke: `1.5px ${item.stroke}`,
                          fontWeight: item.font,
                          textTransform: item.transform as any,
                        }}
                      >
                        {item.sample}
                      </strong>
                      <span>{item.name}</span>
                      {styleSource === "library" && libraryStyle === i && (
                        <i>✓</i>
                      )}
                    </button>
                  ))}
                </div>
                <div className="style-subheading">Preset พื้นฐาน</div>
                <div className="presets">
                  {PRESETS.map((p, i) => (
                    <button
                      key={p.name}
                      className={
                        styleSource === "preset" && preset === i
                          ? "selected"
                          : ""
                      }
                      onClick={() => {
                        setPreset(i);
                        setStyleSource("preset");
                      }}
                    >
                      <span
                        style={{
                          color: p.fg,
                          background: p.bg,
                          WebkitTextStroke: `1px ${p.stroke}`,
                        }}
                      >
                        Aa
                      </span>
                      <small>{p.name}</small>
                    </button>
                  ))}
                </div>
              </section>
              <section className="control-section compact">
                <label>
                  ฟอนต์{" "}
                  <select
                    className="select font-select"
                    value={selectedFont}
                    onChange={(event) => setSelectedFont(+event.target.value)}
                  >
                    {THAI_FONTS.map((font, index) => (
                      <option value={index} key={font.name}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ขนาด{" "}
                  <div className="size-stepper">
                    <button
                      onClick={() =>
                        setCaptionSize((value) => Math.max(12, value - 4))
                      }
                      title="เล็กลง"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={12}
                      max={220}
                      value={captionSize}
                      onChange={(event) =>
                        setCaptionSize(
                          Math.max(
                            12,
                            Math.min(220, Number(event.target.value) || 64),
                          ),
                        )
                      }
                    />
                    <span>px</span>
                    <button
                      onClick={() =>
                        setCaptionSize((value) => Math.min(220, value + 4))
                      }
                      title="ใหญ่ขึ้น"
                    >
                      ＋
                    </button>
                  </div>
                </label>
                <label>
                  สีข้อความ{" "}
                  <button className="swatch">
                    <i style={{ background: style.fg }} /> {style.fg}
                  </button>
                </label>
                <label>
                  สีคำ Active{" "}
                  <button className="swatch">
                    <i style={{ background: style.active }} /> {style.active}
                  </button>
                </label>
                <label>
                  Animation{" "}
                  <select
                    className="select"
                    value={captionAnim}
                    onChange={(event) => setCaptionAnim(event.target.value)}
                  >
                    {CAPTION_ANIMS.map((anim) => (
                      <option key={anim.id} value={anim.id}>
                        {anim.name}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </>
          ) : (
            <>
              <section className="control-section noise-before-analysis">
                <div className="noise-before-cut">
                  <label className="noise-toggle">
                    <input
                      type="checkbox"
                      checked={noiseReduce !== "off"}
                      disabled={!mediaFile || Boolean(processing)}
                      onChange={(event) => {
                        const next = event.target.checked ? "light" : "off";
                        setNoiseReduce(next);
                      }}
                    />
                    <span>วิเคราะห์เสียงหลังวาง Media บน Timeline</span>
                  </label>
                  {noiseReduce !== "off" && (
                    <div className="noise-row">
                      {([['light', 'เบา'], ['strong', 'แรง']] as const).map(
                        ([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={noiseReduce === value ? "selected" : ""}
                            onClick={() => {
                              setNoiseReduce(value);
                            }}
                          >
                            {label}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                  <small>
                    {!mediaFile
                      ? "ลาก Media ลง V1 ก่อน จึงจะเริ่มวิเคราะห์ได้"
                      : noiseReduce === "off"
                        ? "ยังไม่เลือก — ใช้ปุ่มตรวจจับเพื่อวิเคราะห์เสียง Original"
                        : "กำลังใช้เสียงลด noise สำหรับ waveform และการตรวจช่วงเงียบ"}
                  </small>
                </div>
              </section>
              <section className="silence-hero">
                <Sparkles />
                <div>
                  <strong>ตรวจจับช่วงเงียบ</strong>
                  <span>วิเคราะห์เสียงในเครื่องของคุณ</span>
                </div>
                <button
                  onClick={() => void analyzeTimelineSelection()}
                  disabled={Boolean(processing)}
                >
                  {processing || "ตรวจจับช่วงเงียบ"}
                </button>
              </section>
              <section className="control-section">
                <div className="section-heading">
                  <span>ความแรงในการตัด</span>
                </div>
                <div className="cut-strength">
                  {[
                    { name: "เก็บจังหวะ", th: -32, ms: 0.6 },
                    { name: "มาตรฐาน", th: -27, ms: 0.4 },
                    { name: "กระชับสุด", th: -23, ms: 0.3 },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      className={
                        threshold === preset.th && minSilence === preset.ms
                          ? "selected"
                          : ""
                      }
                      onClick={() => {
                        setThreshold(preset.th);
                        setMinSilence(preset.ms);
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <p>
                  "กระชับสุด" ตัดช่วงพูดหยุด/หายใจที่เสียงเบาออกด้วย ·
                  เปลี่ยนค่าแล้วกด "ตรวจจับช่วงเงียบ" ใหม่
                </p>
              </section>
              <section className="control-section silence-sliders">
                <label className="silence-slider-row">
                  <span>Threshold</span>
                  <output>{threshold} dB</output>
                  <input
                    className="range silence-range"
                    type="range"
                    min="-50"
                    max="-18"
                    step="1"
                    value={threshold}
                    onChange={(event) => setThreshold(Number(event.target.value))}
                  />
                </label>
                <label className="silence-slider-row">
                  <span>เงียบอย่างน้อย</span>
                  <output>{minSilence.toFixed(2)} วิ</output>
                  <input
                    className="range silence-range"
                    type="range"
                    min="0.2"
                    max="2"
                    step="0.05"
                    value={minSilence}
                    onChange={(event) => setMinSilence(Number(event.target.value))}
                  />
                </label>
                <label className="silence-slider-row">
                  <span>Padding ก่อน/หลัง</span>
                  <output>{padding.toFixed(2)} วิ</output>
                  <input
                    className="range silence-range"
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={padding}
                    onChange={(event) => setPadding(Number(event.target.value))}
                  />
                </label>
              </section>
              {silences.length > 0 && (
                <section className="silence-actions">
                  <strong>
                    เลือกตัด {enabledSilences.length} ช่วง · ลดประมาณ{" "}
                    {removedDuration.toFixed(1)} วินาที
                  </strong>
                  <button
                    className={previewCuts ? "active" : ""}
                    onClick={() => setPreviewCuts((value) => !value)}
                  >
                    {previewCuts ? "หยุดทดลองข้าม" : "▶ ทดลองข้ามช่วงเงียบ"}
                  </button>
                  <button
                    className="export-cut"
                    onClick={applySilenceCuts}
                    disabled={!enabledSilences.length}
                  >
                    ✂ ตัดชิด (Ripple) บน Timeline
                  </button>
                  <small className="cut-hint">
                    ตัดชิดทันทีบน Timeline ไม่ Render · กด "ส่งออก"
                    เมื่องานเสร็จเพื่อ Render
                  </small>
                  <button
                    className="secondary"
                    onClick={() => {
                      const shouldEnable =
                        enabledSilences.length !== silences.length;
                      setSilences((items) =>
                        items.map((item) => ({
                          ...item,
                          enabled: shouldEnable,
                        })),
                      );
                    }}
                  >
                    {enabledSilences.length === silences.length
                      ? "ไม่เลือกทั้งหมด"
                      : "เลือกทั้งหมด"}
                  </button>
                  <small>
                    คลิกพื้นที่สีแดงบน waveform เพื่อเปิด/ปิดแต่ละช่วง
                  </small>
                </section>
              )}
              {notice && <div className="process-notice outside">{notice}</div>}
              <div className="silence-note">
                ช่วงที่ตรวจพบจะแสดงเป็นพื้นที่สีแดงบน waveform
                คุณสามารถเปิดหรือปิดแต่ละจุดก่อนตัดจริง
              </div>
            </>
          )}
        </aside>
      </main>
      <section className="timeline-shell" style={{ height: timelineHeight }}>
        <div
          className="timeline-resizer"
          onPointerDown={(e) => beginDrag(e, "timeline-height")}
          onDoubleClick={() => setTimelineHeight(330)}
          title="ลากเพื่อปรับความสูง Timeline"
        />
        <div className="timeline-tools">
          <div className="tool-left">
            <button onClick={splitAtPlayhead} title="แบ่งก้อนตรง Playhead (X)">
              <Scissors /> แบ่ง
            </button>
            <span className="divider" />
            <button
              className="icon-btn"
              onClick={undo}
              disabled={historyIndexRef.current <= 0}
              title="ย้อนกลับ (Ctrl+Z)"
            >
              <Undo2 />
            </button>
            <button
              className="icon-btn"
              onClick={redo}
              disabled={historyIndexRef.current >= historyRef.current.length - 1}
              title="ทำซ้ำ (Ctrl+Shift+Z / Ctrl+Y)"
            >
              <Redo2 />
            </button>
            <span className="clip-count">{caps.length} ช่วงซับ</span>
            <button
              className={selectedEditSegment !== null ? "tool-active" : ""}
              onClick={deleteSelectedEditSegment}
              disabled={selectedEditSegment === null}
              title="ลบก้อนที่เลือกและ Ripple ช่องว่าง"
            >
              <Trash2 /> ลบก้อน
            </button>
            <button
              className={selectedExtraTrack !== null ? "tool-active" : ""}
              onClick={deleteSelectedTrack}
              disabled={selectedExtraTrack === null}
              title="ลบ Video Track ที่เลือก"
            >
              <Trash2 /> ลบ Track
            </button>
            <button
              className={snapEnabled ? "tool-active" : ""}
              onClick={() => setSnapEnabled(!snapEnabled)}
              title="ดูดเข้าหาเฟรมและขอบคลิป (Snap)"
            >
              <Magnet /> Snap
            </button>
            <button
              onClick={() => {
                setSelectedEditSegment(null);
                setSelectedExtraTrack(extraVideoTracks);
                setExtraVideoTracks((count) => count + 1);
              }}
              title="เพิ่ม Video Track"
            >
              + Track
            </button>
          </div>
          <div className="zoom">
            <button onClick={fitTimeline} title="แสดง Timeline ทั้งหมด">
              <Maximize2 /> Fit
            </button>
            <button onClick={() => setZoom(Math.max(minZoom, zoom / 1.3))}>
              <ZoomOut />
            </button>
            <input
              type="range"
              min={minZoom}
              max="8"
              step=".02"
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
            />
            <button onClick={() => setZoom(Math.min(8, zoom * 1.3))}>
              <ZoomIn />
            </button>
          </div>
        </div>
        <div className="timeline-body">
          <div className="track-heads">
            <div className="ruler-head">แทร็ก</div>
            <div className="track-head">
              <div>
                <strong>วิดีโอ</strong>
                <span>V1</span>
              </div>
              <button onClick={() => setTrackVisible(!trackVisible)}>
                {trackVisible ? <Eye /> : <EyeOff />}
              </button>
              <button onClick={() => setLocked(!locked)}>
                {locked ? <Lock /> : <Unlock />}
              </button>
            </div>
            {Array.from({ length: extraVideoTracks }, (_, index) => (
              <div
                className={`track-head ${selectedExtraTrack === index ? "selected-track" : ""}`}
                key={`video-head-${index + 2}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedEditSegment(null);
                  setSelectedExtraTrack(index);
                }}
              >
                <div>
                  <strong>วิดีโอ</strong>
                  <span>V{index + 2}</span>
                </div>
                <button><Eye /></button>
                <button><Unlock /></button>
              </div>
            ))}
            <div className="track-head">
              <div>
                <strong>เสียง</strong>
                <span>A1</span>
              </div>
              <button
                className={muted ? "tool-active" : ""}
                onClick={() => setMuted((value) => !value)}
                title={muted ? "เปิดเสียง A1" : "ปิดเสียง A1"}
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </button>
              <button>
                <Unlock />
              </button>
            </div>
            <div className="track-head">
              <div>
                <strong>คำบรรยาย</strong>
                <span>C1</span>
              </div>
              <button>
                <Eye />
              </button>
              <button>
                <Unlock />
              </button>
            </div>
          </div>
          <div
            className="timeline-scroll"
            ref={timelineScrollRef}
            onWheel={zoomTimelineWithWheel}
          >
            <div
              ref={timelineContentRef}
              className="timeline-content"
              style={{ width: px, height: 216 + extraVideoTracks * 62 }}
              onPointerDownCapture={beginMarquee}
            >
              <div className="ruler">
                {Array.from(
                  {
                    // rulerStep already spaces labels ~64px apart, so a sane
                    // timeline never needs many ticks. Capping the count keeps
                    // a bad duration from allocating an unrenderable array.
                    length: Math.min(
                      2000,
                      Math.floor(timelineDisplayDuration / rulerStep) + 1,
                    ),
                  },
                  (_, i) => {
                    const t = i * rulerStep;
                    return (
                      <span
                        key={i}
                        style={{ left: `${(t / timelineDisplayDuration) * 100}%` }}
                      >
                        {fmtRuler(t)}
                      </span>
                    );
                  },
                )}
              </div>
              {marquee && (
                <div
                  className="timeline-marquee"
                  style={{ left: `${marquee.left}%`, width: `${marquee.width}%` }}
                />
              )}
              <div
                className="playhead"
                style={{ left: `${(time / timelineDisplayDuration) * 100}%` }}
                onPointerDown={(e) => beginDrag(e, "playhead")}
              >
                <i />
                <b />
              </div>
              {inPoint !== null && (
                <div
                  className="range-marker in-marker"
                  style={{ left: `${(inPoint / timelineDisplayDuration) * 100}%` }}
                >
                  I
                </div>
              )}
              {outPoint !== null && (
                <div
                  className="range-marker out-marker"
                  style={{ left: `${(outPoint / timelineDisplayDuration) * 100}%` }}
                >
                  O
                </div>
              )}
              <div
                className={`track video-track ${mediaDropActive ? "media-drop-active" : ""}`}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes("application/x-silence-media")) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setMediaDropActive(true);
                }}
                onDragLeave={() => setMediaDropActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setMediaDropActive(false);
                  const multi = event.dataTransfer.getData(
                    "application/x-silence-media-multi",
                  );
                  if (multi) {
                    try {
                      appendManyToTimeline(JSON.parse(multi) as string[]);
                      return;
                    } catch {
                      // fall through to single-id drop
                    }
                  }
                  appendMediaToTimeline(
                    event.dataTransfer.getData("application/x-silence-media"),
                  );
                }}
              >
                {timelineMedia.length > 0 && !editSegmentLayout.length ? (
                  <div
                    className="media-sequence"
                    style={{
                      width: `${occupiedPercent}%`,
                    }}
                  >
                    {timelineMedia.map((mediaId, index) => {
                      const item = mediaBin.find((entry) => entry.id === mediaId);
                      const total = timelineMedia.reduce(
                        (sum, id) =>
                          sum + (mediaBin.find((entry) => entry.id === id)?.duration || 1),
                        0,
                      );
                      return (
                        <div
                          key={`${mediaId}-${index}`}
                          className={`media-sequence-clip ${selectedTimelineMedia.includes(index) ? "selected" : ""}`}
                          style={{ flex: (item?.duration || 1) / Math.max(1, total) }}
                          draggable={selectedTimelineMedia.includes(index)}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setSelectedTimelineMedia((selected) =>
                              event.ctrlKey || event.metaKey || event.shiftKey
                                ? selected.includes(index)
                                  ? selected.filter((item) => item !== index)
                                  : [...selected, index]
                                : [index],
                            );
                            setSelectedEditSegment(null);
                            setSelectedEditSegments([]);
                            const rect = timelineContentRef.current?.getBoundingClientRect();
                            if (rect) {
                              const clickedTime =
                                ((event.clientX - rect.left) / rect.width) *
                                timelineDisplayDuration;
                              seek(clickedTime);
                            }
                          }}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("application/x-silence-sequence", String(index));
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.stopPropagation();
                            const from = Number(
                              event.dataTransfer.getData("application/x-silence-sequence"),
                            );
                            if (!Number.isInteger(from) || from === index) return;
                            setTimelineMedia((items) => {
                              const next = [...items];
                              const [moved] = next.splice(from, 1);
                              next.splice(index, 0, moved);
                              return next;
                            });
                            setSelectedTimelineMedia([index]);
                          }}
                        >
                          <div className="media-sequence-thumbnails">
                            {Array.from(
                              {
                                length: Math.max(
                                  3,
                                  Math.min(18, Math.ceil((item?.duration || 30) / 20)),
                                ),
                              },
                              (_, thumbIndex) => (
                                <span
                                  key={thumbIndex}
                                  style={
                                    item?.thumbnail
                                      ? { backgroundImage: `url(${item.thumbnail})` }
                                      : undefined
                                  }
                                />
                              ),
                            )}
                          </div>
                          <em>{index + 1} · {item?.name || "คลิป"}</em>
                        </div>
                      );
                    })}
                  </div>
                ) : editSegmentLayout.length ? (
                  editSegmentLayout.map((segment, index) => {
                    const sourceMedia = mediaTimelineLayout.find(
                      (media) =>
                        segment.start >= media.start - 0.001 &&
                        segment.start < media.start + media.length - 0.001,
                    );
                    const sourceAnalyzed = Boolean(
                      sourceMedia && analyzedMediaIds.includes(sourceMedia.mediaId),
                    );
                    const thumbIndex = Math.min(
                      Math.max(0, thumbnails.length - 1),
                      Math.floor(
                        ((segment.start + segment.end) /
                          2 /
                          Math.max(0.001, sourceDuration)) *
                          thumbnails.length,
                      ),
                    );
                    return (
                      <div
                        key={`${segment.start}-${segment.end}`}
                        className={`video-clip jump-segment ${sourceAnalyzed ? "detected-cut" : "pending-analysis"} ${sourceAnalyzed && (selectedEditSegments.includes(index) || selectedEditSegment === index) ? "selected" : ""} ${!sourceAnalyzed && sourceMedia && selectedTimelineMedia.includes(sourceMedia.index) ? "selected" : ""}`}
                        style={{
                          left: `${(segment.outputStart / timelineDisplayDuration) * 100}%`,
                          width: `${(segment.length / timelineDisplayDuration) * 100}%`,
                          opacity: trackVisible ? 1 : 0.35,
                        }}
                        title={`คลิป ${index + 1} · Source ${segment.start.toFixed(2)}–${segment.end.toFixed(2)}`}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          const rect = timelineContentRef.current?.getBoundingClientRect();
                          if (rect) {
                            const clicked = Math.max(
                              0,
                              Math.min(
                                duration,
                                ((event.clientX - rect.left) / rect.width) * timelineDisplayDuration,
                              ),
                            );
                            seek(
                              Math.round(clicked * sequenceFps) / sequenceFps,
                            );
                          }
                          setSelectedExtraTrack(null);
                          if (!sourceAnalyzed && sourceMedia) {
                            setSelectedTimelineMedia((selected) =>
                              event.ctrlKey || event.metaKey || event.shiftKey
                                ? selected.includes(sourceMedia.index)
                                  ? selected.filter((item) => item !== sourceMedia.index)
                                  : [...selected, sourceMedia.index]
                                : [sourceMedia.index],
                            );
                            setSelectedEditSegments([]);
                            setSelectedEditSegment(null);
                            return;
                          }
                          setSelectedTimelineMedia([]);
                          setSelectedEditSegments(
                            event.ctrlKey || event.metaKey
                              ? selectedEditSegments.includes(index)
                                ? selectedEditSegments.filter((item) => item !== index)
                                : [...selectedEditSegments, index]
                              : [index],
                          );
                          setSelectedEditSegment(index);
                        }}
                        draggable={
                          sourceAnalyzed &&
                          (selectedEditSegments.includes(index) ||
                            selectedEditSegment === index)
                        }
                        onDragStart={(event) => {
                          if (!sourceAnalyzed) return;
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "application/x-silence-editsegment",
                            String(index),
                          );
                        }}
                        onDragOver={(event) => {
                          if (
                            !event.dataTransfer.types.includes(
                              "application/x-silence-editsegment",
                            )
                          )
                            return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const from = Number(
                            event.dataTransfer.getData(
                              "application/x-silence-editsegment",
                            ),
                          );
                          if (!Number.isInteger(from) || from === index) return;
                          setEditSegments((items) => {
                            const next = [...items];
                            const [moved] = next.splice(from, 1);
                            next.splice(index, 0, moved);
                            return next;
                          });
                          setSelectedEditSegment(index);
                          setSelectedEditSegments([index]);
                        }}
                      >
                        <span
                          style={
                            sourceMedia?.item?.thumbnail || thumbnails[thumbIndex]
                              ? {
                                  backgroundImage: `url(${sourceMedia?.item?.thumbnail || thumbnails[thumbIndex]})`,
                                }
                              : {}
                          }
                        />
                        <em>
                          {index + 1} · {sourceMedia?.item?.name || "คลิป"}
                        </em>
                      </div>
                    );
                  })
                ) : detectedVideoLayout.length ? (
                  detectedVideoLayout.map((segment, index) => {
                    const sourceMedia = mediaTimelineLayout.find(
                      (media) =>
                        segment.start >= media.start - 0.001 &&
                        segment.start < media.start + media.length - 0.001,
                    );
                    return (
                      <div
                        key={`detected-${segment.start}-${segment.end}`}
                        className={`video-clip jump-segment ${segment.analyzed ? "detected-cut" : "pending-analysis"} ${segment.analyzed && (selectedEditSegments.includes(index) || selectedEditSegment === index) ? "selected" : ""} ${!segment.analyzed && selectedTimelineMedia.includes(segment.mediaIndex) ? "selected" : ""}`}
                        style={{
                          left: `${(segment.start / timelineDisplayDuration) * 100}%`,
                          width: `${(segment.length / timelineDisplayDuration) * 100}%`,
                          opacity: trackVisible ? 1 : 0.35,
                        }}
                        title={`ก้อนคำพูด ${index + 1} · ${segment.start.toFixed(2)}–${segment.end.toFixed(2)}`}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (segment.analyzed) {
                            setSelectedTimelineMedia([]);
                            setSelectedEditSegments(
                              event.ctrlKey || event.metaKey || event.shiftKey
                                ? selectedEditSegments.includes(index)
                                  ? selectedEditSegments.filter((item) => item !== index)
                                  : [...selectedEditSegments, index]
                                : [index],
                            );
                            setSelectedEditSegment(index);
                          } else {
                            setSelectedTimelineMedia((selected) =>
                              event.ctrlKey || event.metaKey || event.shiftKey
                                ? selected.includes(segment.mediaIndex)
                                  ? selected.filter((item) => item !== segment.mediaIndex)
                                  : [...selected, segment.mediaIndex]
                                : [segment.mediaIndex],
                            );
                            setSelectedEditSegment(null);
                            setSelectedEditSegments([]);
                          }
                          const rect = timelineContentRef.current?.getBoundingClientRect();
                          const clickedTime = rect
                            ? ((event.clientX - rect.left) / rect.width) *
                              timelineDisplayDuration
                            : segment.start;
                          seek(
                            Math.max(
                              segment.start,
                              Math.min(segment.end, clickedTime),
                            ),
                          );
                        }}
                      >
                        <span
                          style={
                            sourceMedia?.item?.thumbnail
                              ? { backgroundImage: `url(${sourceMedia.item.thumbnail})` }
                              : {}
                          }
                        />
                        <em>
                          {segment.mediaIndex + 1} · {sourceMedia?.item?.name || "คลิป"}
                          {!segment.analyzed ? " · ยังไม่วิเคราะห์" : ""}
                        </em>
                      </div>
                    );
                  })
                ) : null}
                {mediaDropActive && (
                  <div
                    className="media-drop-indicator"
                    style={{
                      left: `${occupiedPercent}%`,
                      width: `${Math.max(2, Math.min(28, 100 - occupiedPercent))}%`,
                    }}
                  >
                    วางต่อท้าย
                  </div>
                )}
              </div>
              {Array.from({ length: extraVideoTracks }, (_, index) => (
                <div
                  className={`track video-track empty-video-track ${selectedExtraTrack === index ? "selected-track" : ""}`}
                  key={`video-track-${index + 2}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedEditSegment(null);
                    setSelectedExtraTrack(index);
                  }}
                >
                  <span>V{index + 2} · วางคลิปเพิ่มเติมที่นี่</span>
                </div>
              ))}
              <div className="track audio-track">
                {(timelineMedia.length > 0 || editSegmentLayout.length > 0) && (
                  <div className="wave" style={{ width: `${occupiedPercent}%` }}>
                    <canvas ref={waveCanvasRef} className="wave-canvas" />
                  </div>
                )}
                {mediaTimelineLayout.map((segment) => (
                  <div
                    key={`wave-media-${segment.mediaId}-${segment.index}`}
                    className={`wave-media-segment ${mediaWaveforms[segment.mediaId]?.length ? "ready" : "loading"}`}
                    style={{
                      left: `${(segment.start / timelineDisplayDuration) * 100}%`,
                      width: `${(segment.length / timelineDisplayDuration) * 100}%`,
                    }}
                  >
                    <span>A1 · {segment.index + 1}</span>
                  </div>
                ))}
                {editSegmentLayout.map((segment, index) => (
                  <div
                    key={`audio-${index}`}
                    className="audio-jump-segment"
                    style={{
                      left: `${(segment.outputStart / timelineDisplayDuration) * 100}%`,
                      width: `${(segment.length / timelineDisplayDuration) * 100}%`,
                    }}
                  />
                ))}
                {silences.map((silence, i) => {
                  const timelineStart = sourceToTimeline(silence.start);
                  const timelineEnd = sourceToTimeline(silence.end);
                  return (
                  <div
                    key={i}
                    className={`silence-zone ${silence.enabled ? "" : "disabled"}`}
                    style={{
                      left: `${(timelineStart / timelineDisplayDuration) * 100}%`,
                      width: `${Math.max(0, ((timelineEnd - timelineStart) / timelineDisplayDuration) * 100)}%`,
                      minWidth: "1px",
                    }}
                    onPointerDown={(event) => beginDrag(event, "silence-move", i)}
                    title={`เงียบ ${silence.start.toFixed(2)}–${silence.end.toFixed(2)} วินาที · ลากกลางเพื่อย้าย · ลากขอบเพื่อปรับ · คลิกเพื่อเปิด/ปิด`}
                  >
                    <i
                      className="silence-handle silence-handle-left"
                      onPointerDown={(event) => beginDrag(event, "silence-left", i)}
                    />
                    <i
                      className="silence-handle silence-handle-right"
                      onPointerDown={(event) => beginDrag(event, "silence-right", i)}
                    />
                  </div>
                  );
                })}
              </div>
              <div className="track caption-track" onPointerDown={beginCapMarquee}>
                {capMarquee && (
                  <div
                    className="cap-marquee"
                    style={{
                      left: `${capMarquee.left}%`,
                      width: `${capMarquee.width}%`,
                    }}
                  />
                )}
                {caps.map((c, i) => {
                  const captionWidth = Math.max(
                    0,
                    ((c.end - c.start) / timelineDisplayDuration) * 100,
                  );
                  return (
                  <button
                    key={i}
                    className={`${selected === i ? "selected" : ""} ${
                      active === i ? "playing" : ""
                    } ${checkedCaps.includes(i) ? "checked" : ""}`}
                    style={{
                      left: `${(c.start / timelineDisplayDuration) * 100}%`,
                      // Use the real caption duration. A 2% minimum made every
                      // short caption look several seconds long on long videos
                      // and visually overlap its neighbours.
                      // Leave one screen pixel between touching captions so two
                      // correct, adjacent ranges never look overlapped.
                      width: `max(0px, calc(${captionWidth}% - 1px))`,
                    }}
                    onPointerDown={(e) => {
                      beginDrag(e, "caption", i);
                      setSelected(i);
                      seek(c.start);
                    }}
                  >
                    <i
                      className="trim-handle trim-left"
                      onPointerDown={(e) => beginDrag(e, "left", i)}
                    />
                    {c.text}
                    <i
                      className="trim-handle trim-right"
                      onPointerDown={(e) => beginDrag(e, "right", i)}
                    />
                  </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="statusbar">
          <span>
            <i className="green-dot" /> ประมวลผลในเครื่อง
          </span>
          <span>{sequenceFps} fps</span>
          <span>48 kHz</span>
          <span className="hotkey-hint">
            Space เล่น/พัก · J K L · ← → ทีละเฟรม · I O · X แบ่งก้อน · − + Zoom
          </span>
          <span className="status-spacer" />
          <span>Zoom {Math.round(zoom * 100)}%</span>
        </div>
      </section>
    </div>
  );
}
const rootElement = document.getElementById("root")!;
const appRoot =
  (
    globalThis as typeof globalThis & {
      __silenceStudioRoot?: ReturnType<typeof createRoot>;
    }
  ).__silenceStudioRoot || createRoot(rootElement);
(
  globalThis as typeof globalThis & {
    __silenceStudioRoot?: ReturnType<typeof createRoot>;
  }
).__silenceStudioRoot = appRoot;
appRoot.render(<App />);
