---
title: "ResearcherConnect — Technical Specification"
subtitle: "Architecture, measures, data model and interfaces"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "July 2026"
---

# 1. Purpose and scope

This specification describes the implemented ResearcherConnect v0.3 pair-assessment instrument. The current submission, *WELCOME TO THE JUNGLE: AGENT ARENAS, UNLIKELY COLLABORATIONS, AND THE SEARCH FOR SCIENTIFIC IDEAS THAT MATTER*, proposes a further agent-arena stage; those mechanisms are not present in this release. The [technical appendix](TECHNICAL_APPENDIX.md) separates implementation, development observations and planned evaluation.

ResearcherConnect operationalises a five-step research design for identifying **latent scientific collaboration opportunities** — pairings not explained by established mechanisms of tie formation. This document specifies how it works: the measures, the agentic pipeline, the data model, the interfaces, and the invariants that keep its behaviour traceable.

It is a research instrument, not a product. Every design choice below favours *auditability* over convenience: a reviewer must be able to answer "why did the system say that?" by reading files, not by re-running code.

**Version:** prototype v0.3 (October 2026; two run modes since 10 September 2026), successor to SyncMinds v0.1 (Python/Streamlit).

# 2. System overview

A local-first web application. A plain Node HTTP server runs the agentic pipeline and serves a vanilla ES-module frontend. There is no build step and no required dependency; `@anthropic-ai/sdk` is optional and used only in API-key mode.

```
browser (vanilla ES modules)          node:http server
┌────────────────────────┐           ┌──────────────────────────────┐
│ star chart (canvas)    │  JSON API │ router → API handlers        │
│ probe queue            │◀─────────▶│ pipeline (5 steps)           │
│ conversation theater   │           │ baseline.js  (deterministic) │
│ connection briefs      │◀── SSE ───│ agents/*     (LLM calls)     │
│ findings dashboard     │  events   │ llm/*        (3 drivers)     │
└────────────────────────┘           └──────────────┬───────────────┘
                                                    │
                                     data/runs/*.json — provenance
```

**Module map**

| Module | Responsibility |
|---|---|
| `server/index.js` | HTTP server, API handlers, SSE bus, state composition |
| `server/router.js` | Route matching; literal path segments beat `:params` |
| `server/pipeline.js` | Orchestrates the five steps; stages are idempotent (resumable) |
| `server/baseline.js` | Tie-formation predictors, ECP, thresholds, classification |
| `server/dataset.js` | Composes the pool: seed + additions − removals + edits |
| `server/store.js` | Run persistence (one JSON file per run) |
| `server/archive.js` | Reset-by-archiving; never deletes |
| `server/agents/*` | persona, conversation, synthesizer, assessor, scout |
| `server/llm/*` | provider registry + three drivers |
| `public/js/*` | app (state/wiring), graph (canvas), ui (pure render), theater, rail, api |

# 3. Measures

## 3.1 Structural predictability (Step 1)

The baseline: how strongly the four mechanisms of Dahlander & McFarland (2013) predict a tie between two researchers. Computed deterministically from the collaboration graph and profile fields; **no LLM is involved**.

| Mechanism | Operationalisation | Range |
|---|---|---|
| Organisational foci | any shared institution → 0.6; any shared unit/centre → 1.0 | [0,1] |
| Status & value homophily | ½·(1 − \|Δseniority\|/3) + ½·(shared method families / union) | [0,1] |
| Cumulative advantage | √(deg_a · deg_b) / (n − 1) | [0,1] |
| Triadic closure | shared collaborators / min(deg_a, deg_b) | [0,1] |

$$\text{predictability} = 0.30\,f + 0.20\,h + 0.20\,c + 0.30\,t$$

Weights are the exported constant `WEIGHTS`. Affiliation fields are treated as `;`- or `/`-separated **lists** and compared normalised (case-insensitive, parentheticals stripped), so a researcher holding a school *and* a centre appointment matches on either — multiple affiliations are the norm, not an anomaly.

Every computation returns a `breakdown`: per mechanism, the plain-language principle, the actual inputs, the weight arithmetic, and the contribution — plus the full composite formula as a string. This is displayed when a pair is selected and preserved in the run record.

## 3.2 Expected collaboration potential — ECP (Step 3b)

The system's own judgment of a pairing, derived **in code** from the synthesizer's three 1–5 sub-scores:

$$\text{ECP} = \frac{(r-1) + (c-1) + (f-1)}{12} \in [0,1]$$

