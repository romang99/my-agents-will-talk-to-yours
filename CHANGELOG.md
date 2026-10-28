# Changelog

Dates are when the work landed on the development machine, not release dates. Nothing has
been tagged. For the reasoning behind each change see `docs/DECISIONS.md`.

## 0.3.0 — August to October 2026 (unreleased)

**Judge mode** (10 September 2026). A second way to produce ECP: one model, both profiles
and the trigger, "should they collaborate, 0 or 1?" with one sentence of reason; repeated
`JUDGE_REPEATS` times (default 10) on each of the provider's judge models (CLI: `opus`,
`sonnet`, `haiku`), four calls in flight; ECP = share of votes in favour. Two named prompt
variants (`unguided`, `guided`) as experimental factors, full prompt snapshotted into the
run. Live tally view replaces the theater in this mode. Classification, chart, validation
unchanged. Run records gain `mode`, `judge`, `judgments`. Resume recasts only missing votes.
`server/agents/judge.js`, `public/js/tally.js`, tests.

**Plain-prose prompts** (September 2026). Persona, conversation and synthesizer prompts
rewritten so agents write like researchers: short sentences, real names of things, a banned
list of agent-speak, a brief addressed to a busy human who has not read the transcript.

**Reset by archiving** (3 August 2026). Findings → *Start a fresh experiment*, scopes
`findings` and `all`; moves to `data/archive/<timestamp>/` with a `MANIFEST.json`; atomic
directory claim; manifest written on partial failure. Nothing deleted.

**Robustness pass** (September 2026). Stale trigger selection reconciled; reset state
adopted identically from the UI action and the SSE event; reset scope validated; decision
errors surfaced as toasts; mode-aware labels and toasts; `graph.js` reads the palette from
CSS tokens; PDF build respects document front-matter titles.

**Documentation** (August–October 2026). Prototype Guide, Technical Specification, Research
Protocol, Data & Ethics Statement, revised Technical Appendix, design record for the
10 September session, PDF build (`npm run docs`). October: Start Here, History and Decision
Log, Status, Glossary, Working With Run Records, Publishing Checklist, this changelog,
CONTRIBUTING.

**Measurement evidence.** Historical live development exposed test–retest variation
and unanimous responses in unguided judge mode. These observations motivate repeat
measurements and discriminant-validity checks; individual live-run results remain in the
private research archive.

## 0.2.0 — 24 to 27 July 2026

Rebuilt from SyncMinds as a local-first Node application: star-chart interface, pair as the
unit of analysis, deterministic Dahlander & McFarland baseline with per-mechanism
explainability, ECP computed in code from the synthesizer's sub-scores, classification by
named thresholds, probe queue ordered by ascending predictability, Findings dashboard,
human validation and alignment. Opportunity triggers (snapshotted) and *recognition, not
invention* after working sessions 1–2 with Nadine. Per-run provider choice (`demo`,
`claude-cli`, `anthropic`). Researcher add/edit/remove; AI scout with cited sources;
multi-affiliation foci; representation verification. Resumable runs; CLI retry. Code-review
pass establishing the invariants (one ECP implementation, named thresholds, override
deltas, specificity-ordered routes, one palette, no silent truncation). Screening-loop
design written, not implemented.

## 0.1 — SyncMinds, June–July 2026 (separate project)

Python/Streamlit prototype in `OrgSci/syncminds/` (not in this repository): four rounds
around a call-for-papers trigger, persona mind files, honest-failure test case, `claude -p`
provider, audit trail. The origin documents (June meeting transcript, the call, the July
emails, the project plan) are in its `docs/provenance/`.
