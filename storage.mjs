// Janitor for the scratch folder.
//
// Everything under `root` is disposable: browser uploads, extracted wavs,
// render output. The job table lives in memory only, so anything on disk that
// no live job points at is garbage — including every single file present at
// boot. Left unmanaged the folder grows without bound (it reached 527 GB
// across 339 files before this module existed), and a near-full system drive
// is exactly what makes silence analysis crawl.
//
// One exception: media that a CapCut draft links to. CapCut stores an absolute
// path to the upload, so deleting it turns the user's project into offline
// media. Those paths get pinned, and the pin manifest survives restarts.

import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import path from "node:path";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const GB = 1024 ** 3;

const PIN_FILE = ".pins.json";

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const gb = (bytes) => `${(bytes / GB).toFixed(2)} GB`;

/**
 * @param {object} options
 * @param {() => Promise<string[]>} [options.adopt] Paths that an external tool
 *   already depends on. Consulted at boot so the manifest can be rebuilt if it
 *   is ever lost, and so drafts made before this module existed still resolve.
 */
export function createJanitor({ root, jobs, log = console.log, adopt = null }) {
  const config = {
    // A job nobody has touched this long is abandoned — tab closed, user moved on.
    jobTtl: num(process.env.SILENCE_JOB_TTL_HOURS, 6) * HOUR,
    // How long an exported CapCut draft keeps its source media alive.
    pinTtl: num(process.env.SILENCE_PIN_TTL_DAYS, 14) * DAY,
    // Never touch anything written this recently: multer creates its temp file
    // long before it finishes writing several GB into it.
    grace: num(process.env.SILENCE_GRACE_MINUTES, 15) * MINUTE,
    sweepEvery: num(process.env.SILENCE_SWEEP_MINUTES, 5) * MINUTE,
    // Ceilings — whichever bites first wins.
    maxBytes: num(process.env.SILENCE_MAX_GB, 60) * GB,
    minFreeBytes: num(process.env.SILENCE_MIN_FREE_GB, 25) * GB,
  };

  const pinPath = path.join(root, PIN_FILE);
  /** @type {Map<string, {pinnedAt: number, label: string}>} */
  const pins = new Map();
  /** @type {Set<string>} */
  const inFlight = new Set();
  let sweeping = false;
  let timer = null;
  let lastSweep = { at: 0, removed: 0, freed: 0 };

  const norm = (target) => path.resolve(target).toLowerCase();

  // ---------------------------------------------------------------- pins

  let pinsLoaded = null;
  // Pins must be in memory before anything can be deleted, whatever the call
  // order — a sweep that runs without them would wipe live CapCut sources.
  const pinsReady = () => (pinsLoaded ??= loadPins());

  async function loadPins() {
    try {
      const raw = JSON.parse(await readFile(pinPath, "utf8"));
      const now = Date.now();
      for (const [key, value] of Object.entries(raw)) {
        const pinnedAt = Number(value?.pinnedAt) || 0;
        if (now - pinnedAt > config.pinTtl) continue;
        pins.set(key, { pinnedAt, label: String(value?.label || "") });
      }
    } catch {
      // No manifest yet, or it is corrupt. Either way we start clean.
    }
  }

  async function savePins() {
    try {
      await writeFile(pinPath, JSON.stringify(Object.fromEntries(pins)), "utf8");
    } catch (error) {
      log(`[janitor] could not persist pins: ${error.message}`);
    }
  }

  /**
   * Keep these paths alive — a CapCut draft now points at them.
   */
  async function pin(targets, label = "") {
    await pinsReady();
    const now = Date.now();
    let added = 0;
    for (const target of targets) {
      if (!target) continue;
      const key = norm(target);
      if (!key.startsWith(norm(root))) continue; // outside scratch, not ours
      pins.set(key, { pinnedAt: now, label });
      added += 1;
    }
    if (added) {
      await savePins();
      log(`[janitor] pinned ${added} source file(s) for ${label || "a draft"}`);
    }
  }

  function isPinned(target) {
    const entry = pins.get(norm(target));
    if (!entry) return false;
    if (Date.now() - entry.pinnedAt > config.pinTtl) {
      pins.delete(norm(target));
      return false;
    }
    return true;
  }

  // ------------------------------------------------------- in-flight holds

  function holdUpload(target) {
    if (target) inFlight.add(norm(target));
  }
  function releaseUpload(...targets) {
    for (const target of targets) if (target) inFlight.delete(norm(target));
  }
  const isInFlight = (target) => inFlight.has(norm(target));

  /**
   * Express middleware pair around multer: multer names the temp file before it
   * has finished streaming gigabytes into it, so a sweep firing mid-upload
   * would delete the file out from under the request.
   */
  function guardUpload(req, _res, next) {
    if (req.file?.path) holdUpload(req.file.path);
    next();
  }

  // ------------------------------------------------------------- job TTL

  /** Mark a job as still in use so the TTL sweep leaves it alone. */
  function touch(id) {
    const job = jobs.get(id);
    if (job) job.lastUsed = Date.now();
    return job;
  }

  /** Everything on disk that a live job still needs. */
  function liveTargets() {
    const live = new Set();
    for (const [id, job] of jobs) {
      if (job.file) live.add(norm(job.file));
      live.add(norm(path.join(root, id))); // transcript / wav working dir
      live.add(norm(path.join(root, `${id}-cut.mp4`))); // render output
    }
    return live;
  }

  function expireJobs(now) {
    let expired = 0;
    for (const [id, job] of jobs) {
      const lastUsed = job.lastUsed || job.createdAt || 0;
      if (now - lastUsed <= config.jobTtl) continue;
      if (isPinned(job.file)) continue;
      jobs.delete(id);
      expired += 1;
    }
    return expired;
  }

  // ---------------------------------------------------------------- sizes

  async function entrySize(target) {
    try {
      const info = await stat(target);
      if (!info.isDirectory()) return { bytes: info.size, mtime: info.mtimeMs };
      let bytes = 0;
      let mtime = info.mtimeMs;
      const stack = [target];
      while (stack.length) {
        const dir = stack.pop();
        for (const child of await readdir(dir, { withFileTypes: true })) {
          const full = path.join(dir, child.name);
          if (child.isDirectory()) {
            stack.push(full);
            continue;
          }
          const childInfo = await stat(full).catch(() => null);
          if (!childInfo) continue;
          bytes += childInfo.size;
          mtime = Math.max(mtime, childInfo.mtimeMs);
        }
      }
      return { bytes, mtime };
    } catch {
      return null;
    }
  }

  async function freeBytes() {
    try {
      if (typeof fsp.statfs !== "function") return null;
      const info = await fsp.statfs(root);
      return info.bsize * info.bavail;
    } catch {
      return null;
    }
  }

  async function drop(target) {
    try {
      await rm(target, { recursive: true, force: true, maxRetries: 3 });
      return true;
    } catch (error) {
      // A file ffmpeg still has open cannot be unlinked on Windows. It will be
      // collected on the next pass.
      log(`[janitor] could not remove ${path.basename(target)}: ${error.message}`);
      return false;
    }
  }

  /** Remove scratch entries right now — used when a request fails outright. */
  async function discard(...targets) {
    await pinsReady();
    for (const target of targets) {
      if (!target) continue;
      if (!norm(target).startsWith(norm(root))) continue;
      if (isPinned(target)) continue;
      await drop(target);
    }
  }

  /** Delete a render output once the client has actually received it. */
  function dropAfterSend(res, target) {
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      void drop(target);
    };
    res.on("close", cleanup);
    res.on("finish", cleanup);
  }

  // ---------------------------------------------------------------- sweep

  /**
   * @param {{ boot?: boolean }} options
   *   boot: no job or upload can predate the process, so the grace period on
   *   recently-written files is meaningless — take everything unpinned.
   */
  async function sweep({ boot = false } = {}) {
    if (sweeping) return lastSweep;
    await pinsReady();
    sweeping = true;
    const now = Date.now();
    let removed = 0;
    let freed = 0;
    try {
      const expired = expireJobs(now);
      const live = liveTargets();
      const survivors = [];
      let total = 0;

      let names = [];
      try {
        names = await readdir(root);
      } catch {
        names = [];
      }

      for (const name of names) {
        if (name === PIN_FILE) continue;
        const full = path.join(root, name);
        const info = await entrySize(full);
        if (!info) continue;

        if (isPinned(full)) {
          total += info.bytes;
          continue;
        }
        // An upload in progress is never garbage, whatever kind of sweep this is.
        if (isInFlight(full)) {
          total += info.bytes;
          continue;
        }
        if (live.has(norm(full))) {
          total += info.bytes;
          survivors.push({ full, ...info });
          continue;
        }
        if (!boot && now - info.mtime < config.grace) {
          total += info.bytes;
          continue;
        }
        if (await drop(full)) {
          removed += 1;
          freed += info.bytes;
        } else {
          total += info.bytes;
        }
      }

      // Pressure valve: still over the size cap, or the drive is running out.
      // Evict the least recently used jobs whole — a clear "please analyse
      // again" beats a job whose media vanished underneath it.
      const free = await freeBytes();
      const overSize = total > config.maxBytes;
      const lowDisk = free !== null && free + freed < config.minFreeBytes;
      if (overSize || lowDisk) {
        const byAge = survivors.sort((a, b) => a.mtime - b.mtime);
        let budget = total;
        const target = Math.min(
          config.maxBytes,
          lowDisk ? Math.max(0, budget - (config.minFreeBytes - (free ?? 0))) : budget,
        );
        for (const entry of byAge) {
          if (budget <= target) break;
          if (isInFlight(entry.full) || isPinned(entry.full)) continue;
          for (const [id, job] of jobs) {
            if (norm(job.file) === norm(entry.full)) jobs.delete(id);
          }
          if (await drop(entry.full)) {
            budget -= entry.bytes;
            removed += 1;
            freed += entry.bytes;
          }
        }
        log(
          `[janitor] storage pressure (${gb(total)} used${
            free === null ? "" : `, ${gb(free)} free`
          }) — evicted the oldest jobs`,
        );
      }

      if (removed || expired)
        log(
          `[janitor] removed ${removed} leftover item(s), reclaimed ${gb(freed)}${
            expired ? ` · expired ${expired} idle job(s)` : ""
          }`,
        );
      lastSweep = { at: now, removed, freed };
      return lastSweep;
    } finally {
      sweeping = false;
    }
  }

  async function stats() {
    await pinsReady();
    let bytes = 0;
    let items = 0;
    try {
      for (const name of await readdir(root)) {
        if (name === PIN_FILE) continue;
        const info = await entrySize(path.join(root, name));
        if (!info) continue;
        bytes += info.bytes;
        items += 1;
      }
    } catch {
      // Folder not created yet.
    }
    return {
      items,
      bytes,
      pinned: pins.size,
      jobs: jobs.size,
      freeBytes: await freeBytes(),
      lastSweep,
      config,
    };
  }

  // ----------------------------------------------------------------- boot

  async function start() {
    await pinsReady();
    if (adopt) {
      try {
        const adopted = await adopt();
        if (adopted?.length) await pin(adopted, "existing draft");
      } catch (error) {
        // Adoption is a safety net. If it fails, refuse to sweep blind rather
        // than risk deleting media a draft still points at.
        log(`[janitor] could not read existing drafts (${error.message}) — skipping boot sweep`);
        return lastSweep;
      }
    }
    // Nothing survives a restart except pins, so every other byte here is dead.
    const before = await sweep({ boot: true });
    timer = setInterval(() => {
      void sweep().catch((error) => log(`[janitor] sweep failed: ${error.message}`));
    }, config.sweepEvery);
    timer.unref?.();

    let closing = false;
    const shutdown = () => {
      if (closing) return;
      closing = true;
      clearInterval(timer);
      // Best effort and synchronous-ish: the next boot sweep is the real
      // guarantee, so never block exit on it.
      void sweep().finally(() => process.exit(0));
      setTimeout(() => process.exit(0), 4000).unref();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    process.once("SIGHUP", shutdown);

    log(
      `[janitor] scratch folder ${root} · reclaimed ${gb(before.freed)} at boot · ` +
        `sweeping every ${config.sweepEvery / MINUTE} min, job TTL ${
          config.jobTtl / HOUR
        } h, cap ${gb(config.maxBytes)}`,
    );
    return before;
  }

  return {
    start,
    sweep,
    stats,
    touch,
    pin,
    discard,
    holdUpload,
    releaseUpload,
    guardUpload,
    dropAfterSend,
    config,
  };
}
