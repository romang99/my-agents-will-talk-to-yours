---
title: "ResearcherConnect — History and Decision Log"
subtitle: "How the project got here, and why it is the way it is"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "October 2026"
---

> The code records *what* was built. This document records *when* and *why*, so a
> collaborator can distinguish deliberate choices from accidents and identify open
> decisions. This is a technical summary of project history, not a reproduction of
> private meeting quotations, personal profiles or individual live-run records.

# Part 1 — Timeline

**June 2026 — planning.** Nadine Ostern and Marek Kowalkiewicz began planning
LLM-agent prototypes for research-team formation. The staged-conditions idea
(representation depth L0 vs L0+L2) dates from this phase.

**8 July 2026 — the call and the plan.** The *Organization Science* "AI-Assisted
Frontiers in Organizational Science" call for prototypes informed the project plan.
Two success measures emerged: **human–machine alignment** (whether humans endorse
model-proposed connections) and **beyond-baseline discovery** (whether suggested
connections go beyond established predictors of tie formation). Both remain primary.

**July 2026 — SyncMinds v0.1.** A Python/Streamlit prototype used four rounds
(self-assessment, exploration, team assembly, pitch negotiation) around a call-for-papers
trigger. It established the persona mind-file format, an honest-failure test case,
the provider pattern (including a `claude -p` driver) and audit-trail discipline.

**24 July 2026 — ResearcherConnect v0.2.** Rebuilt as a local-first Node application
with a star-chart interface, the pair as the unit of analysis and a deterministic
tie-formation baseline. Design reviews introduced two changes: conversations are
anchored to an explicit **opportunity trigger**, and agents practise **recognition,
not invention** (judge whether humans should meet rather than draft research agendas).
The screening-loop design was sketched and remains unimplemented.

**25 July 2026 — the AI scout.** Public-web research can draft profiles with cited
sources; saving requires human review. Full representation editing was added,
including multiple affiliations.

**27 July 2026 — code review pass.** Tests established auditable invariants: one
implementation per measure, named thresholds and weights, explanations reading the
actual computation, overrides recording human corrections, specificity-ordered
routing, a shared palette and no silent truncation. The appendix draft began
calling this v0.3.

**August 2026 — repeatability and reset.** Private development showed that model
outputs can vary under identical inputs. Repeated evaluation became a protocol
requirement. Reset-by-archiving was added to separate experimental conditions while
preserving evidence privately. The protocol, ethics statement, specification, guide
and PDF build were documented. These observations are historical context, not
results from the distributed synthetic examples.

**Late August / September 2026 — prose and robustness.** Persona, conversation and
synthesizer prompts were revised for plain prose and concrete explanations. A code
review addressed stale trigger reconciliation, shared reset handling across UI and
event streams, atomic archive-directory claims with manifests on partial failure,
validated reset scopes and document titles in the PDF build.

**10 September 2026 — the judge pivot.** Private development highlighted unsupported
profile claims propagating into output, dialogue reaching beyond available evidence,
and briefs repeating conversations. A search-centric redesign was sketched and
parked. The measurement approach shifted to **one model, one binary question,
repeated and averaged across models**. Judge mode was added with named prompt
variants, a tally view, demo support and tests. Sampling behaviour and possible
yes-bias remain methodological questions; individual private results are not
reproduced here.

**Late October 2026 — documentation and handover.** The documentation set was
prepared for collaborators. Roman Geist takes the repository and technical appendix;
Nadine Ostern and Marek Kowalkiewicz write the proposal. The prototype is framed as a
recommendation system with open research questions. A future agent-arena concept
(teams, bids, manager agents and negotiation) is not implemented. The shared code
repository distributes fictional synthetic profiles and offline demo examples only.
Details: [HANDOVER](HANDOVER.md).

# Part 2 — Decision log

Each entry records the decision, reason, rejected alternatives and status.
Entries marked **open** are the authors' to settle.

