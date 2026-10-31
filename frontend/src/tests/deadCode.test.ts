import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { useAppStore } from '../state/useAppStore'

/* INT-1: no dead modules. Every source file is reachable from main.tsx through relative imports,
   except tests and the few modules only the QA scripts and tests read. A legacy component that
   nothing imports fails this test instead of lingering. */

const SRC = path.resolve(__dirname, '..')
// Read by scripts/ (lint-copy, check-contrast) and tests, never by the app.
const SCRIPT_ONLY = ['utils/contrast.ts', 'utils/copyLinter.ts', 'styles/token-metadata.ts']
// Brand art kept for the docs (docs/ux-pipeline); not shipped unless imported.
const isAsset = (f: string) => f.startsWith('assets/')
const isTest = (f: string) => /\.test\.tsx?$/.test(f) || f.startsWith('tests/')

const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

function resolve(from: string, spec: string): string | null {
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const p = path.resolve(path.dirname(from), spec + ext)
    if (existsSync(p) && statSync(p).isFile()) return p
  }
  return null
}

const IMPORT = /(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|import\s+['"](\.[^'"]+)['"]|@import\s+['"](\.[^'"]+)['"]/g

function reachable(): Set<string> {
  const seen = new Set<string>()
  const stack = [path.join(SRC, 'main.tsx')]
  while (stack.length) {
    const f = stack.pop()!
    if (seen.has(f)) continue
    seen.add(f)
    if (!/\.(tsx?|css)$/.test(f)) continue
    for (const m of readFileSync(f, 'utf8').matchAll(IMPORT)) {
      const r = resolve(f, (m[1] ?? m[2] ?? m[3] ?? m[4])!)
      if (r) stack.push(r)
    }
  }
  return seen
}

describe('dead code (INT-1)', () => {
  it('every app module is imported from main.tsx', () => {
    const seen = reachable()
    const dead = files(SRC)
      .filter((f) => !seen.has(f))
      .map(rel)
      .filter((f) => !isTest(f) && !isAsset(f) && !SCRIPT_ONLY.includes(f))
    expect(dead).toEqual([])
  })

  it('the app store holds no unused settings or demo switches', () => {
    const keys = Object.keys(useAppStore.getState())
    for (const gone of ['simulateLlmDown', 'textScale', 'soundEffects', 'enhancedGlyphs', 'blurAutoPause', 'studyWindow', 'restDays'])
      expect(keys).not.toContain(gone)
  })
})
