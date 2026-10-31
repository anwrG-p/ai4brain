import { getDimensionsByPreset, type DimensionPresetKey } from '../../config/dimensions'
import type { TaskSchemaType } from '../../types'

/** The five pillars (spec "Five pillars"). */
export const PILLAR_IDS = ['focus', 'agility', 'impulse', 'memory', 'visual'] as const
export type PillarId = (typeof PILLAR_IDS)[number]

/** Consumer names, the only pillar wording shown in the UI (U5). */
export const PILLAR_LABELS: Record<PillarId, string> = {
  focus: 'Focus & Strategy',
  agility: 'Mental Agility',
  impulse: 'Impulse Control',
  memory: 'Deep Memory',
  visual: 'Visual Radar',
}

export function isPillarId(value: unknown): value is PillarId {
  return typeof value === 'string' && (PILLAR_IDS as readonly string[]).includes(value)
}

/* ---------------------------------------------------------------------------------------------
   The doc's model ("Rou7 zebda cognitive intelligence", RADAR SCORES). Input names are the doc's.
   Every input is a 0-100 score; taskScores.ts derives them from telemetry events.

   SCALE ANCHORS, GATES AND SPLITS MARKED (A) ARE ASSUMPTIONS TO TUNE AGAINST MEMBER 3'S DATA, NOT
   EVIDENCE. The formulas themselves (d' log-linear, LDI, Stroop RT cost on correct trials) follow
   docs/research/2026-10-30-member1-evidence-review.md sections 1.1-1.3.

   OSPAN                 n-back d' on the rule stream (log-linear correction, Hautus 1995), switch
                         trials left out, floored at 0 when hit rate <= false-alarm rate;
                         (A) d' 0 -> 0, d' 4 -> 100
   OTS_Planning          tower: (A) 0.8 x share solved in minimum moves + 0.2 x planning speed on
                         those, (A) planning 0 s -> 1, 30 s -> 0
   OTS_Execution         tower: mean of l_min / l_user (0 when unsolved)
   FluidMatrices         mean of matrix accuracy and relational accuracy weighted by hops
   ANT_Conflict          Stroop RT cost (incongruent - congruent, correct trials), (A) 0 ms -> 100,
                         300 ms -> 0, times the gate (accuracy - 1/4) / (3/4) (chance = 4 inks);
                         0 when accuracy is at chance and no cost can be measured
   DCCS_SwitchCost       n-back accuracy on switch trials vs the rule stream's non-switch noise
                         trials, (A) cost 0 -> 100, 0.5 -> 0, times the gate min(1, d' / 1) (A)
   ErrorRecovery         accuracy on the trial right after an error, all exercises; tasks played at
                         chance (n-back d' 0, Stroop accuracy <= 1/4) are left out
   SST_SSRT              PROXY: Stroop incongruent accuracy (no stop-signal task exists)
   DDM_Caution           omitted: no source
   PAL_FirstTrialMemory  omitted: no source
   MST_LDI               P(similar | lure) - P(similar | new), clamped to 0..1
   UFOV_SOA              QUEST threshold, 17 ms -> 100, 500 ms -> 0 (the payload's duration grid)
   ANT_Orienting         UFOV peripheral accuracy

   The gates exist so doing nothing (or pressing at random) scores low: a difference score alone
   is ~0 for a disengaged user, which would read as a perfect 100.
   --------------------------------------------------------------------------------------------- */

export const INPUT_IDS = [
  'OSPAN',
  'OTS_Planning',
  'OTS_Execution',
  'FluidMatrices',
  'ANT_Conflict',
  'DCCS_SwitchCost',
  'ErrorRecovery',
  'SST_SSRT',
  'DDM_Caution',
  'PAL_FirstTrialMemory',
  'MST_LDI',
  'UFOV_SOA',
  'ANT_Orienting',
] as const
export type InputId = (typeof INPUT_IDS)[number]

export function isInputId(value: unknown): value is InputId {
  return typeof value === 'string' && (INPUT_IDS as readonly string[]).includes(value)
}

/** One input: a 0-100 score, the trials behind it, and whether it stands in for the doc's measure. */
export type InputScore = { score: number; trials: number; proxy?: true }
export type TaskScores = Partial<Record<InputId, InputScore>>

