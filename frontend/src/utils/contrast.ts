import type { ContrastPairReport } from '../types'
import { DESIGN_SYSTEM_CONTRAST_PAIRS } from '../styles/token-metadata'

/**
 * Computes WCAG 2.1 relative luminance for a 6-digit hex color string.
 */
export function getRelativeLuminance(hex: string): number {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '')
  if (clean.length !== 6) {
    throw new Error(`Expected 6-char hex color, received: ${hex}`)
  }
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255

  const toLinear = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Computes WCAG 2.1 contrast ratio between two hex colors (rounded to 2 decimals).
 */
export function computeContrastRatio(hexA: string, hexB: string): number {
  const lumA = getRelativeLuminance(hexA)
  const lumB = getRelativeLuminance(hexB)
  const brightest = Math.max(lumA, lumB)
  const darkest = Math.min(lumA, lumB)
  const ratio = (brightest + 0.05) / (darkest + 0.05)
  return Math.round(ratio * 100) / 100
}

/**
 * Evaluates all registered design-system token pairs against WCAG 2.1 thresholds.
 */
export function evaluateDesignSystemContrast(): ContrastPairReport[] {
  return DESIGN_SYSTEM_CONTRAST_PAIRS.map((pair) => {
    const ratio = computeContrastRatio(pair.fgHex, pair.bgHex)
    const passes = ratio >= pair.minRequired
    let level: ContrastPairReport['level'] = 'FAIL'
    if (ratio >= 7.0 && pair.minRequired === 4.5) {
      level = 'AAA'
    } else if (ratio >= 4.5 && pair.minRequired === 4.5) {
      level = 'AA'
    } else if (ratio >= 3.0 && pair.minRequired === 3.0) {
      level = 'AA-UI'
    }
    return {
      ...pair,
      ratio,
      level,
      passes,
    }
  })
}
