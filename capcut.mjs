// Builds a CapCut Desktop draft (draft_content.json + draft_meta_info.json)
// from a cut list (editSegments) + captions, by cloning a real reference draft
// so the schema matches the installed CapCut version.
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const US = 1_000_000;
const newId = () => crypto.randomUUID().toUpperCase();
const fwd = (p) => String(p).replace(/\\/g, "/");

async function loadJson(p) {
  return JSON.parse(await readFile(p, "utf8"));
}

// Index every material in a draft by id -> {bucket, material}.
function indexMaterials(materials) {
  const idx = new Map();
  for (const [bucket, arr] of Object.entries(materials || {})) {
    if (Array.isArray(arr))
      for (const m of arr) if (m && m.id) idx.set(m.id, { bucket, material: m });
  }
  return idx;
}

// Clone the extra materials a template segment references (speed, canvas,
// sound_channel_mapping, placeholder_info, material_color, vocal_separation,
// text animations, …) into destMaterials with fresh ids, and return the new
// ref-id list. CapCut refuses to edit a segment whose extra_material_refs are
// missing, so every generated segment gets its own copies.
function cloneSegRefs(refIds, srcIdx, destMaterials) {
  const out = [];
  for (const rid of refIds || []) {
    const hit = srcIdx.get(rid);
    if (!hit) continue;
    const m = structuredClone(hit.material);
    m.id = newId();
    if (!Array.isArray(destMaterials[hit.bucket])) destMaterials[hit.bucket] = [];
    destMaterials[hit.bucket].push(m);
    out.push(m.id);
  }
  return out;
}

// Scan the CapCut draft root for a draft usable as a video/content template
// and one usable as a text template.
export async function findTemplates(draftRoot, preferredName = "0722") {
  let entries = [];
  try {
    entries = await readdir(draftRoot);
  } catch {
    throw new Error(`เปิดโฟลเดอร์ draft ของ CapCut ไม่ได้: ${draftRoot}`);
  }
  const candidates = [];
  for (const name of entries) {
    // Never use our own generated projects as a template (avoids propagating any
    // quirk of a previous export, and hidden/system folders).
    if (name.endsWith("-jumpcut") || name.startsWith(".")) continue;
    const dir = path.join(draftRoot, name);
    const content = path.join(dir, "draft_content.json");
    let s;
    try {
      s = await stat(content);
    } catch {
      continue;
    }
    candidates.push({ name, dir, content, mtime: s.mtimeMs });
  }
  // The user keeps a known-good CapCut project as the compatibility template.
  // Prefer it over an arbitrary recently edited draft, whose schema/features may
  // differ or whose media may have been removed.
  candidates.sort((a, b) => {
    if (a.name === preferredName) return -1;
    if (b.name === preferredName) return 1;
    return b.mtime - a.mtime;
  });
  let contentRef = null;
  let textRef = null;
  for (const c of candidates) {
    let draft;
    try {
      draft = await loadJson(c.content);
    } catch {
      continue;
    }
    const hasVideo =
      (draft.materials?.videos || []).length > 0 &&
      (draft.tracks || []).some(
        (t) => t.type === "video" && (t.segments || []).length > 0,
      );
    const hasText =
      (draft.materials?.texts || []).length > 0 &&
      (draft.tracks || []).some(
        (t) => t.type === "text" && (t.segments || []).length > 0,
      );
    if (!contentRef && hasVideo) contentRef = { ...c, draft };
    if (!textRef && hasText) textRef = { ...c, draft };
    if (contentRef && textRef) break;
  }
  if (!contentRef)
    throw new Error(
      "ไม่พบโปรเจกต์ CapCut ที่มีวิดีโอสำหรับใช้เป็นต้นแบบ — เปิด CapCut สร้างโปรเจกต์ที่มีคลิป 1 อันก่อน",
    );
  return { contentRef, textRef };
}

function setTextContent(material, text) {
  let content;
  try {
    content = JSON.parse(material.content || "{}");
  } catch {
    content = {};
  }
  const style = (content.styles && content.styles[0]) || {};
  style.range = [0, text.length];
  content.text = text;
  content.styles = [style];
  material.content = JSON.stringify(content);
  material.base_content = text;
  material.recognize_text = text;
  material.words = { text: [], start_time: [], end_time: [] };
}

// CapCut export must be safe even if the caller sends old/untrimmed caption
// data. Keep every start fixed and remove only the tail covered by the next
// caption. Zero-length captions are omitted from the CapCut text track.
function trimCaptionOverlaps(captions) {
  return (captions || []).map((caption, index) => {
    const next = captions[index + 1];
    if (!next || caption.end <= next.start) return caption;
    return { ...caption, end: Math.max(caption.start, next.start) };
  });
}

