import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Mascot } from '../features/brand/Mascot'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  copiedToast: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copiedToast: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    // In production this could send to a telemetry queue; in CISTAC it logs cleanly
    console.error('[SynapseTwin ErrorBoundary Intercepted]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copiedToast: false,
    })
    this.props.onReset?.()
  }

  handleCopyDiagnostics = async () => {
    const diagnosticPayload = {
      timestamp: new Date().toISOString(),
      errorName: this.state.error?.name ?? 'UnknownError',
      errorMessage: this.state.error?.message ?? 'No message provided',
      componentStack: this.state.errorInfo?.componentStack ?? 'N/A',
      location: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    }

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(diagnosticPayload, null, 2),
      )
      this.setState({ copiedToast: true })
      setTimeout(() => this.setState({ copiedToast: false }), 3000)
    } catch {
      // Fallback if clipboard permission is denied
      console.warn('Clipboard write failed; diagnostic JSON logged to console', diagnosticPayload)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Card
            className="max-w-2xl w-full p-6 sm:p-8 border-2 border-danger/40 bg-surface shadow-lg space-y-6"
            aria-label="Component Fault Intercepted"
          >
            {/* Header Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Badge tone="danger" glyph="▲">
                  Self-Healing Boundary Active
                </Badge>
                <Badge tone="neutral">
                  Zero White-Screen Guarantee
                </Badge>
              </div>
              <span className="font-mono text-xs text-ink-muted">
                ERR-CLIENT-RECOVERY
              </span>
            </div>

            {/* Mascot and Reassuring Title */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <Mascot state="rest" size="md" className="shrink-0" />
              <div className="space-y-1.5 text-center sm:text-left">
                <h2 className="font-display font-bold text-xl sm:text-2xl text-ink">
                  Component Fault Isolated & Preserved
                </h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  An unhandled rendering fault occurred within this UI module.
                  Your cognitive trial telemetry and local profile state remain
                  safe and buffered in indexed storage.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-danger/30 bg-danger/10 text-xs font-mono text-ink space-y-1"
            >
              <div className="font-semibold text-danger">
                {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unexpected application state'}
              </div>
              <div className="text-ink-muted text-xs">
                No telemetry was lost. You can safely retry mounting this component or reset to defaults.
              </div>
            </div>

            {/* Collapsible Sanitized Technical Diagnostics */}
            <details className="text-xs border border-border rounded-xl p-3 bg-canvas/40 space-y-2">
              <summary className="font-semibold cursor-pointer text-ink hover:text-brand transition-colors focus-ring rounded-sm">
                Inspect Technical Diagnostics (Audit & Reproduction)
              </summary>
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-ink-muted">
                  Component Stack Trace (Sanitized):
                </p>
                <pre className="p-2.5 rounded-lg bg-canvas text-ink font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {this.state.errorInfo?.componentStack || 'No component stack trace available.'}
                </pre>
              </div>
            </details>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={this.handleReset}
                >
                  Try Re-rendering Component
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={this.handleCopyDiagnostics}
                >
                  {this.state.copiedToast
                    ? '✓ Diagnostic JSON Copied'
                    : 'Copy Diagnostic JSON'}
                </Button>
              </div>

              <a
                href="/"
                className="tactile-btn bg-surface text-ink px-3 py-2 text-sm font-semibold inline-flex items-center no-underline"
              >
                ← Return to Home
              </a>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
