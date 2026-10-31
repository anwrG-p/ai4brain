import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Motion pass (ticket 07b, spec R8): guards on tokens.css.
const css = readFileSync(path.resolve(__dirname, 'tokens.css'), 'utf8')
const block = css.slice(css.indexOf('/* Motion pass (ticket 07b'))

describe('motion pass (tokens.css)', () => {
  it('animates transform and opacity only', () => {
    const frames = [...css.matchAll(/@keyframes (anim-[\w-]+|char-(?:breathe|blink)) \{([\s\S]*?)\n\}/g)]
    expect(frames.length).toBeGreaterThanOrEqual(14)
    for (const [, name, body] of frames) {
      const props = [...body!.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(props.filter((p) => p !== 'transform' && p !== 'opacity'), name).toEqual([])
    }
  })

  it('turns every anim-* class off under reduced motion, OS or app setting', () => {
    const lock = block.slice(block.indexOf('/* motion pass: lock */'))
    expect(lock).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\[class\*="anim-"\] \{\s*animation: none !important;/)
    expect(lock).toMatch(/\[data-reduced-motion="true"\] \[class\*="anim-"\] \{\s*animation: none !important;/)
  })

  it('presses an answer button only with motion on, and never one that draws the stimulus', () => {
    const press = block.slice(block.indexOf('@media (prefers-reduced-motion: no-preference)'))
    const rule = press.slice(0, press.indexOf('\n}\n'))
    expect(rule).toMatch(/:root:not\(\[data-reduced-motion="true"\]\) \[data-timed-trial="true"\] \.tactile-btn:not\(:has\(svg\)\):active:not\(:disabled\) \{\s*transform: scale\(0\.97\) !important;/)
    // Nothing else in the motion pass reaches into a running trial.
    const code = block.replace(rule, '').replace(/\/\*[\s\S]*?\*\//g, '') // comments may name it
    expect(code).not.toMatch(/data-timed-trial/)
  })
})
