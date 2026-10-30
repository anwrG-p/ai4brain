import { Component, type ReactNode } from 'react'

type Props = { taskId: string; onSkip: () => void; children: ReactNode }

// A task whose params make it throw while rendering is logged and skipped instead of blanking the app.
// Mount with `key` = the task counter so the next task gets a fresh boundary.
export class SkipOnError extends Component<Props, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.error(`task ${this.props.taskId} failed to render; skipping`, err)
    this.props.onSkip()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
