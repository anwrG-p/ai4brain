# 03: Welcome page (`/`)

Status: ready-for-agent
Blocked by: 02
Spec: `../spec.md` (Goal, R1, R2, R5)

## Target layout

A single column, max width about 720 px, centred. From top to bottom:

1. **h1, keep the exact text:** "Let's map how your mind works in 2 minutes."
2. **One sentence subline** of 15 words or fewer.
3. **Primary CTA:** `#start-baseline-btn`, with accessible name /Start my 2-minute baseline/. Below it, a small text link "Sign in".
4. **"How SynapseTwin Works":** keep the heading. Three simple rows, each a Lucide icon + title + one line. Keep the titles: "2-Minute Micro-Games", "Your Living Brain Twin", "Zero-Guilt Growth". No cards, no badges, no "Phase" footers, no tape.
5. **One privacy line** with a Lucide shield icon: "Private by design: no camera, no microphone, no biometrics." Plus a link to the methodology page.

## Remove

- the decorative Brian hero image, its halo, speech bubble and contact shadow
- the DoodleArrow and DoodleSquiggle
- the 3 stat tiles (6 / 0 / High; R5)
- "The Brian Protocol" stamp divider
- emoji tiles
- the duplicate "Begin Assessment →" CTA (one primary CTA per screen)
- the technical badges ("Layer A Psychometrics", "95% ±CI"). Move them into a `<details data-technical-drawer>` "How it works under the hood" only if you keep them.

## Copy

- About half of today's ~260 words.
- Front-loaded and objective.
- This page is **not** copy-lint exempt, so it must pass lint:copy.

## Tests

- `designSystem.test.tsx`'s Welcome test passes unchanged: heading, button, the 4 texts, and navigation to onboarding.
- `e2e/welcome.spec.ts` passes on Edge: axe clean in light and dark, no overflow at 375, 768 and 1440 px.
- **New test:**
  - no element with `aria-hidden` decorative mascot image on `/`
  - at most one `button`/link styled primary
  - visible word count under 140 (count `textContent` words of `main`, excluding `details`)

## Done when

`qa:checks` is green, the Welcome e2e passes, and the commit has no AI attribution.
