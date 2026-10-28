# Technical Appendix (draft)

**Prototype:** ResearcherConnect v0.3
**Paper:** *"Nice to Meet You — Could My LLM Talk to Yours?" Identifying Latent Scientific Collaboration Opportunities through LLM-Mediated Conversations*
**Authors:** Nadine Ostern, Marek Kowalkiewicz (Queensland University of Technology)
**Repository:** this directory (Git repository per the Call for Prototypes requirements)
**Status:** draft appendix, revised 28 October 2026 to cover both measurement modes and the September 2026 pivot. Numbers in §A6 are placeholders to be filled from study runs. The engineering-level companion is `docs/TECHNICAL_SPECIFICATION.md`; the study design is `docs/RESEARCH_PROTOCOL.md`; what the live runs have shown so far is `docs/STATUS.md`.

**How to use this draft.** Each section names the document that supplies its detail, so whoever writes the final appendix can go to the source rather than to the code.

| Appendix section | Draw from |
|---|---|
| A1 overview, definitions | TECHNICAL_SPECIFICATION §1–3; GLOSSARY |
| A2 representation | TECHNICAL_SPECIFICATION §5.3–5.4; DATA_ETHICS §4 |
| A3 measurement modes and the pivot | DECISIONS Part 1 (10 Sept 2026), D12–D15; specs/2026-09-10 Part 2 |
| A4 baseline and comparison | TECHNICAL_SPECIFICATION §3; ARCHITECTURE "Baseline metrics" |
| A5 validation and measures | RESEARCH_PROTOCOL §4 |
| A6 conditions and status | RESEARCH_PROTOCOL §3; STATUS §3 |
| A7 implementation, reproducibility | ARCHITECTURE; WORKING_WITH_RUNS; CHANGELOG |
| A8 limitations | STATUS §3 observations; TECHNICAL_SPECIFICATION §10; DATA_ETHICS §6, §8 |
| Planned development (agent arena; recommendation vs decision) | HANDOVER §3 |

---

## A1. System overview

ResearcherConnect operationalises the paper's research design as a five-stage computational pipeline over a pool of researcher representations. The unit of analysis is the **researcher pair**; the unit of output is a **run** — a fully-provenanced record of one machine judgment of a pair and its comparison with the structural baseline.

**Definitions implemented.** Two numbers describe every pair. *Structural predictability* is the composite of the four tie-formation mechanisms of Dahlander & McFarland (2013), computed deterministically on [0,1]. *Expected collaboration potential* (ECP) is the system's own judgment of the pairing on [0,1], produced in one of two modes (§A3). A *latent collaboration opportunity* is operationalised as a run in which predictability falls below a preregistered threshold (0.25) **and** ECP reaches at least 0.5 — classical theory predicts nothing, yet the system sees real potential. Pairs at or above 0.5 predictability are *structurally predicted*; ECP of zero is *none*; everything else is *borderline*. The finding of interest is thus the **divergence** between the two measures, not either alone. Classification is computed in code from the two numbers; no prompt decides it.

**Anchoring in an opportunity.** Every judgment is anchored to an explicit *trigger* — a call for papers, grant scheme or project brief supplied by the operator — because tie-formation theory speaks to whether a tie forms, not to whether a collaboration would be worth forming; quality is assessable only against something concrete. The trigger text is snapshotted into each run, so later edits cannot rewrite past evidence. An open-exploration condition with no trigger is retained for comparison.

## A2. Researcher representation (Step 2)

Each researcher is represented by a layered profile derived from the SyncMinds v0.1 mind-file format: **L0** stable identity (name, affiliations, unit, seniority, field, methods, interests, collaboration style) and **L2** dynamic reflections (recent, researcher-authored notes on what currently occupies them).

Profiles are composed deterministically into (i) a *persona card* shown in the interface for researcher verification and (ii) the text the models are given. Real researchers' profiles are marked `verified: false` until the person reviews and confirms their own representation; an AI-drafted or AI-refreshed profile (the system includes a web-search "scout" that cites every claim) never sets that flag. Verification is Step 2 of the research design, performed in the tool, and the protocol excludes unverified profiles from primary analysis. The September 2026 demonstration in which a fabricated publication entered an unverified profile and propagated into a recommendation (§A3) is the reason this is treated as a validity condition rather than good practice.

