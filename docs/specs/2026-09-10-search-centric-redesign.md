# From pairs to searches — redesign notes (not yet implemented)

**Date:** 2026-09-10
**Source:** Project design review by Marek Kowalkiewicz and Nadine Ostern
**Status:** design for discussion — no code changes. Evolves, does not replace,
`2026-07-24-screening-loop-design.md`.

## Lessons from private development

The following are historical methodological observations from private development,
not results from the synthetic fixtures distributed in this repository. Individual
profiles, run outputs and meeting quotations are not reproduced here.

1. **Unverified profile claims can propagate.** AI-assisted profile drafting can
   introduce fabricated or stale claims. If a draft is used before verification,
   those claims can pass into a conversation and then into its brief. A verification
   control must be enforced by the workflow, and profiles need periodic review.
2. **Free dialogue asks questions only humans can answer.** Agents may reach for
   evidence absent from the supplied profiles, then invent it or stall. Improving
   prose does not resolve this limitation of the instrument.
3. **The brief can repeat the conversation.** A summary may add little for someone
   who watched the full exchange, even though it can help someone who did not. This
   suggests demoting the conversation as the primary interaction.

## Design shifts considered

### A. Unit of work: pair → search

Today the operator picks a pair and runs it. A one-to-many search would instead
start with a seeker who has an opportunity and wants to find collaborators across
institutions. The pair becomes a leaf; the object the human owns is a **search** —
seeker + trigger + preferences → candidates → a ranked, explained shortlist.

### B. Human breakpoints move from the end to the middle

Currently the only human act is validation after the run. Two earlier interventions
were proposed:

- **Seeker interview** (before anything runs). Establish the desired collaborator,
  whether similarity or a different perspective is useful, whether a project idea
  already exists, and constraints such as timing, role and career stage.
- **Candidate check-in** (mid-search). Before responding, a candidate's agent asks
  its human whether the opportunity is relevant, what they would contribute, and
  whether they are willing and available. The agent carries that answer back.

The process becomes a **semi-structured interview** with fixed question blocks and
defined human interventions, rather than free chat. This applies the principle of
strategically positioned breakpoints to the process itself.

### C. Predictability becomes a preference dimension, not a score to minimise

Similarity can help a team get started, while a different perspective may be useful
for transdisciplinary work. A chart could reveal well-covered and underrepresented
areas without assuming one direction is always better.

Two things must not be confused:

- The **research claim** is unchanged: a latent opportunity is one the tie-formation
  baseline does not predict and humans nonetheless endorse. That is what the paper measures.
- The **product** lets the seeker state where on the predictability axis they want
  to look, such as structurally unlikely connections or complementary work within
  a familiar institutional setting.

### D. Matching: push (shortlist) or pull (announce and respond)

**Push.** The seeker's agent scores candidates and shortlists. The selection
criterion matters: using predictability would make the comparison baseline part
of the selection process. Shortlisting would need a separate basis, such as
relevance to the trigger and stated preference, with predictability held out.

**Pull.** The seeker's agent announces the opportunity and preferences. Other
agents, briefed by their owners on interests, skills and willingness to
collaborate, decide whether to respond. Coordination is distributed. Predictability
can then be computed on respondents as a separate comparison, although selection
effects still need to be reported.

Costs and limitations of pull:

- **Compute is the same.** Every agent must read every announcement and decide —
  N LLM calls per announcement, as in a scan. Pull changes who decides, not the
  asymptotic cost.
- **Responses need validation.** An agent's assertion of its human's interest and
  fit needs confirmation. The candidate check-in in §B is one possible control.
- **Selectivity / spam.** Unselective responses can flood the seeker and pester
  candidates. A cadence could approach a small set first and widen only if needed.

A hybrid is plausible: announce to a preference-filtered set rather than everyone,
with predictability still held out of the filter.

## What survives, what changes

| Survives unchanged | Changes |
|---|---|
| `baseline.js` — mechanisms, weights, ECP, classification | `pipeline.js` — a *search* record containing candidate evaluations |
| One JSON file per unit of evidence | `conversation.js` — structured question blocks, not free dialogue |
| Profiles, verification, the scout (with a guard — see below) | new stage: seeker interview |
| Providers, reset/archive, tests | new stage: candidate check-in (async, human-gated) |
| The star chart | UI centre of gravity: the search rather than a selected pair |

## Decisions before any code

1. **Push, pull, or hybrid** (§D). Determines the data model.
2. **What the agents actually do.** Recommendation: fixed question blocks answered
   by humans, or by agents from verified profiles with that distinction marked,
   followed by an agent-to-agent comparison step. Retain dialogue only where useful.
3. **Predictability: filter, comparison, or both?** It cannot be both on the same pairs.
4. **Cadence.** How many candidates per round; when to widen; when to stop.
5. **What counts as a candidate's consent** to be approached (DATA_ETHICS §5).
6. Still parked: teams vs pairs; the trigger-as-focus framing.

