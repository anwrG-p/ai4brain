import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  Search,
  Sliders,
  X,
  Lock,
  Unlock,
  FileCheck,
  Trash2,
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useEmilyStore } from '../../state/useEmilyStore'
import {
  type EmilyEmotion,
  type EmilyInteractionEvent,
  INITIAL_EMILY_METRICS,
} from '../../utils/emilyEngine'

export interface HumanReviewProposal {
  id: string
  title: string
  category: 'adaptation' | 'trajectory' | 'safety'
  summary: string
  proposedChange: string
  rationale: string
  timestampIso: string
}

export interface HumanReviewGateProps {
  proposal?: HumanReviewProposal
  onApprove?: (id: string) => void
  onReject?: (id: string, reason: string) => void
  onDismiss?: () => void
  defaultOpen?: boolean
}

export interface UxReviewSignoff {
  id: string
  screenPath: string
  timestamp: string
  reviewer: string
  emotionState: EmilyEmotion
  isHumanLocked: boolean
  jargonViolationsCount: number
  evaluatorNotes: string
  status: 'APPROVED' | 'REJECTED'
  metricsSnapshot: typeof INITIAL_EMILY_METRICS
}

const STORAGE_KEY = 'cistac_ux_review_signoffs'

const FORBIDDEN_JARGON_RULES = [
  { term: 'SAT-JEPA', regex: /\bSAT-JEPA\b/i, replacement: 'Your Thinking Style' },
  { term: 'GMM Archetype', regex: /\bGMM(?:\s+Archetype)?\b/i, replacement: 'Thinking Style Archetype' },
  { term: 'Differential Vector (Δc)', regex: /\bDifferential Vector\s*\(?Δc\)?/i, replacement: 'Weekly Progress Boost' },
  { term: 'Epistemic Uncertainty', regex: /\bepistemic uncertainty\b/i, replacement: 'Clarity Range' },
  { term: 'Uncertainty Polygon', regex: /\buncertainty polygon\b/i, replacement: 'Clarity Range Halo' },
  { term: 'QUEST+ Staircase', regex: /\bQUEST\+\s+(?:Psychometric\s+)?Staircase\b/i, replacement: 'Auto-Paced Flow Target' },
  { term: '5-Part Reasoning Trail', regex: /\b5-Part Reasoning Trail\b/i, replacement: 'Why Brian Suggests This' },
  { term: 'Continuous Saccadic Drift', regex: /\b(?:continuous\s+)?saccadic drift\b/i, replacement: 'Daily Energy Rhythm' },
  { term: 'Covariance Matrix', regex: /\bcovariance\s+matrix\b/i, replacement: 'Skill Balance Interaction' },
]