where *r* = relevance, *c* = complementarity, *f* = feasibility. A non-viable outcome is 0 by definition. `ecpFromBrief` is the only implementation for conversation mode. In judge mode, `ecpFromVotes` — the share of 0/1 votes in favour across every repeat of every model — is the only implementation. Either way the browser displays the stored value and never recomputes it.

## 3.3 Classification (Step 5)

A pure function of the two numbers, using the named constant `THRESHOLDS`:

| Condition | Class |
|---|---|
| ECP = 0 | `none` — the agents found no basis (an honest negative) |
| predictability ≥ 0.50 | `predicted` — structure already explains the pair |
| predictability < 0.25 **and** ECP ≥ 0.50 | `latent` — the object of study |
| otherwise | `borderline` |

The LLM explains the mechanisms; **code decides the class**. The divergence ECP − predictability is the latent signal and the primary figure in Findings.

## 3.4 Human–machine alignment (Step 4)

Per run, the human records *agree* / *worth discussing* / *disagree* against the machine's recommendation. Alignment = agreements ÷ (agreements + disagreements), excluding "worth discussing". The buttons are phrased relative to the recommendation, so "agree" is unambiguous whether the machine said connect or don't.

# 4. The agentic pipeline

`POST /api/runs` starts an asynchronous run; the browser follows it over SSE. Step 3 has two **modes**, chosen per run in the dock. They differ only in how ECP is produced; everything downstream (classification, chart, validation) is shared.

| Step | Stage | LLM calls | Output |
|---|---|---|---|
| 1 | `baseline` | 0 | predictability + breakdown |
| 2 | `representation` | 0 | persona cards and system prompts, composed deterministically from profile data |
| 3 | `conversation` *(conversation mode)* | 6 | alternating agent turns, streamed |
| 3b | `synthesis` *(conversation mode)* | 1 | connection brief (JSON) → ECP = `ecpFromBrief` |
| 3 | `judgment` *(judge mode)* | models × repeats | one 0/1 vote + one-sentence reason per call → ECP = `ecpFromVotes` |
| 5 | `comparison` | 1 | per-mechanism explanations → classification |
| 4 | `validation` | 0 | human decision, recorded asynchronously |

**Conversation mode: eight LLM calls per run.** Personas are *composed*, not generated: model budget is spent where interaction matters.

**Judge mode: (models × repeats) + 1 short calls.** One model is shown both profiles and the trigger and asked *should they collaborate — 0 or 1?* with one plain sentence of reason. Because the answer is not deterministic, the question is put `repeats` times (default 10, `JUDGE_REPEATS`) to each of the provider's `judgeModels` (CLI: `opus`, `sonnet`, `haiku`), four calls in flight at a time. ECP is the share of votes in favour. Two **prompt variants** are named in `agents/judge.js` and selectable per run — `unguided` (no steer) and `guided` (weigh complementarity over similarity) — because the wording is an experimental factor; the full prompt text is snapshotted into the run. Rationale and open questions: `docs/specs/2026-09-10-search-centric-redesign.md`, Part 2.

**Conversation protocol.** Six turns by default (`TURNS` env var), alternating. Each turn is one call carrying the speaker's persona system prompt, the transcript so far, the trigger text, and phase guidance: *relevance* (is this opportunity even ours?), *assessment* (is the complementarity real and concrete?), *judgment* (would the researcher actually commit?). The final turn must give a plain connect / don't-connect recommendation.

**Recognition, not invention in the current conversation mode.** Agents are instructed not to draft research questions or study designs. The deliverable is a judgment about whether two humans should meet; the creative work belongs to the humans afterwards. This was a deliberate design decision (working session, 24 July 2026) after early runs produced plausible but inauthentic research agendas.

**Honest failure is designed in.** Persona rules state that a well-reasoned "no basis" is a successful outcome, and the synthesizer is instructed never to inflate a weak conversation. The seed pool contains a deliberate poor-fit researcher (a marine geochemist) to exercise this path; the test suite asserts that the pairing fails honestly.

**Resumability.** Stages are idempotent over the run record: anything already present is kept. A failed run resumes from its last completed artifact, so a crash at step eight never costs the six conversation turns already paid for — and a judge run that dies mid-tally casts only the missing votes.

# 5. Data model

## 5.1 Run record — `data/runs/<id>.json`

