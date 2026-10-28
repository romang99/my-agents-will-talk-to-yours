// archive.js — "reset" for an experimental prototype.
//
// Resetting NEVER deletes. Every reset moves the current state into
// data/archive/<timestamp>/ and leaves a manifest saying what was moved and
// why. You can always go back and read (or restore) an earlier experiment —
// which matters when the runs are the paper's evidence.
//
// Two scopes:
//   findings — the runs only (the pool, edits and triggers stay put)
//   all      — runs + pool additions/removals + profile edits + custom triggers

import fs from 'node:fs';
import path from 'node:path';

/** Files and folders each scope touches, relative to the data directory. */
const SCOPES = {
  findings: ['runs'],
  all: ['runs', 'custom-researchers.json', 'profile-overrides.json', 'triggers.json'],
};

/** The valid scope names, for callers that need to validate before calling. */
export const RESET_SCOPES = Object.keys(SCOPES);

/**
 * Create and return a fresh timestamped archive directory. Two resets in the
 * same millisecond must not land in the same folder — that would conflate two
 * experiments and overwrite the first manifest — so the name is suffixed until
 * mkdir succeeds, which claims it atomically.
 */
function claimArchiveDir(dataDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(dataDir, 'archive');
  fs.mkdirSync(base, { recursive: true });
  for (let n = 1; ; n += 1) {
    const dir = path.join(base, n === 1 ? stamp : `${stamp}-${n}`);
    try {
      fs.mkdirSync(dir);
      return dir;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
}

export function resetState({ dataDir, scope = 'findings', note = '' }) {
  // Membership test, not a lookup: indexing SCOPES would let "__proto__" and
  // "toString" past a truthiness check and fail later with something unhelpful.
  if (!RESET_SCOPES.includes(scope)) {
    throw new Error(`Unknown reset scope "${scope}" (use: ${RESET_SCOPES.join(', ')})`);
  }
  const targets = SCOPES[scope];

  // The destination is claimed on first use, so a reset with nothing to move
  // leaves no empty directory behind. The manifest is written as soon as the
  // directory exists and rewritten when the moves finish: `listArchives` hides
  // manifest-less directories, so a rename that fails half-way must not be able
  // to leave archived runs invisible.
  const archivedAt = new Date().toISOString();
  let archiveDir = null;
  const moved = [];
  let runsArchived = 0;
  const writeManifest = (complete) =>
    fs.writeFileSync(
      path.join(archiveDir, 'MANIFEST.json'),
      JSON.stringify({ archivedAt, scope, note, moved, runsArchived, complete }, null, 2),
    );
  const claim = () => {
    if (!archiveDir) {
      archiveDir = claimArchiveDir(dataDir);
      writeManifest(false);
    }
    return archiveDir;
  };

  try {
    for (const target of targets) {
      const from = path.join(dataDir, target);
      if (!fs.existsSync(from)) continue;

      if (target === 'runs') {
        const files = fs.readdirSync(from).filter((f) => f.endsWith('.json'));
        if (files.length === 0) continue;
        const to = path.join(claim(), 'runs');
        fs.mkdirSync(to, { recursive: true });
        for (const f of files) {
          fs.renameSync(path.join(from, f), path.join(to, f));
          runsArchived += 1;
        }
        moved.push(`runs/ (${files.length} run${files.length === 1 ? '' : 's'})`);
      } else {
        fs.renameSync(from, path.join(claim(), target));
        moved.push(target);
      }
    }
  } catch (err) {
    // Record what did move before giving up, so the partial archive is findable.
    if (archiveDir) writeManifest(false);
    throw err;
  }

  if (moved.length === 0) return { archived: false, moved: [], runsArchived: 0, archiveDir: null };

  writeManifest(true);
  return { archived: true, moved, runsArchived, archiveDir };
}

/** Past resets, newest first — so the UI can say where the evidence went. */
export function listArchives(dataDir) {
  const dir = path.join(dataDir, 'archive');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, 'MANIFEST.json')))
    .map((d) => ({ id: d, ...JSON.parse(fs.readFileSync(path.join(dir, d, 'MANIFEST.json'), 'utf8')) }))
    .sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1));
}
