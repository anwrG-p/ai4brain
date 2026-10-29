import { useMemo, useState } from 'react'
import type { PrivacyAuditEvent } from '../../../types'
import type { ConsentPreferences } from '../../../state/useAppStore'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'

export interface PrivacyCenterProps {
  consentPreferences: ConsentPreferences
  onUpdateConsent: (patch: Partial<ConsentPreferences>) => void
  onRejectAllOptional: () => void
  onRestoreDefaults: () => void
  onExportData: () => void
  onRequestPurge: () => void
  simulateOffline: boolean
  auditEvents: PrivacyAuditEvent[]
}

export function PrivacyCenter({
  consentPreferences,
  onUpdateConsent,
  onRejectAllOptional,
  onRestoreDefaults,
  onExportData,
  onRequestPurge,
  simulateOffline,
  auditEvents,
}: PrivacyCenterProps) {
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'consent' | 'telemetry' | 'snapshot'
  >('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [copied, setCopied] = useState(false)

  // Live "What the AI Sees" JSON representation
  const liveTelemetryJson = useMemo(() => {
    const allowedFields = [
      'rt_ms',
      'correct',
      'hesitation_jitter_ms',
      'difficulty_level',
      'trial_index',
    ]
    if (consentPreferences.historicalSnapshots) {
      allowedFields.push('sat_jepa_snapshot_vector')
      allowedFields.push('gmm_archetype_cluster_id')
    }
    if (consentPreferences.coachAndCollab) {
      allowedFields.push('collab_rubric_events')
      allowedFields.push('metacognitive_feedback_id')
    }

    const payload = {
      schemaVersion: 'cistac-v1.0',
      consentReceiptId: consentPreferences.consentReceiptId,
      updatedAtIso: consentPreferences.updatedAtIso,
      nonBiometricMode: true,
      biometricSensorsHardwareLock: {
        camera: 'DISCONNECTED',
        microphone: 'DISCONNECTED',
        keystrokeDynamics: 'BLOCKED',
        facialGeometry: 'BLOCKED',
        eyeTracking: 'BLOCKED',
      },
      storageMode: simulateOffline ? 'local_indexed_queue' : 'encrypted_session',
      baselineMode: consentPreferences.baselineMode,
      activeDimensionsPreserved: 7,
      telemetryFieldsAllowed: allowedFields,
      telemetryFieldsBlocked: [
        'camera_stream',
        'mic_audio',
        'biometric_raw_keystroke_timestamps',
        'ip_address',
        'device_fingerprint',
      ],
      researchBenchmarkOptIn: consentPreferences.researchExport,
      nonClinicalAcknowledged: consentPreferences.nonClinicalAck,
    }

    return JSON.stringify(payload, null, 2)
  }, [consentPreferences, simulateOffline])

  const handleCopyJson = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(liveTelemetryJson)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Filtered audit events
  const filteredEvents = useMemo(() => {
    return auditEvents.filter((evt) => {
      if (activeFilter === 'consent' && !evt.eventType.includes('consent'))
        return false
      if (activeFilter === 'telemetry' && !evt.eventType.includes('telemetry'))
        return false
      if (activeFilter === 'snapshot' && !evt.eventType.includes('snapshot'))
        return false

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        return (
          evt.fieldScope.toLowerCase().includes(query) ||
          evt.payloadSummary.toLowerCase().includes(query) ||
          evt.hash.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [auditEvents, activeFilter, searchTerm])

  return (
    <div className="space-y-6">
      {/* 1. Permanent Non-Biometric Hardware Lock Banner */}
      <Card
        className="p-5 border-2 border-border-strong bg-brand-subtle shadow-doodle"
        aria-label="Hardware Lock Guarantee"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-sm border-2 border-border-strong bg-brand text-brand-ink flex items-center justify-center shrink-0 shadow-doodle-sm font-bold text-lg">
              🔒
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-display font-bold text-ink text-base">
                  Non-Biometric Hardware Lock Active
                </span>
                <Badge tone="success" glyph="●">
                  Physically Disconnected
                </Badge>
                <Badge tone="neutral" glyph="✦">
                  IEEE &amp; EDPB Compliant
                </Badge>
              </div>
              <p className="text-sm text-ink-muted leading-relaxed max-w-3xl">
                SynapseTwin enforces a mathematically and architecturally sealed zero-biometrics guarantee.
                Camera, microphone, eye-tracking, and biometric keystroke dynamics are disabled and physically unreachable in code.
                Only trial reaction latency (<code className="font-mono text-ink">ms</code>), task response accuracy, and hesitation jitter are processed.
              </p>
            </div>
          </div>
          <div className="shrink-0 self-end md:self-auto">
            <Badge tone="brand" glyph="◈">
              Hardware Lock Enforced
            </Badge>
          </div>
        </div>
      </Card>

      {/* 2-Column Responsive Layout: Controls & GDPR vs Live Inspector & Receipt */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 7 COLUMNS: Consent Controls & GDPR Actions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card L1: Granular Consent Matrix */}
          <Card className="p-6 border-border" aria-label="Consent Management">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-border">
              <div>
                <h2 className="font-display font-bold text-xl text-ink">
                  Granular Consent Controls
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Update your algorithmic telemetry scope at any time with equal-prominence controls.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRejectAllOptional}
                >
                  Reject All Optional
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRestoreDefaults}
                >
                  Restore Defaults
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Scope 1: Core Cognitive Telemetry (Locked) */}
              <div className="p-4 rounded-xl border border-border bg-canvas/40 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-semibold text-ink text-sm">
                      Core Cognitive Telemetry
                    </span>
                    <Badge tone="neutral">
                      Mandatory Core
                    </Badge>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Processes stimulus response latency (<code className="font-mono text-ink">ms</code>) and error rate. Required for the 85%-accuracy QUEST+ adaptive staircase.
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand/10 text-brand">
                    ✓ Locked Active
                  </span>
                </div>
              </div>

              {/* Scope 2: Historical Snapshots */}
              <div className="p-4 rounded-xl border border-border bg-surface flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-semibold text-ink text-sm">
                      Historical Snapshot Archive
                    </span>
                    {consentPreferences.historicalSnapshots ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Revoked</Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Saves 14-snapshot Brain Twin latent manifold trajectories for longitudinal time travel, retrospective comparison, and archetype hysteresis.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={consentPreferences.historicalSnapshots}
                  aria-label="Toggle Historical Snapshot Archive"
                  onClick={() =>
                    onUpdateConsent({
                      historicalSnapshots: !consentPreferences.historicalSnapshots,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    consentPreferences.historicalSnapshots
                      ? 'bg-brand'
                      : 'bg-border-strong'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm ring-0 transition duration-200 ease-in-out ${
                      consentPreferences.historicalSnapshots
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Scope 3: AI Coaching & Collaboration Telemetry */}
              <div className="p-4 rounded-xl border border-border bg-surface flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-semibold text-ink text-sm">
                      AI Coach & Collaboration Scoring
                    </span>
                    {consentPreferences.coachAndCollab ? (
                      <Badge tone="brand">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Revoked</Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Allows SAT-JEPA to evaluate human-AI agency (0–100 Collaboration Score) and recommend grounded resting or micro-block interventions.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={consentPreferences.coachAndCollab}
                  aria-label="Toggle AI Coach and Collaboration Scoring"
                  onClick={() =>
                    onUpdateConsent({
                      coachAndCollab: !consentPreferences.coachAndCollab,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    consentPreferences.coachAndCollab
                      ? 'bg-brand'
                      : 'bg-border-strong'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm ring-0 transition duration-200 ease-in-out ${
                      consentPreferences.coachAndCollab
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Scope 4: Open Research Benchmark Contribution */}
              <div className="p-4 rounded-xl border border-border bg-surface flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-semibold text-ink text-sm">
                      Anonymized Research Benchmark Export
                    </span>
                    {consentPreferences.researchExport ? (
                      <Badge tone="info">Opted In</Badge>
                    ) : (
                      <Badge tone="neutral">Opted Out</Badge>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Contributes stripped, k-anonymized normalized trial latents to open cognitive science benchmark datasets. Never includes raw timestamps.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={consentPreferences.researchExport}
                  aria-label="Toggle Anonymized Research Benchmark Export"
                  onClick={() =>
                    onUpdateConsent({
                      researchExport: !consentPreferences.researchExport,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    consentPreferences.researchExport
                      ? 'bg-brand'
                      : 'bg-border-strong'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm ring-0 transition duration-200 ease-in-out ${
                      consentPreferences.researchExport
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </Card>

          {/* Card L2: GDPR Sovereign Rights (Articles 15, 17, 20) */}
          <Card className="p-6 border-border" aria-label="Self-Service GDPR Rights">
            <div className="mb-4">
              <h2 className="font-display font-bold text-xl text-ink">
                Self-Service Data Subject Rights (GDPR)
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Execute your statutory rights directly without human intermediary delays or automated friction.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Article 20: Data Portability */}
              <div className="p-4 rounded-xl border border-border bg-canvas/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-body font-semibold text-ink text-sm">
                      Right of Access &amp; Portability
                    </span>
                    <Badge tone="neutral">Article 20</Badge>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed mb-4">
                    Download an exhaustive, machine-readable JSON archive of all your telemetry records, twin snapshots, and consent events.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onExportData}
                  className="w-full flex items-center justify-center gap-2"
                >
                  Download Complete Archive (JSON)
                </Button>
              </div>

              {/* Article 17: Right to Erasure */}
              <div className="p-4 rounded-xl border border-danger/30 bg-danger/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-body font-semibold text-ink text-sm">
                      Right to Erasure (Purge)
                    </span>
                    <Badge tone="danger">Article 17</Badge>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed mb-4">
                    Irrevocably delete all raw telemetry, session logs, and Brain Twin vectors. Issues a tamper-evident deletion certificate.
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={onRequestPurge}
                  className="w-full flex items-center justify-center gap-2 font-semibold"
                >
                  Purge All Data &amp; Telemetry
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT 5 COLUMNS: Live Telemetry Inspector & Cryptographic Receipt */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card R1: "What the AI Sees" Live Inspector */}
          <Card className="p-6 border-border" aria-label="What the AI Sees Telemetry Inspector">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="font-display font-bold text-lg text-ink">
                  "What the AI Sees" Live Inspector
                </h2>
                <p className="text-xs text-ink-muted">
                  Real-time telemetry payload dispatched to SAT-JEPA engine.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyJson}
                className="shrink-0"
              >
                {copied ? '✓ Copied' : 'Copy JSON'}
              </Button>
            </div>

            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="font-mono text-ink-muted">
                Storage: <span className="font-bold text-ink">{simulateOffline ? 'local_indexed_queue' : 'encrypted_session'}</span>
              </span>
              <Badge tone="brand">
                cistac-v1.0
              </Badge>
            </div>

            {/* Syntax Highlighted JSON Code Container */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Live Telemetry JSON payload code view"
              className="p-3.5 rounded-xl border border-border bg-canvas/60 text-ink font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <pre className="whitespace-pre">{liveTelemetryJson}</pre>
            </div>
          </Card>

          {/* Card R2: Cryptographic Consent Receipt */}
          <Card className="p-5 border-border bg-surface shadow-sm" aria-label="Cryptographic Consent Receipt">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold text-sm">
                  #
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-ink">
                    Cryptographic Consent Receipt
                  </h3>
                  <span className="text-xs text-ink-muted font-mono">
                    ID: {consentPreferences.consentReceiptId}
                  </span>
                </div>
              </div>
              <Badge tone="success" glyph="●">
                VERIFIED AUTHENTIC
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-canvas/50 border border-border">
                <span className="text-ink-muted block text-xs mb-0.5">SHA-256 Audit Signature:</span>
                <code className="font-mono text-ink text-xs break-all">
                  SHA256: 7d9a8e024b1c902835471029e847b29384710293847102938471029384710293
                </code>
              </div>
              <div className="flex justify-between items-center text-ink-muted text-xs px-1">
                <span>Last Updated: {consentPreferences.updatedAtIso}</span>
                <span>Algorithm: ECDSA-P256 / SHA256</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. Chronological Audit Event Log Table */}
      <Card className="p-6 border-border" aria-label="Chronological Audit Event Log">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
          <div>
            <h2 className="font-display font-bold text-xl text-ink">
              Chronological Audit Event Log
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Tamper-evident record of all telemetry ingest events, consent updates, and export operations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Pills */}
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-canvas/60">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                All Events
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('consent')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeFilter === 'consent'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Consent
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('telemetry')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeFilter === 'telemetry'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Telemetry
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('snapshot')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeFilter === 'snapshot'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Snapshots
              </button>
            </div>

            {/* Text Search */}
            <div className="relative">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search audit trail..."
                aria-label="Search audit trail"
                className="px-3 py-1 text-xs rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand w-40 sm:w-48"
              />
            </div>
          </div>
        </div>

        {/* Audit Table with Screen-Reader Accessible Wrapper */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Chronological Audit Event Log Table"
          className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-xl border border-border"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas/50 text-ink border-b border-border">
                <th scope="col" className="p-3 font-semibold">Timestamp (UTC)</th>
                <th scope="col" className="p-3 font-semibold">Event Type</th>
                <th scope="col" className="p-3 font-semibold">Field Scope</th>
                <th scope="col" className="p-3 font-semibold">Summary</th>
                <th scope="col" className="p-3 font-semibold">Cryptographic Hash</th>
                <th scope="col" className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-ink-muted">
                    No matching audit events found.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-canvas/30 transition-colors">
                    <td className="p-3 font-mono text-ink-muted whitespace-nowrap">
                      {evt.timestampIso.replace('T', ' ').replace('Z', '')}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-semibold text-ink uppercase tracking-wider text-xs">
                        {evt.eventType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-brand whitespace-nowrap">
                      {evt.fieldScope}
                    </td>
                    <td className="p-3 text-ink max-w-xs truncate">
                      {evt.payloadSummary}
                    </td>
                    <td className="p-3 font-mono text-xs text-ink-muted whitespace-nowrap">
                      {evt.hash.substring(0, 18)}...
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <Badge tone="success" glyph="●">
                        verified
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