The provenance chain. One file per run, human-readable, grep-able, citable.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | `run-<ISO timestamp>-<idA>+<idB>` |
| `pair` | [string, string] | researcher ids, in the order the agents spoke |
| `createdAt`, `updatedAt` | ISO 8601 | |
| `provider` | `{name, model}` | which driver and model produced the content |
| `status` | enum | `running` \| `awaiting-validation` \| `failed` |
| `stage` | enum | last stage entered (`baseline` … `validation`) |
| `baseline` | object | scores, composite, `breakdown[]`, `formula`, `existingTie`, `sharedNeighbours` |
| `trigger` | object \| null | `{id, title, text}` — **snapshotted**, so later edits cannot rewrite history |
| `mode` | enum | `conversation` \| `judge` (absent on runs predating modes = conversation) |
| `judge` | object \| null | judge mode only: `{models[], repeats, variant, prompt: {system, user}}` — the exact question asked |
| `judgments` | array | judge mode only: `{provider, model, votes: [{vote: 0\|1, reason, at}]}` per model |
| `personas` | object | the persona card each agent spoke from, keyed by researcher id |
| `transcript` | array | `{index, speakerId, speakerName, text, at}` per turn |
| `opportunity` | object \| null | the connection brief (§5.2) |
| `ecp` | number \| null | `ecpFromBrief(opportunity)` or `ecpFromVotes(judgments)` by mode — one function each, stored once |
| `assessment` | object | `{mechanisms[], summary}` — the LLM's tie-formation reading |
| `classification` | enum | `latent` \| `borderline` \| `predicted` \| `none` |
| `decision` | object \| null | `{decision, note, decidedAt}` |
| `error` | string \| null | failure message, if any |
| `log` | array | `{at, msg}` — stage transitions, turns, classification, resumes |

## 5.2 Connection brief

`{viable, title, fit_summary, contributions{idA,idB}, joint_angle, first_step, relevance, complementarity, feasibility, verdict}`.

`joint_angle` is a pointer, not a research question; `first_step` is a suggested first contact between the humans.

## 5.3 Researcher profile

`{id, name, synthetic, verified, title, institution, unit, country, seniority (1–4), field, methods[], methodFamilies[], interests[], reflections[], collaborationStyle, orcid?, provenance?}`.

`reflections` is the "private layer" — what currently occupies the researcher — and is what makes conversations specific rather than generic. `provenance` records an AI-drafted profile's sources and caveats. `verified` is true only when the researcher has reviewed their own representation.

## 5.4 Pool composition

The seed pool (`server/data/researchers.json`) is **immutable at runtime**. The live pool is composed as:

```
seed + custom.added − custom.removed (tombstones) + profile-overrides (field deltas)
```

`data/profile-overrides.json` stores only fields that genuinely differ from the underlying record — a no-op save writes nothing, and reverting a field removes its entry — so the file reads as a record of *human corrections*, which is evidence for Step 2.

## 5.5 Reset and archives

Reset moves state to `data/archive/<timestamp>/` with a `MANIFEST.json` (`archivedAt`, `scope`, `note`, `moved[]`, `runsArchived`). Scope `findings` moves runs only; `all` also moves pool additions, profile edits and custom triggers. **Nothing is ever deleted**, so an earlier experimental condition remains readable and restorable.

# 6. LLM providers

All usable drivers are detected at boot and offered per run. `PROVIDER=…` sets only the default.

| Driver | Mechanism | Notes |
|---|---|---|
| `anthropic` | `@anthropic-ai/sdk`, `claude-opus-4-8`, streaming, adaptive thinking | requires `ANTHROPIC_API_KEY` |
| `claude-cli` | spawns `claude -p --output-format json` | runs on a Claude Code subscription; no key |
| `demo` | deterministic templating from profile data | offline, free; **labelled as simulated** in UI and provenance |

All expose `complete({system, prompt, maxTokens, meta})`. Every CLI call retries once after 5 s to absorb transient failures. The profile scout additionally enables `WebSearch`/`WebFetch` with a longer turn budget.

**The demo driver is a first-class citizen**: it keeps the full pipeline testable offline and the app demonstrable without credentials, and it must be updated in lockstep with any prompt or schema change.

# 7. Interfaces

## 7.1 HTTP API

