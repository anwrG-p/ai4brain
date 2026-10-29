import type {
  BrainTwinSnapshot,
  CollaborationScorePayload,
  DimensionConfig,
  DimensionEstimate,
  FatigueHeatmapCell,
  HabitContract,
  TrajectoryPoint,
  WhyThisTrail,
} from '../../types'
import type { PersonaId } from '../../state/useAppStore'

/**
 * Generates deterministic, uncertainty-aware dimension estimates for any 3..10 dimension preset
 * and any of the 6 personas/edge fixtures.
 */
export function buildEstimatesForDimensions(
  dimensions: readonly DimensionConfig[],
  persona: PersonaId,
): DimensionEstimate[] {
  return dimensions.map((dim, idx) => {
    // Edge fixture: first dimension unassessed (null) to verify partial state
    if (persona === 'edge-missing-dim' && idx === 0) {
      return {
        dimensionId: dim.id,
        backendDimensionKey: dim.backendDimensionKey,
        scorePct: null,
        ciLowerPct: 0,
        ciUpperPct: 0,
        uncertaintySigma: 0,
        confidence: 0,
        isLowConfidence: true,
        sampleSize: 0,
        meanRtMs: 0,
        errorRatePct: 0,
        hesitationJitterMs: 0,
        speedAccuracyProfile: 'deliberate',
        trendDeltaPct: 0,
        lastUpdatedIso: '2026-10-24T12:00:00Z',
      }
    }

    if (persona === 'new-user') {
      return {
        dimensionId: dim.id,
        backendDimensionKey: dim.backendDimensionKey,
        scorePct: null,
        ciLowerPct: 0,
        ciUpperPct: 0,
        uncertaintySigma: 0,
        confidence: 0,
        isLowConfidence: true,
        sampleSize: 0,
        meanRtMs: 0,
        errorRatePct: 0,
        hesitationJitterMs: 0,
        speedAccuracyProfile: 'deliberate',
        trendDeltaPct: 0,
        lastUpdatedIso: '2026-10-24T12:00:00Z',
      }
    }

    const isNoisyPersona = persona === 'noisy-low-confidence'
    const baseScore = isNoisyPersona
      ? 54 + ((idx * 9) % 24)
      : 68 + ((idx * 7) % 22)
    const isLowConf = isNoisyPersona ? idx % 2 === 0 : idx === 5
    const halfBand = isLowConf ? 16 : 5 + (idx % 3)
    const confidence = isLowConf ? 0.48 : 0.84 - (idx % 3) * 0.04

    return {
      dimensionId: dim.id,
      backendDimensionKey: dim.backendDimensionKey,
      scorePct: Math.min(96, Math.max(20, baseScore)),
      ciLowerPct: Math.max(0, baseScore - halfBand),
      ciUpperPct: Math.min(100, baseScore + halfBand),
      uncertaintySigma: Math.round((halfBand / 1.96) * 10) / 10,
      confidence: Math.round(confidence * 100) / 100,
      isLowConfidence: isLowConf,
      sampleSize: isLowConf ? 4 : 18 + idx * 3,
      meanRtMs: 540 + idx * 45 + (isNoisyPersona ? 160 : 0),
      errorRatePct: isLowConf ? 24 : 12,
      hesitationJitterMs: isLowConf ? 195 : 64,
      speedAccuracyProfile: isLowConf
        ? 'impulsive_error'
        : idx % 2 === 0
          ? 'fast_accurate'
          : 'deliberate',
      trendDeltaPct: isNoisyPersona ? -2 + idx : 4 + (idx % 5),
      lastUpdatedIso: '2026-10-24T12:00:00Z',
    }
  })
}

export const SAMPLE_WHY_THIS_TRAIL: WhyThisTrail = {
  id: 'why-wm-dual-stream',
  observedData: [
    'Working Memory 2-back accuracy reached 88% across 18 trials (mean RT: 585 ms).',
    'Rule-switch trials showed only a +62 ms latency cost with zero error bursts.',
    'Episodic Pattern Separation confidence remains preliminary (48%, ±16% band) due to only 4 completed lure trials.',
  ],
  inference:
    'SAT-JEPA prototype differential vector (Δc) indicates strong working-memory stability ready for dual-stream progression, while Episodic Separation needs 6 additional lure-discrimination trials to narrow uncertainty.',
  recommendation:
    'Run a 2-minute Mnemonic Similarity calibration block next, followed by Level 3 Dual-Stream N-Back.',
  confidence: 0.86,
  counterfactual:
    'If 2+ consecutive error bursts occur or response-time jitter exceeds 180 ms, the staircase will step back to single-stream 2-back automatically.',
  sourceModule: 'sat_jepa_delta_c',
}

