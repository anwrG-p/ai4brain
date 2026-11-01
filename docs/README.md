# Docs

What the product is and how to run it: the [root README](../README.md).

## Current
| Doc | What it holds |
|---|---|
| [GLOSSARY.md](GLOSSARY.md) | Consumer words (Loti, Momo, the 5 skills, exercise names), retired words, banned clinical terms. |
| [adr/](adr/) | Decisions. [0001](adr/0001-two-tier-consumer-vs-technical-telemetry.md): plain words in the UI, formulas only on "How we calculate this". [0002](adr/0002-no-server-side-emotion-inference.md): no server-side emotion inference. |
| [design/DESIGN.md](design/DESIGN.md) | The brand v2 design system in short. Full route and design guide: `docs/design/BRAND-V2.md`. |
| [architecture/TASKS_AND_DIMENSIONS.md](architecture/TASKS_AND_DIMENSIONS.md) | The exercises, their telemetry dimensions and the skill each one feeds. |
| [architecture/EMILY_BEHAVIORAL_EMOTION_ENGINE.md](architecture/EMILY_BEHAVIORAL_EMOTION_ENGINE.md) | The on-device mood rules behind Momo, and their legal and evidence limits. |
| [architecture/SEQUENCE_DIAGRAMS.md](architecture/SEQUENCE_DIAGRAMS.md) | Data flow between the modules. |
| [architecture/MEMBER2_HANDOVER.md](architecture/MEMBER2_HANDOVER.md) | The `ai_coach` package: safety guardrails, collaboration scorer, explainer. |
| [ui/contracts.md](ui/contracts.md) | Frontend–server API contracts and their status. |
| [ui/JUDGES-UI.md](ui/JUDGES-UI.md) | Rubric criteria mapped to screens. |
| [research/](research/) | Dated evidence reviews. The latest is [2026-10-31](research/2026-10-31-improvement-opportunities.md). |
| [agents/](agents/) | Conventions for coding agents (issue tracker, triage labels, domain docs). |

## History (kept as a record, not maintained)
- [architecture/TEAM_PLAN.md](architecture/TEAM_PLAN.md): the original five-member challenge plan.
- [ui/](ui/README.md): the pre–brand v2 UI (19 page specs, screenshots, sprint state, decisions, QA log, changelog).
- [design/UX_TRANSFORMATION_PLAN.md](design/UX_TRANSFORMATION_PLAN.md): the pre–brand v2 journey and mascot plan.
- `branding/`: early BRIAN logo concepts.
- [superpowers/plans/](superpowers/plans/): an early implementation plan.

Links are relative. `tests/test_docs_links.py` fails on broken links and on any `file:///` link.
