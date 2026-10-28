---
title: "ResearcherConnect — Data and Ethics Statement"
subtitle: "What the prototype holds about people, and on what terms"
author: "Nadine Ostern & Marek Kowalkiewicz · Queensland University of Technology"
date: "July 2026"
---

> **Status: working draft.** This is the researchers' own statement of practice, not
> an approved ethics application. It is written to be the basis of one. Items marked
> **[TO CONFIRM]** need a decision or an institutional answer before any QUT
> researcher outside the two authors is invited to participate.

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
| QUT Pure export | planned | Institutional record; access and permitted use **[TO CONFIRM]** |
| OpenAlex | paused | Public bibliographic data; not currently used |

The scout is *evidence-first*: it is instructed to leave a field empty rather than infer it, and to record what it could not establish. Its output is a **draft**, never saved without a human pressing save.

# 4. Verification and correction

A real researcher's profile stays `verified: false` until the person it describes reviews it and ticks the box themselves. This is not decorative — it is Step 2 of the research design, and the protocol excludes unverified profiles from the primary analysis.

Three rules protect it:

1. An AI refresh never sets `verified`. Evidence-based is not the same as confirmed.
2. Every field is editable by the subject, including affiliations and reflections.
3. Corrections are stored as deltas against the seed, so what a person changed is visible as a change — an audit trail, not a silent overwrite.

**[TO CONFIRM]** whether verification should be captured with a timestamp and the verifier's identity. Currently it is a boolean. For a study that reports "n verified profiles", a timestamp is probably needed.

# 5. Consent

For the two authors, participation is self-evident. For anyone else the position is:

- **Nothing is written about a person into a study dataset without their knowledge.** A researcher may be *scouted* from public sources during development, but a scouted profile is a draft; entering the study requires them to see it and verify it.
- **Recruitment** (Nadine's proposal of an open call to QUT researchers) should present: what is held, that an LLM will speak as them to another agent, that conversations are logged and analysed, that they see and correct their own representation first, and that they may withdraw. **[TO CONFIRM]** wording, and whether QUT's HREC classifies this as low/negligible risk.
- **Withdrawal** should remove the person from the pool and their pairs from the analysed set. The mechanism exists (removal is a reversible tombstone; the seed file is never mutated), but withdrawal from *past run records* is not currently implemented — those runs would need to be archived out by hand. **[TO CONFIRM]** what withdrawal means for evidence already collected.

# 6. Being spoken for

The uncomfortable core of the design is that an agent asserts things in a named person's voice. Mitigations in place:

- Agents speak only from the verified profile; the composition step adds no biography.
- Agents are instructed to recognise opportunities, not to invent research agendas or commit their researcher to anything.
- Output is framed as a suggestion that two humans talk — the system never contacts anyone, never sends a message, and never publishes.
- Conversations are visible in full to the participants; nothing about a person is asserted where they cannot read it.
- A confident negative is a legitimate result, so the system is not under pressure to flatter.

Residual risk, to be stated in the paper: an agent may still misrepresent nuance, and a person may be characterised in a conversation they never read. **[TO CONFIRM]** whether each participant is given access to every run they appear in, not only the ones they validate. The recommendation is yes — it is a small interface change and it removes the asymmetry.

# 7. Storage, retention and sharing

Everything is **local-first**: plain JSON files under `data/` on the operator's machine. No database, no hosting, no third-party account. Public deployment was considered and deliberately declined.

The one external flow is the LLM call. Profile text and conversation turns are sent to Anthropic (API or Claude Code CLI) to generate responses; the scout additionally issues web searches for the named researcher. Participants must be told this. **[TO CONFIRM]** whether QUT policy permits sending staff profile data to a commercial LLM provider, and under which agreement.

Retention: run files persist until archived. Reset **archives, never deletes** — so "clearing findings" between conditions preserves the evidence chain rather than destroying it. That is right for research integrity and wrong for a naive reading of data minimisation; the two need to be reconciled in the ethics application. **[TO CONFIRM]** an end-of-project disposal point.

Sharing: the Organization Science submission includes a Git repository. **The shared repository must ship fictional synthetic personas and offline demo runs only.** No real person's profile (including an author profile), human correction or live run may be committed. Consent for a private study does not make a profile suitable for this shared code repository. This is the single most consequential rule in this document, because it is the one most easily broken by accident.

# 8. Fairness

A system that recommends collaborations can concentrate attention. Two properties push the other way, and both should be measured rather than assumed: cumulative advantage is scored so that being *already* well-connected raises predictability (and therefore pushes a pair out of the latent region), and the probe queue is ordered least-predictable-first, which surfaces the peripheral before the central.

Nonetheless, representation quality depends on public visibility, and public visibility is unequally distributed — early-career researchers, non-English publication records and less self-promoting academics will have thinner profiles and will likely receive lower ECP for reasons that are artefacts, not substance. This should be reported as a limitation and, if the pool is large enough, checked empirically against career stage.

# 9. Open items

1. QUT HREC pathway and whether this is negligible-risk. (§5)
2. Institutional position on sending staff profile data to a commercial LLM provider. (§7)
3. Pure data access terms and permitted secondary use. (§3)
4. What withdrawal means for run records already collected. (§5)
5. Verification as a timestamped, attributed event rather than a boolean. (§4)
6. Whether participants get read access to every run they appear in. (§6)
7. End-of-project data disposal point. (§7)
8. Recruitment wording for the open call. (§5)
