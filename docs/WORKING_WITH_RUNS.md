---
title: "ResearcherConnect — Working With Run Records"
subtitle: "How to read, tabulate and cite the evidence files"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "October 2026"
---

Every run is one JSON file in `data/runs/`. Analysis for the paper needs nothing else: the
file holds the inputs, every model output, the scores, the classification and the human
decision. This page shows what is in one, how to tabulate many, and what may and may not be
compared. This repository ships two demo-mode examples on synthetic pairs in
`data/examples/` (the ones quoted below); live runs are never committed.

# 1. File names and lifecycle

```
run-2026-10-28T05-15-36-216Z-synthetic-aiko-tanaka+synthetic-priya-raman.json
    └── created (UTC) ──────────┘ └── pair, in speaking order ───────────────┘
```

`status` moves `running` → `awaiting-validation` (or `failed`); `stage` records the last
stage entered: `baseline`, `representation`, `conversation`/`synthesis` or `judgment`,
`comparison`, `validation`. A failed run keeps every completed artifact and can be resumed.

# 2. Fields

| Field | Both modes | Meaning |
|---|---|---|
| `id`, `pair`, `createdAt`, `updatedAt` | ✓ | identity and timing |
| `provider` | ✓ | `{name, model}` that produced the content, e.g. `{"name":"claude-cli","model":"opus (via Claude Code CLI)"}` or `demo-replay (no LLM)` |
| `mode` | ✓ | `conversation` or `judge`; **absent on runs before 10 Sept 2026, which are conversation runs** |
| `trigger` | ✓ | `{id, title, text}` snapshotted at run time, or `null` for open exploration |
| `baseline` | ✓ | `scores{}` per mechanism, `composite` (= predictability), `breakdown[]`, `formula`, `existingTie`, `sharedNeighbours[]` |
| `personas` | ✓ | the persona card each side spoke from (or was judged from), keyed by id |
| `ecp` | ✓ | the stored ECP; **never recompute it in analysis**, read it |
| `classification` | ✓ | `latent` / `borderline` / `predicted` / `none` |
| `assessment` | ✓ | `{mechanisms[{mechanism, score, explanation}], summary}` — the assessor's prose |
| `decision` | ✓ | `{decision: accept\|discuss\|decline, note, decidedAt}` or `null` |
| `log` | ✓ | `[{at, msg}]` stage transitions, turns or votes, resumes |
| `error` | ✓ | failure message or `null` |
| `transcript` | conversation | `[{index, speakerId, speakerName, text, at}]`; empty in judge mode |
| `opportunity` | conversation | the brief (§4); `null` in judge mode |
| `judge` | judge | `{models[], repeats, variant, prompt: {system, user}}` — the exact question asked |
| `judgments` | judge | `[{provider, model, votes: [{vote: 0\|1, reason, at}]}]`, one entry per model, pre-seeded so partial files are well-formed |

# 3. An annotated judge run (demo provider, synthetic pair)

Abbreviated from a real file. Demo output is templated, so the reasons repeat; a live run
has a different sentence per vote.

```json
{
  "id": "run-2026-10-28T05-15-36-216Z-synthetic-aiko-tanaka+synthetic-priya-raman",
  "pair": ["synthetic-aiko-tanaka", "synthetic-priya-raman"],
  "provider": { "name": "demo", "model": "demo-replay (no LLM)" },
  "status": "awaiting-validation",
  "stage": "validation",
  "mode": "judge",
  "trigger": { "id": "orgsci-call-2026", "title": "Org Science special issue: …", "text": "…" },
  "baseline": {
    "scores": { "organisationalFoci": 0, "homophily": 0.333, "cumulativeAdvantage": 0.2, "triadicClosure": 0 },
    "composite": 0.107,
    "breakdown": [
      { "mechanism": "organisationalFoci", "score": 0, "weight": 0.3,
        "inputs": "no shared institution (UK university … vs Mid-sized US research university …) → 0",
        "contribution": 0 },
      "…three more…"
    ],
    "formula": "composite = 0.30×0.00 + 0.20×0.33 + 0.20×0.20 + 0.30×0.00 = 0.11"
  },
  "judge": {
    "models": ["demo-judge-a", "demo-judge-b", "demo-judge-c"],
    "repeats": 10,
    "variant": "unguided",
    "prompt": { "system": "You are asked whether two researchers should collaborate…", "user": "RESEARCHER A\nAiko Tanaka — …" }
  },
  "judgments": [
    { "provider": "demo", "model": "demo-judge-a",
      "votes": [ { "vote": 0, "reason": "Organization studies … and Computational social science share too little …", "at": "…" }, "…" ] },
    "…two more models…"
  ],
  "ecp": 0.1,
  "classification": "borderline",
  "assessment": { "mechanisms": ["…"], "summary": "None of the four classical mechanisms plausibly produces this tie — …" },
  "decision": null,
  "log": [
    { "at": "…", "msg": "Run started with provider demo (demo-replay (no LLM)), judge mode: 3 model(s) × 10 votes, prompt \"unguided\" — trigger: …" },
    { "at": "…", "msg": "Vote 1/30 — demo-judge-a: no" },
    "…"
  ]
}
```

