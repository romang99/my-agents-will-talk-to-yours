---
title: "ResearcherConnect — Start Here"
subtitle: "Onboarding for collaborators who are forking or downloading the project"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "October 2026"
---

> You have the code. This page gives you the context the code cannot: what the
> project is for, what has happened to it so far, how to run it in an hour without
> spending anyone's budget, and which document to read next for your role.

# 1. What this is, in four paragraphs

**Current submission:** *WELCOME TO THE JUNGLE: AGENT ARENAS, UNLIKELY COLLABORATIONS, AND THE SEARCH FOR SCIENTIFIC IDEAS THAT MATTER*. This page explains the existing pair-assessment prototype. Its planned extension is an agent arena for exploring and evaluating scientific opportunities; see the [technical appendix](TECHNICAL_APPENDIX.md) and [submission framing](specs/2026-10-30-submission-framing.md).

**The research question.** Can an LLM find research collaborations that established
network theory would not predict, and that the humans involved then endorse? Dahlander &
McFarland (2013) describe four mechanisms that explain why research ties form: shared
organisational settings, similarity of status and values, cumulative advantage of the
already well-connected, and shared collaborators. The implementation labels a pair with a low structural score and positive model assessment as a candidate **latent collaboration opportunity**. Human endorsement is a separate outcome to be evaluated; the current classification does not itself establish scientific value.

**The two numbers.** For every pair of researchers the system computes *structural
predictability* (0–1, deterministic, from the four mechanisms) and *expected collaboration
potential* (ECP, 0–1, the model's judgment). Classification is a pure function of those two
numbers: low predictability with high ECP is `latent`. No prompt decides the class.

**Two ways to get ECP.** The original design had two persona agents, each speaking from a
researcher's "mind file", hold a six-turn conversation about a concrete opportunity (a call
for papers), after which a synthesizer wrote a connection brief and ECP was derived from its
sub-scores. Live use showed that conversations drift into agent-speak, ask questions no
profile can answer, and once justified a pairing with a paper that does not exist. On
10 September 2026 the authors pivoted to **judge mode**: one model is shown both profiles
and the opportunity and asked "should they collaborate, 0 or 1?", ten times each on several
models; ECP is the share of votes in favour. Both modes are in the app. Conversation mode is
kept as the documented failure path and a possible explainer; the paper tells that story.

**Where it is headed.** The submission brings together the existing prototype, its technical appendix and a proposal for further development. The proposed arena will compare alternative multi-agent configurations and examine the scientific potential of the opportunities they produce. Verified participant profiles, sampling, human evaluation and suitable comparison conditions belong to the planned study. The current release remains a pair-assessment instrument, with the development observations and limitations documented separately from future work.

# 2. Reading order, by role

| If you are… | Read, in this order |
|---|---|
| **Deciding the study** (Nadine) | [STATUS](STATUS.md) → [RESEARCH_PROTOCOL](RESEARCH_PROTOCOL.md) §§3–7 → [DATA_ETHICS](DATA_ETHICS.md) §§4–7 → [specs/2026-09-10](specs/2026-09-10-search-centric-redesign.md) Part 2 |
| **Running the study** (a research assistant) | this page → [PROTOTYPE_GUIDE](PROTOTYPE_GUIDE.md) → [WORKING_WITH_RUNS](WORKING_WITH_RUNS.md) → RESEARCH_PROTOCOL §5 |
| **Changing the code** | this page → [../ARCHITECTURE.md](../ARCHITECTURE.md) → [TECHNICAL_SPECIFICATION](TECHNICAL_SPECIFICATION.md) → [../CONTRIBUTING.md](../CONTRIBUTING.md) → [../CLAUDE.md](../CLAUDE.md) |
| **Understanding why it is the way it is** | [DECISIONS](DECISIONS.md) (timeline and decision log) → the design records under `specs/` |
| **Reviewing for the paper** | [TECHNICAL_APPENDIX](TECHNICAL_APPENDIX.md) |
| **About to push or share** | [PUBLISHING_CHECKLIST](PUBLISHING_CHECKLIST.md) — before anything else |

[GLOSSARY](GLOSSARY.md) defines every term used across these documents.

# 3. Setup

**Requirements:** [Node.js](https://nodejs.org) 20 or newer. Nothing else. There is no
`npm install` and no build step; the only dependency (`@anthropic-ai/sdk`) is optional.

```bash
git clone <repository> ResearcherConnect
cd ResearcherConnect
npm test          # offline tests, about ten seconds — confirms the checkout is sound
npm run demo      # offline demo mode on http://localhost:4870
```

Demo mode simulates every model call deterministically from the profile text. It is for
learning the interface and for demonstrations, never for findings; the interface labels it.

**For live runs** you need one of:

| Route | What to do | Cost model |
|---|---|---|
| Claude Code subscription | make sure `claude` works in your terminal (`claude --version`), then `npm start` | counts against your subscription limits; no key |
| Anthropic API key | `npm install @anthropic-ai/sdk`, then `ANTHROPIC_API_KEY=sk-ant-… npm start` | billed per token |

`npm start` detects every usable provider and offers them in the dock; you choose one
**per run**. `PROVIDER=demo` or `PROVIDER=claude-cli` only changes the default.

**Note for the API route:** it has been exercised in code review and unit tests but not in
a live run in this repository's history, because no key was available on the development
machine. Expect it to work; verify it on a synthetic pair before relying on it.

## Configuration

Everything is an environment variable. There is no config file.

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `4870` | HTTP port |
| `PROVIDER` | auto | default provider in the dock (`demo`, `claude-cli`, `anthropic`) |
| `ANTHROPIC_API_KEY` | unset | enables the `anthropic` provider |
| `TURNS` | `6` | conversation-mode turns per run |
| `JUDGE_REPEATS` | `10` | default repeats per model in judge mode (1–50; also settable per run in the API) |

`.claude/launch.json` lets the Claude Code desktop app start either mode as a preview
server; it is not needed to run the project.

## What is *not* in the repository

- `data/profile-overrides.json` is gitignored. It holds human corrections to profiles and
  belongs to the people who made them.
- `docs/pdf/` is build output (`npm run docs`, needs pandoc and Chrome). Markdown is the
  source of truth.
- The predecessor project, SyncMinds v0.1, and the project's origin trail (the June 2026
  meeting transcript, the call for papers, the July emails between the authors, the project
  plan) live in a sibling folder on Marek's machine, `OrgSci/syncminds/docs/provenance/`.
  Links to `../OrgSci/…` in older documents point there. Ask Marek if you need them;
  [DECISIONS](DECISIONS.md) summarises what they contain.
