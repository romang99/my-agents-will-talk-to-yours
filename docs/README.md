# Documentation

**New here? Start with [ONBOARDING](ONBOARDING.md).** It explains the project in four
paragraphs, gives a reading order by role, and gets you running in an hour.

## Orientation

| Document | For | Read it when |
|---|---|---|
| [Start Here](ONBOARDING.md) | anyone new | You have the code and need the context |
| [Status](STATUS.md) | everyone | What works, what the live runs showed, what is open — dated |
| [History and Decision Log](DECISIONS.md) | anyone asking "why is it like this?" | Before changing a design choice or arguing about one |
| [Glossary](GLOSSARY.md) | everyone | A term in any document or the UI is unclear |
| [Handover](HANDOVER.md) | Roman, and whoever writes the appendix | What the call requires, what this snapshot contains, how the paper now frames the prototype, what comes next |

## Using and changing the tool

| Document | For | Read it when |
|---|---|---|
| [Prototype Guide](PROTOTYPE_GUIDE.md) | anyone using the tool | You want to run it and understand what you're looking at |
| [Working With Run Records](WORKING_WITH_RUNS.md) | whoever analyses results | You need to read, tabulate or cite the evidence files |
| [Technical Specification](TECHNICAL_SPECIFICATION.md) | anyone changing the code | You need the measures, data model, API, and the invariants that must hold |
| [Contributing](../CONTRIBUTING.md) | anyone changing the code | Conventions, invariants, how to make common changes |

## The study and the paper

| Document | For | Read it when |
|---|---|---|
| [Research Protocol](RESEARCH_PROTOCOL.md) | Nadine & Marek | Before collecting any data — design, conditions, measures, open decisions |
| [Data & Ethics Statement](DATA_ETHICS.md) | Nadine & Marek | Before inviting anyone outside the two authors to participate |
| [Technical Appendix](TECHNICAL_APPENDIX.md) | Organization Science reviewers | The paper-facing account; its preamble maps each section to its source document |
| [Publishing Checklist](PUBLISHING_CHECKLIST.md) | whoever pushes | **Before the repository goes anywhere** — the tree and history currently contain data that must not be published |

## Design records

Kept as written and not updated as the system evolves:

- [Original design](specs/2026-07-24-researcherconnect-design.md) — the plan the prototype was built from
- [Screening loop](specs/2026-07-24-screening-loop-design.md) — designed, **not implemented**; five open questions for Nadine
- [From pairs to searches, and the judge pivot](specs/2026-09-10-search-centric-redesign.md) — Part 1 parked; Part 2 built as judge mode

Primary sources: `../transcripts/` (working sessions 1–2, 24 July 2026). The June 2026
meeting transcript, the call for papers and the July emails are in the predecessor
project's folder on Marek's machine (`OrgSci/syncminds/docs/provenance/`), not here.

Repository-level: [README](../README.md) (setup and orientation), [ARCHITECTURE](../ARCHITECTURE.md) (module map), [CHANGELOG](../CHANGELOG.md), [CLAUDE.md](../CLAUDE.md) (rules for AI-assisted work on this codebase).

## PDFs

```bash
npm run docs
```

Renders the documents to `docs/pdf/`. Requires [pandoc](https://pandoc.org) and Google Chrome; the Markdown is the source of truth, and the PDFs are disposable build output (untracked).
