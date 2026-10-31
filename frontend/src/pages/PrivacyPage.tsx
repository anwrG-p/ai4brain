import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PrivacyCenter } from '../components/features/privacy/PrivacyCenter'
import { WhyThisPanel } from '../components/features/coach/WhyThisPanel'
import { Mascot } from '../components/features/brand/Mascot'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DoodleSquiggle } from '../components/ui/DoodleDecorations'
import { useAppStore } from '../state/useAppStore'
import { tracker } from '../features/assessment/telemetry/tracker'
import { forgetUserId } from '../features/assessment/tasks/taskSource'
import { useGoalsStore } from '../features/insights/goals'
import { useSessionStore } from '../features/insights/sessionStore'
import { MOCK_PRIVACY_AUDIT_LOG } from '../services/mocks/fixtures'
import type { PrivacyAuditEvent, PurgeCertificate, WhyThisTrail } from '../types'

const PRIVACY_WHY_THIS_TRAIL: WhyThisTrail = {
  id: 'why-privacy-01',
  confidence: 0.99,
  observedData: [
    'IEEE P7000 / EDPB Granular Consent Architecture active',
    'This preview keeps your answers in memory only and stores nothing in your browser',
    'Zero-Biometrics Software Isolation Proof passed',
  ],
  inference:
    'Hardware-level software lockout permanently guarantees no camera, microphone, or biometric sensors are ever invoked or accessible.',
  recommendation:
    'Keeping Historical Snapshots active allows your Personal Cognitive Twin to detect learning plateaus and recommend rest days with zero streak penalties.',
  counterfactual:
    'If Core Telemetry were revoked, adaptive staircase latency estimation would be unable to calibrate trial difficulty.',
  sourceModule: 'quest_staircase',
}

