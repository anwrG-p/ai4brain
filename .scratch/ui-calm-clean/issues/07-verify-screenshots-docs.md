# 07: Verify everything, regenerate screenshots, docs

Status: wontfix
Blocked by: 03, 04, 05, 06
Spec: `../spec.md` ("Done when")

## Verify

1. From `frontend/`, run `npm run qa:checks`. It must be green.
2. Run **every** e2e spec on Edge through a scratch config with `channel: 'msedge'`, kept in the scratchpad, not the repo.
   - Axe must be clean in light and dark, with no overflow at 375, 768 and 1440 px.
   - Fix any violation the redesign caused. List any pre-existing failure separately.
3. **Visual pass with screenshots.** Open `/`, `/onboarding`, `/assessment`, `/dashboard`, `/task/working_memory` and one inherited page (for example `/coach`), in light and dark at 1440 and 375 px.
   - Check against the spec: no doodles, Lexend, flat background, one soft elevation, one primary CTA, no nested cards.
   - Record findings in Comments. Fix small inherited-page breakages caused by the token change (for example text that now lacks contrast); list bigger ones as follow-ups.

## Screenshots

The e2e specs write to `docs/ui/screenshots/`. Commit the regenerated images, because they are the UI team's visual record.

## Docs

- `docs/ui/DECISIONS.md`: DEC-010 (from ticket 01) gets the final screenshots list and the follow-ups.
- `docs/design/DESIGN.md` (if it describes "Doodle"): add a short header note "Superseded by DEC-010 (Calm & Clean)" and point to `.scratch/ui-calm-clean/spec.md`.
- Set this ticket and the spec to `Status: resolved`.

## Done when

All of the above pass, and the commits have no AI attribution.

## Comments

- 2026-10-31 (TD-03 tracker hygiene): Superseded by `.scratch/brand-v2/` (brand-v2 ticket 10 verifies and updates docs).