// Returns { draft, totalUs, videoMaterialId }
export function buildDraftContent(opts) {
  const {
    contentDraft,
    textDraft,
    videoPath,
    videoName,
    width,
    height,
    sourceDurationUs,
    hasAudio,
    canvasW,
    canvasH,
    fps,
    segments,
    captions,
    timelineId,
    mediaSources,
  } = opts;

  const draft = structuredClone(contentDraft);
  // Index the template's materials before we start replacing buckets, so we can
  // clone the per-segment extra materials (speed/canvas/etc) that CapCut needs.
  const vIdx = indexMaterials(draft.materials);

  // --- video material (clone template, swap in our media) ---
  const refVideos = draft.materials?.videos || [];
  const sources = mediaSources?.length
    ? mediaSources
    : [{
        path: videoPath,
        name: videoName,
        durationUs: sourceDurationUs,
        width,
        height,
        hasAudio,
      }];
  const videoMaterialIds = sources.map(() => newId());
  draft.materials.videos = sources.map((source, index) => {
    const vmat = structuredClone(refVideos[0]);
    Object.assign(vmat, {
      id: videoMaterialIds[index],
      local_material_id: "",
      material_name: source.name,
      path: fwd(source.path),
      media_path: "",
      reverse_path: "",
      intensifies_path: "",
      duration: source.durationUs,
      width: source.width || width,
      height: source.height || height,
      has_audio: source.hasAudio !== false,
      type: "video",
      crop_scale: 1,
      crop: {
        lower_left_x: 0,
        lower_left_y: 1,
        lower_right_x: 1,
        lower_right_y: 1,
        upper_left_x: 0,
        upper_left_y: 0,
        upper_right_x: 1,
        upper_right_y: 0,
      },
    });
    return vmat;
  });
  draft.materials.audios = [];

  // --- video track from cut segments ---
  const refVTrack = (draft.tracks || []).find(
    (t) => t.type === "video" && (t.segments || []).length,
  );
  const segTpl = refVTrack.segments[0];
  // Reset the material buckets this segment type references, then rebuild them
  // per generated segment (each needs its own speed/canvas/etc copies).
  const vRefBuckets = new Set(
    (segTpl.extra_material_refs || [])
      .map((r) => vIdx.get(r)?.bucket)
      .filter(Boolean),
  );
  for (const b of vRefBuckets) draft.materials[b] = [];
  const videoTrack = { ...structuredClone(refVTrack), id: newId(), segments: [] };
  let cursor = 0;
  segments.forEach((seg, i) => {
    const sourceIndex = Math.max(
      0,
      Math.min(videoMaterialIds.length - 1, Number(seg.sourceIndex || 0)),
    );
    const durUs = Math.max(1, Math.round((seg.end - seg.start) * US));
    const s = structuredClone(segTpl);
    Object.assign(s, {
      id: newId(),
      material_id: videoMaterialIds[sourceIndex],
      source_timerange: {
        start: Math.max(0, Math.round(seg.start * US)),
        duration: durUs,
      },
      target_timerange: { start: cursor, duration: durUs },
      render_timerange: { start: 0, duration: 0 },
      speed: 1.0,
      volume: 1.0,
      last_nonzero_volume: 1.0,
      reverse: false,
      is_loop: false,
      visible: true,
      clip: {
        scale: { x: 1, y: 1 },
        rotation: 0,
        transform: { x: 0, y: 0 },
        flip: { vertical: false, horizontal: false },
        alpha: 1,
      },
      uniform_scale: { on: true, value: 1 },
      extra_material_refs: cloneSegRefs(
        segTpl.extra_material_refs,
        vIdx,
        draft.materials,
      ),
      render_index: i,
      track_render_index: 0,
      group_id: "",
      common_keyframes: [],
      keyframe_refs: [],
    });
    cursor += durUs;
    videoTrack.segments.push(s);
  });
  const totalUs = cursor;

  // --- text track from captions ---
  draft.materials.texts = [];
  let textTrack = null;
  const refTTrack =
    textDraft &&
    (textDraft.tracks || []).find(
      (t) => t.type === "text" && (t.segments || []).length,
    );
  const tMatTpl =
    refTTrack &&
    (textDraft.materials.texts || []).find(
      (m) => m.id === refTTrack.segments[0].material_id,
    );
  const tSegTpl = refTTrack && refTTrack.segments[0];
  const tIdx = textDraft ? indexMaterials(textDraft.materials) : new Map();
  if (tMatTpl && tSegTpl && captions.length) {
    textTrack = { ...structuredClone(refTTrack), id: newId(), segments: [] };
    trimCaptionOverlaps(captions).forEach((cap, i) => {
      const text = String(cap.text || "").trim();
      if (!text) return;
      const durUs = Math.round((cap.end - cap.start) * US);
      if (durUs <= 0) return;
      const mat = structuredClone(tMatTpl);
      mat.id = newId();
      setTextContent(mat, text);
      const s = structuredClone(tSegTpl);
      Object.assign(s, {
        id: newId(),
        material_id: mat.id,
        source_timerange: null,
        target_timerange: {
          start: Math.max(0, Math.round(cap.start * US)),
          duration: durUs,
        },
        render_timerange: { start: 0, duration: 0 },
        extra_material_refs: cloneSegRefs(
          tSegTpl.extra_material_refs,
          tIdx,
          draft.materials,
        ),
        render_index: 14000 + i,
        track_render_index: 1,
        visible: true,
        clip: {
          scale: { x: 1, y: 1 },
          rotation: 0,
          transform: { x: 0, y: 0.72 },
          flip: { vertical: false, horizontal: false },
          alpha: 1,
        },
        uniform_scale: { on: true, value: 1 },
        common_keyframes: [],
        keyframe_refs: [],
      });
      draft.materials.texts.push(mat);
      textTrack.segments.push(s);
    });
  }

  // --- assemble ---
  draft.tracks = [videoTrack];
  if (textTrack && textTrack.segments.length) draft.tracks.push(textTrack);
  draft.duration = totalUs;
  draft.fps = fps || 30;
  draft.canvas_config = {
    ratio: "original",
    width: canvasW,
    height: canvasH,
    background: null,
  };
  // A CapCut project has two different identifiers: draft_id in its metadata
  // and a timeline id in draft_content/Timelines/project.json. They must not be
  // conflated, and the timeline folder must have this exact id.
  draft.id = timelineId || newId();
  if (draft.materials) {
    draft.materials.video_effects = [];
    draft.materials.effects = draft.materials.effects || [];
  }
  return { draft, totalUs, videoMaterialId: videoMaterialIds[0], videoMaterialIds };
}