## A3. Producing ECP (Step 3): two modes and a pivot

The prototype implements two instruments for Step 3. They differ only in how ECP is produced; baseline, classification, validation and provenance are shared. The second was adopted after the first failed in ways the paper reports.

**Conversation mode (the original design).** Two persona agents alternate for a fixed number of turns (default 6), each call carrying the speaker's persona prompt, the trigger, the transcript so far, and phase guidance (*relevance*: is this opportunity ours? *assessment*: is the complementarity real and concrete? *judgment*: would the researcher commit?). Agents are instructed to practise *recognition, not invention*: to judge whether a connection is worth making and say what each side would bring, never to draft research questions. A synthesizer distils the transcript into a connection brief `{viable, title, fit_summary, contributions, joint_angle, first_step, relevance, complementarity, feasibility, verdict}` with the three ratings on 1–5 scales; ECP = ((r−1)+(c−1)+(f−1))/12 in code, 0 when not viable. Eight model calls per run.

What live use showed, in order of seriousness: (1) a run on an unverified, AI-refreshed real profile justified the pairing with a paper that does not exist; (2) improvised dialogue reaches for facts no profile contains, then invents or stalls; (3) the brief repeats the conversation. A rewrite of the prompts into plain prose (September 2026) improved the register without changing what the instrument is. Historical private runs on identical inputs also returned different ECP, showing that one run cannot establish a stable estimate. Individual live-run measurements are not distributed in this repository.

**Judge mode (adopted 10 September 2026).** One model is shown both profiles and the trigger and asked *should these two researchers collaborate on this opportunity — 0 or 1?* with one sentence of reason. Because the answer is not deterministic, the question is put *k* times (default 10) to each of *m* models (three Anthropic models through the Claude Code CLI; the API driver is configured equivalently), and ECP is the share of votes in favour. A forced binary commits the model in a way a verbalised probability does not, and averaging over repeats yields a distribution rather than an anecdote. Two prompt wordings are named experimental factors — *unguided* (no steer) and *guided* (weigh complementarity over similarity) — because whether a model rewards similarity, and so tracks the baseline, is the question Nadine raised and is better run than argued. The full prompt is snapshotted into each run. (k·m + 1) short calls per run; roughly an order of magnitude cheaper than conversation mode, which matters for collaborators on smaller model budgets.

The study question thereby sharpens to: *is uncontrolled model judgment more accurate than tie-formation theory at predicting collaborations that humans endorse?* Conversation mode is retained as the documented failure path and as a candidate explainer for latent finds.

## A4. Baseline and comparison (Steps 1 and 5)

The four mechanisms are computed deterministically from the collaboration graph and profile fields:

| Mechanism | Operationalisation | Range |
|---|---|---|
| Organisational foci | shared institution (0.6), shared unit (1.0); affiliations are lists, so multiple appointments all count | [0,1] |
| Status & value homophily | ½·(1 − |Δseniority|/3) + ½·Jaccard(method families) | [0,1] |
| Cumulative advantage | √(deg_a·deg_b)/(n−1) | [0,1] |
| Triadic closure | |shared neighbours| / min(deg_a, deg_b) | [0,1] |

Composite predictability = 0.30·foci + 0.20·homophily + 0.20·advantage + 0.30·closure, where *n* is the pool size. Weights and thresholds are named constants (`WEIGHTS`, `THRESHOLDS`), stipulated rather than fitted, and held fixed across a study; a robustness appendix can re-classify stored runs under alternative thresholds without re-running anything.

An assessor model produces per-mechanism natural-language explanations, and the interface exposes the full arithmetic for any pair — each mechanism's inputs, its weighted contribution, and the total. The classification itself is computed in code from the two deterministic scores, keeping the key measure auditable and model-independent.

**Probing and sampling.** The interface ranks unconnected pairs by ascending predictability (the probe queue): sampling where the baseline predicts least is where a positive judgment is most diagnostic of latency. For the study, pairs are judged exhaustively or by a predictability-stratified sample — never by a predictability-filtered shortlist, since the baseline cannot also be the selection mechanism.

## A5. Human validation (Step 4) and success measures

