# SynapseTwin Documentation & Architecture Hub

> **CISTAC 1.0 (AI4Brain Challenge)** — Continuous, Non-Clinical Cognitive Assessment & Adaptive Growth  
> **Master Documentation Directory**: All architecture diagrams, UX plans, design tokens, and psychometric specifications.

---

## 📚 Central Documentation Directory

```
docs/
├── README.md                                 # This master documentation index
├── GLOSSARY.md                               # Canonical consumer lexicon & forbidden jargon list
├── adr/                                      # Architecture Decision Records
├── agents/                                   # Engineering skills configuration (issue tracker, triage, domain)
├── design/
│   ├── DESIGN.md                             # Doodle Design System, OKLCH tokens, WCAG 2.2 AA
│   └── UX_TRANSFORMATION_PLAN.md             # 19-page journey, EMILY affective computing, human protocol
├── architecture/
│   ├── SEQUENCE_DIAGRAMS.md                  # All 5 Mermaid.js inter-subsystem sequence diagrams
│   ├── TASKS_AND_DIMENSIONS.md               # 6-skill cognitive tasks, 3-10 dimension registry & biases
│   └── MEMBER2_HANDOVER.md                   # Member 2 Layer B AI Coach Handover & XAI contract
└── ui/
    ├── README.md                             # Frontend implementation & sprint overview
    ├── JUDGES-UI.md                          # Jury Rubric-to-UI Proof Matrix (All 11 criteria)
    ├── contracts.md                          # Frontend-backend API contracts & dimension bridge
    ├── DECISIONS.md                          # Architectural decision records (DEC-001 through DEC-008)
    ├── QA-log.md                             # Verification history & audit results
    └── pages/                                # Detailed specifications for all 19 screens (01 to 19)
```

---

## 📖 Quick Links to Core Deliverables

### 1. Consumer Vocabulary & Copy Safety
- [docs/GLOSSARY.md](GLOSSARY.md): Complete list of approved consumer terms, the 18 forbidden academic/clinical jargon rules, and automated linter specifications (`copyLinter.ts`).

### 2. Design System & Visual Foundations
- [docs/design/DESIGN.md](design/DESIGN.md): The official Doodle (Hand Drawn) specification, OKLCH 10-step ramps, Okabe-Ito colorblind-safe 10-dimension palette, typography pairings (Fredoka / Lexend / JetBrains Mono), and WCAG 2.2 AA contrast proof.
- [docs/design/UX_TRANSFORMATION_PLAN.md](design/UX_TRANSFORMATION_PLAN.md): Complete 19-page user journey flow, EMILY affective computing model, color psychology matrix, and the 4-tier Human UX Approval Protocol.

### 3. Architecture & Psychometric Engines
- [docs/architecture/SEQUENCE_DIAGRAMS.md](architecture/SEQUENCE_DIAGRAMS.md): All 5 Mermaid.js sequence diagrams detailing communication flows across Members 1, 2, 3, 4, and 5.
- [docs/architecture/TASKS_AND_DIMENSIONS.md](architecture/TASKS_AND_DIMENSIONS.md): Comprehensive documentation of the 6 core cognitive skills ($N$-back, Stroop, Matrix, Tower, UFOV, MST), the dynamic 3–10 Dimension Registry, and 6 active measurement bias mitigations.
- [docs/architecture/MEMBER2_HANDOVER.md](architecture/MEMBER2_HANDOVER.md): Handover documentation for the Layer B AI Coach, XAI explainability engine, dynamic collaboration scoring, and safety guardrails.

### 4. Evaluator Verification & Rubric Proofs
- [docs/ui/JUDGES-UI.md](ui/JUDGES-UI.md): Matrix mapping all 11 competition rubric criteria (Relevance, Quality, Innovation, UX, Explainability, Safety, Generalisation, Robustness, Profile Quality, Plan Relevance, Defense) to live screens, code paths, and screenshots.
- [docs/ui/contracts.md](ui/contracts.md): Verified backend endpoints, TypeScript contracts, and data models.
- [docs/ui/DECISIONS.md](ui/DECISIONS.md): Complete chronological record of design and architectural decisions.

### 5. Autonomous Agent Engineering Configuration
- [docs/agents/issue-tracker.md](agents/issue-tracker.md): Local markdown issue tracking conventions under `.scratch/<feature>/`.
- [docs/agents/triage-labels.md](agents/triage-labels.md): Canonical triage roles mapping.
- [docs/agents/domain.md](agents/domain.md): Single-context domain documentation consumption rules.

