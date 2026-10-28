# data/

Runtime state. The app writes here; the seed inputs it reads live in `server/data/`.
This repository ships with the runtime state empty, by policy: live runs and profiles of
real people are never committed (`docs/DATA_ETHICS.md` §7, `docs/PUBLISHING_CHECKLIST.md`).

| Path | What | Tracked? |
|---|---|---|
| `examples/*.json` | two demo-mode runs on synthetic pairs, so reviewers can read a run record without running anything; the app does not read this folder | yes |
| `runs/*.json` | one file per run — the provenance chain | **ignored** (only `.gitkeep`) |
| `archive/<timestamp>/` | past experimental conditions moved here by reset, each with `MANIFEST.json` | **ignored** |
| `custom-researchers.json` | `{added[], removed[]}` — researchers added in the UI, tombstones for removed seed ones | **ignored** |
| `profile-overrides.json` | human corrections to profiles, as field deltas | **ignored** |
| `triggers.json` | opportunity triggers; created from `server/data/triggers-seed.json` on first start | **ignored** |

All other files under `data/` are ignored by default, including newly named exports,
backups and live runs. Under `server/data/`, only `researchers.json` (fictional personas)
and `triggers-seed.json` are shared. `transcripts/` shares only its README; `private/`
is reserved for untracked local imports. These exclusions do not delete local files.

The commit and push guards reject these private paths even if they are force-added.
They also check the allowed JSON files: profiles must be explicitly synthetic and demo
examples must use the offline demo provider and synthetic seed personas. Review the
origin of every fixture; a synthetic flag alone does not make a real profile fictional.
Enable the guards in each clone with `git config core.hooksPath .githooks`.

To see the examples in the interface:

```bash
cp data/examples/*.json data/runs/
```

Restore an archived condition: `mv archive/<timestamp>/runs/*.json runs/` and reload the app.
