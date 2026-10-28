# ResearcherConnect — Architecture

Local-first web app: a plain-Node backend running the agentic pipeline, a vanilla ES-module frontend, no build step, no framework, one optional dependency.

```
ResearcherConnect/
├── server/
│   ├── index.js               # node:http server — static files, JSON API, SSE bus
│   ├── router.js              # route matcher; literal segments beat :params
│   ├── pipeline.js            # the agentic run: orchestrates the paper's 5 steps
│   ├── baseline.js            # Step 1 + 5: predictors, ECP, THRESHOLDS, classification (pure, tested)
│   ├── dataset.js             # composes the pool: seed + additions − removals + edits
│   ├── store.js               # run persistence → data/runs/*.json (the provenance chain)
│   ├── archive.js             # reset = archive to data/archive/<timestamp>/; never deletes
│   ├── util.js                # JSON extraction from LLM output
│   ├── agents/
│   │   ├── persona.js         # Step 2: persona cards + agent system prompts
│   │   ├── conversation.js    # Step 3: alternating agent turns with phase guidance
│   │   ├── synthesizer.js     # Step 3→4: transcript → structured opportunity brief
│   │   ├── judge.js           # Step 3, judge mode: k × models 0/1 votes → ECP (prompt variants named here)
│   │   ├── assessor.js        # Step 5: mechanism-by-mechanism baseline comparison
│   │   └── scout.js           # AI-drafted profiles from the web (human reviews before saving)
│   ├── llm/
│   │   ├── provider.js        # provider abstraction + auto-detection
│   │   ├── claude-cli.js      # `claude -p` driver (local Claude Code subscription)
│   │   ├── anthropic-sdk.js   # official SDK driver (claude-opus-4-8, streaming)
│   │   └── demo.js            # deterministic offline driver (demos + tests)
│   └── data/researchers.json  # seed pool: 6 SyncMinds personas + 4 additions, existing ties
├── public/                    # vanilla ES modules, served by the same process
│   ├── index.html
│   ├── css/styles.css         # "chart room" token system (ink on pale chart paper)
│   └── js/
│       ├── app.js             # state, SSE wiring, view switching
│       ├── graph.js           # custom canvas force layout — the star chart (no deps)
│       ├── theater.js         # streaming conversation view
│       ├── tally.js           # live vote tally (judge-mode counterpart of theater.js)
│       ├── rail.js            # 5-step pipeline rail
│       ├── ui.js              # probe queue, cards, briefs, dashboard (pure render fns)
│       └── api.js             # fetch + EventSource client
├── tools/
│   ├── backfill-ecp.mjs       # one-time migration: ECP into pre-ECP run records
│   └── build-docs.mjs         # docs/*.md → docs/pdf/ (pandoc → headless Chrome)
├── test/                      # node --test; runs fully offline via the demo provider
├── data/                      # runtime state (README.md inside); live runs on real people are never committed
│   ├── runs/                  # provenance: one JSON per run (keep these — they're the paper's evidence)
│   └── archive/<timestamp>/   # past experiments, with a MANIFEST.json (reset archives, never deletes)
├── transcripts/               # working-session transcripts (primary sources; README.md inside)
├── CONTRIBUTING.md            # conventions, invariants, how to make common changes
├── CHANGELOG.md               # what landed when
├── CLAUDE.md                  # the brief an AI coding assistant works from
└── docs/
    ├── README.md              # index of the documentation set
    ├── ONBOARDING.md          # start here: context, reading order, first hour, budget, FAQ
    ├── STATUS.md              # dated snapshot: what works, what live runs showed, open decisions
    ├── DECISIONS.md           # timeline and decision log (the why)
    ├── GLOSSARY.md            # every term
    ├── PROTOTYPE_GUIDE.md     # how to run and read the tool
    ├── WORKING_WITH_RUNS.md   # run-record format, tabulating, what may be compared
    ├── TECHNICAL_SPECIFICATION.md  # measures, data model, API, invariants
    ├── RESEARCH_PROTOCOL.md   # study design, conditions, open decisions
    ├── DATA_ETHICS.md         # what's held about real people, on what terms
    ├── TECHNICAL_APPENDIX.md  # Org Science submission appendix draft, with a source map
    ├── PUBLISHING_CHECKLIST.md # before the repository goes anywhere
    └── specs/…                # design records, kept as written
```

