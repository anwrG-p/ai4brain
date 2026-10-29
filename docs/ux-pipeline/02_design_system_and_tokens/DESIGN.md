# Doodle Design System Specification & Token Architecture

> **SynapseTwin / BRIAN Design System** — CISTAC 1.0 (AI4Brain Challenge)  
> **Status**: Production Locked (`DEC-006` · `DEC-008`) · **WCAG 2.2 AA Certified**  
> **Theme Duo**: `Playful Lab` (Light default) & `Night Lab` (Dark theme)

---

## 1. Visual Philosophy & Design Principles

The **Doodle (Hand Drawn)** design system rejects cold, clinical hospital aesthetics and sterile corporate dashboards. Instead, it pairs the warmth, approachability, and organic feel of marker sketches with strict mathematical design tokens, a 4 px baseline grid, and rigorous accessibility standards.

```
       [ Warm Hand-Drawn Character ]
                     +
        [ 4px Mathematical Spacing ]
                     +
     [ WCAG 2.2 AA Contrast & Focus ]
                     ▼
  Doodle Design System (Playful & Night Lab)
```

1. **Structure Enables Creativity**: A rigid 4 px token grid allows imperfect lines, sketch borders, and organic doodles to feel cohesive without becoming visually chaotic.
2. **Intentional Imperfection**: 2 px tactile ink borders (`#1F1B3B`), hand-drawn SVG squiggles, and offset drop shadows (`shadow-doodle`) reduce cognitive testing stress and performance anxiety.
3. **Accessibility is Non-Negotiable**: Playful styling never compromises contrast, focus indicators (`:focus-visible`), tap targets ($\ge 44\text{px}$), or screen-reader landmarks.

---

## 2. OKLCH Perceptual Token Ramps & Color System

All colors are formulated in perceptual OKLCH color space so lightness ($L$) steps remain uniform across hues, with verified sRGB hex fallbacks for automated contrast verification in CI.

### 2.1 Warm Paper & Ink Neutral Ramp

| Step | OKLCH Value | Hex Fallback | Primary Semantic Role |
| :---: | :--- | :---: | :--- |
| `50` | `oklch(0.982 0.016 82)` | `#FFF8EE` | Light `canvas` (Warm Paper background) |
| `100` | `oklch(0.958 0.022 80)` | `#F7EFE2` | Light `surface-subtle` / hover fill |
| `200` | `oklch(0.912 0.024 78)` | `#EAE0D0` | Subtle dividers & skeleton base |
| `300` | `oklch(0.825 0.026 285)` | `#C8C2D6` | Disabled states and placeholder borders |
| `400` | `oklch(0.625 0.035 288)` | `#8C86A0` | Light `border` (`3.31:1` on `#FFF8EE`) |
| `500` | `oklch(0.515 0.042 288)` | `#6E6888` | Secondary icons and neutral glyphs |
| `600` | `oklch(0.452 0.045 288)` | `#5B5675` | Light `ink-muted` (`6.62:1` on `#FFF8EE`) |
| `700` | `oklch(0.350 0.052 286)` | `#3B3556` | Elevated borders and card outlines |
| `800` | `oklch(0.245 0.055 284)` | `#1F1B3B` | Light `ink` (`15.61:1`) & primary tactile borders |
| `900` | `oklch(0.195 0.048 265)` | `#131B33` | Dark `surface` (Night Lab card fill) |
| `950` | `oklch(0.145 0.042 265)` | `#0B1020` | Dark `canvas` (Night Lab background) |

### 2.2 Brand Teal & Feedback Accents

| Token Variable | Light Hex (`#FFF8EE`) | Dark Hex (`#0B1020`) | Contrast vs Background | Role |
| :--- | :---: | :---: | :---: | :--- |
| `--color-brand` | `#0F766E` | `#22D3EE` | **5.48:1** (Light) / **10.51:1** (Dark) | Primary interactive actions, focus rings |
| `--color-reward` | `#FFC83D` | `#A3E635` | **10.64:1** (w/ `#1F1B3B`) | Celebrations, mastery, rest badges |
| `--color-accent` | `#FF6B6B` | `#F472B6` | **5.89:1** (w/ `#1F1B3B`) | Non-clinical highlights, playful squiggles |
| `--color-success` | `#15803D` | `#4ADE80` | **5.02:1** (Light) / **10.85:1** (Dark) | Calibrated state, valid input |
| `--color-warning` | `#B45309` | `#FBBF24` | **4.95:1** (Light) / **11.40:1** (Dark) | Caution notices, offline indicator |
| `--color-danger` | `#C62828` | `#F87171` | **5.62:1** (Light) / **7.82:1** (Dark) | Critical errors, purge actions |
| `--color-info` | `#0369A1` | `#38BDF8` | **5.88:1** (Light) / **9.45:1** (Dark) | Informational callouts, why-this trails |