/** The doc's weights, verbatim. Each pillar sums to 1. */
export const PILLAR_WEIGHTS: Record<PillarId, Partial<Record<InputId, number>>> = {
  focus: { OSPAN: 0.45, OTS_Planning: 0.3, FluidMatrices: 0.25 },
  agility: { ANT_Conflict: 0.4, DCCS_SwitchCost: 0.4, ErrorRecovery: 0.2 },
  impulse: { SST_SSRT: 0.5, OTS_Execution: 0.3, DDM_Caution: 0.2 },
  memory: { MST_LDI: 0.55, PAL_FirstTrialMemory: 0.45 },
  visual: { UFOV_SOA: 0.5, ANT_Orienting: 0.5 },
}

export type PillarScore = {
  /** 0-100, or null when coverage is below MIN_COVERAGE. */
  score: number | null
  /** Half-width of a ~95% band, in score points (0-50). */
  uncertainty: number
  /** Share of the pillar's weight that had data (0-1). */
  coverage: number
  /** Inputs used that only stand in for the doc's measure. */
  proxies: InputId[]
}

export const MIN_COVERAGE = 0.3
const MAX_UNCERTAINTY = 50
/** Inputs with no source by design: they lower `coverage` but do not widen the band forever. */
export const UNSOURCED_INPUTS: readonly InputId[] = ['DDM_Caution', 'PAL_FirstTrialMemory']

/** Scores every pillar from the inputs that are there, renormalising the weights over them.
    Uncertainty: each input's standard error is taken as the worst-case binomial one, 50 / sqrt(trials)
    points; they combine with the renormalised weights, and the result is divided by the coverage of
    the SOURCEABLE inputs (UNSOURCED_INPUTS excluded), so the band widens as trials drop and as
    inputs that could have been measured go missing. 1.96 x that, capped at 50. `coverage` itself
    stays the doc-weight share.
    ponytail: worst-case binomial SE, not a fitted measurement model; Member 3's profile can replace it. */
export function pillarScores(inputs: TaskScores): Record<PillarId, PillarScore> {
  const out = {} as Record<PillarId, PillarScore>
  for (const pillar of PILLAR_IDS) {
    let coverage = 0
    let sourceable = 0
    let sum = 0
    const used: [number, InputScore][] = []
    const proxies: InputId[] = []
    for (const [id, w] of Object.entries(PILLAR_WEIGHTS[pillar]) as [InputId, number][]) {
      if (!UNSOURCED_INPUTS.includes(id)) sourceable += w
      const input = inputs[id]
      if (!input) continue
      coverage += w
      sum += w * input.score
      used.push([w, input])
      if (input.proxy) proxies.push(id)
    }
    let uncertainty = MAX_UNCERTAINTY
    if (coverage > 0 && used.every(([, i]) => i.trials > 0)) {
      const variance = used.reduce((v, [w, i]) => v + (w / coverage) ** 2 * (2500 / i.trials), 0)
      uncertainty = Math.min(MAX_UNCERTAINTY, (1.96 * Math.sqrt(variance)) / Math.min(1, coverage / sourceable))
    }
    out[pillar] = { score: coverage >= MIN_COVERAGE ? sum / coverage : null, uncertainty, coverage, proxies }
  }
  return out
}

/** The overall score: the plain mean of the pillars that have a score (the doc gives no weights
    across pillars), or null when none has. */
export function unifiedScore(pillars: Record<PillarId, PillarScore>): number | null {
  const scores = PILLAR_IDS.map((p) => pillars[p].score).filter((s): s is number => s !== null)
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
}

export type Training = { dimId: string; schema: TaskSchemaType }

/** The first dimension of the active preset that has `schema`, or null. Which exercise practises a
    pillar is the Train catalog's call (TRAIN_EXERCISES, features/train/catalog.ts). */
export function dimensionFor(schema: TaskSchemaType, preset: DimensionPresetKey = '7'): Training | null {
  const dim = getDimensionsByPreset(preset).find((d) => d.schemaTypes.includes(schema))
  return dim ? { dimId: dim.id, schema } : null
}