export const SAMPLE_COLLABORATION_SCORE: CollaborationScorePayload = {
  totalScore: 82,
  ciRange: [78, 86],
  statusBadge: 'Design proposal, not validated',
  formulaDisplay:
    'S_collab = 0.20·Clarification + 0.25·Verification + 0.20·Iteration + 0.20·Autonomy + 0.15·ResponsibleUse',
  subScores: [
    {
      key: 'clarification',
      label: 'Clarification',
      defaultWeightPct: 20,
      activeDynamicWeightPct: 20,
      score: 85,
      evidenceCount: 6,
      recentEvents: ['Asked why UFOV duration changed after block 2'],
      howToImprove: 'Ask a targeted question whenever a confidence band widens.',
    },
    {
      key: 'verification',
      label: 'Critical Verification',
      defaultWeightPct: 25,
      activeDynamicWeightPct: 25,
      score: 88,
      evidenceCount: 8,
      recentEvents: ['Inspected "Why this?" trail on 4 coach recommendations'],
      howToImprove: 'Continue comparing AI suggestions against your raw trial telemetry.',
    },
    {
      key: 'iteration',
      label: 'Iteration',
      defaultWeightPct: 20,
      activeDynamicWeightPct: 20,
      score: 79,
      evidenceCount: 5,
      recentEvents: ['Refined weekly goal target after reviewing fatigue heatmap'],
      howToImprove: 'Adjust exercise pacing after reviewing post-block feedback.',
    },
    {
      key: 'autonomy',
      label: 'Autonomy',
      defaultWeightPct: 20,
      activeDynamicWeightPct: 20,
      score: 76,
      evidenceCount: 4,
      recentEvents: ['Selected self-paced practice before scored block'],
      howToImprove: 'Initiate one self-chosen dimension exercise before asking the coach.',
    },
    {
      key: 'responsible_use',
      label: 'Responsible Use',
      defaultWeightPct: 15,
      activeDynamicWeightPct: 15,
      score: 92,
      evidenceCount: 7,
      recentEvents: ['Reviewed Privacy Center & non-biometric telemetry settings'],
      howToImprove: 'Keep non-biometric defaults active and respect rest breaks.',
    },
  ],
  whyThis: SAMPLE_WHY_THIS_TRAIL,
}

export interface CollabHistoryPoint {
  weekKey: string
  weekLabel: string
  score: number
  ciLower: number
  ciUpper: number
  actionsCount: number
}

export const COLLABORATION_LONGITUDINAL_HISTORY: CollabHistoryPoint[] = [
  { weekKey: 'W1', weekLabel: 'Week 1 (Baseline)', score: 64, ciLower: 56, ciUpper: 72, actionsCount: 4 },
  { weekKey: 'W2', weekLabel: 'Week 2', score: 68, ciLower: 61, ciUpper: 75, actionsCount: 9 },
  { weekKey: 'W3', weekLabel: 'Week 3', score: 72, ciLower: 66, ciUpper: 78, actionsCount: 15 },
  { weekKey: 'W4', weekLabel: 'Week 4', score: 76, ciLower: 71, ciUpper: 81, actionsCount: 21 },
  { weekKey: 'W5', weekLabel: 'Week 5', score: 79, ciLower: 74, ciUpper: 84, actionsCount: 26 },
  { weekKey: 'W6', weekLabel: 'Week 6 (Current)', score: 82, ciLower: 78, ciUpper: 86, actionsCount: 30 },
]

