---
title: "ResearcherConnect — Glossary"
subtitle: "Every term used across the code and the documents"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "October 2026"
---

Terms are alphabetical. Where a term names something in the code, the file is given.

**Alignment** — human–machine alignment, one of the two primary measures: agreements ÷
(agreements + disagreements) over the machine's recommendations, counting "worth
discussing" as neither. Agreeing with a *don't connect* counts as alignment too.

**Archive** — the destination of a reset. `data/archive/<timestamp>/` with a
`MANIFEST.json` (`archivedAt`, `scope`, `note`, `moved[]`, `runsArchived`, `complete`).
Nothing is ever deleted. `server/archive.js`.

**Assessor** — the LLM stage in Step 5 that writes a per-mechanism explanation of whether
tie-formation theory would have predicted the pair. It explains; it does not classify.
`server/agents/assessor.js`.

**Baseline** — Step 1: the four tie-formation mechanisms computed deterministically for a
pair, their composite (predictability), and a breakdown showing the arithmetic.
`server/baseline.js`.

**Borderline** — classification for a pair that is neither `latent`, `predicted` nor `none`.

**Breakdown** — the per-mechanism record (principle, inputs, weight, contribution, formula)
that makes every predictability number explainable. Shown in the *Pair baseline* panel and
stored in the run.

**Brief** (connection brief) — conversation mode's structured output: `viable`, `title`,
`fit_summary`, `contributions`, `joint_angle`, `first_step`, three 1–5 sub-scores, `verdict`.
A note to a busy researcher deciding whether to email a stranger. `server/agents/synthesizer.js`.

**Candidate** — an unconnected pair, as listed by `GET /api/candidates` in ascending
predictability.

**Chart room** — the visual identity: indigo ink on pale chart paper, a star atlas. Light
only. `public/css/styles.css`, `public/js/graph.js`.

**Classification** — `latent` / `borderline` / `predicted` / `none`, a pure function of
predictability and ECP using `THRESHOLDS`. `baseline.js#classify`.

**Claude Code CLI** (`claude-cli` provider) — a driver that shells out to `claude -p`,
running on a Claude Code subscription. Model aliases `opus`, `sonnet`, `haiku`.
`server/llm/claude-cli.js`.

**Composite** — the weighted sum of the four mechanism scores; the same thing as
predictability.

**Conversation mode** — the original Step 3: two persona agents alternate for `TURNS`
turns, a synthesizer writes a brief, ECP = `ecpFromBrief`. `server/agents/conversation.js`.

**Cumulative advantage** — mechanism 3: √(deg_a · deg_b) / (n − 1); the already
well-connected attract ties.

**Custom researchers** — `data/custom-researchers.json`: `{added[], removed[]}`;
researchers added through the UI and tombstones for removed ones.

**Decision** — the human's Step 4 verdict on a run: `accept` / `discuss` / `decline`, with
an optional note. Stored on the run.

**Demo provider** — a deterministic offline driver that templates every stage from profile
text. Labelled "demo-replay (no LLM)" everywhere. Used by the tests and for credential-free
demonstrations; must track every prompt and schema change. `server/llm/demo.js`.

**Divergence** — ECP − predictability; the latent signal, plotted in Findings.

**ECP** (expected collaboration potential) — the system's judgment of a pair on [0, 1].
Conversation mode: ((r−1)+(c−1)+(f−1))/12 from the brief's sub-scores, 0 if not viable
(`ecpFromBrief`). Judge mode: share of votes in favour (`ecpFromVotes`). Computed once,
server-side, stored on the run; the browser never recomputes it.

**Existing tie** — a collaboration edge in the seed graph (`collaborations[]` in
`server/data/researchers.json`). Pairs with an existing tie are not candidates.

**Findings** — the dashboard view: predictability × ECP scatter, classification counts,
alignment, run table with a *Mode* column.

**Guided** — the judge prompt variant that asks judges to weigh complementarity over
similarity. See *Variant*.

**Homophily** (status and value homophily) — mechanism 2: ½·(1 − |Δseniority|/3) +
½·Jaccard(method families).

**Judge mode** — Step 3 since 10 September 2026: one model is shown both profiles and the
trigger and asked "should they collaborate, 0 or 1?" with one sentence of reason; repeated
`repeats` times on each of the provider's `judgeModels`. ECP = share in favour.
`server/agents/judge.js`.

**Judgment** — one model's tally in a judge run: `{provider, model, votes: [{vote, reason, at}]}`.

**Latent** (latent collaboration opportunity) — the object of study: a pair with
predictability < 0.25 **and** ECP ≥ 0.5. Structure predicts nothing; the system sees
potential. Upper-left of the Findings scatter.