- Real-person run records and profiles, by policy, and the verbatim session transcripts.
  This repository is a clean snapshot of the development clone; see the publishing checklist.

# 4. Your first hour

1. **Demo, conversation mode.** `npm run demo`, open the app, keep *Agents talk* in the dock,
   pick the top pair in the probe queue, press *Let the agents talk*. Watch the rail,
   the theater and the brief. Then open *Findings*.
2. **Demo, judge mode.** Switch the dock to *Judges vote (unguided)*, run the same pair.
   Watch the tally fill in instead of the theater. Compare the two runs in Findings: the
   table has a *Mode* column.
3. **Honest failure.** Run Lena Fischer (marine geochemistry) against anyone. The system
   must say no. This is the manipulation check and the tests assert it.
4. **Explainability.** Select any pair and read the *Pair baseline* panel. Every number
   there can be traced to a line in `server/baseline.js`.
5. **One live judge run** (if you have a provider). Choose a synthetic pair so you spend
   nothing on real people yet. A judge run on the CLI takes two to three minutes and makes
   31 short calls (3 models × 10 votes + 1 assessor call). A conversation run makes 8 long
   calls and takes several minutes.
6. **Reset.** Findings → *Start a fresh experiment* → *Clear findings*. Nothing is deleted;
   your runs are now under `data/archive/<timestamp>/` with a manifest.

# 5. Budget guidance for subscription users

Judge mode was designed to be affordable on a smaller Claude Code subscription than the
one it was developed on. Levers, cheapest first:

- Choose fewer judge models per run (the dock and the API accept any subset of
  `opus`, `sonnet`, `haiku`).
- Lower `JUDGE_REPEATS` (five still averages; one is a point estimate and defeats the design).
- Run pairs in batches with pauses; the CLI driver already keeps four calls in flight and
  retries once after a transient failure.
- Prefer judge mode over conversation mode for anything exploratory. Conversation runs are
  long-context and cost roughly an order of magnitude more.

Runtime depends on the provider, model, repeat count and local environment. Measure it
with fictional demo fixtures or within the separate private study; individual live-run
timing records are not part of this repository.

# 6. Troubleshooting and FAQ

**Port 4870 is in use.** `PORT=5000 npm start`, or find the old process:
`lsof -i :4870`.

**The dock only offers "demo".** Neither `claude` is on your PATH nor `ANTHROPIC_API_KEY`
is set in the shell that launched `npm start`. The boot log lists the detected providers.

**"claude CLI exited 1" or a timeout.** Usually transient; every CLI call retries once after
five seconds. If it persists, run `claude -p "hi"` in a terminal: you may need to log in, or
your subscription limit may be reached. A failed run keeps everything it finished; open it
and press *Resume run*. Judge runs recast only the missing votes.

**Every judge said yes.** Unanimity can arise from model agreement, yes-bias or sampling
behaviour. Check the instrument with suitable and poor-fit comparisons in the private
study, and compare the named prompt variants. Unanimity alone is not validation.

**The judges disagree on nothing across repeats.** On the CLI path, sampling appears to be
near-deterministic, so repeats may not be drawing from a distribution. The API path exposes
sampling parameters; the sampling limitations are described in STATUS §3.

**A pair I expected is not in the queue.** The queue shows the twelve least predictable
unconnected pairs and says how many exist. Use *From …* to focus on one researcher, or click
two stars.

**My runs vanished.** Someone pressed *Start a fresh experiment*. Look in `data/archive/`;
each folder has a `MANIFEST.json`. Restore with
`mv data/archive/<id>/runs/*.json data/runs/` and reload.

**A profile says "unverified".** It is a real person's profile that they have not reviewed.
Only they can tick the box. An AI refresh never sets it. In the separate private study,
verify real profiles before live use: unsupported claims can propagate into output.

**I edited a trigger and old runs did not change.** Correct: triggers are snapshotted into
runs so that later edits cannot rewrite evidence.

**Dark mode?** Deliberately none. The light "chart room" palette was validated for
colour-vision deficiency and the owner dislikes dark mode. Do not add one casually.

# 7. Who to ask

Marek Kowalkiewicz built the prototype (with Claude Code) and is the contact for the
codebase; Nadine Ostern co-owns the research design. Study design and governance are
agreed by the research team.
