---
title: "ResearcherConnect — Publishing Checklist"
subtitle: "Before the repository goes to GitHub or to a reviewer"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "28 October 2026"
---

The shared repository contains **fictional synthetic profiles and offline demo runs only**.
Never commit a real person's profile, a live run, human profile corrections, credentials,
or raw working-session transcripts. This rule includes the authors' own profiles and all
reachable Git history. Changing a real person's name or setting `synthetic: true` is not
anonymisation: use independently written fictional fixtures instead.

## 1. Contents of the shared snapshot

- Ten fictional profiles in `server/data/researchers.json`, all marked `synthetic: true`.
- A fictional collaboration graph and two offline demo examples on synthetic pairs.
- Application code, tests, documentation, and the MIT licence with its author attribution.

Real profiles, overrides, live evidence and raw transcripts belong in a separate private
research archive. The shared documentation may summarise aggregate methodological findings;
it does not include the underlying personal profiles or live run artifacts.

## 2. Before every push

1. Run `npm test`. This includes regression tests for the publishing policy.
2. Run `npm run check:publishing`. It audits tracked files and every reachable commit:
   synthetic profiles and persona snapshots, demo-only examples, private runtime paths,
   credentials, and author identities accidentally reused as personas.
3. Review `git diff --cached` manually. Flags and automated pattern checks cannot prove
   that an invented-looking profile is unrelated to a real person.
4. Run `git ls-files data/ server/data/ transcripts/ private/`. Only `data/README.md`,
   `data/runs/.gitkeep`, direct synthetic `data/examples/*.json`, the two seed files
   (`researchers.json`, `triggers-seed.json`) and `transcripts/README.md` should be listed.
5. Confirm `git check-ignore data/profile-overrides.json data/runs/check.json
   data/archive/check.json data/new-export.csv server/data/researchers-backup.json
   transcripts/session.txt private/import.json` reports all seven paths. The data folders
   use an allowlist, so new local exports and backups remain untracked by default.
   The commit guard rejects excluded paths even if force-added; allowed JSON is also
   checked for synthetic-only profiles and demo-only runs.
6. Retain the MIT `LICENSE` and copyright attribution. Keep STATUS accurate; do not present
   offline examples as live evidence or rewrite historical findings as synthetic results.
7. Optional: render documentation with `npm run docs`. PDFs are ignored build output.

The automated audit is an additional gate, not a substitute for reviewing the data's origin.
An initial setup commit containing only a README is harmless; every commit containing seed
data or run artifacts must meet this policy.

## 3. Enable the commit and push guards in every clone

```bash
git config core.hooksPath .githooks
```

The pre-commit hook checks the staged snapshot, so unstaged edits cannot hide private data.
The tracked pre-push hook checks the actual commit being pushed and all its ancestors.
It blocks a clean-looking latest commit if an older ancestor still contains private data.
The QUT working clone has this guard enabled. Every new clone needs the configuration above.

## 4. If private data was already pushed

Deleting a file in a new commit is insufficient. Rewrite every affected branch or tag,
audit the rewritten history, and coordinate the update with collaborators. Use a checked
`--force-with-lease` only for an explicitly authorised privacy cleanup; never overwrite
concurrent work. Collaborators must use a fresh clone after the rewrite, rather than merge
old history back in.

GitHub can retain unreachable commits and cached views after a rewrite. Full server-side
removal may require GitHub Support; other people's clones must be cleaned separately.
