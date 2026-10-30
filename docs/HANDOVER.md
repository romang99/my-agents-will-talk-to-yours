---
title: "ResearcherConnect — Handover"
subtitle: "What the next person needs to do, and what the paper now expects of the prototype"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "October 2026"
---

> Written for Roman Geist, who joins the project in October 2026 and takes over the
> repository and the technical appendix. Decisions from the late-October planning call
> (Marek, Nadine, Roman) are recorded here so they do not live only in a transcript.

# 1. What the call requires

The *Organization Science* Call for Prototypes wants three things:

1. **A short proposal**, at most 2,000 words, written to catch interest rather than to
   report results ("a Nature-description type of paper"). Nadine and Marek write it.
2. **A technical appendix** with the details needed to evaluate and understand the work.
   Roman drafts it from this documentation; the source map at the top of
   [TECHNICAL_APPENDIX](TECHNICAL_APPENDIX.md) says which document feeds each section.
3. **A GitHub repository or equivalent artifact** containing the prototype. It must be
   public, or reviewers cannot see it. Roman sets it up; it may be a different repository
   from the one this snapshot came from.

Development proper, if accepted, runs through 2027. A finished system is not expected at
submission. What is expected is a working first take plus an honest account of what it
showed and what comes next.

# 2. The repository you were given

This is a **clean snapshot**, created 28 October 2026, of the development repository.
It contains:

- the complete application and tests (`npm test` must pass before anything else);
- ten fictional synthetic personas and a fictional collaboration graph;
- two demo-mode runs on synthetic pairs under `data/examples/`, so reviewers can see what a
  run record looks like without running anything;
- the full documentation set.

It does **not** contain: any live run, any real-person profile (including author profiles),
the human-correction overrides, the verbatim working-session transcripts, or the git
history of the development repository. Those stay in Marek's private clone, which remains
the archive the paper cites. The policy is [DATA_ETHICS](DATA_ETHICS.md) §7; the procedure
is [PUBLISHING_CHECKLIST](PUBLISHING_CHECKLIST.md). Keep both when you push: the ignore
rules in `.gitignore` make it hard to commit live evidence by accident, not impossible.

Before pushing, run the checklist once. The licence is MIT (`LICENSE`).

# 3. How the paper frames the prototype now

Three positions were settled on the planning call:

- **The prototype is submitted as the first take**, with its open questions stated: how
  to validate, and which instrument is better, agents talking to each other or judges
  voting. [STATUS](STATUS.md) §3 lists what the live runs have shown; the appendix's
  limitations section is built from it.
- **It is a recommendation system, not a decision-making system.** Nadine's point:
  matching (finding people for a call) and deciding (what the team does, who leads, where
  in the call the gap is) are separate steps and must not be mixed. A 2×2 of {matching,
  deciding} × {AI, human} is a useful way to say who does what. The prototype does matching
  and leaves deciding to the humans; that is a feature of the design, not a gap.
- **The next stage is an "agent arena".** Instead of comparing tie-formation theory with
  ECP pair by pair, agents representing researchers would be put into a structured
  environment and observed. Roman's candidate mechanics, to be tried and compared rather
  than chosen up front: teams drawn from scratch and evaluated on sketched work; bids with
  the highest bid rewarded; manager agents that assemble teams by needed skill and
  seniority (a professor for one task, a student for a cheaper one); negotiation in large
  and small groups (two agents deciding which of several experts fits). The guiding idea:
  shift the hardest step, evaluation, to the strongest model and keep the easy steps simple.
  Start with plain matchmaking and build up.

None of the arena work exists in code. The appendix should describe it as the planned
development, clearly separated from what was built.

When reading this handover, distinguish the implemented pair-assessment prototype from the planned arena described in the [current technical appendix](TECHNICAL_APPENDIX.md).

# 4. Naming

**Current submission title (30 October 2026):** *WELCOME TO THE JUNGLE: AGENT ARENAS, UNLIKELY COLLABORATIONS, AND THE SEARCH FOR SCIENTIFIC IDEAS THAT MATTER*.

The following naming ideas are retained as historical notes from the planning call: "agent arena";
something with the energy of *This is Sparta* or *Gladiator* for the title; a plain
subtitle such as *Design Principles for Agent-Based Assessment of Research Collaborations*.
Roman's thesis working title: *Transforming research tasks into tailored teams: a
multi-agent architecture for competency- and preference-aware task assignment*. The
implemented prototype retains the name ResearcherConnect.

# 5. Practicalities for Roman

- **Model access.** A personal Claude subscription is enough to run judge mode on a
  handful of pairs ([ONBOARDING](ONBOARDING.md) §5 has the budget levers). If limits bite,
  Marek can assign a seat on a Claude Team subscription for the project's duration.
  ChatGPT or another vendor can be added as a judge with a small driver
  ([CONTRIBUTING](../CONTRIBUTING.md), "Add an LLM provider"); a second vendor also answers
  the "are three Anthropic models three judges?" objection.
- **Privacy setting.** In the Claude app, turn off the thumbs-up/thumbs-down feedback
  option in Settings; otherwise rated conversations are shared with the provider.
- **Compute.** QUT's high-performance computing team can provide a machine for larger
  local models once the need is specific (RAM, model size, runtime). Marek has given them
  notice; tell him what you need.
- **Order of work.** The paper is the priority: repository, then appendix. Product-box
  descriptions, thesis research design and the arena prototype come after the submission.

# 6. Who to ask

Marek is the contact for the code, private development archive and infrastructure;
Nadine for the research design and framing. Study design and participant-study
governance are agreed by the research team before study use.
