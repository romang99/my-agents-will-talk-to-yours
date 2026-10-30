---
title: "ResearcherConnect — Data and Ethics Statement"
subtitle: "What the prototype holds about people, and on what terms"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "July 2026"
---

> **Status: prototype-stage governance statement.** This document describes the
> prototype's data practices and the requirements of a future participant study.
> It is not an approved ethics application.

# 1. Why this document exists

ResearcherConnect builds a machine-readable representation of a named academic and lets an LLM speak as them. Even when every input is public, that is a meaningfully different act from reading someone's staff page. Three things follow: the representation must be correctable by its subject, the system must never claim more certainty than its evidence supports, and a person must be able to decline without consequence.

# 2. What data the system holds

Two kinds of profile, always distinguishable in the interface and in the data.

**Synthetic personas** are composites, representing no real person. They carry `synthetic: true`, are marked in the interface, and are used for demonstrations, tests and the deliberate poor-fit case. Shared fixtures must meet the publishing policy; relabelling a real profile does not make it fictional.

**Real researchers** carry `synthetic: false`. Their profile holds: name, affiliation(s), field, methods, research interests, notable work, recent reflections (short statements of current thinking), collaboration style, ORCID where known, and known collaborators as graph edges. Everything is professional and public-facing. The system holds no personal contact details, no employment or salary data, no student or grant records, and nothing from private correspondence.

Two derived stores exist: `data/profile-overrides.json` (only genuine human corrections to seed values) and `data/runs/*.json` (complete records of each probe, including conversation text and the human's decision and note).

# 3. Where it comes from

| Source | Status | Notes |
|---|---|---|
| Hand-authored fictional fixtures | distributed | Ten synthetic seed personas; no real subject or personal publication record |
| AI scout (live web search) | available for a separate private study | Reviewed drafts and cited sources stay in ignored runtime stores; never in the shared seed file |
| QUT Pure export | planned | Not used in the distributed prototype; study use depends on institutional access and permitted use |
| OpenAlex | paused | Public bibliographic data; not currently used |

The scout is *evidence-first*: it is instructed to leave a field empty rather than infer it, and to record what it could not establish. Its output is a **draft**, never saved without a human pressing save.

# 4. Verification and correction

The intended study procedure requires researchers to review and confirm their representations before primary analysis. The prototype stores verification as a boolean; it does not authenticate who changes the flag or block live runs involving unverified real profiles.

Three rules protect it:

1. An AI refresh never sets `verified`. Evidence-based is not the same as confirmed.
2. Every field is editable by the subject, including affiliations and reflections.
3. Corrections are stored as deltas against the seed, so what a person changed is visible as a change — an audit trail, not a silent overwrite.

Verification timestamps and verifier identity are not recorded in this release.

# 5. Consent

A participant study is separate from the distributed synthetic demonstration. Its consent procedure should explain the following:

- **Nothing is written about a person into a study dataset without their knowledge.** A researcher may be *scouted* from public sources during development, but a scouted profile is a draft; entering the study requires them to see it and verify it.
- **Recruitment information** should explain what is held, that an LLM will speak as the participant to another agent, that conversations are logged and analysed, that participants review their own representation first, and how withdrawal is handled. The recruitment route and applicable institutional review belong to the separately governed participant study.
- **Withdrawal** should remove the person from the pool and their pairs from the analysed set. The mechanism exists (removal is a reversible tombstone; the seed file is never mutated), but withdrawal from *past run records* is not currently implemented — those runs would need to be archived out by hand. Historical run records are not automatically removed when a profile is withdrawn. Their treatment must follow the study's consent and retention arrangements.

# 6. Being spoken for

An agent asserts things in a named person's voice. The current design includes the following controls and limits:

- Agents are instructed to use the supplied profile; the composition step adds no biography. Profile verification is not enforced by the run endpoint.
- Agents are instructed to recognise opportunities, not to invent research agendas or commit their researcher to anything.
- Output is framed as a suggestion that two humans talk — the system never contacts anyone, never sends a message, and never publishes.
- Full conversations are available to the operator. Participant-facing access to every relevant run is not implemented.
- A confident negative is a legitimate result, so the system is not under pressure to flatter.

An agent may still misrepresent nuance, and a person may be characterised in a conversation they never read. These representation and access limitations remain relevant to the design of a participant study.

# 7. Storage, retention and sharing

Everything is **local-first**: plain JSON files under `data/` on the operator's machine. No database, no hosting, no third-party account. Public deployment was considered and deliberately declined.

The one external flow is the LLM call. Profile text and conversation turns are sent to Anthropic (API or Claude Code CLI) to generate responses; the scout additionally issues web searches for the named researcher. Participants must be told this. Participant-study use requires appropriate institutional arrangements for external processing and clear disclosure to participants; no project-specific provider approval is documented here.

Retention: run files persist until archived. Reset **archives, never deletes**, preserving records between conditions. Archiving does not implement end-of-project disposal. The participant study requires retention and withdrawal arrangements consistent with institutional requirements.

Sharing: the Organization Science submission includes a Git repository. **The shared repository must ship fictional synthetic personas and offline demo runs only.** No real person's profile (including an author profile), human correction or live run may be committed. Consent for a private study does not make a profile suitable for this shared code repository. This is the single most consequential rule in this document, because it is the one most easily broken by accident.

# 8. Fairness

A system that recommends collaborations can concentrate attention. Two properties push the other way, and both should be measured rather than assumed: cumulative advantage is scored so that being *already* well-connected raises predictability (and therefore pushes a pair out of the latent region), and the probe queue is ordered least-predictable-first, which surfaces the peripheral before the central.

Nonetheless, representation quality depends on public visibility, and public visibility is unequally distributed — early-career researchers, non-English publication records and less self-promoting academics will have thinner profiles and will likely receive lower ECP for reasons that are artefacts, not substance. This should be reported as a limitation and, if the pool is large enough, checked empirically against career stage.
