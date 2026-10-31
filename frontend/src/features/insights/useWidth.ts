import { useLayoutEffect, useRef, useState } from 'react'

/** The element's width in CSS px, kept current with a ResizeObserver. Charts draw in real pixels so
    their text keeps its size on a phone (a scaled viewBox shrinks 14 px labels to about 10). Before
    layout (and in jsdom, which has none) it is `fallback`. */
export function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => {
      const w = Math.round(el.clientWidth)
      if (w > 0) setWidth(w)
    }
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}
