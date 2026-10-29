import { NodiCompanion, type NodiState, type NodiCompanionProps } from './NodiCompanion'

export type MascotState = NodiState

export interface MascotProps extends NodiCompanionProps {
  // Backwards compatibility with previous Mascot prop signature
  ariaHidden?: boolean
}

export function Mascot(props: MascotProps) {
  return <NodiCompanion {...props} />
}

export { NodiCompanion }
