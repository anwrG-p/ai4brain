# 03: Loti chat (bubbles, scripted brain, coach adapter stub)

Status: ready-for-agent
Blocked by: 02
Spec: `../spec.md` (R2, U5, Anti-slop rule 4). Source: `docs/Loti interface.docx`.

## Interfaces (`frontend/src/features/loti/`)

```ts
type LotiChoice = { id: string; label: string; action?: LotiAction }
type LotiAction =
  | { kind: 'train'; pillar?: PillarId; schemaType?: TaskSchemaType }
  | { kind: 'navigate'; to: string }
  | { kind: 'setGoal'; pillar: PillarId; target: number }
  | { kind: 'reply'; nodeId: string }
type LotiMessage = { id: string; text: string; choices: LotiChoice[]; pose?: LotiPose }
type LotiContext = { now: Date; weakestPillar?: PillarId; mood?: Mood; hasGoalsThisYear: boolean; sessionsThisWeek: number }
interface LotiBrain {
  opening(ctx: LotiContext): LotiMessage | null
  respond(nodeId: string, choiceId: string, ctx: LotiContext): LotiMessage | null
}
```

- **`scriptedBrain.ts`** implements the doc's examples deterministically:
  - weakest pillar: "Want to improve it?" → Yes → train
  - new year goals, which feed into setGoal
  - "How was your day?" with choices great / okay / tough
  - a weekend-night nudge
  - a sunshine or morning nudge

  Messages are at most 120 characters, in Loti's voice: warm and specific. No hype words (rule 4), no brain regions, no chemical claims.
- **`coachAdapter.ts`** is a `LotiBrain` stub for Member 2's coach. It makes no network calls and falls back to the scripted brain. Document the doc's memory rule there: send only what the user has actually read.

## UI

- **`LotiBubbles.tsx`**
  - Shows a small Loti and **one** bubble at a time.
  - Choices are pill chips, keyboard reachable and 44 px tall.
  - A "Not now" button dismisses the bubble (lets the user cut Loti off); the conversation can resume later.
  - New bubbles are announced with `aria-live="polite"`.
  - Loti's `talk` pose plays only while a bubble enters.
- **`useLotiActions`** executes actions:
  - train → `/task/...` or `/train?pillar=`
  - navigate
  - setGoal → the goals store from ticket 04. If ticket 04 hasn't landed, define a small goals slice that ticket 04 will adopt.

## Tests

- Script tests cover every context's opening and every choice's next step.
- Every message is at most 120 characters.
- The lint-copy banned terms and the anti-slop hype list are absent from all script text.
- UI tests: a chip click advances the conversation, "Not now" dismisses it, and the keyboard works.

## Done when

`qa:checks` is green, and the commit has no AI attribution.