## The agentic pipeline

`POST /api/runs {pair}` starts an async run; the browser follows it over `GET /api/events` (SSE).

```
        deterministic                         LLM calls                        deterministic
  ┌──────────────┐   ┌────────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────────┐
  │ 1 BASELINE   │ → │ 2 REPRESENTA-  │ → │ 3 CONVERSA-  │ → │ 3b SYNTHESIS│ → │ 5 COMPARISON │
  │ 4 predictors │   │   TION persona │   │   TION 6     │   │  opportunity│   │ classify +   │
  │ + composite  │   │   cards/prompts│   │   turns (SSE)│   │  brief JSON │   │ LLM mechanism│
  └──────────────┘   └────────────────┘   └──────────────┘   └─────────────┘   │ explanations │
                                                                               └──────┬───────┘
                                                              ┌────────────────────────┘
                                                              ▼
                                                     4 VALIDATION (human, async)
                                                     accept / discuss / decline
```

Design decisions worth knowing:

- **Recognition, not invention.** The agents' job is to recognise whether a genuine collaboration opportunity exists — for a concrete **trigger** (a call for papers, project brief, or idea, selected per run and snapshotted into provenance) — and to recommend whether the humans should connect. They are explicitly instructed not to draft research questions or study designs; that creative work belongs to the humans after they meet. The synthesis output is a *connection brief* (fit, contributions, first contact), not a research proposal. Decided in the 2026-07-24 working session with Nadine (transcripts/).
- **The LLM explains; code decides.** The synthesizer's 1-5 sub-scores are reduced in code to **ECP** (expected collaboration potential, 0-1; 0 when non-viable) — `baseline.js#ecpFromBrief`. Classification is then a pure function of the two numbers (`classify`): ECP 0 → `none`; predictability ≥ 0.5 → `predicted`; predictability < 0.25 AND ECP ≥ 0.5 → `latent`; else `borderline`. The divergence ECP − predictability is the latent signal, plotted in Findings. Every predictability number is fully explainable: `pairBaseline` returns a per-mechanism breakdown (inputs, weights, contributions, formula) shown when any pair is selected and preserved in run provenance.
- **Two ways to produce ECP, one way to classify.** Per run the dock chooses *conversation* mode (agents talk, synthesizer writes a brief, `ecpFromBrief`) or *judge* mode (one model asked "should they collaborate — 0 or 1?" k times across several models, `ecpFromVotes` = share in favour). `classify()`, the chart and validation are identical downstream. Judge mode came out of the 10 September 2026 session, after agent conversations proved hard to keep grounded (agent-speak; a hallucinated paper used to justify a pairing); the design record is `docs/specs/2026-09-10-search-centric-redesign.md`. Judge prompt wording is an experimental factor: variants are named (`unguided`, `guided`), selectable per run, and snapshotted into provenance.
- **Personas are composed, not generated.** Step 2 composes the layered profile data (from SyncMinds mind files) into the persona card and system prompt deterministically. LLM budget is spent where interaction matters: conversation turns, synthesis, assessment. A run costs 6 + 1 + 1 = 8 LLM calls.
- **Honest failure is a designed outcome.** The persona ground rules instruct agents that "a well-reasoned *no basis for collaboration* is a successful outcome," and the synthesizer is told never to inflate weak conversations. The seed pool includes a deliberate poor-fit researcher to exercise this path; the test suite asserts it.
- **The demo provider is a first-class citizen.** It generates plausible, profile-specific content for every stage using a lexical-affinity heuristic — so the full UI is demonstrable with zero credentials, and the pipeline is unit-testable offline. Its outputs are labelled `demo-replay (no LLM)` in the provenance and UI.
- **Provenance is a file.** One JSON per run with everything: prompts implied by persona data, all turns, scores, provider identity, log, decision. Grep-able, diff-able, citable in the paper.

## Baseline metrics (Step 1)

From Dahlander & McFarland (2013), computed over the seed graph:

| Mechanism | Operationalisation |
|---|---|
| Organisational foci | any shared institution (0.6) → any shared unit/centre (1.0); affiliation fields are `;`/`/`-separated lists, compared normalised, so multiple affiliations all count |
| Status & value homophily | 0.5 × seniority proximity + 0.5 × method-family overlap |
| Cumulative advantage | √(deg_a × deg_b) / (n−1) |
| Triadic closure | shared neighbours / min degree |

