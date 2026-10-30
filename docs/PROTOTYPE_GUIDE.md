---
title: "ResearcherConnect — Prototype Guide"
subtitle: "WELCOME TO THE JUNGLE: AGENT ARENAS, UNLIKELY COLLABORATIONS, AND THE SEARCH FOR SCIENTIFIC IDEAS THAT MATTER"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "July 2026"
---

# What this prototype does

ResearcherConnect is the implemented pair-assessment prototype supporting the current submission. It compares a deterministic structural heuristic with model assessments of potential research collaborations. Conversation mode uses an exchange between agents representing the two researchers; judge mode collects repeated binary judgments. Both modes support human feedback.

The proposed agent arena will extend this foundation to alternative multi-agent arrangements for exploring and evaluating scientific opportunities. Arena mechanisms, team formation and the generation and evaluation of research sketches remain planned development. The [technical appendix](TECHNICAL_APPENDIX.md) describes the current implementation and the planned evaluation.

In the current conversation mode, agents assess whether the two humans should talk and explain what each would bring. They are instructed not to draft research questions or study designs. A well-argued negative recommendation is a valid outcome.

Each run stores its inputs, model outputs, scores and human feedback in a JSON file. Judge runs also save the full judge prompt; conversation prompt reconstruction requires the matching code revision.

# Before you start

