# assessment_engine/client (frozen)

Frozen reference. The maintained copy is `frontend/src/features/assessment/`. Voice opt-in lives only here: the `voice/` toggle and probe were not ported, because the UI ships without voice (decision D1 in `.scratch/member1-ui-integration/spec.md`). This folder still builds and runs on its own (`npm run dev`, `VITE_MOCK_TASKS=1` for mock tasks), but fixes and new features go to the UI copy, not here. Contracts and run commands: [`../README.md`](../README.md).
