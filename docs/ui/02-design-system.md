# 02 — Design System Specification (`docs/ui/02-design-system.md`)

> **History.** This describes the UI before brand v2 (BRIAN, the Doodle design, 19 pages, 7 dimensions), superseded on 2026-10-31. Current: the [root README](../../README.md), the [glossary](../../docs/GLOSSARY.md) and `docs/design/BRAND-V2.md`. Kept as a record; not maintained.

> **Design Direction Locked (`DEC-006`)**: **Playful Lab** (Light default) + **Night Lab** (Dark theme), paired with **Fredoka** (Display), **Lexend** (UI/Reading), and **JetBrains Mono** (Tabular metrics & formulas).

---

## 1. OKLCH 10-Step Primitive Ramps (`frontend/src/styles/tokens.css`)

All colors are engineered in perceptual OKLCH space so lightness ($L$) steps are uniform across hues, with verified sRGB hex fallbacks for automated WCAG 2.1 contrast calculation.

### 1.1 Warm Paper & Ink Neutral Ramp (`neutral-50` .. `neutral-950`)
| Step | OKLCH Value | Hex Fallback | Primary Role |
| :---: | :--- | :---: | :--- |
| `50` | `oklch(0.982 0.016 82)` | `#FFF8EE` | Light `canvas` (Warm Paper) |
| `100` | `oklch(0.958 0.022 80)` | `#F7EFE2` | Light `surface-subtle` / hover tint |
| `200` | `oklch(0.912 0.024 78)` | `#EAE0D0` | Subtle dividers & skeleton base |
| `300` | `oklch(0.825 0.026 285)` | `#C8C2D6` | Disabled fills |
| `400` | `oklch(0.625 0.035 288)` | `#8C86A0` | Light `border` (`3.31:1` on `#FFF8EE`) |
| `500` | `oklch(0.515 0.042 288)` | `#6E6888` | Secondary icons |
| `600` | `oklch(0.452 0.045 288)` | `#5B5675` | Light `ink-muted` (`6.62:1` on `#FFF8EE`) |
| `700` | `oklch(0.350 0.052 286)` | `#3B3556` | Elevated borders |
| `800` | `oklch(0.245 0.055 284)` | `#1F1B3B` | Light `ink` (`15.61:1` on `#FFF8EE`) & tactile border |
| `900` | `oklch(0.195 0.048 265)` | `#131B33` | Dark `surface` |
| `950` | `oklch(0.145 0.042 265)` | `#0B1020` | Dark `canvas` (Night Lab) |

### 1.2 Brand Teal Ramp (`teal-50` .. `teal-900`)
| Step | OKLCH Value | Hex Fallback | Primary Role |
| :---: | :--- | :---: | :--- |
| `50` | `oklch(0.965 0.032 182)` | `#ECFDF9` | Brand badge tint |
| `100` | `oklch(0.920 0.058 182)` | `#CCFBF1` | Active nav background (Light) |
| `400` | `oklch(0.795 0.138 198)` | `#22D3EE` | Dark theme `brand` (`10.51:1` on `#0B1020`) |
| `600` | `oklch(0.560 0.105 182)` | `#0D9488` | Interactive hover border |
| `700` | `oklch(0.495 0.092 184)` | `#0F766E` | Light theme `brand` (`5.48:1` with `#FFFFFF`) |
| `800` | `oklch(0.420 0.078 184)` | `#115E59` | Light theme `brand-hover` (`7.42:1` with `#FFFFFF`) |

---

## 2. Semantic Color Roles & Computed WCAG 2.1 Contrast Table

Every text/background and UI-boundary pair is checked by `frontend/scripts/check-contrast.mjs` in CI.

