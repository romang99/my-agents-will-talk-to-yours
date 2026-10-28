# Contributing to ResearcherConnect

This is a research instrument, not a product. The bar for a change is not "does it work"
but "can a reviewer still answer *why did it produce this number?* by reading files". The
rules below exist to keep that true. `CLAUDE.md` states the same rules in the form an
AI coding assistant reads; keep the two in step.

## Development loop

```bash
npm test            # node --test, offline, ~10 s; run before and after every change
npm run demo        # offline UI on http://localhost:4870
npm start           # live providers, chosen per run in the dock
npm run docs        # Markdown → PDF (pandoc + Chrome); optional
```

No build step, no linter, no formatter. Match the surrounding style: ES modules, two-space
indentation, single quotes, no semicolon games, short functions with a comment that says
*why*. No new runtime dependencies without a reason written in the commit message; the one
optional dependency is `@anthropic-ai/sdk`.

## Invariants (do not break these)

1. **Classification is code, not LLM.** `baseline.js#classify` decides; the assessor
   only explains.
2. **One implementation per measure.** ECP is produced by `ecpFromBrief` (conversation) or
   `ecpFromVotes` (judge), stored on the run; the browser displays `run.ecp` and never
   recomputes it.
3. **Study parameters are named.** `WEIGHTS` and `THRESHOLDS` in `baseline.js`; nothing
   else may hard-code 0.25 or 0.5, including explanation text in the demo provider.
4. **Explanations read the computation.** Score and explanation come from the same `*Detail`
   helper. A test asserts it.
5. **Never truncate silently.** A view that shows a subset says what it is not showing.
6. **Overrides are deltas.** `data/profile-overrides.json` holds human corrections only.
7. **The demo provider stays in lockstep.** Change a prompt's JSON schema or a parser, and
   update `server/llm/demo.js` and the tests in the same commit.
8. **Judge prompt variants are experimental factors.** Add a new named entry to
   `JUDGE_PROMPTS`; never edit an existing one's text. Runs record the variant and the full
   prompt, and results either side of a wording change are not comparable.
9. **Honest failure is a feature.** The Lena Fischer path must keep failing; do not tune it
   into producing opportunities.
10. **Reset archives, never deletes.**
11. **Triggers are snapshotted into runs.**
12. **One palette, light only.** `graph.js` reads the CSS tokens; the classification colours
    were validated for colour-vision deficiency against the light surface.

## Common changes, and how to make them

**Add an LLM provider.** Create `server/llm/<name>.js` exporting a class with `name`,
`model`, `judgeModels[]`, and `async complete({system, prompt, maxTokens, meta, model})`
returning text. Register it in `provider.js#availableProviders` with a detection rule (env
var, binary on PATH) and a label in `PROVIDER_LABELS`. `meta.kind` tells you which stage is
calling (`turn`, `synthesis`, `judge`, `assessment`) if the driver needs to adapt; the demo
driver switches on it. A cross-vendor judge is exactly this plus a `judgeModels` list;
nothing in the pipeline is Anthropic-specific.

**Add a judge prompt variant.** Add a key to `JUDGE_PROMPTS` in `server/agents/judge.js`
with `label`, `system` and `guidance`. It appears in the dock and the API automatically;
`GET /api/state` lists it. Add a line to `RESEARCH_PROTOCOL.md` §3.3 saying what it
manipulates. Do not touch `unguided` or `guided`.

**Change a conversation-mode prompt.** Edit `persona.js`, `conversation.js`,
`synthesizer.js` or `assessor.js`; update `demo.js` if the output shape changed; run the
tests. Then note the date in `docs/DECISIONS.md`, because conversation runs do not record
their prompt text and the git history is the only way to know which wording produced a run.

**Change a threshold or weight.** Don't, mid-study. If you must: `baseline.js` only, update
`docs/RESEARCH_PROTOCOL.md` §3.3 and `TECHNICAL_SPECIFICATION.md` §3, and archive existing
runs first (Findings → *Start a fresh experiment*), since stored classifications were
computed under the old values.

**Add a synthetic researcher.** Append to `server/data/researchers.json` with
`synthetic: true`, `verified: true`, a `(synthetic composite)` suffix on the institution,
and edges in `collaborations[]` if wanted. Keep the eight-plus-one shape in mind: one
deliberate poor fit is enough. Real people are added through the UI, never in the seed
file, and never committed (see `docs/PUBLISHING_CHECKLIST.md`).

**Add an API route.** `server/index.js` has a route table matched by `router.js` with
literal segments beating `:params`, so order does not matter. Add a client function in
`public/js/api.js`. Validate every body field and return 400 with a message; see
`POST /api/runs` for the pattern.

**Add an SSE event.** Emit from the pipeline with `emit(type, payload)`; handle in
`public/js/app.js` next to the others. Events are the only way the browser learns about a
run; polling is not used.

**Change the front end.** `ui.js` holds pure render functions (string in, string out);
`app.js` holds state and DOM wiring; `graph.js` is the canvas chart with no dependencies.
Keep that split. Respect `prefers-reduced-motion`. No framework, no bundler, no dark mode.

**Write or change a document.** Markdown under `docs/` with YAML front matter (`title`,
`subtitle`, `author`, `date`); `tools/build-docs.mjs` lists what the PDF build includes.
Design records under `docs/specs/` are kept as written and never updated; write a new one.
Update `docs/README.md` when you add a document.

## Tests

`test/*.test.js`, Node's built-in runner, no network. Every deterministic function has a
test; the pipeline is tested end to end on the demo provider; resumability is tested by
simulated crash. When you add behaviour, add the test in the same commit. When you fix a
bug, add the failing case first.

## Commits and branches

- Work on `main` is fine for the two authors; collaborators branch and open a pull request.
- Commit messages: a one-line summary of the *effect*, then why, in prose. The history is
  part of the provenance; a reviewer may read it.
- Never commit a real-person profile (including an author profile), human correction, live run,
  raw transcript or credentials. Keep all runtime state untracked. Run `npm test` and
  `npm run check:publishing` before pushing; enable the push guard with
  `git config core.hooksPath .githooks`. Do not push without the owner's say-so.

## Working with an AI assistant

Much of this codebase was written with Claude Code. `CLAUDE.md` is the assistant's brief;
if you change a rule here, change it there. Review AI-written code against the invariants
above; the assistant is good at following them and bad at knowing when a rule is missing.
