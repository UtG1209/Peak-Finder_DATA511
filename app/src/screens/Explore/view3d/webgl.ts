// Is WebGL available? Probed once; the 3D view toggle is disabled (with words) when it is not, and the 2D map stays.
import { useEffect, useState } from 'react'

let cached: boolean | undefined

export function webglAvailable(): boolean {
  if (cached !== undefined) return cached
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null
    cached = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext() // free the probe context at once
  } catch {
    cached = false
  }
  return cached
}

/** True while the viewport is at least `px` wide (the 3D toggle is hidden below 860 px). */
export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`
  const [ok, setOk] = useState(() => typeof matchMedia !== 'function' || matchMedia(query).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(query)
    const on = () => setOk(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return ok
}