Each completed run awaits a human decision — *agree*, *worth discussing*, or *disagree* — with an optional note. The buttons are phrased against whatever the machine recommended, so "agree" denotes agreement with the recommendation in both directions. In judge mode the human sees the judges' *k·m* one-sentence reasons; in conversation mode, the brief and transcript. Two success measures are computed continuously:

1. **Human–machine alignment:** agreements / (agreements + disagreements) over machine recommendations.
2. **Beyond-baseline discovery:** the count and share of validated opportunities classified *latent*.

## A6. Study conditions and current status

The public seed pool contains 10 fictional synthetic researcher representations, including one deliberate poor-fit case (a marine geochemist) to verify the system's capacity for negative results. No real-person representation is distributed. The existing-tie graph contains 7 edges.

As of 28 October 2026, no study condition has been run. Historical private development exposed test–retest variability and possible yes-bias or insufficient sampling variation in judge mode. Individual live-run values and records are excluded. `docs/STATUS.md` summarises the methodological limitations; a preregistered study with a poor-fit comparison remains necessary.

*Placeholder for study results: N runs across the sampled pairs per condition (trigger vs none; unguided vs guided judge; representation depth), per-classification counts, alignment rate, test–retest of ECP, and the comparison of judge ECP with predictability as predictors of human endorsement.*

## A7. Implementation and reproducibility

- **Stack:** Node.js ≥ 20; no build step; one optional dependency (`@anthropic-ai/sdk`). Frontend is vanilla ES modules with a custom canvas force layout.
- **Models:** a provider abstraction supporting the Anthropic API, the local Claude Code CLI, and a deterministic offline demo driver used by the test suite. Provider, model, mode, prompt variant and (in judge mode) the full prompt text are recorded per run. Adding a judge from another vendor is a small driver with the same interface.
- **Provenance:** every run persists as a single JSON artifact (trigger snapshot, baseline scores and breakdown, persona cards, all turns or all votes with timestamps, brief or judgments, assessment, stage log, human decision). `docs/WORKING_WITH_RUNS.md` documents the format and how to tabulate it. The project's own genesis (idea email, meeting transcript, plan) and the working-session transcripts that redirected the design are preserved; `docs/DECISIONS.md` is the dated decision log.
- **Tests:** automated offline tests (`node --test`) covering the deterministic metrics, classification thresholds, explanation/score consistency, pool composition, the full pipeline in both modes against the offline driver, the negative-result path, resumability, judge vote parsing and ECP from votes, the scout's parser, routing, and archive/reset behaviour. No network access required.
- **Experiment boundaries:** clearing findings between conditions *archives* rather than deletes — runs move to `data/archive/<timestamp>/` with a manifest — so the evidence chain of an earlier condition remains readable and restorable.
- **Data in the repository:** synthetic personas and demo-mode runs only; live runs on real people stay in the authors' private archive (`docs/DATA_ETHICS.md` §7).

## A8. Limitations

1. **Representation validity.** Judgments are a function of profiles and trigger alone; an unverified profile can carry fabricated or stale claims into a recommendation, as happened once in development. Verification before use is a validity condition.
2. **Discriminant validity.** Model agreement can reflect yes-bias rather than discrimination. Evaluate verified suitable and poor-fit pairs, compare prompt conditions, and measure human endorsement in the separate private study.
3. **Sampling variance.** Repeats only estimate a distribution if sampling is stochastic; the CLI path appears near-deterministic. The study should use the API path with explicit sampling parameters and report test–retest.
4. **Judges are not independent.** Three models from one vendor share training; agreement among them is weak evidence. Cross-vendor judges address this.
5. **Tie leakage through profile text.** Reflections and notable work name collaborators, so a judge can see the tie the baseline is meant to measure independently. Either collaborator names are stripped from judge prompts or this is reported as a confound.
6. **Small-world baseline.** With a ten-node seed graph, cumulative advantage and triadic closure have limited variance; institutional-scale data (QUT Pure) is the intended remedy.
7. **Construct gap.** ECP is a model judgment, not ground truth; human validation is the corrective, and misalignment is itself data.
8. **The trigger is itself a focus.** Anchoring in a call for papers introduces exactly the kind of organisational focus the baseline measures — but one that did not exist socially. Whether this is a contribution (agents as synthetic foci) or a limitation is open.
9. **Independent validation is required.** Development feedback does not replace a study with independent validators who are blind to condition.
