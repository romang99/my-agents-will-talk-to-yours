# Screening Loop — Design Sketch (not yet implemented)

**Date:** 2026-07-24
**Source:** Marek & Nadine working session 2 (transcripts/Researcher Connect 2_transcript.txt)
**Status:** design for discussion — no code exists yet

## The problem it solves

Validation does not scale. With N researchers there are N(N−1)/2 pairs; nobody will read a
hundred connection briefs, let alone a million. The system must be **largely autonomous at the
front**, funnelling down to a shortlist that is manageable for humans — with human intervention
*inside* the loop, not only at the end (the "strategically positioned breakpoints" principle).

## The unit economics that make it work

ECP (expected collaboration potential) is already computed per run. The insight from the
session: a *cheap* first-pass conversation is enough to rank; only the survivors deserve
expensive deep runs and human attention.

## The loop

```
INPUT: focal researcher R (or a whole pool), trigger T, candidate set C (all unconnected pairs
       involving R, or all pairs), round budget K (or a stability rule)

Round 0 — SCREEN (autonomous, cheap)
  for each candidate c in C:
      short conversation (2 turns) + mini-synthesis  →  ECP₀(c)
  rank C by ECP₀ descending; shortlist S = top M (default 10–20)

Round k — INTERVENE + RESCREEN (human in the loop)
  1. Present S to the humans. BOTH researchers of a shortlisted pair can respond:
       · comment (free text — steering, context, constraints)
       · "no interest / not available"  →  ECP(c) := 0 for this trigger (with reason logged)
       · "defer" (prototype feature; off in study conditions) → snooze + re-prompt later
  2. Re-run ALL of C (not just S), injecting accumulated comments into the
     conversation context of affected pairs — comments can demote a shortlisted
     pair and promote #11 into the top 10.
  3. Re-rank → new shortlist S′.

STOP when: round budget K reached, OR the shortlist is stable
  (e.g. Jaccard(S, S′) ≥ 0.8 for two consecutive rounds — "no movement in the top 10").

OUTPUT: final shortlist → full-depth runs (6 turns + synthesis + baseline comparison)
        → Step 4 validation as today. Only these appear as chart overlays / Findings rows.
```

## Design decisions to settle with Nadine

1. **Screen depth.** 2 turns (one exchange each) + a 1-call mini-synthesis = 3 LLM calls per
   candidate. For 100 candidates ≈ 300 calls/round — fine on the API, slow on the CLI.
   A round-0 *lexical* pre-filter (cheap embedding/keyword relevance to the trigger) could cut
   C before any LLM call; is that acceptable rigor-wise, or must every pair get a conversation?
2. **Comment injection semantics.** A researcher's comment applies to (a) that one pair, or
   (b) all their pairs in this screening (e.g. "I'm on leave until March" is global;
   "I already work with someone on X" is pair-specific). Proposal: researcher chooses scope
   per comment; both stored in provenance.
3. **Stability rule vs fixed rounds.** Fixed K is simpler to preregister; the stability rule
   is more elegant. Proposal: both implemented, K preregistered for the study.
4. **What the paper measures.** Per round: shortlist composition, rank movements, ECP
   distribution, and where human comments moved candidates in/out — the loop itself generates
   the intervention-effect data Nadine wants.
5. **Teams (later).** Team ECP = product of pairwise ECPs (from the session: one 0.1 member
   collapses a 0.9³ team). Screening for teams = greedy assembly from the pairwise ECP matrix.
   Out of scope for v1.

## Data model sketch

```
data/screenings/<id>.json
{
  id, trigger: {…snapshot}, focal: "researcher-id" | null,
  createdAt, status: running|awaiting-intervention|complete,
  rounds: [
    { index, ranked: [{pair, ecp, runId}], shortlist: [pairKey…],
      interventions: [{pair|null, researcherId, kind: comment|decline|defer, text, at}] }
  ],
  stopRule: {type: fixed|stability, k, jaccard}
}
```

Screening runs reuse the pipeline with `turns: 2` and `mode: 'screen'` (skips the assessor —
no baseline comparison needed until the deep run). Every screen run is still a provenance file.

## UI sketch

A third view tab, **Screenings**: pick trigger + focal researcher (or all) → "Start screening".
A ranked ledger updates live per round; shortlisted rows get comment / decline buttons for each
researcher; a round indicator shows movement (▲▼) since the previous round; "Run deep probes"
on the final shortlist hands over to the existing pipeline.

## Cost envelope (order of magnitude)

100 candidates × 3 calls × 3 rounds ≈ 900 screen calls + 20 deep runs × 8 calls ≈ 1,060 calls
per screening on the API — tens of dollars on claude-opus-4-8, or scale down with a cheaper
model for screen rounds (provider-per-stage is a small extension of the current per-run switch).