---

## 3. Okabe-Ito Colorblind-Safe 10-Dimension Palette

To guarantee that color is never the sole communicator of information, every cognitive dimension combines an **Okabe-Ito colorblind-safe stroke/fill token**, a **dedicated SVG geometric marker**, and a **distinctive dash/stroke pattern**:

| Slot | Token | Light Hex | Dark Hex | Marker Shape | Glyph | Dash Pattern | Default Dimension Assignment |
| :---: | :--- | :---: | :---: | :--- | :---: | :--- | :--- |
| **1** | `--dim-1` | `#0072B2` | `#56B4E9` | Circle | `●` | Solid | Working Memory (`WM`) |
| **2** | `--dim-2` | `#C45100` | `#FF8C3B` | Square | `■` | Solid | Inhibition Control (`IC`) |
| **3** | `--dim-3` | `#008662` | `#2DD4BF` | Triangle | `▲` | Solid | Cognitive Flexibility (`CF`) |
| **4** | `--dim-4` | `#9E4778` | `#E899C8` | Diamond | `◆` | Solid | Attention Networks (`AN`) |
| **5** | `--dim-5` | `#A86E00` | `#FACC15` | Pentagon | `⬠` | Solid | Divided Perceptual Speed (`PS`) |
| **6** | `--dim-6` | `#0B76A8` | `#38BDF8` | Hexagon | `⬢` | Solid | Episodic Pattern Separation (`EP`) |
| **7** | `--dim-7` | `#7D7300` | `#F0E442` | Star | `★` | Solid | Visuospatial Planning & $G_f$ (`VP`) |
| **8** | `--dim-8` | `#4F46E5` | `#818CF8` | Cross | `✚` | `4,4` dashed | Surprise Dimension Slot #8 |
| **9** | `--dim-9` | `#0F766E` | `#34D399` | Ring | `◎` | `2,3` dotted | Surprise Dimension Slot #9 |
| **10** | `--dim-10` | `#831843` | `#F472B6` | Hourglass | `⧗` | `6,2,2,2` dash-dot | Surprise Dimension Slot #10 |

### Uncertainty & Low-Confidence Tokens
- `--uncertainty-band-fill`: `rgba(15, 118, 110, 0.16)` (Light) / `rgba(34, 211, 238, 0.18)` (Dark)
- `--uncertainty-low-stroke`: `#9E4778` (Light) / `#F472B6` (Dark)
- **Hatching Threshold Rule**: When `confidence < 0.60`, polygons and progress bars switch from solid fills to `url(#low-confidence-hatch)` (diagonal $45^\circ$ stripes, 8 px pitch) and render the `"Low confidence · Preliminary"` badge.

---

## 4. Typography & Spacing Rhythm

### 4.1 Type Families
- **Display**: `'Fredoka', 'Delius Swash Caps', system-ui, sans-serif` (Weights: `600`, `700`) — Warm, hand-lettered headlines.
- **Reading / UI**: `'Lexend', system-ui, sans-serif` (Weights: `400`, `500`, `600`) — Scientifically optimized for reading speed and reduced visual crowding.
- **Metrics / Monospace**: `'JetBrains Mono', monospace` — Tabular figures (`font-variant-numeric: tabular-nums`) for jitter, RT, and CI intervals.

### 4.2 Spacing Scale (4 px Base Grid)
`4px` (`xs`), `8px` (`sm`), `12px` (`md`), `16px` (`base`), `24px` (`lg`), `32px` (`xl`), `48px` (`2xl`).

### 4.3 Tactile Shadows & Borders
- **Tactile Border**: `2px solid var(--color-border-strong)` (`#1F1B3B` in light theme, `#E8ECFF` in dark theme).
- **Tactile Shadow (`shadow-doodle`)**: `3px 3px 0px var(--color-border-strong)`.
- **Button Active Press**: `translate(2px, 2px)` with shadow reduced to `1px 1px 0px`.

---

## 5. WCAG 2.2 AA Compliance Verification

Every component and page in SynapseTwin is verified against WCAG 2.2 AA:
1. **Automated Contrast**: `npm run check:contrast` checks all 21 Light and Dark color pairs against $\ge 4.5:1$ for body text and $\ge 3.0:1$ for UI boundaries.
2. **Keyboard Focus Rings**: Visible `:focus-visible` offset outlines (`2px solid var(--color-brand)`, `offset 2px`) on all interactive buttons, links, and sliders.
3. **Screen Reader Landmarks**: Skip-to-content link, `role="status"` live regions on banners, and `aria-expanded` attributes on Why-This panels.
4. **Touch Ergonomics**: All interactive click targets have minimum dimensions of $44 \times 44\text{ px}$.

