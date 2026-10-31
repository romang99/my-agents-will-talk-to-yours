# WELCOME TO THE JUNGLE: AGENT ARENAS, UNLIKELY COLLABORATIONS, AND THE SEARCH FOR SCIENTIFIC IDEAS THAT MATTER

**ResearcherConnect v0.3 — technical prototype**

ResearcherConnect assesses potential research collaborations between **pairs of researchers** using researcher profiles, research opportunities and model judgments. A deterministic structural heuristic, informed by the four tie-formation mechanisms of Dahlander & McFarland (2013), is compared with the model's expected collaboration potential (ECP). The implemented classification identifies candidate **latent collaboration opportunities** when a low structural score is combined with a positive model assessment.

Two assessment modes are implemented. **Conversation mode** uses an exchange between agents representing the researchers, followed by a connection brief. **Judge mode** asks whether the two researchers should collaborate on the opportunity, repeating a binary judgment across selected models; ECP is the share of valid votes in favour. Both modes support human feedback. Initial development observations and the limits of the existing evaluation are documented in the technical appendix.

The **proposed agent arena** is the next development stage. It will investigate alternative multi-agent configurations for exploring scientific connections and developing and evaluating possible research directions. Arena mechanisms and team formation are future work; the current release provides the pair-assessment foundation.