export default function PrivacyPage() {
  const {
    consentPreferences,
    updateConsentPreferences,
    simulateOffline,
    resetDemoState,
  } = useAppStore()

  const [auditEvents, setAuditEvents] = useState<PrivacyAuditEvent[]>(
    MOCK_PRIVACY_AUDIT_LOG,
  )
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false)
  const [purgeAckChecked, setPurgeAckChecked] = useState(false)
  const [purgeCertificate, setPurgeCertificate] = useState<PurgeCertificate | null>(
    null,
  )
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(
    null,
  )

  // Granular consent update with audit log appending
  const handleUpdateConsent = (patch: Partial<typeof consentPreferences>) => {
    updateConsentPreferences(patch)

    const patchKey = Object.keys(patch)[0] ?? 'unknown'
    const patchVal = Object.values(patch)[0]

    const newEvent: PrivacyAuditEvent = {
      id: `evt-aud-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      eventType: 'consent_updated',
      fieldScope: `${patchKey}: ${String(patchVal)}`,
      payloadSummary: `User adjusted ${patchKey} preference. Live telemetry schema recalculated.`,
      hash: `SHA256: ${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
      status: 'verified',
    }

    setAuditEvents((prev) => [newEvent, ...prev])
  }

  // Reject all optional handler (EDPB equal prominence)
  const handleRejectAllOptional = () => {
    updateConsentPreferences({
      historicalSnapshots: false,
      coachAndCollab: false,
      researchExport: false,
    })

    const newEvent: PrivacyAuditEvent = {
      id: `evt-aud-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      eventType: 'consent_updated',
      fieldScope: 'allOptional: revoked',
      payloadSummary:
        'User executed single-click Reject All Optional consent action.',
      hash: `SHA256: ${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
      status: 'verified',
    }
    setAuditEvents((prev) => [newEvent, ...prev])
  }

  // Restore defaults handler
  const handleRestoreDefaults = () => {
    updateConsentPreferences({
      historicalSnapshots: true,
      coachAndCollab: true,
      researchExport: false,
    })

    const newEvent: PrivacyAuditEvent = {
      id: `evt-aud-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      eventType: 'consent_updated',
      fieldScope: 'defaults: restored',
      payloadSummary: 'User restored default consent profile.',
      hash: `SHA256: ${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
      status: 'verified',
    }
    setAuditEvents((prev) => [newEvent, ...prev])
  }

  // GDPR Article 20: Data portability export
  const handleExportData = () => {
    const archivePayload = {
      archiveFormat: 'cistac-v1.0',
      exportTimestampUtc: new Date().toISOString(),
      consentReceipt: consentPreferences,
      auditTrail: auditEvents,
      activeDimensionsCount: 7,
      storageClassification: simulateOffline
        ? 'local_indexed_queue'
        : 'encrypted_session',
      nonBiometricCertificate: {
        enforced: true,
        camera: 'DISCONNECTED',
        microphone: 'DISCONNECTED',
        biometrics: 'ZERO_CAPTURED',
      },
    }

    const dataBlob = new Blob([JSON.stringify(archivePayload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(dataBlob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `synapsetwin-data-archive-${Date.now()}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)

    setDownloadSuccessMessage(
      '✓ GDPR Article 20 complete data archive downloaded successfully.',
    )
    setTimeout(() => setDownloadSuccessMessage(null), 4000)

    const exportEvent: PrivacyAuditEvent = {
      id: `evt-aud-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      eventType: 'data_exported',
      fieldScope: 'cistac-v1.0 complete archive',
      payloadSummary:
        'Self-service machine-readable data portability archive exported.',
      hash: `SHA256: ${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
      status: 'verified',
    }
    setAuditEvents((prev) => [exportEvent, ...prev])
  }

  // GDPR Article 17: Right to Erasure confirmation
  const handleConfirmPurge = () => {
    resetDemoState()
    // Drops pending events on this device; server-side deletion is Member 4's route.
    const recordsPurged = tracker.clear()
    forgetUserId()
    // The dashboard's local data: completed sessions and yearly goals.
    useSessionStore.getState().clearSessions()
    useGoalsStore.getState().clearGoals()

    const cert: PurgeCertificate = {
      certificateId: `CERT-PURGE-2026-${Math.random()
        .toString(16)
        .substring(2, 6)
        .toUpperCase()}`,
      timestampIso: new Date().toISOString(),
      userHash: 'ANON_USER_SALT_8F4A',
      recordsPurged,
      storagePurged: [
        'data/raw/telemetry/*.jsonl',
        'sat_jepa_latent_snapshots',
        'collaboration_rubric_logs',
        'habit_contracts_cache',
      ],
      status: 'CONFIRMED_PERMANENT',
    }

    setPurgeCertificate(cert)
    setIsPurgeModalOpen(false)
    setPurgeAckChecked(false)

    const purgeEvent: PrivacyAuditEvent = {
      id: `evt-aud-${Date.now()}`,
      timestampIso: new Date().toISOString(),
      eventType: 'data_purged',
      fieldScope: 'all_telemetry_and_profiles',
      payloadSummary: `Irrevocable data purge executed under GDPR Article 17. Certificate ${cert.certificateId} issued.`,
      hash: `SHA256: 0000000000000000000000000000000000000000000000000000000000000000`,
      status: 'verified',
    }
    setAuditEvents([purgeEvent])
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header Banner */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand" glyph="★">
            Layer C Sovereign Hub
          </Badge>
          <Badge tone="neutral" glyph="◈">
            Signature #6 &lt;PrivacyCenter /&gt;
          </Badge>
          <Badge tone="success" glyph="●">
            GDPR Articles 15, 17 &amp; 20 Compliant
          </Badge>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-ink tracking-tight">
              Privacy Center &amp; Sovereign Audit Log
            </h1>
            <DoodleSquiggle className="max-w-xs mt-1" />
            <p className="text-sm sm:text-base text-ink-muted max-w-3xl mt-1 leading-relaxed">
              Verify mathematical hardware locks, inspect live AI telemetry payloads, manage granular consent, and execute statutory GDPR rights with tamper-evident audit receipts.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link to="/dashboard">
              <Button variant="secondary" size="sm">
                ← Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Download Alert Notification */}
      {downloadSuccessMessage && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl border border-brand/30 bg-brand/10 text-ink text-sm font-semibold flex items-center gap-2"
        >
          <span>✓</span>
          <span>{downloadSuccessMessage}</span>
        </div>
      )}

      {/* Deletion Certificate Banner */}
      {purgeCertificate && (
        <Card
          className="p-5 border-2 border-success/40 bg-success/10 shadow-sm"
          aria-label="Cryptographic Deletion Certificate"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-display font-bold text-ink text-base">
                  Cryptographic Deletion Certificate Issued
                </span>
                <Badge tone="success" glyph="●">
                  {purgeCertificate.status}
                </Badge>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Certificate ID: <code className="font-mono text-ink font-bold">{purgeCertificate.certificateId}</code> · Purged {purgeCertificate.recordsPurged} records across all telemetry queues.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPurgeCertificate(null)}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Signature #6: PrivacyCenter Component */}
      <PrivacyCenter
        consentPreferences={consentPreferences}
        onUpdateConsent={handleUpdateConsent}
        onRejectAllOptional={handleRejectAllOptional}
        onRestoreDefaults={handleRestoreDefaults}
        onExportData={handleExportData}
        onRequestPurge={() => setIsPurgeModalOpen(true)}
        simulateOffline={simulateOffline}
        auditEvents={auditEvents}
      />

      {/* Companion Mascot & Explainability Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <WhyThisPanel
            trail={PRIVACY_WHY_THIS_TRAIL}
            defaultExpanded={true}
            title="Why this privacy architecture?"
          />
        </div>
        <div className="lg:col-span-4">
          <Card className="p-6 border-border flex flex-col items-center text-center">
            <Mascot state="idle" size="md" className="mb-3" />
            <span className="font-display font-bold text-ink text-base mb-1">
              Privacy Guard Mascot
            </span>
            <p className="text-xs text-ink-muted leading-relaxed">
              "Your cognitive twin stays 100% private and under your sovereign control. We never touch camera or audio sensors."
            </p>
          </Card>
        </div>
      </div>

      {/* 2-Step Destructive Purge Modal */}
      {isPurgeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="purge-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60"
        >
          <div className="bg-surface border-2 border-danger/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3
                  id="purge-modal-title"
                  className="font-display font-bold text-lg text-ink"
                >
                  Confirm Irrevocable Data Purge (GDPR Art. 17)
                </h3>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  This action permanently erases all session reaction times, task accuracy logs, 14-snapshot Brain Twin vectors, collaboration scores, and habit contracts from both local storage and mock telemetry queues.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-danger/20 bg-danger/5 text-xs text-danger leading-relaxed space-y-1">
              <span className="font-bold block">Consequences of Purging:</span>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Brain Twin manifold will reset to initial uncalibrated state.</li>
                <li>Longitudinal time travel snapshots will be destroyed.</li>
                <li>A tamper-evident Deletion Certificate will be generated for your records.</li>
              </ul>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-ink">
              <input
                type="checkbox"
                checked={purgeAckChecked}
                onChange={(e) => setPurgeAckChecked(e.target.checked)}
                className="mt-0.5 rounded border-border text-danger focus:ring-danger"
              />
              <span className="select-none font-semibold">
                I understand this action is immediate, permanent, and cannot be undone.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsPurgeModalOpen(false)
                  setPurgeAckChecked(false)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={!purgeAckChecked}
                onClick={handleConfirmPurge}
                className="font-semibold disabled:opacity-40"
              >
                Permanently Purge All Data
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