export function buildDraftMeta(refMeta, opts) {
  const { draftId, draftName, foldPath, rootPath, durationUs, createUs, media, medias } =
    opts;
  const meta = structuredClone(refMeta);
  meta.draft_id = draftId;
  meta.draft_name = draftName;
  meta.draft_fold_path = fwd(foldPath);
  meta.draft_root_path = rootPath;
  meta.draft_cover = fwd(path.join(foldPath, "draft_cover.jpg"));
  meta.tm_duration = durationUs;
  meta.tm_draft_create = createUs;
  meta.tm_draft_modified = createUs;
  meta.tm_draft_removed = 0;
  const makeEntry = (item) => ({
    ai_group_type: "",
    create_time: Math.floor(createUs / US),
    duration: item.durationUs,
    enter_from: 0,
    extra_info: item.name || "",
    file_Path: fwd(item.path),
    height: item.height,
    id: crypto.randomUUID(),
    import_time: Math.floor(createUs / US),
    import_time_ms: createUs,
    item_source: 1,
    material_color_tag: "",
    md5: "",
    metetype: "video",
    roughcut_time_range: { duration: item.durationUs, start: 0 },
    sub_time_range: { duration: -1, start: -1 },
    type: 0,
    width: item.width,
  });
  if (!Array.isArray(meta.draft_materials)) meta.draft_materials = [];
  let bucket = meta.draft_materials.find((b) => b.type === 0);
  if (!bucket) {
    bucket = { type: 0, value: [] };
    meta.draft_materials.unshift(bucket);
  }
  bucket.value = (medias?.length ? medias : [media]).map(makeEntry);
  return meta;
}

export function registerInRoot(root, opts) {
  const { draftId, draftName, foldPath, rootPath, durationUs, createUs } = opts;
  const list = Array.isArray(root.all_draft_store) ? root.all_draft_store : [];
  const tpl = list[0] ? structuredClone(list[0]) : {};
  Object.assign(tpl, {
    draft_id: draftId,
    draft_name: draftName,
    draft_fold_path: fwd(foldPath),
    draft_root_path: rootPath,
    draft_json_file: fwd(path.join(foldPath, "draft_content.json")),
    draft_cover: fwd(path.join(foldPath, "draft_cover.jpg")),
    draft_is_invisible: false,
    tm_duration: durationUs,
    tm_draft_create: createUs,
    tm_draft_modified: createUs,
    tm_draft_removed: 0,
  });
  const foldFwd = fwd(foldPath);
  root.all_draft_store = [
    tpl,
    ...list.filter(
      (e) => e.draft_fold_path !== foldFwd && e.draft_id !== draftId,
    ),
  ];
  if (Array.isArray(root.draft_ids))
    root.draft_ids = [draftId, ...root.draft_ids.filter((x) => x !== draftId)];
  return { root, draftId };
}
