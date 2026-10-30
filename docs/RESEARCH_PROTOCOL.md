---
title: "ResearcherConnect — Research Protocol"
subtitle: "Study design, measures and procedure (working draft)"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "July 2026"
---

> **Status: proposed evaluation framework.** This document concerns the initial
> pair-assessment instrument. It is not a preregistration and does not report a
> completed participant study.

# 1. Research question

**Scope of this working protocol.** This document concerns evaluation of the initial pair-assessment instrument. The current submission, *WELCOME TO THE JUNGLE: AGENT ARENAS, UNLIKELY COLLABORATIONS, AND THE SEARCH FOR SCIENTIFIC IDEAS THAT MATTER*, also proposes an agent-arena extension. Its planned research sketches and evaluation are outlined in the [technical appendix](TECHNICAL_APPENDIX.md); the arena is not implemented in v0.3.

> How does LLM-mediated interaction construct latent scientific collaboration opportunities beyond established mechanisms of tie formation?

A **latent collaboration opportunity** is a potentially valuable basis for joint research that (a) has not developed into a social tie and (b) is unlikely to become visible through established tie-formation mechanisms alone.

The claim under test is not that the system finds *good* collaborations — it is that it finds collaborations that classical structure does not predict, and that humans nonetheless endorse.

# 2. Why a trigger does not undermine the design

Early runs let agents invent research agendas freely; the results were fluent but inauthentic. The design now anchors every conversation to a concrete **opportunity trigger** (a call for papers, grant scheme, or project brief).

This does not weaken the latency claim. Tie-formation theory explains *how ties form*, not *how good a collaboration would be*. The baseline's blind spot is quality, and the trigger is what makes quality assessable. Collaboration quality is itself trigger-dependent: a roboticist and a chemist may be an excellent pairing for one call and a poor one for another.

A call for papers can itself provide an organisational focus. Its role as a shared context must be considered when interpreting the opportunities produced by the system.

# 3. Design

Unit of analysis: the **researcher pair**. Teams are out of scope for the first study; a defensible extension is team potential as the product of pairwise ECPs (one weak member collapses the team), which is recorded here as future work.

## 3.1 Candidate study conditions

Candidate manipulations, in rough order of value:

| Condition | Manipulation | Tests |
|---|---|---|
| **A. Trigger** | trigger vs open exploration, same pairs | whether anchoring changes what is found and whether humans endorse it |
| **B. Representation depth** | L0 profile only vs L0 + recent reflections (+ L1 publication corpus) | whether richer mind files change conversation quality and ECP |
| **C. Human intervention** | no intervention vs mid-conversation steering | the "strategically positioned breakpoints" idea |

Within-pair comparisons use the same pair under both levels. Repeated exposure to suggestions and knowledge of the condition can affect human assessments, so order and information available to raters belong to the evaluation design.

## 3.2 Sampling of pairs

The interface orders unconnected pairs by ascending structural score. This supports exploratory inspection. Evaluation across structural proximity requires a sampling design that includes suitable comparison pairs; a sample restricted to low-score pairs supports claims about that subset.

## 3.3 Current defaults and study provenance

The following values are the current software defaults:

| Parameter | Value | Where |
|---|---|---|
| Mechanism weights | foci 0.30, homophily 0.20, cumulative advantage 0.20, triadic closure 0.30 | `WEIGHTS` |
| `predicted` threshold | predictability ≥ 0.50 | `THRESHOLDS` |
| `latent` thresholds | predictability < 0.25 **and** ECP ≥ 0.50 | `THRESHOLDS` |
| Conversation length | 6 turns | `TURNS` |
| Model | `claude-opus-4-8` (or CLI equivalent) | run provenance |

Weights and thresholds are **stipulated, not fitted**. A robustness appendix should report how classifications shift under alternative thresholds — the run files contain both raw numbers, so this is a re-analysis, not a re-run.

**Prompt wording is part of measurement provenance.** Judge runs store their full prompt. Conversation runs require the matching code revision because the full stage prompts and their versions are not stored with each run. A comparative study must document the configuration used for each condition.

**ECP has measurement noise that must be quantified before it carries a claim.** Historical private development observed different ECP on identical inputs, so a single run cannot establish a stable estimate. Individual live-run values are retained only in the private research archive. Since a `latent` verdict turns on ECP crossing 0.5, repeatability must be assessed under the study configuration. The prototype retains each run's ECP. Predictability is unaffected because it is deterministic.

# 4. Measures

**Primary — beyond-baseline discovery.** The count and proportion of validated opportunities classified `latent`. Reported with the predictability × ECP scatter; the shaded upper-left region is the finding.

**Primary — human–machine alignment.** Agreements ÷ (agreements + disagreements) over machine recommendations. Both directions matter: agreeing that a pair *should not* connect is as informative as agreeing that it should.

**Secondary.** Distribution of ECP and of the divergence (ECP − predictability); rate of honest negatives; per-mechanism contributions for latent pairs (which mechanism's absence characterises them); time-to-decision; provider/model comparison where the same pair was run more than once.

**Manipulation check.** The deliberate poor-fit case (marine geochemistry against information systems) must yield `none`. If it does not, the sycophancy countermeasures have failed and results are not interpretable.

# 5. Proposed procedure

1. **Assemble the private study pool.** Use a separately governed private study copy and ignored runtime stores for verified participant profiles and data sources (Pure export when available; the AI scout in the interim). Do not replace the shared fictional seed or commit personal study data.
2. **Verification (Step 2).** Each real researcher reviews and corrects their own representation and ticks *verified*. Unverified profiles are excluded from the primary analysis.
3. **Fix the trigger(s).**
4. **Baseline.** Computed automatically; export the predictability of every pair before any conversation.
5. **Probe** under the recorded sampling plan and study configuration.
6. **Validation (Step 4).** The interface records one agree / worth discussing / disagree response per run, with an optional note. The planned independent and researcher-specific assessments are described in the [technical appendix](TECHNICAL_APPENDIX.md).
7. **Analysis.** From the run files: classification counts, alignment, divergence distribution, threshold robustness.
8. **Archive** the condition (Findings → *Start a fresh experiment*) before beginning the next; the archive manifest is the boundary marker between conditions.

# 6. Data and instruments

Run files retain the implemented assessment outputs and available provenance (see the Technical Specification, §5.1). A participant study may require additional evaluation records and the matching code revision; the [technical appendix](TECHNICAL_APPENDIX.md) describes the planned evaluation.

Qualitative material worth collecting alongside: researchers' free-text notes at validation, and short debriefs on *why* they accepted or declined. These explain divergences that numbers alone cannot.

# 7. Threats to validity

| Threat | Mitigation | Residual risk |
|---|---|---|
| Sycophantic agreement | ground rules, honest-failure design, poor-fit manipulation check | agents may still over-endorse; report the negative rate |
| Representation error | researcher verification; scout provenance and caveats | verified profiles still reflect self-presentation |
| Small graph | institutional-scale data (Pure) | seed-pool results are illustrative, not estimates |
| Validator is also an author | independent validators where possible; blind to condition | conflict of interest must be declared |
| Threshold arbitrariness | preregistration + robustness appendix | classification boundaries remain stipulated |
| Model drift over time | model recorded per run; date-stamped | replication may not reproduce exactly |

# 8. Development stage

The submission presents the current prototype and a proposal for further development. Participant evaluation and the agent-arena extension belong to a subsequent research stage. The current technical appendix describes the proposed pilot and the distinction between implemented feedback and planned independent evaluation.
