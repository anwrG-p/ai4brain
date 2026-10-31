// Core domain contracts mirroring docs/ui/contracts.md and assessment_engine/api/routes/telemetry.py

export type BackendDimensionKey =
  | 'working_memory'
  | 'pattern_induction'
  | 'executive_function'
  | 'spatial_orientation'
  | 'processing_speed'
  | 'episodic_memory'

export type TaskSchemaType =
  | 'n_back'
  | 'stroop'
  | 'matrix'
  | 'mental_rotation'
  | 'relational'
  | 'tower'
  | 'ufov'
  | 'mst'

export type MarkerShape =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'cross'
  | 'ring'
  | 'hourglass'

export interface DimensionConfig {
  id: string
  code: string
  slotIndex: number // 1..10
  name: string
  consumerLabel?: string
  shortDescription: string
  scientificDefinition: string
  taskName: string
  scoringMethod: string
  uncertaintyNote: string
  knownBiases: string[]
  backendDimensionKey: BackendDimensionKey
  schemaTypes: TaskSchemaType[]
  colorCssVar: string // e.g. 'var(--dim-1)'
  markerShape: MarkerShape
  markerGlyph: string // e.g. '●', '■', '▲'
  strokeDasharray?: string
}

export interface DimensionEstimate {
  dimensionId: string
  backendDimensionKey: BackendDimensionKey
  scorePct: number | null // null when unassessed (partial profile state)
  ciLowerPct: number
  ciUpperPct: number
  uncertaintySigma: number
  confidence: number // 0..1 (<0.60 triggers hatched band & low-confidence UI)
  isLowConfidence: boolean
  sampleSize: number
  meanRtMs: number
  errorRatePct: number
  hesitationJitterMs: number
  speedAccuracyProfile: 'fast_accurate' | 'deliberate' | 'impulsive_error' | 'fatigued_slow'
  trendDeltaPct: number
  lastUpdatedIso: string
}

export interface WhyThisTrail {
  id: string
  observedData: string[]
  inference: string
  recommendation: string
  confidence: number
  counterfactual: string
  sourceModule: 'sat_jepa_delta_c' | 'quest_staircase' | 'collab_scorer' | 'deterministic_fallback'
}

export interface CollaborationSubScore {
  key: 'clarification' | 'verification' | 'iteration' | 'autonomy' | 'responsible_use'
  label: string
  defaultWeightPct: 20 | 25 | 20 | 20 | 15
  activeDynamicWeightPct: number
  score: number
  evidenceCount: number
  recentEvents: string[]
  howToImprove: string
}

export interface CollaborationScorePayload {
  totalScore: number
  ciRange: [number, number]
  statusBadge: 'Design proposal, not validated'
  formulaDisplay: string
  subScores: CollaborationSubScore[]
  whyThis: WhyThisTrail
}

export interface BrainTwinSnapshot {
  snapshotId: string
  timestampIso: string
  label: string
  triggerEvent: string
  archetypeName: string
  clusterId: number
  overallConfidence: number
  estimates: DimensionEstimate[]
}

export interface TrajectoryPoint {
  weekKey: string // e.g. 'W1', 'W2', ..., 'W6', '+1 Wk', '+2 Wk'
  weekLabel: string
  scorePct: number
  ciLowerPct: number
  ciUpperPct: number
  confidence: number
  isProjected: boolean
  sessionCount: number
}

export interface FatigueHeatmapCell {
  windowId: 'morning' | 'afternoon' | 'evening'
  windowLabel: string
  dayKey: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  readinessPct: number | null // null when no session logged in that slot
  meanRtMs: number | null
  status: 'optimal' | 'moderate' | 'fatigued' | 'unlogged'
  glyph: '●' | '◐' | '▲' | '—'
}

