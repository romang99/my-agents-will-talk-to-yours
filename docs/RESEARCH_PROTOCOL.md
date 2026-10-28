---
title: "ResearcherConnect — Research Protocol"
subtitle: "Study design, measures and procedure (working draft)"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "July 2026"
---

> **Status: working draft for discussion.** Sections marked **[DECIDE]** are open
> questions for Nadine and Marek to settle before any data collection. Nothing here
> is preregistered yet; the point of the document is to make the choices explicit
> enough that they *can* be.

# 1. Research question

> How does LLM-mediated interaction construct latent scientific collaboration opportunities beyond established mechanisms of tie formation?

A **latent collaboration opportunity** is a potentially valuable basis for joint research that (a) has not developed into a social tie and (b) is unlikely to become visible through established tie-formation mechanisms alone.

The claim under test is not that the system finds *good* collaborations — it is that it finds collaborations that classical structure does not predict, and that humans nonetheless endorse.

# 2. Why a trigger does not undermine the design

Early runs let agents invent research agendas freely; the results were fluent but inauthentic. The design now anchors every conversation to a concrete **opportunity trigger** (a call for papers, grant scheme, or project brief).

This does not weaken the latency claim. Tie-formation theory explains *how ties form*, not *how good a collaboration would be*. The baseline's blind spot is quality, and the trigger is what makes quality assessable. Collaboration quality is itself trigger-dependent: a roboticist and a chemist may be an excellent pairing for one call and a poor one for another.

A residual subtlety worth stating in the paper: a call for papers is itself an organisational focus in Dahlander & McFarland's sense. The defensible framing is that the system manufactures focality that did not exist socially — neither researcher was attending to that opportunity together. **[DECIDE]** whether to make this a theoretical contribution ("agents as synthetic organisational foci") or a limitation.

# 3. Design

Unit of analysis: the **researcher pair**. Teams are out of scope for the first study; a defensible extension is team potential as the product of pairwise ECPs (one weak member collapses the team), which is recorded here as future work.

## 3.1 Conditions **[DECIDE]**

Candidate manipulations, in rough order of value:

| Condition | Manipulation | Tests |
|---|---|---|
| **A. Trigger** | trigger vs open exploration, same pairs | whether anchoring changes what is found and whether humans endorse it |
| **B. Representation depth** | L0 profile only vs L0 + recent reflections (+ L1 publication corpus) | whether richer mind files change conversation quality and ECP |
| **C. Human intervention** | no intervention vs mid-conversation steering | the "strategically positioned breakpoints" idea |

Within-pair designs are preferred (same pair under both levels), since the pair is its own control. Order effects are not a concern because the system has no memory across runs — but the *human* validating both does, so **[DECIDE]** whether validation is blind to condition.

## 3.2 Sampling of pairs

Probe unconnected pairs in ascending predictability — the front of the queue is where classical theory predicts least, so a discovery is most diagnostic. **[DECIDE]** whether to sample the full unconnected set (feasible at n ≈ 12; 59 pairs) or the lowest-*k* stratum, and whether to include a stratified sample of higher-predictability pairs as a comparison group. Including them is methodologically stronger: without them there is no evidence that the system *discriminates* rather than simply endorsing everything.

## 3.3 Preregistered parameters

Fixed before data collection and reported verbatim:

| Parameter | Value | Where |
|---|---|---|
| Mechanism weights | foci 0.30, homophily 0.20, cumulative advantage 0.20, triadic closure 0.30 | `WEIGHTS` |
| `predicted` threshold | predictability ≥ 0.50 | `THRESHOLDS` |
| `latent` thresholds | predictability < 0.25 **and** ECP ≥ 0.50 | `THRESHOLDS` |
| Conversation length | 6 turns | `TURNS` |
| Model | `claude-opus-4-8` (or CLI equivalent) | run provenance |

Weights and thresholds are **stipulated, not fitted**. A robustness appendix should report how classifications shift under alternative thresholds — the run files contain both raw numbers, so this is a re-analysis, not a re-run.

