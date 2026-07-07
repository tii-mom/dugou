'use client'

import { useEffect, useRef, useState } from 'react'

/** 数字平滑滚动到目标值 */
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    const start = performance.now()

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (target - from) * eased
      setValue(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}
