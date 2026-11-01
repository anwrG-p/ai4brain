import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { REDIRECTS } from '../App'
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

  it('no app code links to a redirected route; links go to the new routes', () => {
    // A quote or backtick opens the path. A plain key matches only itself ('/task' redirects, the
    // real route '/task/:dimId' does not); a key with a :param matches its prefix plus '/'.
    const esc = (r: string) => r.replace(/[/-]/g, '\\$&')
    const alts = Object.keys(REDIRECTS).map((r) => (r.includes('/:') ? `${esc(r.replace(/\/:.*$/, ''))}\\/` : `${esc(r)}(?=[?'"\`])`))
    const pattern = new RegExp(`['"\`](?:${alts.join('|')})`)
    const hits = files(SRC)
      .filter((f) => /\.tsx?$/.test(f) && !isTest(rel(f)) && rel(f) !== 'App.tsx')
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .filter((line) => pattern.test(line) && !/pathname/.test(line)) // a route check, not a link
          .map((line) => `${rel(f)}: ${line.trim()}`),
      )
    expect(hits).toEqual([])
  })

  it('every runtime dependency is imported by the app', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(SRC, '../package.json'), 'utf8')) as { dependencies: Record<string, string> }
    const code = files(SRC)
      .filter((f) => /\.tsx?$/.test(f) && !isTest(rel(f)))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')
    // The package itself ('d') or a path inside it ('d/...'), never a longer name that starts with it.
    const unused = Object.keys(pkg.dependencies).filter((d) => !code.includes(`'${d}'`) && !code.includes(`'${d}/`))
    expect(unused).toEqual([])
  })

  it('CI step names carry no test counts (they go stale with every new test)', () => {
    const ci = readFileSync(path.resolve(SRC, '../../.github/workflows/ui-ci.yml'), 'utf8')
    expect(ci).not.toMatch(/name:.*\(\d+\/\d+\)/)
  })

  it('the app store holds no unused settings or demo switches', () => {
    const keys = Object.keys(useAppStore.getState())
    for (const gone of ['simulateLlmDown', 'textScale', 'soundEffects', 'enhancedGlyphs', 'blurAutoPause', 'studyWindow', 'restDays'])
      expect(keys).not.toContain(gone)
  })
})