export function buildCollaborationScoreForPersona(
  persona: PersonaId,
): CollaborationScorePayload {
  if (persona === 'noisy-low-confidence') {
    return {
      totalScore: 61,
      ciRange: [52, 70],
      statusBadge: 'Design proposal, not validated',
      formulaDisplay:
        'S_collab = 0.20·Clarification + 0.25·Verification + 0.20·Iteration + 0.20·Autonomy + 0.15·ResponsibleUse',
      subScores: [
        {
          key: 'clarification',
          label: 'Clarification',
          defaultWeightPct: 20,
          activeDynamicWeightPct: 24,
          score: 62,
          evidenceCount: 2,
          recentEvents: ['Single question submitted on task duration'],
          howToImprove: 'Inquire when confidence bands widen to guide the model.',
        },
        {
          key: 'verification',
          label: 'Critical Verification',
          defaultWeightPct: 25,
          activeDynamicWeightPct: 26,
          score: 58,
          evidenceCount: 3,
          recentEvents: ['Inspected 1 why-this panel'],
          howToImprove: 'Cross-check suggested staircase levels against your past trial speed.',
        },
        {
          key: 'iteration',
          label: 'Iteration',
          defaultWeightPct: 20,
          activeDynamicWeightPct: 20,
          score: 60,
          evidenceCount: 2,
          recentEvents: ['Default weekly plan accepted without adjustments'],
          howToImprove: 'Fine-tune session frequency when fatigue signals appear.',
        },
        {
          key: 'autonomy',
          label: 'Autonomy',
          defaultWeightPct: 20,
          activeDynamicWeightPct: 15,
          score: 54,
          evidenceCount: 1,
          recentEvents: ['Started 1 scheduled task'],
          howToImprove: 'Launch a self-selected dimension drill.',
        },
        {
          key: 'responsible_use',
          label: 'Responsible Use',
          defaultWeightPct: 15,
          activeDynamicWeightPct: 15,
          score: 75,
          evidenceCount: 3,
          recentEvents: ['Telemetry settings confirmed'],
          howToImprove: 'Review rest recommendations after intense blocks.',
        },
      ],
      whyThis: {
        ...SAMPLE_WHY_THIS_TRAIL,
        observedData: [
          'High response-time variance across 2 recent sessions',
          '3 total explainability panel audits in past 14 days',
          'Epistemic uncertainty elevated (sigma = 0.22)',
        ],
        inference:
          'Emerging collaborative profile with moderate telemetry density; verification habits developing.',
        confidence: 0.64,
      },
    }
  }

  if (persona === 'new-user') {
    return {
      totalScore: 55,
      ciRange: [44, 66],
      statusBadge: 'Design proposal, not validated',
      formulaDisplay:
        'S_collab = 0.20·Clarification + 0.25·Verification + 0.20·Iteration + 0.20·Autonomy + 0.15·ResponsibleUse',
      subScores: [
        {
          key: 'clarification',
          label: 'Clarification',
          defaultWeightPct: 20,
          activeDynamicWeightPct: 20,
          score: 50,
          evidenceCount: 1,
          recentEvents: ['Baseline orientation question'],
          howToImprove: 'Ask questions as you explore different task paradigms.',
        },
        {
          key: 'verification',
          label: 'Critical Verification',
          defaultWeightPct: 25,
          activeDynamicWeightPct: 25,
          score: 50,
          evidenceCount: 1,
          recentEvents: ['First explainability review completed'],
          howToImprove: 'Review "Why This?" reasoning on future coach insights.',
        },
        {
          key: 'iteration',
          label: 'Iteration',
          defaultWeightPct: 20,
          activeDynamicWeightPct: 20,
          score: 50,
          evidenceCount: 1,
          recentEvents: ['Baseline calibration logged'],
          howToImprove: 'Adjust pacing after completing your first weekly micro-block.',
        },
        {
          key: 'autonomy',
          label: 'Autonomy',
          defaultWeightPct: 20,
          activeDynamicWeightPct: 20,
          score: 55,
          evidenceCount: 1,
          recentEvents: ['Self-selected starting dimension'],
          howToImprove: 'Explore unprompted practice drills.',
        },
        {
          key: 'responsible_use',
          label: 'Responsible Use',
          defaultWeightPct: 15,
          activeDynamicWeightPct: 15,
          score: 72,
          evidenceCount: 2,
          recentEvents: ['Privacy preferences and non-biometric lock saved'],
          howToImprove: 'Maintain healthy break rhythms between assessment blocks.',
        },
      ],
      whyThis: {
        ...SAMPLE_WHY_THIS_TRAIL,
        observedData: [
          'First onboarding baseline completed',
          'Initial telemetry lock confirmed',
        ],
        inference:
          'Baseline collaboration state established; requires additional interactive sessions to narrow confidence interval.',
        confidence: 0.52,
      },
    }
  }

  return SAMPLE_COLLABORATION_SCORE
}