| Semantic Token Role | Light Theme (`Playful Lab`) | Dark Theme (`Night Lab`) | Light Contrast vs Canvas/Surface | Dark Contrast vs Canvas/Surface | Min Requirement |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `--color-canvas` | `#FFF8EE` | `#0B1020` | — | — | Base background |
| `--color-surface` | `#FFFFFF` | `#131B33` | — | — | Card background |
| `--color-surface-raised` | `#F7EFE2` | `#1C2747` | — | — | Drawer / popover |
| `--color-ink` | `#1F1B3B` | `#E8ECFF` | **15.61 : 1** | **16.12 : 1** | $\ge 4.5 : 1$ (Body text) |
| `--color-ink-muted` | `#5B5675` | `#A3ABCB` | **6.62 : 1** | **8.34 : 1** | $\ge 4.5 : 1$ (Subtext) |
| `--color-border` | `#8C86A0` | `#3B4A78` | **3.31 : 1** | **3.18 : 1** | $\ge 3.0 : 1$ (UI boundary) |
| `--color-border-strong` | `#1F1B3B` | `#E8ECFF` | **15.61 : 1** | **16.12 : 1** | $\ge 3.0 : 1$ (Tactile frame) |
| `--color-brand` | `#0F766E` | `#22D3EE` | **5.48 : 1** (w/ `#FFF`) | **10.51 : 1** (w/ `#0B1020`) | $\ge 4.5 : 1$ (CTA text) |
| `--color-brand-ink` | `#FFFFFF` | `#0B1020` | **5.48 : 1** | **10.51 : 1** | $\ge 4.5 : 1$ (CTA label) |
| `--color-reward` | `#FFC83D` | `#A3E635` | **10.64 : 1** (w/ `#1F1B3B`) | **12.60 : 1** (w/ `#0B1020`) | $\ge 4.5 : 1$ (Celebration) |
| `--color-accent` | `#FF6B6B` | `#F472B6` | **5.89 : 1** (w/ `#1F1B3B` ink) | **7.21 : 1** (w/ `#0B1020` ink) | Fill only, never lone text |
| `--color-success` | `#15803D` | `#4ADE80` | **5.02 : 1** (w/ `#FFF`) | **10.85 : 1** (w/ `#0B1020`) | $\ge 4.5 : 1$ |
| `--color-warning` | `#B45309` | `#FBBF24` | **4.95 : 1** (w/ `#FFF`) | **11.40 : 1** (w/ `#0B1020`) | $\ge 4.5 : 1$ |
| `--color-danger` | `#C62828` | `#F87171` | **5.62 : 1** (w/ `#FFF`) | **7.82 : 1** (w/ `#0B1020`) | $\ge 4.5 : 1$ |
| `--color-info` | `#0369A1` | `#38BDF8` | **5.88 : 1** (w/ `#FFF`) | **9.45 : 1** (w/ `#0B1020`) | $\ge 4.5 : 1$ |

---

## 3. Dimension Palette (Okabe-Ito Colorblind-Safe + WCAG $\ge 3:1$ + Distinct Shapes)

To ensure color never carries meaning alone, every dimension slot combines a WCAG-verified stroke/fill token with a dedicated SVG marker geometry and dash/pattern rule for slots 1–10:

| Slot | Token Variable | Light Hex (`#FFF8EE` Ratio) | Dark Hex (`#0B1020` Ratio) | Marker Shape | Default Dimension Mapping |
| :---: | :--- | :---: | :---: | :--- | :--- |
| **1** | `--dim-1` | `#0072B2` (**4.92:1**) | `#56B4E9` (**8.45:1**) | Circle (`●`) | Working Memory (`WM`) |
| **2** | `--dim-2` | `#C45100` (**4.24:1**) | `#FF8C3B` (**7.90:1**) | Square (`■`) | Inhibition Control (`IC`) |
| **3** | `--dim-3` | `#008662` (**4.15:1**) | `#2DD4BF` (**10.60:1**) | Triangle (`▲`) | Cognitive Flexibility (`CF`) |
| **4** | `--dim-4` | `#9E4778` (**4.81:1**) | `#E899C8` (**8.75:1**) | Diamond (`◆`) | Attention Networks (`AN`) |
| **5** | `--dim-5` | `#A86E00` (**3.94:1**) | `#FACC15` (**12.40:1**) | Pentagon (`⬠`) | Divided Perceptual Speed (`PS`) |
| **6** | `--dim-6` | `#0B76A8` (**4.63:1**) | `#38BDF8` (**9.45:1**) | Hexagon (`⬢`) | Episodic Pattern Separation (`EP`) |
| **7** | `--dim-7` | `#7D7300` (**4.12:1**) | `#F0E442` (**14.20:1**) | Star (`★`) | Visuospatial Planning & $G_f$ (`VP`) |
| **8** | `--dim-8` | `#4F46E5` (**5.72:1**, dashed) | `#818CF8` (**7.15:1**, dashed) | Cross (`✚`) | Surprise / Extra Dim #8 |
| **9** | `--dim-9` | `#0F766E` (**5.21:1**, dotted) | `#34D399` (**10.20:1**, dotted) | Ring (`◎`) | Surprise / Extra Dim #9 |
| **10** | `--dim-10` | `#831843` (**7.95:1**, dash-dot) | `#F472B6` (**7.21:1**, dash-dot) | Hourglass (`⧗`) | Surprise / Extra Dim #10 |