| Endpoint | Purpose |
|---|---|
| `GET /api/state` | researchers, ties, triggers, runs, archives, providers |
| `GET /api/candidates` | unconnected pairs, ascending predictability |
| `GET /api/baseline/:a/:b` | full explainability breakdown for a pair |
| `POST /api/runs` | start a run `{pair, provider?, triggerId?}` |
| `GET /api/runs/:id` | full run record |
| `POST /api/runs/:id/resume` | resume a failed run from its last completed stage |
| `POST /api/runs/:id/decision` | record `accept` \| `discuss` \| `decline` |
| `POST /api/researchers` | add a researcher |
| `POST /api/researchers/:id` | edit a representation (whitelisted fields) |
| `DELETE /api/researchers/:id` | remove (tombstone) a researcher |
| `POST /api/researchers/scout` | AI-draft a profile from the web |
| `POST /api/triggers` | save an opportunity trigger |
| `POST /api/reset` | archive current state `{scope: findings\|all, note?}` |
| `GET /api/events` | SSE stream |

Routing is **specificity-ordered**: a literal segment beats a `:param`, so reordering the table cannot change which handler runs.

## 7.2 SSE events

`run.started`, `run.stage`, `run.personas`, `run.turn`, `run.opportunity`, `run.completed`, `run.failed`, `run.resumed`, `run.decision`, `researcher.updated`, `dataset.changed`, `trigger.added`, `state.reset`.

# 8. Invariants

These properties are what make the system's behaviour traceable. They are recorded in `CLAUDE.md` so they survive future edits.

1. **One implementation per measure.** ECP is computed only server-side and stored; the UI displays the stored value. What you see equals what is in the provenance file.
2. **Study parameters are named.** `WEIGHTS` and `THRESHOLDS` in one module; nothing else may hard-code them, including explanation text.
3. **Explanations read the computation.** Score and explanation derive from the same helper, so they cannot drift (asserted by test).
4. **Classification is code, not prompt.**
5. **Overrides are deltas** — human corrections only.
6. **Routes are specificity-ordered.**
7. **One palette** — the canvas reads the CVD-validated CSS tokens rather than repeating hex values.
8. **Never truncate silently** — a view showing a subset must say what it is not showing.
9. **Reset archives, never deletes.**
10. **Triggers are snapshotted into runs** — editing a trigger cannot rewrite past evidence.

# 9. Verification

`npm test` — `node --test`, fully offline via the demo driver, no network required. Coverage: the four mechanisms and their edge cases (isolates, blank affiliations, multi-affiliation matching, formatting differences); ECP; classification boundaries against `THRESHOLDS`; explanation/score consistency; candidate ranking; pool composition (additions, tombstones, overrides); the full pipeline; the honest-failure path; resumability after a simulated crash; trigger anchoring and snapshotting; the scout parser; router specificity; and archive/reset semantics.

# 10. Known limitations

1. **Representation validity.** Agents are only as good as their mind files. Verification mitigates but does not eliminate misrepresentation; profiles of real people are marked unverified until reviewed by the person.
2. **Sycophancy.** LLM agents drift toward agreement. Countermeasures: explicit ground rules, a commitment phase demanding honest feasibility, a synthesizer told to reject inflated opportunities, and a deliberate poor-fit case as a manipulation check.
3. **Small-graph baseline.** With a seed pool of ten to twelve, cumulative advantage and triadic closure have limited variance. Institutional-scale data (QUT Pure) is the intended remedy.
4. **ECP is a model judgment**, not ground truth. Human validation is the corrective, and disagreement is itself data.
5. **Weights and thresholds are stipulated**, not fitted. They must be fixed before a study and reported.
6. **Scale.** Validation does not scale beyond a handful of pairs; the screening-loop design (`docs/specs/`) addresses this and is not yet implemented.

# 11. Provenance of the prototype itself

The project documents its own genesis: the originating emails, the June 2026 meeting transcript, and the project plan are preserved in `OrgSci/syncminds/docs/provenance/`, and the working-session transcripts that redirected the design are in `transcripts/`. Design decisions and their rationale are recorded in `docs/specs/` and in the git history.

# References

Dahlander, L., & McFarland, D. A. (2013). Ties that last: tie formation and persistence in research collaborations over time. *Administrative Science Quarterly*, 58(1), 69–110.

Guimerà, R., Uzzi, B., Spiro, J., & Amaral, L. A. N. (2005). Team assembly mechanisms determine collaboration network structure and team performance. *Science*, 308, 697–702.

Jones, B. F., Wuchty, S., & Uzzi, B. (2008). Multi-university research teams: shifting impact, geography, and stratification in science. *Science*, 322, 1259–1262.