export function buildSnapshotsForDimensions(
  dimensions: readonly DimensionConfig[],
  persona: PersonaId,
): BrainTwinSnapshot[] {
  const currentEstimates = buildEstimatesForDimensions(dimensions, persona)
  const earlierEstimates = currentEstimates.map((est) => ({
    ...est,
    scorePct: est.scorePct !== null ? Math.max(20, est.scorePct - 7) : null,
    ciLowerPct: Math.max(0, est.ciLowerPct - 11),
    ciUpperPct: Math.min(100, est.ciUpperPct - 3),
    confidence: Math.max(0.42, Math.round((est.confidence - 0.14) * 100) / 100),
    isLowConfidence: est.confidence - 0.14 < 0.6,
  }))

  return [
    {
      snapshotId: 'snap-week-1',
      timestampIso: '2026-09-15T10:00:00Z',
      label: 'Week 1 Baseline',
      triggerEvent: 'Initial 2-minute Quick Baseline completed',
      archetypeName: 'Exploratory Calibrator (Cluster C2)',
      clusterId: 2,
      overallConfidence: 0.56,
      estimates: earlierEstimates,
    },
    {
      snapshotId: 'snap-current',
      timestampIso: '2026-10-24T12:00:00Z',
      label: 'Current Brain Twin (Week 6)',
      triggerEvent: 'Post-session SAT-JEPA update (Hysteresis stable)',
      archetypeName: 'Steady Analytical Builder (Cluster C5)',
      clusterId: 5,
      overallConfidence: persona === 'noisy-low-confidence' ? 0.54 : 0.84,
      estimates: currentEstimates,
    },
  ]
}

/**
 * Generates 6 weeks of observed trajectory points (W1..W6) plus 2 weeks of projected fan
 * (+1 Wk, +2 Wk) with widening epistemic uncertainty intervals for Signature #4 <ProjectionFanChart />.
 */
export function buildTrajectoryForTarget(
  targetId: string, // 'composite' or dimensionId
  persona: PersonaId,
  slotSeed = 1,
): TrajectoryPoint[] {
  const isNoisy = persona === 'noisy-low-confidence'
  const baseStart = isNoisy ? 52 + (slotSeed % 8) : 62 + (slotSeed % 10)
  const weeklyGain = isNoisy ? 1.5 : 2.6

  const weeks: { key: string; label: string; isProj: boolean }[] = [
    { key: 'W1', label: 'Week 1 (Baseline)', isProj: false },
    { key: 'W2', label: 'Week 2', isProj: false },
    { key: 'W3', label: 'Week 3', isProj: false },
    { key: 'W4', label: 'Week 4', isProj: false },
    { key: 'W5', label: 'Week 5', isProj: false },
    { key: 'W6', label: 'Week 6 (Current)', isProj: false },
    { key: '+1 Wk', label: '+1 Week Forecast', isProj: true },
    { key: '+2 Wk', label: '+2 Weeks Forecast', isProj: true },
  ]

  return weeks.map((w, idx) => {
    const jitter = isNoisy && idx % 2 === 1 ? -3 : 0
    const rawScore = Math.round(
      Math.min(95, Math.max(30, baseStart + idx * weeklyGain + jitter)),
    )
    // Observed CI narrows from W1 (±14%) to W6 (±5%); Projected fan widens (+1 Wk: ±9%, +2 Wk: ±13%)
    const halfBand = w.isProj
      ? isNoisy
        ? 16 + (idx - 5) * 4
        : 8 + (idx - 5) * 4
      : isNoisy
        ? Math.max(11, 18 - idx)
        : Math.max(5, 13 - idx * 1.5)

    const roundedHalf = Math.round(halfBand)
    const confidence = w.isProj
      ? isNoisy
        ? 0.44
        : 0.68 - (idx - 6) * 0.08
      : isNoisy
        ? 0.52 + idx * 0.01
        : Math.min(0.88, 0.58 + idx * 0.05)

    return {
      weekKey: w.key,
      weekLabel: `${w.label} (${targetId})`,
      scorePct: rawScore,
      ciLowerPct: Math.max(10, rawScore - roundedHalf),
      ciUpperPct: Math.min(99, rawScore + roundedHalf),
      confidence: Math.round(confidence * 100) / 100,
      isProjected: w.isProj,
      sessionCount: w.isProj ? 0 : isNoisy ? 1 + (idx % 2) : 3 + (idx % 2),
    }
  })
}

