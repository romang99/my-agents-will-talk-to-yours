---
title: "ResearcherConnect — Status"
subtitle: "Where things stand, what the live runs have shown, what is open"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "31 October 2026"
---

> A snapshot. Update the date when you change it. For the *why* behind anything here,
> see [DECISIONS](DECISIONS.md); for the study design, [RESEARCH_PROTOCOL](RESEARCH_PROTOCOL.md).

# 1. In one paragraph

The prototype is complete enough to run a study on and has not yet been used for one. Both
run modes work end to end (demo, Claude Code CLI; the API path is coded but unexercised).
The test suite is green (offline tests). Historical private development raised concerns
about measurement variability, profile verification and judge discrimination. The critical
path is study data and decisions: verified profiles in the separate private study, a
poor-fit comparison, a sampling plan and compliance with the publishing checklist.
Individual live-run records and measurements are not distributed.

# 2. What works

| Area | State |
|---|---|
| Baseline (four mechanisms, composite, per-mechanism explanation) | done, tested, shown in UI |
| Persona composition from profiles | done |
| Conversation mode (6 turns, synthesis, brief, ECP from sub-scores) | done; prompts rewritten for plain prose in September 2026 |
| Judge mode (k repeats × m models, 0/1 + one sentence, ECP = share in favour, live tally) | done, tested; private live development only |
| Judge prompt variants `unguided` / `guided`, snapshotted into runs | done; `guided` not yet used live |
| Classification, Findings scatter, decision recording, alignment | done |
| Resumable runs (idempotent stages; judge runs recast only missing votes) | done, tested |
| Opportunity triggers, snapshotted | done |
| Researcher add / edit / remove, AI scout with citations, verification flag | done |
| Reset = archive with manifest, atomic, two scopes | done, tested |
| Providers: `demo`, `claude-cli` (`opus`/`sonnet`/`haiku`) | done, used live |
| Provider: `anthropic` SDK (streaming, adaptive thinking, judge models) | coded, **not run live** (no key on the dev machine) |
| Documentation set, PDF build | done |

# 3. What the live runs have shown

All live runs used the Claude Code CLI with the Org Science call as the trigger. Only aggregate methodological observations are summarised here.

The private development archive supports the following methodological observations:
conversation-mode ECP varied on identical inputs, and unguided judges sometimes responded
unanimously. Individual live-run scores, personal profiles, persona prompts and live
transcripts are not distributed here. These are historical observations, not measurements
from the current fictional seed pool. Separately, the synthetic poor-fit conversation
case produced ECP 0 in offline demo testing.

**Observations a collaborator must weigh before trusting any number:**

1. **The unguided judge may be a yes-machine.** Historical private development raised
   this concern. Evaluate a poor-fit comparison before interpreting a `latent` verdict
   as evidence that the instrument discriminates.
2. **Repeats may lack sampling variance.** Repeated identical answers can indicate
   near-deterministic sampling, so averaging calls may not average over a distribution. The API path exposes sampling parameters and should be used for the study
   (the SDK driver leaves sampling at the API default, which is what adaptive thinking
   requires). Untested here.
3. **Existing ties leak through profile text.** A profile may name an existing
   collaborator, exposing the same tie the structural baseline is meant to assess.
   Strip collaborator names from live judge prompts or report this as a confound.
4. **Profiles hallucinate and rot.** Private development encountered fabricated or
   stale profile claims. Live-study representations must be verified by their subjects
   before use. The distributed seed contains fictional personas only.
5. **Several Anthropic models are not several judges.** Opus, Sonnet and Haiku agreeing is
   weak evidence of anything. A cross-vendor driver is a small addition (the interface is
   `system + prompt → text`).
6. **Conversation-mode ECP needs repeatability checks.** Historical development found
   variation under identical inputs. Plain-prose prompts changed the register without
   resolving the instrument's limitations. Treat a single result cautiously.

# 4. Known gaps, not yet built

- **Verification guard.** A loud warning (or a block) when a live run would use a real
  researcher's unverified profile. This guard is not implemented in the current release.
- **Collaborator-name filter** for judge prompts (observation 3).
- **Cross-vendor judge driver** (observation 5).
- **Prompt version on conversation runs.** Judge runs snapshot the full prompt; conversation
  runs do not record which persona/conversation/synthesizer wording produced them
  (RESEARCH_PROTOCOL §3.3).
- **Verification as a timestamped, attributed event** rather than a boolean (ethics §4).
- **Participant access to every run they appear in** (ethics §6).
- **Withdrawal from past run records** (ethics §5): manual archiving only.
- **QUT Pure import, OpenAlex**: not started / paused.
- **Screening loop, search-centric redesign** (`specs/`): designed, parked.
- **Repository hygiene for sharing**: handled for this repository, which is a clean snapshot
  cut on 28 October 2026; live runs and all real-person profiles stay in the private development
  clone. Keep it that way: [PUBLISHING_CHECKLIST](PUBLISHING_CHECKLIST.md).

# 5. Study and publication status

The current release supports prototype demonstration and pair assessment. No formal study is reported. Participant evaluation requires a separately governed study with reviewed representations, appropriate comparison conditions and documented measurement provenance; see [RESEARCH_PROTOCOL](RESEARCH_PROTOCOL.md) and [DATA_ETHICS](DATA_ETHICS.md).

The implemented feedback records one response per run. Independent assessment of research sketches and separate judgments from the represented researchers are proposed in the [technical appendix](TECHNICAL_APPENDIX.md). Agent-arena mechanisms remain future development.

The repository includes an MIT licence crediting Marek Kowalkiewicz and Nadine Ostern. Whether institutional ownership requires a different copyright holder is not established in this documentation; the licence attribution is unchanged by this documentation revision.
