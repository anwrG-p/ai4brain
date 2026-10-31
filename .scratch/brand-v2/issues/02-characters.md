# 02: Characters (Loti, Dolphin, Momo)

Status: resolved
Blocked by: 01
Spec: `../spec.md` (R1, Design intelligence: clay belongs to characters; Anti-slop rules 2, 9, 10)

## Changes

Create the folder `frontend/src/components/features/characters/`.

Each character is a pure SVG React component in the brand doc's soft-clay style: smooth matte shapes, rounded forms, sky blue with a coral core or accent, a subtle highlight, and the `--clay` depth token. Gradient `stop-color` values come from CSS variables, so lint stays green.

**The characters must look hand-designed and specific, not generic.** Each has a recognisable silhouette, a face with expression, and consistent proportions. Avoid generic glowing blobs: Loti is an orb, but it needs a face, a coral core and a defined shape.

| Character | Props | Look and motion |
|---|---|---|
| `Loti.tsx` (guide) | `pose: 'idle'\|'talk'\|'think'\|'happy'\|'wave'`, `size: 'sm'\|'md'\|'lg'\|'xl'`, `title?` | A sky-blue clay orb with a warm coral core and a friendly face. `talk` animates the mouth only while a bubble is being shown. `happy` pulses the coral core once. |
| `Dolphin.tsx` (celebration) | `pose: 'swim-in'\|'cheer'`, `size` | A rounded, friendly dolphin with a sky body and a coral belly or fin. `swim-in` is a single ease-out entrance; `cheer` is a single hop. |
| `Momo.tsx` (mood) | `mood: 'calm'\|'happy'\|'tired'\|'frustrated'\|'focused'`, `size` | A small round companion whose expression follows the mood. `frustrated` uses a warm grey or amber tint, never red (Anti-Red rule). `MomoFromStore` maps `useEmilyStore` emotions onto these moods; document the mapping. |

**Motion (rule 10)**
- **Still when idle.** Animate only on events: entrance, talk, celebrate, mood change.
- Motion is CSS only.
- Disabled under `prefers-reduced-motion` and `[data-timed-trial="true"]`.

**Accessibility**
- Each character is `role="img"` with a meaningful `aria-label`.

**Wrapper**
- The existing `Mascot.tsx` wrapper renders Loti, with its states mapped to Loti's poses and its props API kept.
- Remove the BrianMascot and NodiCompanion visuals: the halos, pings and framer animation.

## Tests

- Each character and pose renders with its label.
- No `<img>` raster is used.
- No hex values or `rgb()` appear in the markup.
- Reduced motion turns off the animation classes.

## Done when

- `qa:checks` is green.
- Screenshots of each character (light and dark, md and xl) are saved to the scratchpad and described in the report.
- The report says how each character avoids looking like a generic AI illustration.
- Commit with no AI attribution.
