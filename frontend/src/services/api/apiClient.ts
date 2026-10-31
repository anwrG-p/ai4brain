import { getDimensionsByPreset, type DimensionPresetKey } from '../../config/dimensions'
import type {
  BrainTwinSnapshot,
  ChatRequest,
  ClusteringEvaluationResult,
  CoachingResponse,
  CollaborationScorePayload,
  CollaborationScoreResult,
  DimensionEstimate,
  TaskPayload,
} from '../../types'
import type { PersonaId } from '../../state/useAppStore'
import {
  buildEstimatesForDimensions,
  buildSnapshotsForDimensions,
  SAMPLE_COLLABORATION_SCORE,
} from '../mocks/fixtures'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export interface DashboardBundle {
  estimates: DimensionEstimate[]
  snapshots: BrainTwinSnapshot[]
  collaboration: CollaborationScorePayload
  usingMocks: boolean
}

export const apiClient = {
  isMockMode(): boolean {
    return USE_MOCKS
  },

  async getDashboardBundle(
    preset: DimensionPresetKey,
    persona: PersonaId,
  ): Promise<DashboardBundle> {
    const dimensions = getDimensionsByPreset(preset)
    if (USE_MOCKS) {
      return {
        estimates: buildEstimatesForDimensions(dimensions, persona),
        snapshots: buildSnapshotsForDimensions(dimensions, persona),
        collaboration: SAMPLE_COLLABORATION_SCORE,
        usingMocks: true,
      }
    }

    try {
      const res = await fetch(`${API_BASE}/v1/dashboard/profile`)
      if (!res.ok) {
        throw new Error(`Backend profile request failed with HTTP ${res.status}`)
      }
      const data = (await res.json()) as Partial<DashboardBundle>
      return {
        estimates:
          data.estimates ?? buildEstimatesForDimensions(dimensions, persona),
        snapshots:
          data.snapshots ?? buildSnapshotsForDimensions(dimensions, persona),
        collaboration: data.collaboration ?? SAMPLE_COLLABORATION_SCORE,
        usingMocks: false,
      }
    } catch {
      return {
        estimates: buildEstimatesForDimensions(dimensions, persona),
        snapshots: buildSnapshotsForDimensions(dimensions, persona),
        collaboration: SAMPLE_COLLABORATION_SCORE,
        usingMocks: true,
      }
    }
  },

  /**
   * Member 1 Task Generator & Delivery Contract (GET /v1/tasks/next)
   */
  async getNextTask(userId = 'default_user'): Promise<TaskPayload> {
    if (USE_MOCKS) {
      return {
        task_id: `task_${Date.now()}`,
        dimension: 'working_memory',
        schema_type: 'n_back',
        params: {
          n: 2,
          sequence_length: 20,
          isi_ms: 1500,
          stimulus_duration_ms: 500,
        },
        surface_seed: 42,
      }
    }

    const res = await fetch(`${API_BASE}/v1/tasks/next?user_id=${encodeURIComponent(userId)}`)
    if (!res.ok) {
      throw new Error(`Task fetching failed with HTTP ${res.status}`)
    }
    return (await res.json()) as TaskPayload
  },

  /**
   * Member 1 & Member 4 GDPR Telemetry Deletion (DELETE /v1/user/telemetry)
   */
  async deleteUserTelemetry(userId: string): Promise<{ success: boolean; message: string }> {
    if (USE_MOCKS) {
      return {
        success: true,
        message: `Telemetry records for user ${userId} purged from storage.`,
      }
    }
    const res = await fetch(`${API_BASE}/v1/user/telemetry?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      throw new Error(`Telemetry deletion failed with HTTP ${res.status}`)
    }
    return (await res.json()) as { success: boolean; message: string }
  },

  /**
   * Member 2 AI Coach Chat Endpoint (POST /v1/coach/chat)
   */
  async postCoachChat(req: ChatRequest): Promise<CoachingResponse> {
    if (USE_MOCKS) {
      return {
        reply_text: `I noticed your steady pacing on recent trials. Based on your current telemetry, your working memory and focus stability are showing solid consistency.`,
        xai_explanation: `Grounded in Δc differential vector: working memory margin tightened by 12%.`,
        suggested_actions: ['Launch 2-Min Flow', 'Review Fatigue Heatmap', 'Rest Day Calibration'],
        safety_metadata: {
          is_safe: true,
          clinical_terms_detected: [],
          sanitized: false,
          violations: [],
        },
        timestamp: new Date().toISOString(),
      }
    }

    const res = await fetch(`${API_BASE}/v1/coach/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) {
      throw new Error(`Coach chat failed with HTTP ${res.status}`)
    }
    return (await res.json()) as CoachingResponse
  },

  /**
   * Member 2 Dynamic Collaboration Scorer Endpoint (GET /v1/coach/collaboration-score)
   */
  async getCollaborationScore(userId: string, clusterId = 3): Promise<CollaborationScoreResult> {
    if (USE_MOCKS) {
      return {
        composite_score: 82.5,
        archetype_id: clusterId,
        archetype_tier: clusterId <= 2 ? 'explorer' : clusterId <= 5 ? 'practitioner' : 'strategist',
        dimension_scores: {
          clarification: 84.0,
          critical_verification: 78.0,
          iteration: 85.0,
          autonomy: 80.0,
          responsible_use: 86.0,
        },
        dimension_weights: {
          clarification: 0.20,
          critical_verification: 0.20,
          iteration: 0.20,
          autonomy: 0.20,
          responsible_use: 0.20,
        },
        weighted_contributions: {
          clarification: 16.8,
          critical_verification: 15.6,
          iteration: 17.0,
          autonomy: 16.0,
          responsible_use: 17.2,
        },
        growth_recommendation:
          'Challenge initial task prompts and test alternative reasoning pathways during complex sessions.',
        calculated_at: new Date().toISOString(),
      }
    }

    const res = await fetch(
      `${API_BASE}/v1/coach/collaboration-score?user_id=${encodeURIComponent(userId)}&cluster_id=${clusterId}`,
    )
    if (!res.ok) {
      throw new Error(`Collaboration score query failed with HTTP ${res.status}`)
    }
    return (await res.json()) as CollaborationScoreResult
  },

  /**
   * Member 3 Clustering & GMM Transition Evaluation (POST /v1/clustering/evaluate)
   */
  async evaluateClustering(
    userId: string,
    latentVector: number[],
  ): Promise<ClusteringEvaluationResult> {
    if (USE_MOCKS) {
      return {
        user_id: userId,
        active_cluster_id: 3,
        archetype_name: 'Focused Builder',
        archetype_tier: 'practitioner',
        transition_occurred: false,
        responsibilities: [0.05, 0.05, 0.1, 0.55, 0.1, 0.05, 0.04, 0.03, 0.03],
        radar_scores: {
          working_memory: 78.0,
          pattern_induction: 82.0,
          executive_function: 75.0,
          spatial_orientation: 80.0,
          processing_speed: 74.0,
          episodic_memory: 71.0,
        },
        uncertainty_band: 0.08,
        dominant_driver: 'working_memory',
        growth_narrative:
          'Stable convergence in Focused Builder archetype with progressive working memory consolidation.',
      }
    }

    const res = await fetch(`${API_BASE}/v1/clustering/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, latent_vector: latentVector }),
    })
    if (!res.ok) {
      throw new Error(`Clustering evaluation failed with HTTP ${res.status}`)
    }
    return (await res.json()) as ClusteringEvaluationResult
  },
}
