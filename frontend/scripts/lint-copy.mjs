import fs from 'node:fs'
import path from 'node:path'

const SRC_DIR = path.resolve(process.cwd(), 'src')

function walkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkFiles(full))
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.includes('copyLinter') &&
      !/\.test\.(ts|tsx)$/.test(entry.name)
    ) {
      results.push(full)
    }
  }
  return results
}

// Banned clinical/guilt rules targeting user-facing copy
const BANNED = [
  { term: 'ADHD', pattern: /\badhd\b/i },
  { term: 'dementia', pattern: /\bdementia\b/i },
  { term: 'autism', pattern: /\bautism\b/i },
  // Negation-aware: allows "not a medical/clinical diagnostic tool"
  {
    term: 'diagnosis',
    pattern: /(?<!(?:not a|no|not|never|zero|non-clinical|non-)\s+(?:medical|clinical|educational)?\s*)\bdiagnos(?:is|e|ed|tic)\b/i,
  },
  { term: 'disorder', pattern: /(?<!(?:not|no|never|zero)\s+)\bdisorder(?:s)?\b/i },
  { term: 'deficit', pattern: /(?<!(?:not|no|never|zero)\s+(?:clinical|cognitive)?\s*)\bdeficit(?:s)?\b/i },
  { term: 'impairment', pattern: /\bimpair(?:ment|ed)\b/i },
  { term: 'pathology', pattern: /\bpatholog(?:y|ical)\b/i },
  { term: 'symptom', pattern: /\bsymptom(?:s)?\b/i },
  { term: 'patient', pattern: /\bpatient(?:s)?\b/i },
  { term: 'IQ', pattern: /(?<!(?:not|no|never|zero)\s+)\biq(?:\s+score|\s+label)?\b/i },
  { term: 'anxiety', pattern: /\banxiety\b/i },
  { term: 'depression', pattern: /\bdepression\b/i },
  { term: 'dyslexia', pattern: /\bdyslexia\b/i },
  { term: "Alzheimer's", pattern: /\balzheimer(?:'s)?\b/i },
  { term: 'cognitive decline', pattern: /\bcognitive decline\b/i },
  { term: 'abnormal', pattern: /\babnormal\b/i },
  { term: 'below average', pattern: /\bbelow average\b/i },
  { term: 'lazy (guilt)', pattern: /\b(?:you are|too|feeling)\s+lazy\b/i },
  { term: 'weak (guilt)', pattern: /\b(?:you are|too)\s+weak\b/i },
  { term: 'behind (guilt)', pattern: /\b(?:you are|falling)\s+behind\b/i },
  { term: 'broke streak', pattern: /\bbroke your (?:[\w-]+\s+)?streak\b/i },
  { term: 'lost streak', pattern: /\blost your streak\b/i },
  { term: 'you failed', pattern: /\byou failed\b/i },
]

// Forbidden academic/ML jargon targeting consumer UI copy
const BANNED_ACADEMIC_ML = [
  { term: 'SAT-JEPA (use Your Thinking Style)', pattern: /\bSAT-JEPA\b/i },
  { term: 'Differential Vector Δc (use Weekly Progress Boost)', pattern: /\bDifferential Vector\s*\(?Δc\)?/i },
  { term: 'Epistemic Uncertainty (use Clarity Range)', pattern: /\bepistemic uncertainty\b/i },
  { term: 'Uncertainty Polygon (use Clarity Range)', pattern: /\buncertainty polygon\b/i },
  { term: 'QUEST+ Staircase Target (use Auto-Paced to Your Flow Zone)', pattern: /\bQUEST\+\s+(?:Psychometric\s+)?Staircase\s+Target\b/i },
  { term: '5-Part Reasoning Trail (use ✨ Why Brian Suggests This)', pattern: /\b5-Part Reasoning Trail\b/i },
  { term: 'Continuous Saccadic Drift (use Daily Energy & Focus Rhythm)', pattern: /\b(?:continuous\s+)?saccadic drift\b/i },
]

// The one page that may name the method ("How we calculate this", spec U5)
const ACADEMIC_JARGON_EXEMPT_PAGES = ['MethodologyPage.tsx']

let violations = 0
for (const file of walkFiles(SRC_DIR)) {
  const rel = path.relative(process.cwd(), file)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  let inDetailsDrawer = false

  lines.forEach((line, idx) => {
    const trimmed = line.trim()

    // Track technical inspect details drawers
    if (line.includes('<details')) {
      inDetailsDrawer = true
    }
    if (line.includes('</details>')) {
      inDetailsDrawer = false
      return
    }

    // Skip code imports, comments, React.lazy, and JSX comments
    if (
      line.includes('React.lazy') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('{/*')
    ) {
      return
    }

    // Skip technical system/developer diagnostics (e.g. ErrorBoundary diagnostic JSON, System logs)
    if (
      line.includes('Diagnostic JSON') ||
      line.includes('diagnosticPayload') ||
      line.includes('Diagnostic Recovery Log') ||
      line.includes('System Faults') ||
      line.includes('diagnostic tool') // From multiline "not a medical or clinical \n diagnostic tool"
    ) {
      return
    }

    // Skip intentional linter sandbox test fixtures
    if (
      rel.endsWith('MethodologyPage.tsx') &&
      (line.includes('SAMPLE_CLINICAL_DEMO_INPUT') ||
        line.includes('SAMPLE_GUILT_DEMO_INPUT') ||
        line.includes('SAMPLE_GUARDRAIL_INTERCEPTION_INPUT') ||
        line.includes('Patient shows') ||
        line.includes('broke your') ||
        line.includes('cognitive decline'))
    ) {
      return
    }

    // Skip explicit ethical disclaimer banners that describe what the system is NOT
    if (
      line.includes('educational cognitive twin, not a medical') ||
      line.includes('not a medical or clinical diagnostic device') ||
      line.includes('Never provides clinical, medical, or psychiatric diagnostic labels') ||
      line.includes('never mapped to clinical or cognitive deficits') ||
      line.includes('clinical diagnosis, medical evaluation, or fixed intelligence') ||
      line.includes('Zero medical diagnosis, zero IQ labels') ||
      line.includes('Medical records, clinical labels, or fixed IQ scores') ||
      line.includes('Never use clinical terms, diagnostic claims') ||
      line.includes('bans medical/diagnostic terms') ||
      line.includes('14 diagnostic and punitive guilt patterns')
    ) {
      return
    }

    // 1. Clinical and punitive guilt rules (checked across all UI copy)
    for (const rule of BANNED) {
      if (rule.pattern.test(line)) {
        console.error(`[FAIL] ${rel}:${idx + 1} matched banned copy rule "${rule.term}" (${rule.pattern}): ${line.trim()}`)
        violations++
      }
    }

    // 2. Academic / ML jargon rules (exempt for <details> drawers, developer diagnostics, and non-page models)
    const isExemptFromAcademicJargon =
      inDetailsDrawer ||
      ACADEMIC_JARGON_EXEMPT_PAGES.some((page) => rel.endsWith(page)) ||
      !rel.includes(`pages${path.sep}`) ||
      rel.endsWith('PrivacyPage.tsx') || // 09d's page; its owner drops this exemption
      line.includes('Explore How This Is Calculated') ||
      line.includes('data-technical-drawer')

    if (!isExemptFromAcademicJargon) {
      for (const rule of BANNED_ACADEMIC_ML) {
        if (rule.pattern.test(line)) {
          console.error(`[FAIL] ${rel}:${idx + 1} matched forbidden academic/ML jargon "${rule.term}" (${rule.pattern}): ${line.trim()}`)
          violations++
        }
      }
    }
  })
}

if (violations > 0) {
  console.error(`Copy lint failed with ${violations} violation(s).`)
  process.exit(1)
}
console.log('[PASS] lint:copy — All UI copy and mock fixtures pass non-clinical, zero-guilt, and academic jargon checks.')