**Mechanism** — one of Dahlander & McFarland's four: organisational foci, status and value
homophily, cumulative advantage, triadic closure.

**Mind file / representation** — the profile an agent speaks from, in layers: L0 stable
identity (field, methods, interests, collaboration style) and L2 dynamic reflections (what
currently occupies the researcher). From SyncMinds v0.1.

**Mode** — `conversation` or `judge`, chosen per run in the dock, stored as `run.mode`.
Runs without the field predate modes and are conversation runs.

**None** — classification when ECP = 0: the system found no basis. An honest negative, and
a designed outcome.

**Organisational foci** — mechanism 1: shared institution 0.6, shared unit or centre 1.0.
Affiliations are `;`/`/`-separated lists, compared normalised.

**Override** — `data/profile-overrides.json` (gitignored): only fields a human changed from
the seed or added record. A no-op save writes nothing. Reads as "what did a human correct?".

**Pair** — two researcher ids; the unit of analysis.

**Persona card** — the deterministic composition of a profile into what the agent is told it
is. Shown for verification; stored in the run. `server/agents/persona.js`.

**Poor-fit case** — Lena Fischer, a synthetic marine geochemist. The manipulation check: the
system must say no to her. Tests assert it.

**Predictability** (structural predictability) — the composite of the four mechanisms on
[0, 1]. Deterministic; no LLM involved.

**Predicted** — classification when predictability ≥ 0.5: structure already explains the pair.

**Probe** — one run for one pair. The **probe queue** lists the twelve least predictable
unconnected pairs and states how many exist.

**Provenance** — the complete record of how a result was produced. Per run: one JSON file.
For the project itself: `docs/specs/`, `transcripts/`, git history, and the predecessor's
`docs/provenance/` folder.

**Provider** — an LLM driver: `demo`, `claude-cli`, `anthropic`. All expose
`complete({system, prompt, maxTokens, meta, model})` and `judgeModels`. Chosen per run.
`server/llm/provider.js`.

**Recognition, not invention** — the agents' mandate: judge whether two humans should meet
and say what each brings; never draft research questions.

**Reflections** — the L2 layer: short, researcher-authored notes on current thinking. What
makes a conversation specific. Also where collaborator names leak into judge prompts.

**Repeats** — how many times each judge model is asked the same question (`JUDGE_REPEATS`,
default 10, 1–50 per run).

**Reset** — Findings → *Start a fresh experiment*. Scope `findings` moves runs; scope `all`
also moves pool additions, overrides and custom triggers. Always an archive.

**Resume** — continuing a failed run from its last completed stage. Stages are idempotent;
judge runs recast only missing votes.

**Run** — one execution of the pipeline for one pair; one file in `data/runs/`.

**Scout** — the AI agent that drafts a profile from live web search with every claim cited.
Output is a draft until a human saves it; never sets `verified`. `server/agents/scout.js`.

**Seed pool** — `server/data/researchers.json`: ten fictional synthetic researchers
and seven fictional collaboration edges. Immutable at runtime.

**SSE** — server-sent events on `GET /api/events`; how the browser follows a run.

**Synthesizer** — the conversation-mode stage that turns a transcript into a brief.

**Synthetic persona** — a composite representing no real person (`synthetic: true`),
labelled in the UI. Shared fixtures must still meet the publishing checklist; a renamed
real profile is not a synthetic persona.

**Tally** — the live judge-mode view: dots per vote, per-model counts, running ECP, the
judges' reasons. `public/js/tally.js`.

**Theater** — the live conversation-mode view. `public/js/theater.js`.

**Thresholds** — `THRESHOLDS` in `baseline.js`: latent predictability < 0.25, ECP ≥ 0.5;
predicted ≥ 0.5. Nothing else may hard-code them.

**Tombstone** — a removal record in `custom-researchers.json#removed`; reversible; past runs
keep their records.

**Triadic closure** — mechanism 4: shared collaborators / min(deg_a, deg_b).

**Trigger** — the concrete opportunity a run is anchored to (call for papers, grant scheme,
project brief). Seeded with the Org Science call; snapshotted into every run.
`data/triggers.json`.

**Unguided** — the judge prompt variant with no steer. See *Variant*.

**Variant** — a named judge prompt in `JUDGE_PROMPTS` (`unguided`, `guided`). An
experimental factor: adding one is fine, editing one silently is not; the full text is
snapshotted into the run.

**Verified** — a profile flag that only the person it describes may set, after reviewing
their representation. Step 2 of the research design, performed in the tool.

**Weights** — `WEIGHTS` in `baseline.js`: foci 0.30, homophily 0.20, cumulative advantage
0.20, triadic closure 0.30. Stipulated, not fitted.