---

## 4. Uncertainty Tokens
- `--uncertainty-band-fill`: `rgba(15, 118, 110, 0.16)` (Light) / `rgba(34, 211, 238, 0.18)` (Dark)
- `--uncertainty-low-stroke`: `#9E4778` (Light) / `#F472B6` (Dark)
- `--uncertainty-low-tint`: `#FDF2F8` (Light) / `#2D162B` (Dark)
- **Threshold Rule**: Whenever `confidence < 0.60`, the polygon segment and bar switch from solid fill to `url(#low-confidence-hatch)` ($45^\circ$ diagonal stripes, `8px` pitch) and display the `"Low confidence · Preliminary"` badge.

---

## 5. Typography, 4 px Spacing Grid, Radii, Elevation & Motion Scales

- **Font Families**:
  - `--font-display`: `'Fredoka', system-ui, sans-serif` (Weights: `600`, `700`)
  - `--font-sans`: `'Lexend', system-ui, sans-serif` (Weights: `400`, `500`, `600`)
  - `--font-mono`: `'JetBrains Mono', monospace` (`font-variant-numeric: tabular-nums`)
- **Type Scale (1.200 Minor Third, 4 px baseline rhythm)**:
  - `xs`: `0.75rem` (`12px` / `16px` line-height)
  - `sm`: `0.875rem` (`14px` / `20px` line-height)
  - `base`: `1rem` (`16px` / `24px` line-height)
  - `lg`: `1.125rem` (`18px` / `28px` line-height)
  - `xl`: `1.375rem` (`22px` / `28px` line-height)
  - `2xl`: `1.75rem` (`28px` / `36px` line-height)
  - `3xl`: `2.25rem` (`36px` / `44px` line-height)
- **Spacing Scale (4 px Base Grid)**: `4px` (`1`), `8px` (`2`), `12px` (`3`), `16px` (`4`), `20px` (`5`), `24px` (`6`), `32px` (`8`), `40px` (`10`), `48px` (`12`), `64px` (`16`).
- **Radius Scale**: `sm: 8px`, `md: 12px`, `lg: 16px`, `pill: 9999px`.
- **Tactile Elevation Scale**:
  - `--shadow-tactile`: `0 3px 0 var(--color-border-strong)` (Buttons & interactive cards)
  - `--shadow-tactile-active`: `0 1px 0 var(--color-border-strong)` (Paired with `translateY(2px)`)
  - `--shadow-card`: `0 4px 0 var(--color-border-strong)` (Light) / `0 4px 20px rgba(0,0,0,0.45)` (Dark)
- **Motion Scale**:
  - Durations: `--duration-fast: 120ms`, `--duration-base: 220ms`, `--duration-slow: 360ms`
  - Easings: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`, `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)`
  - Reduced Motion: `@media (prefers-reduced-motion: reduce)` forces all transition/animation durations to `0.01ms` and disables mascot loops. Timed cognitive trials (`Page 04`) enforce `data-timed-trial="true"` which disables all decorative motion globally.