/**
 * Generates the 3 (Time Windows) x 7 (Days) Session Fatigue & Alertness Heatmap matrix.
 */
export function buildFatigueHeatmap(persona: PersonaId): FatigueHeatmapCell[] {
  const days: readonly FatigueHeatmapCell['dayKey'][] = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ]
  const windows: readonly {
    id: FatigueHeatmapCell['windowId']
    label: string
  }[] = [
    { id: 'morning', label: 'Morning (08:00–12:00)' },
    { id: 'afternoon', label: 'Afternoon (13:00–17:00)' },
    { id: 'evening', label: 'Evening (18:00–22:00)' },
  ]

  const isNoisy = persona === 'noisy-low-confidence'
  const cells: FatigueHeatmapCell[] = []

  windows.forEach((win, wIdx) => {
    days.forEach((day, dIdx) => {
      // Leave a couple of weekend slots unlogged for realism
      if ((wIdx === 1 && dIdx >= 5) || (wIdx === 0 && dIdx === 6)) {
        cells.push({
          windowId: win.id,
          windowLabel: win.label,
          dayKey: day,
          readinessPct: null,
          meanRtMs: null,
          status: 'unlogged',
          glyph: '—',
        })
        return
      }

      const baseReadiness =
        wIdx === 0
          ? isNoisy
            ? 74
            : 89
          : wIdx === 1
            ? isNoisy
              ? 66
              : 78
            : isNoisy
              ? 51
              : 63

      const score = Math.min(
        96,
        Math.max(42, baseReadiness + ((dIdx * 3) % 7) - 3),
      )
      const rt =
        wIdx === 0
          ? 545 + dIdx * 8
          : wIdx === 1
            ? 610 + dIdx * 10
            : 695 + dIdx * 14 + (isNoisy ? 85 : 0)

      const status: FatigueHeatmapCell['status'] =
        score >= 80 ? 'optimal' : score >= 65 ? 'moderate' : 'fatigued'
      const glyph: FatigueHeatmapCell['glyph'] =
        status === 'optimal' ? '●' : status === 'moderate' ? '◐' : '▲'

      cells.push({
        windowId: win.id,
        windowLabel: win.label,
        dayKey: day,
        readinessPct: score,
        meanRtMs: rt,
        status,
        glyph,
      })
    })
  })

  return cells
}

export const SAMPLE_HABIT_CONTRACTS: HabitContract[] = [
  {
    id: 'contract-wm-1',
    dimensionId: 'working_memory',
    dimensionName: 'Working Memory (Updating)',
    objectiveType: 'capacity',
    title: 'Dual-Stream N-Back Capacity Stretch',
    targetDeltaPct: 10,
    currentProgressPct: 62,
    baselineScorePct: 68,
    currentScorePct: 74,
    etaDaysRange: [18, 24],
    confidencePct: 84,
    weeklyCommitment: '3 micro-sessions / wk (90s block)',
    scheduledRestDay: 'Sunday (Consolidation)',
    streakDays: 18,
    status: 'active',
    rationale:
      'Bayesian QUEST+ tracks steady +0.55% theta gain per micro-block; response-time jitter is low across morning peak slots.',
  },
  {
    id: 'contract-cf-2',
    dimensionId: 'cognitive_flexibility',
    dimensionName: 'Cognitive Flexibility (Set-Shifting)',
    objectiveType: 'stability',
    title: 'Task-Switching Response Stability',
    targetDeltaPct: 8,
    currentProgressPct: 80,
    baselineScorePct: 62,
    currentScorePct: 71,
    etaDaysRange: [12, 16],
    confidencePct: 88,
    weeklyCommitment: '2 micro-sessions / wk (Afternoon)',
    scheduledRestDay: 'Wednesday & Sunday',
    streakDays: 14,
    status: 'active',
    rationale:
      'Variance reduction priority: reducing reaction-time hesitation during high-switch-cost color-word trials.',
  },
  {
    id: 'contract-ep-3',
    dimensionId: 'episodic_pattern_separation',
    dimensionName: 'Episodic Pattern Separation',
    objectiveType: 'maintenance',
    title: 'Mnemonic Discrimination Pacing',
    targetDeltaPct: 12,
    currentProgressPct: 45,
    baselineScorePct: 54,
    currentScorePct: 63,
    etaDaysRange: [21, 28],
    confidencePct: 66,
    weeklyCommitment: 'Proactive Recovery Active · Zero Penalty',
    scheduledRestDay: 'Today (Memory Consolidation)',
    streakDays: 9,
    status: 'pacing_rest',
    rationale:
      'Fatigue signals detected in session 4. Rest day engaged to solidify memory consolidation while preserving your 9-day streak.',
  },
]

