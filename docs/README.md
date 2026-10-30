# Documentation

**Current submission:** *WELCOME TO THE JUNGLE: AGENT ARENAS, UNLIKELY COLLABORATIONS, AND THE SEARCH FOR SCIENTIFIC IDEAS THAT MATTER*. ResearcherConnect v0.3 is the implemented pair-assessment prototype; the agent arena is planned development.

**Technical appendix:** [Markdown](TECHNICAL_APPENDIX.md) · [Word](20261029_Technical_Appendix_OrgScience.docx) · [PDF](Technical_Appendix_Welcome_to_the_Jungle.pdf).

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
| [Research Protocol](RESEARCH_PROTOCOL.md) | Nadine & Marek | Proposed evaluation, candidate conditions, measures and current study status |
| [Data & Ethics Statement](DATA_ETHICS.md) | Nadine & Marek | Data practices, implemented controls and requirements of a participant study |
| [Technical Appendix](TECHNICAL_APPENDIX.md) | Organization Science reviewers | The paper-facing account; its preamble maps each section to its source document |
| [Publishing Checklist](PUBLISHING_CHECKLIST.md) | whoever pushes | **Before publishing or pushing** — audit the tree and reachable history for excluded data and credentials |

## Design records

Dated design records are retained as written. Earlier paper titles and design choices describe their historical stage; they do not replace the current submission framing.

- [Current submission framing](specs/2026-10-30-submission-framing.md) — current title, implemented pair assessment and planned arena development

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

Renders the Markdown documentation to `docs/pdf/`. Requires [pandoc](https://pandoc.org) and Google Chrome; those generated files are untracked build output. The submission appendix linked above is separately maintained in tracked Markdown, Word and PDF forms. Keep those three versions aligned when editing the appendix.