| # | Decision | Why | Rejected alternatives | Status |
|---|---|---|---|---|
| D1 | **The pair is the unit of analysis.** | Tie-formation theory is about dyads; pairwise ECP can compose into teams later. | Teams as the unit (SyncMinds). | settled; teams parked |
| D2 | **Classification is code, not a prompt.** `latent` / `borderline` / `predicted` / `none` is a pure function of predictability and ECP. | The measure must be auditable and recomputable from a run file. | Asking the model whether a pair is latent. | settled |
| D3 | **Every run is anchored to an opportunity trigger.** Its text is snapshotted. | Quality needs a concrete reference; later trigger edits must not rewrite evidence. | Open exploration only (retained as a comparison condition). | settled; trigger-as-focus framing **open** (protocol §2) |
| D4 | **Recognition, not invention.** Agents judge whether humans should meet, not draft research questions. | Fluent invented agendas are not evidence of a useful connection. | Briefs as mini-proposals. | settled |
| D5 | **Honest failure is designed in.** A poor-fit synthetic researcher (Lena Fischer) must yield `none`. | A manipulation check helps detect sycophancy. | Tuning until every pair works. | settled |
| D6 | **Local-first, vanilla, no build step, one optional dependency.** | Reviewers and collaborators should run it with Node alone; external flows are explicit model calls. | Framework front end; hosted deployment. | settled |
| D7 | **Provider chosen per run; demo is first-class.** | Offline tests and credential-free demos must track prompt and schema changes. | A global provider switch. | settled |
| D8 | **ECP is computed in code, once per mode, and stored.** | Screen values must equal provenance values. | Browser recomputation; asking the model for the final score. | settled |
| D9 | **Weights and thresholds are named constants.** 0.30/0.20/0.20/0.30; latent < 0.25 and ECP ≥ 0.5; predicted ≥ 0.5. | Preregistration needs fixed values; robustness should reanalyse stored numbers. | Fitting weights to outcomes. | settled; values **open** until preregistered |
| D10 | **The seed pool is immutable at runtime; additions, tombstones and field deltas are layered.** | Overrides record human corrections as Step 2 evidence in the private study copy. | Editing the seed file in place. | settled |
| D11 | **Reset archives, never deletes.** Atomic directory claim and manifests. | Preserve private research evidence across conditions; reconcile retention with data minimisation. | Deleting runs. | settled; disposal point **open** (ethics §7) |
| D12 | **Prompts use plain prose.** | Prompt wording affects the output's register and is an experimental parameter. | Post-processing model output. | settled; see D14 |
| D13 | **Judge mode repeats binary votes across models; ECP is the share in favour.** | Model judgments can be evaluated without long agent conversations. | Verbalised probabilities; replacing judgment with structural distance. | settled as primary instrument |
| D14 | **Judge prompt variants are experimental factors.** Named, selected per run and snapshotted. | Similarity versus complementarity should be tested; silently changing wording invalidates comparisons. | One tuned prompt. | settled |
| D15 | **Conversation mode stays.** | A documented approach with limitations and a possible explainer for latent finds. | Deleting it. | settled |
| D16 | **Markdown is document source; PDFs are build output.** | Diffable, reviewable source avoids binary churn. | Word documents. | settled |
| D17 | **Verification is the subject's act.** A real profile remains unverified until its subject reviews it; AI refresh never verifies it. | Cited sources do not establish that the representation is accepted by its subject. | Treating citations as verification. | settled; live-use verification guard **open** (STATUS §4) |
| D18 | **The repository ships independently fictional synthetic profiles and offline demo examples only.** | No real profile, human correction or live run belongs in the shared code repository, including author data and data consented for private study. | Publishing private study artifacts for transparency. | settled; run PUBLISHING_CHECKLIST before every push |
| D19 | **Screening-loop and search-centric redesigns are parked.** | Judge mode is cheaper to evaluate; matching by push versus pull remains unresolved. | Building them immediately. | parked |
| D20 | **Light chart-room palette, no dark mode.** | Consistent visual presentation and colour-vision accessibility. | Dark theme. | settled |
| D21 | **Repeats must sample a distribution.** | Repeated calls may be effectively deterministic; API sampling controls need evaluation. | Assuming repetitions provide independent variance. | **open** |
| D22 | **Several Anthropic models are not independent judges.** | Shared training can correlate judgments; cross-vendor evaluation tests generality. | Treating model-family agreement as independent. | **open** |
| D23 | **Judge all unconnected pairs or a predictability-stratified sample.** | The baseline being evaluated cannot also select the candidates. | Predictability-filtered shortlists. | settled in principle; sample size **open** |

# Part 3 — Interpretation cautions

- **Existing collaborations need not plot in the latent corner.** Shared settings,
  seniority, methods and ties can make them structurally predictable. The chart
  should represent that rather than manufacture novelty.
- **ECP can vary under identical inputs.** Sampling noise motivates repeated
  measurement and must not be mistaken for an effect of a changed prompt.
- **Unanimous votes are not automatically a tally bug.** They motivate checks for
  yes-bias and lack of sampling variance; unanimity alone does not validate the instrument.