export interface TelemetryEvent {
  user_id: string
  session_id: string
  task_id: string
  trial_index: number
  dimension: BackendDimensionKey
  score_norm: number
  response_time_ms: number
  error_flag: boolean
  error_burst: number
  hesitation_jitter: number
  keystroke_latency_ms?: number | null
  trial_meta?: Record<string, string | number | boolean>
  voice_opt_in?: boolean
  voice_latency_ms?: number | null
  vocal_pace_hz?: number | null
  client_ts: string
}

export interface ContrastPairReport {
  id: string
  role: string
  theme: 'light' | 'dark'
  fgName: string
  fgHex: string
  bgName: string
  bgHex: string
  ratio: number
  minRequired: number
  level: 'AAA' | 'AA' | 'AA-UI' | 'FAIL'
  passes: boolean
}

export interface CopyLintViolation {
  term: string
  category: 'clinical_diagnostic' | 'punitive_guilt' | 'academic_ml_jargon'
  replacementSuggestion: string
}

export interface CopyLintResult {
  input: string
  isClean: boolean
  violations: CopyLintViolation[]
  sanitizedPreview: string
}

export type GoalObjectiveType = 'capacity' | 'stability' | 'maintenance'

export interface HabitContract {
  id: string
  dimensionId: string
  dimensionName: string
  objectiveType: GoalObjectiveType
  title: string
  targetDeltaPct: number
  currentProgressPct: number
  baselineScorePct: number
  currentScorePct: number
  etaDaysRange: [number, number]
  confidencePct: number
  weeklyCommitment: string
  scheduledRestDay: string
  streakDays: number
  status: 'active' | 'pacing_rest' | 'completed'
  rationale: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Inter-Member Integrated Contracts (Member 1 Assessment, Member 2 AI Coach, Member 3 Clustering)
// ─────────────────────────────────────────────────────────────────────────────

// Member 1 Task Delivery Contract (mirrors assessment_engine/HANDOVER.md)
export interface TaskPayload {
  task_id: string
  dimension: BackendDimensionKey
  schema_type: TaskSchemaType
  params: Record<string, unknown>
  surface_seed?: number
}

// Member 2 AI Coach & Collaboration Engine (mirrors ai_coach/schemas.py)
export type ArchetypeTier = 'explorer' | 'practitioner' | 'strategist'

export interface StateBusEvent {
  user_id: string
  transition_occurred: boolean
  active_cluster_id: number // 0..8
  delta_vector: Record<string, number>
  uncertainty: number
  timestamp?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

export interface ChatRequest {
  user_id: string
  message: string
  session_id?: string
  chat_history?: ChatMessage[]
  active_cluster_id?: number
  delta_vector?: Record<string, number>
}

export interface SafetyViolation {
  detected_phrase: string
  rule_category: string
  remediation_applied: string
}

export interface SafetyMetadata {
  is_safe: boolean
  clinical_terms_detected: string[]
  sanitized: boolean
  violations: SafetyViolation[]
}

export interface CollaborationScoreResult {
  composite_score: number // 0..100
  archetype_id: number // 0..8
  archetype_tier: ArchetypeTier
  dimension_scores: Record<string, number>
  dimension_weights: Record<string, number>
  weighted_contributions: Record<string, number>
  growth_recommendation: string
  calculated_at?: string
}

export interface CoachingResponse {
  reply_text: string
  xai_explanation?: string
  suggested_actions: string[]
  collab_score_snapshot?: CollaborationScoreResult
  safety_metadata: SafetyMetadata
  timestamp?: string
}

// Member 3 Clustering & Archetype Transitions (mirrors clustering_engine/evaluator.py)
export interface ClusteringEvaluationResult {
  user_id: string
  active_cluster_id: number
  archetype_name: string
  archetype_tier: ArchetypeTier
  transition_occurred: boolean
  responsibilities: number[]
  radar_scores: Record<string, number>
  uncertainty_band: number
  dominant_driver?: string
  growth_narrative?: string
  delta_vector?: Record<string, number>
}

