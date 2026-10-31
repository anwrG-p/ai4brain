import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import { Loti } from '../features/characters'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

/* A render error shows Loti, one plain line, Try again and a quiet way home (ticket 09a). The error
   itself goes to the console only; the user sees nothing technical (U1). */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
        <Loti pose="idle" size="md" />
        <h1 className="font-display text-3xl font-bold text-ink">Something went wrong.</h1>
        <p className="text-lg text-ink">Your answers are safe.</p>
        <Button size="lg" onClick={this.handleReset}>
          Try again
        </Button>
        {/* A full load, so the app starts clean. */}
        <a
          href="/dashboard"
          className="focus-ring inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-brand underline underline-offset-4"
        >
          Go home
        </a>
      </div>
    )
  }
}

export default ErrorBoundary