Reading it: predictability 0.107 (theory predicts nothing), ECP 0.10 (3 of 30 votes yes),
so `borderline`, not `latent`: the ECP threshold of 0.5 was not met. Had 15 or more votes
been yes, the same pair would be `latent`.

# 4. The conversation-mode brief

```json
{
  "viable": false,
  "title": "No basis to connect for \"Org Science special issue …\": Sofia × David",
  "fit_summary": "The agents found no genuine basis for a connection …",
  "contributions": { "synthetic-sofia-marchetti": "n/a", "synthetic-david-okonkwo": "n/a" },
  "joint_angle": null,
  "first_step": null,
  "relevance": 1, "complementarity": 1, "feasibility": 1,
  "verdict": "The agents recommend against connecting — a negative result the system is designed to be capable of producing."
}
```

`viable: false` forces ECP 0 and classification `none`. For a viable brief, ECP =
((relevance−1)+(complementarity−1)+(feasibility−1))/12.

# 5. Tabulating many runs

No analysis tooling ships; the files are small enough for a one-off script. This prints one
line per run and works on any Node 20 install:

```bash
node -e '
const fs=require("fs"),p="data/runs/";
for (const f of fs.readdirSync(p).filter(x=>x.endsWith(".json")).sort()) {
  const r=JSON.parse(fs.readFileSync(p+f));
  const votes=(r.judgments||[]).flatMap(j=>j.votes.map(v=>v.vote));
  console.log([
    r.createdAt.slice(0,10), r.mode||"conversation", r.provider.name,
    r.judge?.variant||"", r.pair.join(" × "),
    "pred="+r.baseline.composite, "ecp="+r.ecp, r.classification,
    votes.length? votes.reduce((a,b)=>a+b,0)+"/"+votes.length : "",
    r.decision?.decision||"-"
  ].join("\t"));
}'
```

For a spreadsheet, change `join("\t")` to `join(",")` and redirect to a `.csv`. Python
users: `json.load` each file; the structure above is flat enough that no library is needed.

Archived conditions live under `data/archive/<timestamp>/runs/` with the same format; point
the script there to analyse an earlier condition. `tools/backfill-ecp.mjs` exists for run
files that predate the `ecp` field (July 2026); current files never need it.

# 6. What may be compared

- **Across runs of the same mode, prompt wording, provider and model.** The judge snapshots
  its full prompt into `run.judge.prompt`; diff two runs' prompts before pooling them.
  Conversation runs do *not* record their prompt text; use the git history of
  `server/agents/*.js` against `createdAt`. Runs either side of the September 2026 prose
  rewrite are not comparable.
- **Predictability across anything.** It is deterministic and depends only on the pool
  composition at run time (`sharedNeighbours`, degrees). Adding researchers changes *n* and
  so changes cumulative advantage for everyone; note the pool size when comparing.
- **Not across modes.** Judge ECP (a vote share) and conversation ECP (a rescaled sum of
  three ratings) are different instruments that share a scale. Report them as separate series.
- **Not demo with live.** Demo runs are templated; the interface and the `provider` field
  mark them. Filter them out of any table that makes a claim.

# 7. Citing a run

Cite the file name; it is unique, dated and self-describing. Quote `provider.model`,
`mode`, `judge.variant` (judge mode) and the trigger title alongside any number from it.
The repository must contain only synthetic and demo runs (see the publishing checklist), so
a cited live run on real people will be in the authors' private archive, not in the
published repository; say so in the paper.
