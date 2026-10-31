# 10: Verify, anti-slop audit, screenshots, DEC-011, docs

Status: resolved
Blocked by: 01–09
Spec: `../spec.md` ("Constraints", "Anti-slop rules")

## Steps

1. **Checks.** From `frontend/`, run `npm run qa:checks`, then every e2e spec on Edge through the scratch config.
   - Axe must be clean in light and dark.
   - There must be no overflow at 375, 768 and 1440 px.
2. **Anti-slop audit.** Open every page in light and dark at 1440 and 375 px and grade it against the spec's 12 anti-slop rules.
   - Record a pass or fail per rule, per page, in Comments, with a screenshot path for each.
   - Fix every fail, or list it as a follow-up with a reason.
3. **UI/UX Pro Max pre-delivery checklist.** Run its §1–§3 (accessibility, touch, performance) and its light/dark checklist on the 4 key screens: Welcome, Results, Dashboard, Train.
4. **Screenshots.** Commit the regenerated `docs/ui/screenshots/`.
5. **Docs.**
   - **DEC-011** in `docs/ui/DECISIONS.md`: the brand v2 direction. It supersedes DEC-010, and supersedes DEC-007 for the redesigned pages. Record the user decisions U1–U5 and rulings R1–R7.
   - **`assessment_engine/HANDOVER.md`:** the consent gate and the new flow.
   - **`assessment_engine/GUIDE.md`:** where exercises appear now (baseline flow, Train page).
   - Set the spec and all tickets to `Status: resolved`.

## Done when

All the checks pass, the audit table is complete, and the commit has no AI attribution.