export function calculateBayesianEta(
  targetDelta: number,
  learningRate = 0.52,
  varianceSigma = 2.4,
): [number, number] {
  const meanDays = Math.max(5, Math.round(targetDelta / (learningRate * 0.95)))
  const halfBand = Math.max(2, Math.round(varianceSigma * 1.28))
  return [Math.max(3, meanDays - halfBand), meanDays + halfBand]
}


import type { PrivacyAuditEvent } from '../../types'

export const MOCK_PRIVACY_AUDIT_LOG: PrivacyAuditEvent[] = [
  {
    id: 'evt-aud-01',
    timestampIso: '2026-10-25T01:45:12Z',
    eventType: 'consent_updated',
    fieldScope: 'researchExport: false',
    payloadSummary: 'User modified research benchmark export preference to false.',
    hash: 'SHA256: 4f98a2d1e0b57c6312a890ef9923bc4589d71e230912f458129a0ef1982b6192',
    status: 'verified',
  },
  {
    id: 'evt-aud-02',
    timestampIso: '2026-10-25T01:30:00Z',
    eventType: 'snapshot_stored',
    fieldScope: 'sat_jepa_snapshot_vector',
    payloadSummary: 'Longitudinal Brain Twin manifold snapshot #14 committed to local encrypted store.',
    hash: 'SHA256: e82189fb7320c19a45610ef091a273b543187a0b5c43d89ef210984a51982734',
    status: 'verified',
  },
  {
    id: 'evt-aud-03',
    timestampIso: '2026-10-25T01:12:44Z',
    eventType: 'telemetry_batched',
    fieldScope: 'rt_ms, error_flag, hesitation_jitter_ms',
    payloadSummary: 'Assessment trial batch of 12 non-biometric events validated and ingested.',
    hash: 'SHA256: a098b14251cd987e65140af91823bc5419028374a56b4129e0182743a19b8271',
    status: 'verified',
  },
  {
    id: 'evt-aud-04',
    timestampIso: '2026-10-25T00:58:19Z',
    eventType: 'coach_analyzed',
    fieldScope: 'collab_rubric_events',
    payloadSummary: 'AI Coach generated explainable feedback trail based on delta-c vectors.',
    hash: 'SHA256: 7d9a8e024b1c902835471029e847b29384710293847102938471029384710293',
    status: 'verified',
  },
  {
    id: 'evt-aud-05',
    timestampIso: '2026-10-24T22:15:08Z',
    eventType: 'consent_updated',
    fieldScope: 'nonBiometricMode: true (LOCKED)',
    payloadSummary: 'System hardware verification confirmed camera and microphone disengaged.',
    hash: 'SHA256: 9b28347109283471092834710928347109283471092834710928347109283471',
    status: 'verified',
  },
  {
    id: 'evt-aud-06',
    timestampIso: '2026-10-24T18:00:00Z',
    eventType: 'data_exported',
    fieldScope: 'cistac-v1.0 complete archive',
    payloadSummary: 'Self-service GDPR Article 20 data portability archive downloaded.',
    hash: 'SHA256: 1290384710293847102938471029384710293847102938471029384710293847',
    status: 'verified',
  },
]