Built as the prototype for an *Organization Science* Call for Prototypes submission by **Nadine Ostern** and **Marek Kowalkiewicz** (QUT). It is the visual successor to SyncMinds v0.1 (Python/Streamlit, `OrgSci/syncminds/` — a sibling folder on Marek's machine, not part of this repository).

**Technical appendix:** [Markdown](docs/TECHNICAL_APPENDIX.md) · [PDF](docs/Technical_Appendix_Welcome_to_the_Jungle.pdf).

**New to the project?** Read [docs/ONBOARDING.md](docs/ONBOARDING.md) first; it carries the context the code cannot.

## Quick start

```bash
npm start              # auto-detects the best available LLM provider
npm run demo           # forced offline demo mode — no credentials needed
npm test               # node --test (no network required)
```

Then open **http://localhost:4870**. No build step, no dependencies to install (the Anthropic SDK is optional, see below).

## How to use it

1. **Observatory** — the star chart. Solid faint lines are existing collaborations; the probe queue (left) ranks unconnected pairs by *ascending structural predictability* — the top of the queue is where classical theory predicts nothing, so probing there is most informative.
2. Choose **how the system judges** in the dock: *Agents talk* (two persona agents, six turns, a connection brief) or *Judges vote* (one model asked "should they collaborate — 0 or 1?" ten times across Opus, Sonnet and Haiku; ECP is the share in favour; *unguided* or *guided* prompt). Then choose an **opportunity trigger** (left panel) — the call for papers, project, or idea the agents assess collaboration potential *for*. The Org Science call itself ships as the first trigger, reflexively. Then pick a pair (from the queue, or click two stars — the queue can be focused on one researcher via "From …"), choose a provider in the dock, and press **Let the agents talk**. The pipeline rail across the top lights up as the run moves through the paper's five steps.
3. Watch the **Conversation Theater**: the agents test what each side would genuinely bring to the opportunity — recognition, not invention: they don't draft research topics, and a clear "don't connect" is a valid outcome.
4. Review the **Connection brief**: why the pairing works (or doesn't), what each side brings, a suggested first contact, relevance/complementarity/feasibility scores, and a mechanism-by-mechanism analysis of whether tie-formation theory would have predicted the pair.
5. **Your call** (Step 4 — Validation): Accept / Worth discussing / Decline. Human decisions versus machine recommendations form the *alignment* metric.
6. **Findings** — the running comparison: the predictability × ECP scatter (latent opportunities appear upper-left, where structure predicts nothing but the system sees high potential), classification counts, and how often humans agreed with the machine.

A **Guide** button in the header explains the workflow, the two numbers (predictability and ECP), and how to read the chart — it opens automatically on first visit. Selecting any pair shows exactly how its predictability score is computed, mechanism by mechanism.

## Running this yourself

*Written for collaborators — the whole thing runs on your own machine; nothing is hosted, and nothing leaves your computer except the LLM calls you choose to make.*

**You need:** [Node.js](https://nodejs.org) 20 or newer (`node --version` to check), and a clone of this repository. There is no install step — no `npm install`, no build.

**Start in demo mode first** (free, offline, runs in seconds — the LLM outputs are simulated but the whole app works):

```bash
cd ResearcherConnect
npm run demo
```

Open http://localhost:4870. Pick a pair from the probe queue, press *Let the agents talk*, and watch the pipeline run. Nothing you do here costs anything.

**For real LLM runs**, use whichever you have:

- **Claude Code subscription** — if the `claude` command works in your terminal, just run `npm start`. Runs use your subscription (no API key, no extra billing); a full conversation takes a few minutes.
- **Anthropic API key** — one-time: `npm install @anthropic-ai/sdk`, then:

  ```bash
  ANTHROPIC_API_KEY=sk-ant-... npm start
  ```

  Billed per token to your key; a full run (8 model calls) costs on the order of tens of cents on `claude-opus-4-8`.

**Start with the fictional demo pool.** Inspect a synthetic researcher with **Edit representation** to understand the fields. For a separately authorised private study, add and verify participants in the local runtime stores before using their representations. Representation verification is Step 2 of the research design. Keep personal profiles and corrections out of the shared seed file and out of Git.

**Where things live:** every run is saved as one JSON file in `data/runs/` — the complete provenance chain (baseline scores, every conversation turn, the brief, the model used, your accept/decline decision). Open any past run from the probe queue or the Findings tab; the *Conversation* tab shows the full transcript. Your profile edits persist in `data/profile-overrides.json`. Different port: `PORT=5000 npm start`.

**Managing the pool:** *＋ Add researcher* (left panel) adds a new researcher — they start unconnected, so they surface at the top of the probe queue. Type a name and press **Draft from the web (AI)** to have an agent research the person with live web search (via the Claude CLI) and pre-fill the whole form — title, interests, recent reflections, ORCID — with every source cited. The draft is never saved without your review, and the sources are stored on the profile as provenance for the verification step. *Remove* on a researcher card takes them off the chart; the seed pool file is never modified (removals are tombstoned in `data/custom-researchers.json`) and past runs always keep their records.

## The research design (Ostern & Kowalkiewicz)

| Step | Name | In the app |
|---|---|---|
| 1 | Baseline | Deterministic tie-formation predictors computed for every pair ([server/baseline.js](server/baseline.js)) |
| 2 | Representation | Persona "mind files" composed into agent system prompts; researcher-verifiable ([server/agents/persona.js](server/agents/persona.js)) |
| 3 | Conversation *or* Judgment | Agent-to-agent dialogue, streamed live ([server/agents/conversation.js](server/agents/conversation.js)), or repeated 0/1 votes across models ([server/agents/judge.js](server/agents/judge.js)) — chosen per run |
| 4 | Validation | Human accept/decline decisions recorded per opportunity |
| 5 | Comparison | Classification: `latent` / `borderline` / `predicted` / `none` ([server/baseline.js](server/baseline.js) `classify`) |

## LLM providers

Every usable provider is detected at boot and offered in the dock — you choose one **per run**, so a demo and a live probe of the same pair sit side by side in Findings. `PROVIDER=…` only sets the default.

| Provider | Trigger | Notes |
|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` set | Official SDK, `claude-opus-4-8`, streaming. Requires `npm install @anthropic-ai/sdk` (the project's only, optional, dependency). |
| `claude-cli` | `claude` binary on PATH | Shells out to Claude Code — runs on your existing subscription, zero configuration. A full run takes a few minutes. |
| `demo` | always available (`PROVIDER=demo` to force) | Deterministic offline replay generated from the researcher profiles. Runs in seconds. Used by the test suite. |

The provider and model used are recorded in every run's provenance.

## Provenance

Every run is persisted as a single JSON file under `data/runs/` containing the complete artifact chain: baseline scores, persona cards, every conversation turn or every judge vote (with timestamps), the brief or the judges' reasons, the mechanism assessment, provider/model identity, the judge prompt text, a stage log, and the human decision. [docs/WORKING_WITH_RUNS.md](docs/WORKING_WITH_RUNS.md) explains the format. The project's own origin trail (emails, meeting transcript, project plan) lives in the predecessor's `OrgSci/syncminds/docs/provenance/` on Marek's machine; the dated decision log is [docs/DECISIONS.md](docs/DECISIONS.md).

## Data honesty

All ten researcher profiles are **fictional synthetic composites**, representing no real person (marked `synthetic: true` and labelled in the UI). The authors are credited for their work but are not included as personas. Real study profiles and human corrections belong only in a separate private working copy. One synthetic profile (Lena Fischer, marine geochemistry) is a deliberate poor-fit case: a well-functioning system must be able to say "no viable collaboration" rather than inflate weak matches.

The repository ships synthetic personas and demo-mode runs only (two examples in `data/examples/`). Live runs on real people stay in the authors' private archive. Before pushing, run `npm test` and `npm run check:publishing`, then work through [docs/PUBLISHING_CHECKLIST.md](docs/PUBLISHING_CHECKLIST.md). Enable the history-aware push guard with `git config core.hooksPath .githooks` in each clone.

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full map and design rationale.

## Documentation

[docs/](docs/README.md) holds the full set. Orientation: [Start Here](docs/ONBOARDING.md), [Status](docs/STATUS.md) (what the live runs have shown, what is open), [History and Decision Log](docs/DECISIONS.md), [Glossary](docs/GLOSSARY.md). Using and changing it: [Prototype Guide](docs/PROTOTYPE_GUIDE.md), [Working With Run Records](docs/WORKING_WITH_RUNS.md), [Technical Specification](docs/TECHNICAL_SPECIFICATION.md), [CONTRIBUTING](CONTRIBUTING.md), [CHANGELOG](CHANGELOG.md). The study and the paper: [Research Protocol](docs/RESEARCH_PROTOCOL.md), [Data & Ethics Statement](docs/DATA_ETHICS.md), [Technical Appendix](docs/TECHNICAL_APPENDIX.md), [Publishing Checklist](docs/PUBLISHING_CHECKLIST.md).

```bash
npm run docs
```

renders the Markdown documentation to `docs/pdf/` (needs pandoc and Chrome).

## Licence

[MIT](LICENSE). Code, documents, fictional synthetic personas and offline demo runs; retain the copyright attribution.