## Verification requirements

- A real researcher's AI-refreshed profile must be reviewed by its subject before
  live study use. The workflow needs a guard against using an unverified draft.
- Fabricated claims, stale reflections and human corrections require review in
  the separate private study copy; none belongs in the shared repository.
- This repository distributes independently fictional synthetic profiles and
  offline demo examples only. Real profiles, corrections and live runs remain
  excluded even where a participant has consented to a private study.

---

# Part 2 — the pivot to judges

The design review then considered a cheaper alternative to the search redesign:

1. **Success measure.** Compare model-assisted discovery with the predictability
   baseline, and measure human endorsement rather than treating a shortlist as success.
2. **Latency.** The target remains connections a researcher would not otherwise
   consider through existing ties, represented by the chart's latent region.
3. **Human intervention.** Present latent finds and count how many humans endorse.
   Validation already exists; a credible comparison condition still needs study design.
4. **Structured comparison.** Topic alignment or deliberate difference,
   collaboration style, industry focus and methods can be compared explicitly.
   A normalised research-distance score over methods and interests would be a
   separate structural measure, and must not silently replace model judgment.
5. **Collect study data.** Synthetic fixtures demonstrate the software, but cannot
   establish real-world validity. A separately governed study needs verified real
   profiles, appropriate sampling, human feedback and co-design with participants.
6. **One call, one judge.** Give a model both profiles and the opportunity; ask
   whether the researchers should collaborate, with a binary answer and reason.
   Repeat the query and average across repeats and models. The question becomes
   whether model judgment predicts endorsed collaborations better than the baseline.
7. **Research account.** Report the limitations of conversational agents, including
   unsupported claims, and evaluate the alternative instrument without presenting
   historical private development observations as synthetic benchmark results.
8. **Practicalities.** Short judge calls reduce subscription and token costs, and
   can be implemented within the current application before a larger redesign.

## How the judge design maps onto what exists

ECP is already a judgment on [0, 1]. Everything downstream remains unchanged:
`classify()`, `THRESHOLDS`, the scatter and its latent region, validation,
alignment, provenance, reset, and the per-run provider switch. The **producer**
of ECP changes:

| Conversation design | Judge design |
|---|---|
| 6 conversation turns + 1 synthesis + 1 assessment = 8 long calls | k repeats × m models of one short call (two profiles + trigger → 0/1 + one sentence) |
| ECP = f(relevance, complementarity, feasibility) | ECP = mean vote across repeats and models |
| brief + transcript for the human | the judges' one-line reasons for the human |
| `claude-cli` sufficient | API path matters for sampling controls |

Implementation sketch: `agents/judge.js`; a run `mode: 'judge' | 'conversation'`
chosen per run like the provider; `judgments: [{ model, votes: [0|1…], reasons: [...] }]`
and `ecp` as the mean; a deterministic demo judge and tests. Conversation mode stays
as a documented approach with limitations and a possible explainer for latent finds.

## Design points to settle

1. **Repeats are not optional.** Private development showed variation under
   repeated conversation-mode inputs. Sampling and repeatability need evaluation;
   a verbalised probability is not a calibrated measure by itself.
2. **Temperature.** Repeats yield a distribution only with stochastic sampling.
   The CLI provider exposes no temperature control; the API does. The API path
   and cheaper models may suit repeated judge calls.
3. **Similarity versus complementarity is an experimental factor.** An unguided
   judge may reward topical overlap and track predictability. Compare named
   unguided and complementarity-guided prompt conditions, fixed before evaluation
   (RESEARCH_PROTOCOL §3.3).
4. **Judge every pair, or a predictability-stratified random sample.** Do not
   filter candidates by the baseline being evaluated. For example, C(100, 2) =
   4,950 pairs × 10 repeats × 3 models is roughly 150,000 calls, motivating a
   stratified sample. These are study-planning calculations, not live-run results.
5. **Several Anthropic models are not independent judges.** Shared training can
   produce correlated agreement. A cross-vendor driver helps test generality.
6. **A judge must give a reason.** Ask for a binary vote plus a plain sentence
   the human can assess. Agent conversation might remain an optional explainer
   downstream rather than the measurement instrument.
7. **The profile is the instrument.** Judge = f(profiles, trigger). Unsupported
   profile claims can reach judges just as they reach conversational agents;
   verification before live study use is a validity requirement.
8. **Research distance is a third series.** Keep graph-based predictability,
   profile-similarity distance and model judgment distinct. Agreement between
   them can be a finding rather than an implementation objective.

## Interpreting an existing collaboration

Existing collaborators need not appear in the latent region. Shared institutional
settings, seniority, methods and graph ties can make a pair structurally
predictable. A high collaboration judgment does not imply low predictability;
the chart should represent both measures honestly.