**Prompt wording is a preregistered parameter too**, and must be frozen before a condition opens. The persona, conversation, synthesizer and assessor prompts shape the 1–5 ratings that ECP is computed from, so runs made either side of a prompt edit are not comparable. **[DECIDE]** whether to record a prompt version (or hash) on each run, so provenance states which wording produced a score; nothing does this today.

**ECP has measurement noise that must be quantified before it carries a claim.** Historical private development observed different ECP on identical inputs, so a single run cannot establish a stable estimate. Individual live-run values are retained only in the private research archive. Since a `latent` verdict turns on ECP crossing 0.5, the study needs a test–retest check: **[DECIDE]** how many repeat runs per pair, and whether the reported ECP is a single run or the median of *k*. Predictability is unaffected because it is deterministic.

# 4. Measures

**Primary — beyond-baseline discovery.** The count and proportion of validated opportunities classified `latent`. Reported with the predictability × ECP scatter; the shaded upper-left region is the finding.

**Primary — human–machine alignment.** Agreements ÷ (agreements + disagreements) over machine recommendations. Both directions matter: agreeing that a pair *should not* connect is as informative as agreeing that it should.

**Secondary.** Distribution of ECP and of the divergence (ECP − predictability); rate of honest negatives; per-mechanism contributions for latent pairs (which mechanism's absence characterises them); time-to-decision; provider/model comparison where the same pair was run more than once.

**Manipulation check.** The deliberate poor-fit case (marine geochemistry against information systems) must yield `none`. If it does not, the sycophancy countermeasures have failed and results are not interpretable.

# 5. Procedure

1. **Assemble the private study pool.** Use a separately governed private study copy and ignored runtime stores for verified participant profiles and data sources (Pure export when available; the AI scout in the interim). Do not replace the shared fictional seed or commit personal study data.
2. **Verification (Step 2).** Each real researcher reviews and corrects their own representation and ticks *verified*. Unverified profiles are excluded from the primary analysis. **[DECIDE]** whether unverified profiles may appear as the *other* side of a pair.
3. **Fix the trigger(s).**
4. **Baseline.** Computed automatically; export the predictability of every pair before any conversation.
5. **Probe** per the sampling plan. One run per pair per condition.
6. **Validation (Step 4).** The focal researcher records agree / worth discussing / disagree, with an optional note. **[DECIDE]** whether both members of a pair validate independently — methodologically better, logistically harder.
7. **Analysis.** From the run files: classification counts, alignment, divergence distribution, threshold robustness.
8. **Archive** the condition (Findings → *Start a fresh experiment*) before beginning the next; the archive manifest is the boundary marker between conditions.

# 6. Data and instruments

Each run yields a complete provenance file (see the Technical Specification, §5.1): trigger, every turn, all scores, model identity, and the human decision. Analysis needs no instrumentation beyond these files.

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

# 8. Open questions **[DECIDE]**

1. Conditions to run, and in what order (§3.1).
2. Sampling: full unconnected set, or lowest-*k* plus a high-predictability comparison group (§3.2).
3. One validator per pair or both members (§5.6).
4. Blinding of validators to condition (§3.1).
5. Whether unverified representations may appear on either side (§5.2).
6. Trigger framing in the paper: contribution or limitation (§2).
7. Screening loop (`docs/specs/2026-07-24-screening-loop-design.md`): whether a lexical pre-filter before LLM screening is acceptable, and whether researcher comments scope to one pair or to all of that researcher's pairs.
8. Whether "defer" and similar prototype affordances are switched off for the study.
9. Repeat runs per pair, and whether reported ECP is one run or the median of *k* (§3.3).
10. Whether each run records the prompt version that produced it (§3.3).

# 9. Timeline

Submission (short paper, technical appendix, Git repository) is due end of 2026; a finished prototype is not required at submission, and a year of development follows acceptance. The near-term critical path is therefore: **Pure data access → representation verification by real researchers → a first condition with live runs**, not further feature work.