export function HumanReviewGate({
  proposal,
  onApprove,
  onReject,
  onDismiss,
  defaultOpen = false,
}: HumanReviewGateProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [proposalDecision, setProposalDecision] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [reviewNote, setReviewNote] = useState('')
  const [lastSignoffStatus, setLastSignoffStatus] = useState<string | null>(null)
  const [jargonViolations, setJargonViolations] = useState<
    Array<{ term: string; context: string; replacement: string }>
  >([])
  const [isScanning, setIsScanning] = useState(false)

  const {
    currentEmotion,
    isHumanLocked,
    autoAdapt,
    metrics,
    setManualEmotion,
    unlockHuman,
    updateTelemetry,
    toggleAutoAdapt,
    reset,
  } = useEmilyStore()

  // 1. Check URL param ?review_mode=true
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('review_mode') === 'true') {
        setIsOpen(true)
      }
    }
  }, [])

  // 2. Keyboard shortcut: Shift + J
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 3. Live DOM Jargon Scanner
  const scanDomForJargon = useCallback(() => {
    if (typeof document === 'undefined') return
    setIsScanning(true)

    const violations: Array<{ term: string; context: string; replacement: string }> = []
    const root = document.getElementById('main-content') || document.body

    // Walker to inspect visible text nodes
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        // Ignore the review gate itself, technical inspect details drawers, scripts, styles
        if (
          parent.closest('[data-review-gate]') ||
          parent.closest('details') ||
          parent.closest('[data-technical-drawer]') ||
          parent.tagName === 'SCRIPT' ||
          parent.tagName === 'STYLE'
        ) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })

    let currentNode = walker.nextNode()
    while (currentNode) {
      const text = currentNode.textContent || ''
      if (text.trim().length > 0) {
        for (const rule of FORBIDDEN_JARGON_RULES) {
          if (rule.regex.test(text)) {
            violations.push({
              term: rule.term,
              context: text.trim().slice(0, 80),
              replacement: rule.replacement,
            })
          }
        }
      }
      currentNode = walker.nextNode()
    }

    setJargonViolations(violations)
    setIsScanning(false)
  }, [])

  // Auto-scan on open
  useEffect(() => {
    if (isOpen) {
      scanDomForJargon()
    }
  }, [isOpen, scanDomForJargon])

  // 4. Kinematic Stress Scenario Simulators
  const simulateRageClicks = () => {
    const now = Date.now()
    const syntheticEvents: EmilyInteractionEvent[] = [
      { type: 'mousedown', x: 200, y: 300, timestamp: now - 350, isInteractive: true },
      { type: 'mouseup', x: 200, y: 300, timestamp: now - 310, isInteractive: true },
      { type: 'click', x: 200, y: 300, timestamp: now - 310, isInteractive: true },
      { type: 'mousedown', x: 205, y: 305, timestamp: now - 220, isInteractive: true },
      { type: 'mouseup', x: 205, y: 305, timestamp: now - 180, isInteractive: true },
      { type: 'click', x: 205, y: 305, timestamp: now - 180, isInteractive: true },
      { type: 'mousedown', x: 210, y: 302, timestamp: now - 90, isInteractive: true },
      { type: 'mouseup', x: 210, y: 302, timestamp: now - 50, isInteractive: true },
      { type: 'click', x: 210, y: 302, timestamp: now - 50, isInteractive: true },
      // High jerk pointer tremor
      { type: 'pointermove', x: 212, y: 304, timestamp: now - 40 },
      { type: 'pointermove', x: 228, y: 320, timestamp: now - 20 },
      { type: 'pointermove', x: 215, y: 305, timestamp: now },
    ]
    updateTelemetry(syntheticEvents, { consecutiveErrors: 2 })
  }

  const simulateWandering = () => {
    const now = Date.now()
    const syntheticEvents: EmilyInteractionEvent[] = [
      { type: 'pointermove', x: 100, y: 100, timestamp: now - 1200 },
      { type: 'pointermove', x: 250, y: 350, timestamp: now - 900 },
      { type: 'pointermove', x: 120, y: 180, timestamp: now - 600 },
      { type: 'pointermove', x: 280, y: 220, timestamp: now - 300 },
      { type: 'pointermove', x: 140, y: 310, timestamp: now },
    ]
    updateTelemetry(syntheticEvents)
  }

  const simulateIdleFatigue = () => {
    const now = Date.now()
    const syntheticEvents: EmilyInteractionEvent[] = [
      { type: 'pointermove', x: 100, y: 100, timestamp: now - 7200 },
      { type: 'pointermove', x: 110, y: 110, timestamp: now - 7100 },
      { type: 'pointermove', x: 112, y: 112, timestamp: now },
    ]
    updateTelemetry(syntheticEvents)
  }

  const handleResetCalm = () => {
    reset()
  }

  // 5. Sign-off Storage & Audit Log Management
  const getExistingSignoffs = (): UxReviewSignoff[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  const handleApproveScreen = () => {
    const existing = getExistingSignoffs()
    const signoff: UxReviewSignoff = {
      id: `signoff-${Date.now()}`,
      screenPath: typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
      timestamp: new Date().toISOString(),
      reviewer: 'Design Evaluator',
      emotionState: currentEmotion,
      isHumanLocked,
      jargonViolationsCount: jargonViolations.length,
      evaluatorNotes: reviewNote || 'Verified Doodle design tokens and GLOSSARY consumer terms.',
      status: 'APPROVED',
      metricsSnapshot: { ...metrics },
    }
    const updated = [signoff, ...existing]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setLastSignoffStatus(`Approved at ${new Date().toLocaleTimeString()} (Total: ${updated.length} screens)`)
  }

  const handleExportJson = () => {
    const records = getExistingSignoffs()
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cistac-ux-review-audit-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleClearSignoffs = () => {
    localStorage.removeItem(STORAGE_KEY)
    setLastSignoffStatus('Audit log cleared.')
  }

  // Proposal decisions (backward-compatible)
  const handleProposalApprove = () => {
    setProposalDecision('approved')
    if (proposal) onApprove?.(proposal.id)
  }

  const handleProposalReject = () => {
    setProposalDecision('rejected')
    if (proposal) onReject?.(proposal.id, reviewNote)
  }

  // Discreet footer trigger button when closed
  if (!isOpen) {
    return (
      <div className="flex items-center justify-center my-2" data-review-gate="closed">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="UX Review & Evaluator Controls (Shift + J)"
          className="focus-ring inline-flex items-center gap-2 px-3 py-1.5 rounded-pill border-2 border-border-strong bg-surface text-ink-muted hover:text-ink hover:bg-surface-raised shadow-doodle-sm transition-all text-xs font-mono font-bold cursor-pointer"
          title="Open Evaluator Human UX Review Gate (Shift + J)"
        >
          <ShieldCheck size={14} className="text-brand" aria-hidden="true" />
          <span>⚙️ UX Review & Evaluator Controls</span>
          <span className="text-ink-muted font-normal">(Shift + J)</span>
        </button>
      </div>
    )
  }

  return (
    <div
      data-review-gate="open"
      data-testid="ux-review-gate"
      className="fixed inset-x-2 bottom-2 md:bottom-4 md:right-4 md:left-auto md:w-[480px] max-h-[85vh] z-50 flex flex-col bg-surface rounded-xl border-2 border-border-strong shadow-hero overflow-hidden"
      role="dialog"
      aria-label="Designer and Evaluator UX Review Gate"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 bg-surface-raised border-b-2 border-border-strong">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-brand w-5 h-5" aria-hidden="true" />
          <h2 className="font-display font-bold text-sm text-ink m-0">
            UX Review & Evaluator Controls
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="info" glyph="⚡">
            Review Mode
          </Badge>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              onDismiss?.()
            }}
            aria-label="Close review gate"
            className="focus-ring min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-canvas text-ink-muted hover:text-ink cursor-pointer"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="p-4 space-y-4 overflow-y-auto text-xs">
        {/* Section 1: Live DOM Jargon Scanner */}
        <div className="p-3 rounded-lg border-2 border-border-strong bg-surface-raised space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-ink flex items-center gap-1.5">
              <Search size={14} className="text-brand" aria-hidden="true" />
              <span>Live DOM Jargon Scanner</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={scanDomForJargon}
              disabled={isScanning}
              className="text-xs py-0.5 px-2 h-auto"
            >
              {isScanning ? 'Scanning...' : 'Rescan DOM'}
            </Button>
          </div>

          <p className="text-ink-muted leading-tight m-0">
            Verifies visible text against GLOSSARY.md forbidden academic/ML terms.
          </p>

          <div className="pt-1">
            {jargonViolations.length === 0 ? (
              <Badge
                tone="success"
                glyph="✓"
                data-testid="jargon-scanner-badge"
                className="font-mono"
              >
                0 Jargon Violations (GLOSSARY.md Verified)
              </Badge>
            ) : (
              <div className="space-y-1.5">
                <Badge
                  tone="danger"
                  glyph="⚠"
                  data-testid="jargon-scanner-badge"
                  className="font-mono"
                >
                  {jargonViolations.length} Jargon Violation(s) Found
                </Badge>
                <div className="max-h-24 overflow-y-auto space-y-1 bg-surface p-2 rounded border border-border">
                  {jargonViolations.map((v, i) => (
                    <div key={i} className="text-ink text-xs flex flex-col">
                      <span className="font-bold text-danger">Found: "{v.term}"</span>
                      <span className="text-ink-muted italic truncate">"{v.context}"</span>
                      <span className="text-success font-semibold">Replace with: {v.replacement}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: EMILY State Simulator & Evaluator Stress Toggles */}
        <div className="p-3 rounded-lg border-2 border-border-strong bg-surface-raised space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-ink flex items-center gap-1.5">
              <Sliders size={14} className="text-brand" aria-hidden="true" />
              <span>EMILY Affective State Simulator</span>
            </span>
            <div className="flex items-center gap-1 font-mono text-xs">
              <span className="text-ink-muted">Active:</span>
              <strong className="text-brand uppercase">{currentEmotion}</strong>
            </div>
          </div>

          {/* Direct Emotion Force Toggles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              data-testid="simulate-calm"
              onClick={() => setManualEmotion('calm_flow')}
              className={`focus-ring px-2 py-1.5 rounded border text-xs font-bold text-left transition-colors cursor-pointer ${
                currentEmotion === 'calm_flow'
                  ? 'border-border-strong bg-brand text-brand-ink'
                  : 'border-border bg-surface text-ink hover:bg-canvas'
              }`}
            >
              🌿 Calm Flow
            </button>
            <button
              type="button"
              data-testid="simulate-energized"
              onClick={() => setManualEmotion('energized')}
              className={`focus-ring px-2 py-1.5 rounded border text-xs font-bold text-left transition-colors cursor-pointer ${
                currentEmotion === 'energized'
                  ? 'border-border-strong bg-brand text-brand-ink'
                  : 'border-border bg-surface text-ink hover:bg-canvas'
              }`}
            >
              ✨ Spark
            </button>
            <button
              type="button"
              data-testid="simulate-frustrated"
              onClick={() => setManualEmotion('frustrated')}
              className={`focus-ring px-2 py-1.5 rounded border text-xs font-bold text-left transition-colors cursor-pointer ${
                currentEmotion === 'frustrated'
                  ? 'border-border-strong bg-brand text-brand-ink'
                  : 'border-border bg-surface text-ink hover:bg-canvas'
              }`}
            >
              🍃 De-Escalate
            </button>
            <button
              type="button"
              data-testid="simulate-hesitant"
              onClick={() => setManualEmotion('hesitant')}
              className={`focus-ring px-2 py-1.5 rounded border text-xs font-bold text-left transition-colors cursor-pointer ${
                currentEmotion === 'hesitant'
                  ? 'border-border-strong bg-brand text-brand-ink'
                  : 'border-border bg-surface text-ink hover:bg-canvas'
              }`}
            >
              🧭 Guidance
            </button>
            <button
              type="button"
              data-testid="simulate-fatigued"
              onClick={() => setManualEmotion('fatigued')}
              className={`focus-ring px-2 py-1.5 rounded border text-xs font-bold text-left transition-colors cursor-pointer ${
                currentEmotion === 'fatigued'
                  ? 'border-border-strong bg-brand text-brand-ink'
                  : 'border-border bg-surface text-ink hover:bg-canvas'
              }`}
            >
              🌙 Wind-Down
            </button>
            <button
              type="button"
              data-testid="simulate-reset-calm"
              onClick={handleResetCalm}
              className="focus-ring px-2 py-1.5 rounded border border-border bg-surface text-ink-muted hover:text-ink hover:bg-canvas text-xs font-bold text-center inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCcw size={11} aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          {/* Kinematic Stress Scenario Triggers */}
          <div className="pt-1 border-t border-border/60">
            <span className="text-xs text-ink-muted font-bold block mb-1.5">
              Kinematic Stress Scenarios:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                data-testid="simulate-rage-clicks"
                onClick={simulateRageClicks}
                className="focus-ring px-2 py-1 rounded border border-border bg-surface text-ink hover:bg-canvas text-xs font-mono font-medium truncate cursor-pointer"
                title="Simulate 3 rapid clicks + high jerk tremor"
              >
                ⚡ Rage Clicks
              </button>
              <button
                type="button"
                data-testid="simulate-wandering"
                onClick={simulateWandering}
                className="focus-ring px-2 py-1 rounded border border-border bg-surface text-ink hover:bg-canvas text-xs font-mono font-medium truncate cursor-pointer"
                title="Simulate low directness arc + searching pauses"
              >
                🧭 Wandering
              </button>
              <button
                type="button"
                data-testid="simulate-idle-fatigue"
                onClick={simulateIdleFatigue}
                className="focus-ring px-2 py-1 rounded border border-border bg-surface text-ink hover:bg-canvas text-xs font-mono font-medium truncate cursor-pointer"
                title="Simulate sluggish velocity + >6s idle gap"
              >
                💤 Idle Gap
              </button>
            </div>
          </div>

          {/* Control Toggles: Human Lock & Auto-Adapt */}
          <div className="flex items-center justify-between pt-1 border-t border-border/60 text-xs">
            <button
              type="button"
              data-testid="toggle-human-lock"
              onClick={isHumanLocked ? unlockHuman : () => setManualEmotion(currentEmotion)}
              className="focus-ring inline-flex items-center gap-1 text-ink font-mono cursor-pointer hover:underline"
            >
              {isHumanLocked ? (
                <>
                  <Lock size={12} className="text-brand" aria-hidden="true" />
                  <span>Human Locked (Click to Unlock)</span>
                </>
              ) : (
                <>
                  <Unlock size={12} className="text-ink-muted" aria-hidden="true" />
                  <span>Auto Mode (Click to Lock)</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="toggle-auto-adapt"
              onClick={toggleAutoAdapt}
              className="focus-ring inline-flex items-center gap-1 text-ink font-mono cursor-pointer hover:underline"
            >
              <span>Auto-Adapt:</span>
              <strong className={autoAdapt ? 'text-success' : 'text-ink-muted'}>
                {autoAdapt ? 'ON' : 'OFF'}
              </strong>
            </button>
          </div>
        </div>

        {/* Section 3: Screen UX Sign-Off & 1-Click JSON Export */}
        <div className="p-3 rounded-lg border-2 border-border-strong bg-surface space-y-2.5">
          <span className="font-display font-bold text-ink flex items-center gap-1.5">
            <FileCheck size={14} className="text-brand" aria-hidden="true" />
            <span>Screen UX Sign-Off & Evaluator Audit</span>
          </span>

          <input
            type="text"
            data-testid="evaluator-notes-input"
            placeholder="Evaluator verification notes (e.g. Approved doodle styling)..."
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-sm border border-border bg-canvas text-ink focus:outline-none focus:ring-1 focus:ring-brand font-sans"
            aria-label="Evaluator signoff notes"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                data-testid="approve-screen-ux"
                onClick={handleApproveScreen}
                className="text-xs font-bold inline-flex items-center gap-1"
              >
                <CheckCircle2 size={13} aria-hidden="true" />
                <span>Approve Screen UX</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                data-testid="export-review-json"
                onClick={handleExportJson}
                className="text-xs inline-flex items-center gap-1"
              >
                <Download size={13} aria-hidden="true" />
                <span>Export JSON</span>
              </Button>
            </div>

            <button
              type="button"
              onClick={handleClearSignoffs}
              title="Clear stored audit sign-offs"
              className="focus-ring text-ink-muted hover:text-danger p-1 rounded cursor-pointer"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </div>

          {lastSignoffStatus && (
            <div
              data-testid="approval-status-message"
              className="text-xs font-mono font-bold text-success flex items-center gap-1"
            >
              <CheckCircle2 size={12} aria-hidden="true" />
              <span>{lastSignoffStatus}</span>
            </div>
          )}
        </div>

        {/* Section 4: Backward-Compatible Adaptation Proposal (if passed) */}
        {proposal && (
          <div className="p-3 rounded-lg border border-border bg-surface-subtle space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink">{proposal.title}</span>
              <Badge
                tone={proposalDecision === 'approved' ? 'success' : proposalDecision === 'rejected' ? 'danger' : 'info'}
                glyph="🛡️"
              >
                {proposalDecision.toUpperCase()}
              </Badge>
            </div>
            <p className="text-ink leading-snug m-0">{proposal.summary}</p>
            <div className="text-ink-muted">
              <strong className="text-ink">Proposed: </strong>
              {proposal.proposedChange}
            </div>
            {proposalDecision === 'pending' && (
              <div className="flex items-center gap-2 justify-end pt-1">
                <Button size="sm" variant="secondary" onClick={handleProposalReject}>
                  <XCircle className="w-3.5 h-3.5 me-1 text-danger" aria-hidden="true" />
                  Reject Proposal
                </Button>
                <Button size="sm" variant="primary" onClick={handleProposalApprove}>
                  <CheckCircle2 className="w-3.5 h-3.5 me-1" aria-hidden="true" />
                  Approve Adaptation
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