Composite = 0.3·foci + 0.2·homophily + 0.2·advantage + 0.3·closure (`WEIGHTS`). The probe queue ranks unconnected pairs ascending — probing where the baseline predicts *least* is where a latent discovery is most informative.

## Frontend

Custom canvas force simulation (~200 lines): O(n²) repulsion (fine at this scale), springs on existing ties, gentle centering, drag support. Rendering leans into the engraved star-atlas identity — indigo ink on pale chart paper: planisphere grid, plate frame with corner ticks, diffraction-spike star glyphs, italic serif labels, chart stamps, and classification-coloured dashed constellation lines with a grow-in animation for new discoveries. `prefers-reduced-motion` disables twinkle, dash animation, and the typewriter effect.

The classification palette (`#1E9B7E` latent / `#A87F26` borderline / `#5E6FD0` predicted) was validated for CVD separation, lightness band, and contrast against the `#ECEFF5` chart-paper surface.

## Invariants that keep behaviour traceable

These are the properties that let you answer "why did it produce this number?" by reading:

- **One implementation per measure.** `ecpFromBrief` (server) computes ECP; the browser only ever displays the stored `run.ecp`. The number on screen is the number in the provenance file.
- **Study parameters are named.** `WEIGHTS` and `THRESHOLDS` in `baseline.js` — nothing else may hard-code 0.25/0.5, including the demo provider's explanation text.
- **Explanations read the computation.** `pairBaseline` derives each score and its explanation from one `*Detail` helper, so an explanation cannot drift from the score it explains (asserted by test).
- **Overrides are deltas.** `data/profile-overrides.json` records only fields that genuinely differ from the seed/added record — a no-op save writes nothing, and reverting a field removes its entry. The file reads as "what did a human correct?".
- **Routes are specificity-ordered**, so reordering the API table cannot change which handler runs.
- **One palette.** `graph.js` reads the CVD-validated CSS tokens at load rather than repeating hex values.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/state` | researchers, ties, runs, provider info |
| `GET /api/candidates` | unconnected pairs ranked by ascending predictability |
| `GET /api/baseline/:a/:b` | full explainability breakdown of a pair's predictability |
| `POST /api/triggers` | save an opportunity trigger (data/triggers.json; seeded with the Org Science call) |
| `POST /api/runs` | start a run for `{pair, provider?, triggerId?, mode?, judge?: {variant, repeats, models}}` — provider and mode chosen per run |
| `GET /api/runs/:id` | full run record |
| `POST /api/runs/:id/resume` | resume a failed run from its last completed stage (judge runs recast only missing votes) |
| `POST /api/runs/:id/decision` | record `accept` / `discuss` / `decline` (+ note) |
| `POST /api/researchers` | add a researcher (stored in `data/custom-researchers.json`; seed pool is never mutated) |
| `POST /api/researchers/scout` | AI-draft a profile from the live web (returned, not saved) |
| `DELETE /api/researchers/:id` | remove a researcher (custom ones are deleted; seed ones are tombstoned; runs are never deleted) |
| `POST /api/researchers/:id` | edit a representation (whitelisted fields), mark verified |
| `POST /api/reset` | archive current state `{scope: findings\|all, note?}` |
| `GET /api/events` | SSE: `run.started`, `run.stage`, `run.personas`, `run.turn`, `run.vote`, `run.judged`, `run.opportunity`, `run.completed`, `run.failed`, `run.resumed`, `run.decision`, `researcher.updated`, `dataset.changed`, `trigger.added`, `state.reset` |

## Relationship to SyncMinds v0.1

SyncMinds (`OrgSci/syncminds/`, Python/Streamlit, July 2026) proved the concept with a four-round pipeline (self-assessment → exploration → team assembly → pitch negotiation) around a call-for-papers trigger. ResearcherConnect narrows the unit of analysis to the **pair** and adds the **baseline comparison** — reflecting how the paper's framing evolved (Nadine's July email: benchmark LLM-suggested connections against the existing collaboration graph and established predictors of tie formation). The persona mind files, the honest-failure test case, the provider pattern (including the `claude -p` driver), and the audit-trail discipline all carry over from SyncMinds.