You need [Node.js](https://nodejs.org) 20 or newer. There is nothing to install — no `npm install`, no build step.

```bash
cd ResearcherConnect
npm run demo      # offline, free, instant — start here
```

Open <http://localhost:4870>.

**Demo mode is simulated.** It stitches plausible dialogue from profile fields so the whole app works with no credentials and no cost. It is for learning the interface and for demonstrations — never for findings. The interface labels it everywhere it appears.

For real agent conversations, use `npm start`, which detects what you have:

| Provider | Requirement | Character |
|---|---|---|
| Claude Code subscription | the `claude` command works in your terminal | no API key; a full run takes a few minutes |
| Anthropic API key | `npm install @anthropic-ai/sdk`, then `ANTHROPIC_API_KEY=… npm start` | billed per token; roughly tens of cents per run |
| Demo | always available | instant, free, simulated |

You choose the provider **per run** in the dock, so a demo and a live probe of the same pair can sit side by side in the findings.

# The five steps, and where each one lives

The interface follows the paper's research design. The rail across the top lights up as a run moves through it.

| Step | What happens | Where you see it |
|---|---|---|
| 1 · Baseline | The four classical tie-formation mechanisms are computed for the pair, deterministically | Select any pair → *Pair baseline* panel |
| 2 · Representation | Each researcher's profile is composed into their agent's instructions | Click a star → *Edit representation* |
| 3 · Conversation or judgment | Persona agents assess the pair together, or judge models cast repeated votes | Conversation Theater or judge tally; stored transcript or vote reasons |
| 4 · Validation | You agree or disagree with the machine's recommendation | The buttons at the foot of every connection brief |
| 5 · Comparison | Predictability and ECP are compared; the pair is classified | Findings tab |

# A first session

**1 · Choose an opportunity trigger** (top left). The Org Science call ships as the first one — reflexively, the call that prompted this system. Add your own with *＋ New trigger* and paste any call for papers, grant scheme, or project brief. The full text goes into every conversation and is snapshotted into the run, so a trigger edited later never rewrites past evidence.

You can also select *None — open exploration*, which asks the agents whether any basis for collaboration exists at all. Running the same pair with and without a trigger is a useful comparison.

**2 · Choose a pair.** The probe queue lists unconnected pairs, **least predictable first** — the top of the queue is where classical theory predicts nothing, so a discovery there is most informative. Use *From …* to focus on one researcher (all their unconnected pairs), or click any two stars on the chart.

Selecting a pair opens the *Pair baseline* panel, which shows exactly how its predictability number was computed: each mechanism, the actual inputs, the weight arithmetic, and the total.

**3 · Choose how the system judges, then run.** The dock offers two modes. *Agents talk*: two persona agents hold a six-turn conversation and a brief is written. *Judges vote*: one model is shown both profiles and the opportunity and asked "should they collaborate — 0 or 1?", ten times each on Opus, Sonnet and Haiku; ECP is the share of votes in favour, and you get every judge's one-sentence reason. *Unguided* leaves the judges to their own criteria; *guided* asks them to weigh complementarity over similarity. Which wording you used is recorded on the run — treat it as an experimental condition, not a preference.

**3a · Let the agents talk.** Watch the conversation stream in. The agents introduce what their researcher would bring, test whether the complementarity is real, and end with a recommendation. They are instructed not to invent research questions — that work belongs to you, after you meet.

**4 · Read the connection brief.** Why the pairing works or doesn't, what each side brings, a suggested first contact, the three sub-scores, and a mechanism-by-mechanism analysis of whether tie-formation theory would have predicted this pair at all.

**5 · Make your call.** *Agree* / *Worth discussing* / *Disagree*. The buttons adapt to what the machine recommended, so "agree" always means agreement — that is the human–machine alignment measure.

**6 · Open Findings** for the running picture: the predictability × ECP chart, classification counts, and your alignment rate.

# The two numbers

**Structural predictability (0–1)** — a deterministic heuristic combining proxies for the four tie-formation mechanisms (Dahlander & McFarland 2013): shared organisational settings, similar standing and methods, existing connections and shared collaborators. Its weights are stipulated, and it is not a calibrated probability. The calculation is exposed in the interface and uses no LLM.

**ECP — expected collaboration potential (0–1)** — the system's own judgment. In conversation mode it is computed in code from the agents' relevance, complementarity and feasibility scores; in judge mode it is the share of votes in favour. Zero when no case was found.

The finding is in the **divergence**:

| Classification | Meaning |
|---|---|
| **Latent** | structural score < 0.25 **and** ECP ≥ 0.5 — a candidate opportunity combining a low structural score with a positive model assessment |
| **Predicted** | ECP > 0 and structural score ≥ 0.5 |
| **Borderline** | neither clearly applies |
| **No viable basis** | ECP = 0; this rule takes priority over the structural score |

In the Findings chart, candidate latent opportunities appear in the shaded upper-left. Their scientific value and human endorsement require the planned evaluation.

# Managing the researcher pool

**Add someone:** *＋ Add researcher*. Type a name and press **Draft from the web (AI)** to have an agent research them with live web search and fill in the whole form — affiliation, interests, recent reflections, ORCID — citing every source. Review it, then save. Drafts are never saved unreviewed, and the sources are stored on the profile.

**Correct someone:** click their star → *Edit representation*. Everything is editable, including affiliations. For a real researcher, *Refresh from the web (AI)* re-researches them in place — no need to delete and recreate, which would sever their existing ties.

**Multiple affiliations are normal.** Separate them with `;` — a shared school *or* a shared centre counts as a shared organisational focus.

**Verification is the researcher's own act.** A profile stays *unverified* until the person it describes reviews it and ticks the box. An AI refresh always leaves it unticked: evidence-based is not the same as confirmed. This is Step 2 of the research design, performed in the tool.

**Remove someone:** the seed pool file is never modified; removals are reversible tombstones, and past runs keep their records.

# Starting a fresh experiment

Findings → **Start a fresh experiment**.

Resetting **archives; it never deletes**. Everything moves to `data/archive/<timestamp>/` with a manifest recording what was moved and when, and stays readable. Two scopes:

- **Clear findings** — the runs only. The pool, your edits and your triggers stay.
- **Clear everything** — runs plus pool additions, profile edits and custom triggers, returning to the seed state.

Use this between experimental conditions. Because nothing is destroyed, an earlier condition's evidence can always be re-read or restored (`mv data/archive/<id>/runs/*.json data/runs/`).

# Where the evidence lives

| Path | Contents |
|---|---|
| `data/runs/*.json` | One file per run — the complete provenance chain |
| `data/archive/<timestamp>/` | Previous experiments, with a manifest |
| `data/profile-overrides.json` | Only genuine human corrections to profiles |
| `data/custom-researchers.json` | Researchers you added; tombstones for those removed |
| `data/triggers.json` | Your opportunity triggers |
| `server/data/researchers.json` | The seed pool — never modified by the app |

# Glossary

**Trigger** — the concrete opportunity a conversation is anchored to.
**Mind file / representation** — the profile an agent speaks from: field, methods, interests, recent reflections, collaboration style.
**Probe** — one full run for one pair.
**Predictability** — the tie-formation baseline score (Step 1).
**ECP** — expected collaboration potential, the system's judgment (Step 3b).
**Latent opportunity** — high ECP where predictability is low; the object of study.
**Alignment** — how often the human agrees with the machine's recommendation (Step 4).
**Synthetic persona** — a composite representing no real person, marked as such throughout.

# When something goes wrong

**A run fails part-way.** Completed work is kept. Open the run and press *Resume run* — it continues from the last finished step and does not repeat (or re-pay for) work already done.

**"claude CLI exited 1".** Usually a transient blip; every call already retries once automatically. Try again, and check `claude` works in your terminal.

**Demo dialogue looks shallow.** It is templated, not generated. Switch the provider to a live one.

**A pair you expected isn't in the queue.** The queue shows the twelve least predictable pairs and states how many exist. Use *From …* to focus on one researcher, or click the two stars directly.
