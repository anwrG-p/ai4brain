# Evidence review: making SynapseTwin less bulky

*2026-10-30. Deep-research run with 107 agents. Each claim was checked by 3 adversarial verifiers and dropped if 2 of the 3 refuted it.*

**Scope:** the whole app. **Problems:** visual clutter, too much text, too many steps.

**Ownership:** `frontend/` belongs to the UI team (DEC-001). Section 3 is a proposal for them. Section 4 is what Member 1 applies on the exercise screen.

---

## 1. What the evidence supports, ranked by likely impact

### 1.1 Reduce visual complexity; colour can stay (high confidence)

- **What the studies show:**
  - High visual complexity causes the largest drop in first-impression appeal.
  - Low-complexity designs are liked about as much as medium ones.
  - Simple, familiar layouts are rated most beautiful.
  - Colourfulness matters much less than complexity.
  - Users over 45 prefer low complexity even more.
- **Sources:** Reinecke et al., CHI 2013 (450 sites, 548 raters; [pdf](https://kgajos.seas.harvard.edu/papers/reinecke13aesthetics.pdf)); Tuch et al. 2012 ([Google Research summary](https://research.google/blog/users-love-simple-and-familiar-designs-why-websites-need-to-make-a-great-first-impression/)).
- **For SynapseTwin:** the playful Doodle **palette can stay**. What has to go is **density and layering**: cards inside cards, stacked shadows and borders, and many competing blocks per screen.
- **Caveat:** these studies measure first-impression appeal, not long-term usability. Very sparse designs lose a little appeal.

### 1.2 Remove what the task doesn't need, but keep what users need (medium confidence)

- **The principle:** every extra element competes with the relevant ones and makes them less visible. The aim is *sufficient information, and only sufficient information*. Minimalism is not a goal in itself, because it often removes needed labels and state. ([NN/g heuristic #8](https://www.nngroup.com/articles/aesthetic-minimalist-design/))
- **For SynapseTwin:** cut redundant cards, borders, shadows and secondary text. Keep labels, state, and the explanations users need for trust.

### 1.3 Cut and front-load text (high and medium confidence)

- **How people read:** users scan. They read at most about **28%** of a page's words, realistically about **20%**, and only about 18% of any text added to a page. ([NN/g](https://www.nngroup.com/articles/how-little-do-users-read/))
- **What rewriting achieved:**

  | Rewrite | Measured usability |
  |---|---|
  | About half the words | +58% |
  | Scannable format | +47% |
  | Objective, non-promotional tone | +27% (not statistically significant) |
  | All three combined | +124% |
  | 1998 rewrite for technical users | +159% |

  The samples were small, so treat these numbers as direction only. ([NN/g](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/))
- **Front-load meaning:** the first two words of a line get far more attention than the third.
  - Start every heading, card, bullet and button with the information-carrying word. Write "Memory score: 72", not "Here's how your memory score looks".
  - The first two lines of a page must carry its point. ([NN/g](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content-discovered/))

### 1.4 Keep mascots only where they carry information (medium confidence, 2–1 votes)

- **What eye-tracking shows:** purely decorative images are largely ignored ("jazzed-up = ignored"). Images that carry task-relevant content do get looked at. ([NN/g](https://www.nngroup.com/articles/photos-as-web-content/))
- **The counterpoint:** decorative pictures can lift mood without hurting learning (Magner et al.).
- **For SynapseTwin:**
  - Keep BRIAN, Nodi and EMILY where they **signal something**: feedback, state, progress, or an empty state.
  - Remove or shrink them where they are ornament next to primary content.

### 1.5 Drop upfront tutorial carousels (medium confidence)

- **The study:** 70 users, 4 apps. Task success was 91% for people who read the tutorial and 94% for people who skipped it, not a significant difference. Readers also rated the tasks as **harder** (p = .047). ([NN/g](https://www.nngroup.com/articles/mobile-tutorials/))
- **For SynapseTwin:** cut intro decks and explanatory onboarding steps. Get users to their first exercise quickly, and give help in context instead.

### 1.6 Short consent is fine only if it stays fair (medium confidence)

- **The rule:** Accept and Reject sit **together, equally visible, on the first screen**. Details sit behind "Customise".
- **Why it matters:**
  - Moving Reject off the first screen raises consent by **22–23 percentage points**, a dark pattern that most EU regulators treat as an infringement.
  - Granular controls on the first screen lower consent by 8–20 points.
  - Sources: Nouwens et al., CHI 2020 ([arXiv](https://arxiv.org/abs/2001.02479v1)); EDPB Cookie Banner Taskforce report, 2023.
- **For SynapseTwin:** one consent screen with Accept / Reject / Customise.

---

## 2. Popular advice the evidence did NOT support

Don't build rules on these. They were refuted in verification:

| Advice | Vote | Why it fails |
|---|---|---|
| Fixed word budgets per card ("users read half of pages ≤ 111 words") | 0–3 | |
| Designing layouts around the F-pattern | 1–2 | NN/g treats the F-pattern as a symptom of poor formatting, not a target. |
| "Users decide whether to stay in 17–50 ms" | 0–3 | That timing is aesthetic judgement, not retention. |
| "All decoration is noise" | 1–2 | Decoration can have affective value. |

**Not covered by verified evidence:** distraction-free design for timed task screens, dashboard and chart count, showing uncertainty to lay users, deferring account creation, and numeric audit thresholds. Guidance in these areas is design judgement and is labelled as such below.

---

## 3. Proposal for the UI team (whole app)

The UI owner decides. Each item points to its evidence; ⚖ marks judgement only.

| Area | Change | Evidence |
|---|---|---|
| Global | Allow one card level per region; no cards inside cards. One shadow style; drop stacked borders plus shadows. | §1.1, §1.2 |
| Global | Halve body copy on every page. Start each heading, card and button with the key word. Use an objective tone, not hype. | §1.3 |
| Global | Mascots appear only when they carry state or feedback (celebrate, empty state, error). No ornamental mascots next to primary content. | §1.4 |
| Onboarding | Remove explanatory steps and carousels. Path: welcome → one consent screen (Accept / Reject / Customise) → first exercise. Put explanations in context. | §1.5, §1.6 |
| Onboarding / Privacy | Move consent details (retention, non-biometric mode, export) behind "Customise" / `<details>`, with equal-weight Accept and Reject on top. | §1.6 |
| Assessment hub, Methodology | Move technical content (QUEST+, endpoints, contract previews, JSON) into collapsed `<details>` drawers, consistent with ADR 0001. Leave one plain-language line visible. | §1.2, §1.3, ADR 0001 |
| Dashboard | ⚖ One headline metric per dimension plus one chart. Keep confidence bands, but behind a "How sure is this?" toggle. | judgement |
| Privacy certificate | Fix the false "server files permanently purged" claim (DEC-008). Only on-device events are cleared until Member 4's delete route exists. | DEC-008 |
| Evaluator / judge panel | Keep it hidden unless judge mode is on, so it adds no visual weight for real users. | §1.2 |

**A quick check for any page (⚖ judgement):**
- Can you say the page's single purpose in one line?
- Is there one primary action?
- Do the first two words of every text block carry meaning?
- Is anything decorative sitting next to primary content?
- Is there a card inside a card?
- Is there technical detail outside a `<details>` drawer?

---

## 4. Applied by Member 1 on the exercise screen (ticket 07)

The rules are in `.scratch/member1-ui-integration/issues/07-mount-in-task-runner-page.md` → "Declutter".
