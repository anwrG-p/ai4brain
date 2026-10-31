import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

/* Judge mode (spec R6): the CISTAC evaluator, inspector, stage and persona controls render only
   after `?judge=1`. The flag is remembered for the browser tab (sessionStorage), so it survives
   in-app navigation; `?judge=0` turns it off. Without storage it lasts only while the URL has it. */
export const JUDGE_KEY = 'synapsetwin_judge'

export function readJudgeMode(search: string): boolean {
  const flag = new URLSearchParams(search).get('judge')
  try {
    if (flag === '1') sessionStorage.setItem(JUDGE_KEY, '1')
    else if (flag === '0') sessionStorage.removeItem(JUDGE_KEY)
    return flag === '1' || (flag !== '0' && sessionStorage.getItem(JUDGE_KEY) === '1')
  } catch {
    return flag === '1'
  }
}

// ponytail: the storage write runs while rendering; it is idempotent, so a repeat render is harmless.
export function useJudgeMode(): boolean {
  const { search } = useLocation()
  return useMemo(() => readJudgeMode(search), [search])
}
