# CLAUDE.md — ResearcherConnect

Visual agentic system for discovering latent research collaboration opportunities. Prototype for an Organization Science "Call for Prototypes" submission (Ostern & Kowalkiewicz, QUT). Successor to the Python/Streamlit `OrgSci/syncminds/` v0.1 — personas and provenance carry over from there.

## Commands

```bash
npm start          # run (auto-detects provider: anthropic SDK → claude CLI → demo)
npm run demo       # forced offline demo mode
npm test           # node --test, fully offline
```

No build step. No required dependencies (`@anthropic-ai/sdk` is optional, only for API-key mode).

## Architecture in one paragraph

`server/index.js` (plain node:http) serves `public/` and a JSON API, and streams pipeline events over SSE. `server/pipeline.js` runs the paper's five steps for a researcher pair: deterministic baseline (`baseline.js`, Dahlander & McFarland's four tie-formation mechanisms) → persona composition (`agents/persona.js`) → step 3 in one of two modes — agent-to-agent conversation (`agents/conversation.js`) + synthesis (`agents/synthesizer.js`), or repeated 0/1 votes from several models (`agents/judge.js`) — → baseline comparison (`agents/assessor.js` + `classify()`). Runs persist as single JSON files in `data/runs/` (the provenance chain). LLM access goes through `server/llm/provider.js`, which detects every usable driver at boot (`demo` always; `claude-cli` if the binary exists; `anthropic` if a key is set) and lets the UI pick one per run; all drivers expose `complete({system, prompt, maxTokens, meta})`.

## Rules

- **Classification is code, not LLM.** `baseline.js#classify` decides latent/borderline/predicted from the deterministic predictability score and ECP; the assessor LLM only explains. Don't move the verdict into a prompt.
- **One implementation per measure, one place for parameters.** ECP has one producer per run mode — `baseline.js#ecpFromBrief` (conversation) or `baseline.js#ecpFromVotes` (judge) — and is stored on the run; the browser displays `run.ecp`, never recomputes it. Thresholds live in `THRESHOLDS` and weights in `WEIGHTS`; nothing else may hard-code them (the demo provider's explanation text reads `THRESHOLDS` too). Score explanations must read the same `*Detail` helper the score does.
- **Never truncate silently.** If a view shows a subset (the probe queue caps rows), it must say what is not shown and how to reach it.
- **`data/profile-overrides.json` records human corrections only** — deltas against the seed/added record, not every save.
- **The demo provider must stay in lockstep** with prompt/parser changes — it's what the tests and credential-free demos run on. If you change the synthesizer's JSON schema, update `llm/demo.js` and the tests together.
- **Judge prompt variants are experimental factors.** They live named in `agents/judge.js#JUDGE_PROMPTS`; adding one is fine, silently editing one is not — runs record the variant and the full text, and results either side of a wording change are not comparable (see RESEARCH_PROTOCOL §3.3).
- **Honest failure is a feature.** Don't "fix" the poor-fit path (Lena Fischer) into producing opportunities; tests assert it fails honestly.
- **Frontend is vanilla ES modules, no build.** Pure render functions in `ui.js`; DOM wiring in `app.js`; the canvas star chart in `graph.js` has no dependencies. Keep the light "chart room" star-atlas identity (indigo ink on pale chart paper — the owner explicitly dislikes dark mode); the classification palette in `styles.css` was CVD-validated against the light surface; don't swap colors casually.
- The shared seed dataset and example runs must contain independently fictional synthetic personas only. Never commit a real profile, including an author profile, or a live run. Run `npm test` and `npm run check:publishing` before pushing; keep runtime state ignored and enable `.githooks` in every clone.
- Don't deploy or `git push` unless explicitly asked.
