import { useEffect, useRef, useState } from 'react'
import type { Units } from '../lib/units'

/** Metric toggle: °F · mi · ft or °C · km · m. Stored in the URL as units=metric by the caller. */
export function UnitsToggle({ units, onChange }: { units: Units; onChange: (u: Units) => void }) {
  return (
    <div className="fits units" role="group" aria-label="Units">
      <button type="button" className="fit" aria-pressed={units === 'us'} onClick={() => onChange('us')}>°F · mi</button>
      <button type="button" className="fit" aria-pressed={units === 'metric'} onClick={() => onChange('metric')}>°C · km</button>
    </div>
  )
}

/** Copy text with the async Clipboard API, falling back to a hidden textarea where it is blocked (http, old browsers). */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const t = document.createElement('textarea')
    t.value = text
    t.setAttribute('readonly', '')
    t.style.position = 'fixed'
    t.style.opacity = '0'
    document.body.appendChild(t)
    t.select()
    const ok = document.execCommand?.('copy') ?? false
    t.remove()
    return ok
  }
}

/** "Share link": copies the current view (with go=1, so it opens unblurred). Says so in words for screen readers too. */
export function ShareButton({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <>
      <button
        type="button" className="fit share"
        onClick={async () => {
          setState((await copy(url)) ? 'copied' : 'failed')
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setState('idle'), 3000)
        }}
      >
        {state === 'copied' ? 'Link copied ✓' : 'Share link'}
      </button>
      <span className="sr-only" role="status">{state === 'copied' ? 'Link copied to the clipboard' : state === 'failed' ? 'Could not copy the link' : ''}</span>
      {state === 'failed' && <span className="hintline">Copy it from the address bar.</span>}
    </>
  )
}
