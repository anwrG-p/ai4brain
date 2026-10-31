# No server-side emotion inference

*Accepted 2026-10-31. Source: [research §5 and top-10 items 5 and 8](../research/2026-10-31-improvement-opportunities.md#5-emotion-inference-ai-act-and-gdpr).*

**Decision.** Momo's mood is a **guess made on the device by hand-written rules, which the user can correct**. The server never infers emotion from telemetry.

- **On the device only.** `frontend/src/utils/emilyEngine.ts` turns pointer and key timing into a proposed mood. `useEmilyStore` holds it, and Momo shows it. The scripted Loti may read it locally. The mood label never leaves the device: telemetry and the coach request (`POST /v1/coach/chat`) never carry it.
- **Hand-written rules, not a trained model.** Rules written by people are not an "AI system" under the EU AI Act (Recital 12). A model trained to infer emotion would be high-risk emotion recognition under **Annex III 1(c)**. So no learned affect model, on the device or the server.
- **The server never infers emotion.** `/v1/telemetry/event` receives `hesitation_jitter` and `keystroke_latency_ms` for task scoring. `brain_twin_jepa`, `clustering_engine`, `ai_coach` and `dynamic_cache` must not use these fields, or any other telemetry, to infer, label or store an emotion or mood. Archetypes and forecasts describe exercise performance only.
- **A guess the user owns.** Momo only *proposes* "frustrated", "hesitant" or "tired", and the user approves or changes it. `autoAdapt` stays off.
- **First-exposure notice (Art 50(3)).** The first time Momo shows a mood, the user is told that it is a guess from how they tap, and that they can change it. Art 50(3) applies from 2 Aug 2026.

**Why.**
- The AI Act's biometric data includes *behavioural* characteristics (Art 3(34), Recital 14). Inferring "frustrated" from pointer kinematics is therefore likely emotion recognition (Art 3(39)). "Tired" is a physical state and is excluded (Recital 18).
- Consumer use is not banned. Art 5(1)(f) covers only workplaces and education.
- The evidence is weak. In the best field study, cursor speed and distance explained about 17% of the variance in self-reported negative emotion (out-of-sample R² .17, n = 80). Negative emotion made cursors **slower**, not jerkier (Hibbeln et al. 2017). A mood presented as a reading would overclaim.
- An inferred emotion used to treat people differently may be special-category data under GDPR (ICO guidance). Processing that stays on the device likely keeps it out of ePrivacy Art 5(3) (EDPB Guidelines 2/2023, via a summary).

**Consequences.**
- Changing to a trained model, or to any server-side mood inference, needs a new ADR, a DPIA and the Annex III high-risk obligations (now due 2 Dec 2027 under the Digital Omnibus).
- Copy never says "Momo knows how you feel", "we detect your emotions", "100% non-biometric" or "no emotion recognition".
- Frontend work (the notice, opt-in in You → Privacy, not counting staircase errors as strain) is ticket F-D.
