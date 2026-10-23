// Population std-dev (ms) of the intervals between input timestamps; 0 with fewer than 3 inputs.
export function hesitationJitter(inputTimes: number[]): number {
  if (inputTimes.length < 3) return 0
  const gaps = inputTimes.slice(1).map((t, i) => t - inputTimes[i])
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  return Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length)
}

// Length of the current run of consecutive errors (0 after a correct response).
export function nextErrorBurst(prev: number, correct: boolean): number {
  return correct ? 0 : prev + 1
}
