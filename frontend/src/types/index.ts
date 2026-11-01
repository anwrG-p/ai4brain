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
  | 'stop_signal'

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
