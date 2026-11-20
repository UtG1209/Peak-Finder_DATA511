// "Not sure? Spin the wheel": a wheel of the top 12 hikes that fit, wider slice = higher match %.
// It spins once on open, lands, and shows the pick with Open and Spin again. With prefers-reduced-motion it picks at once.
import { animate, useMotionValue, motion, type AnimationPlaybackControls } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DIFFICULTY_COLORS, DIFFICULTY_LABEL, type Difficulty } from '../lib/difficulty'
import { landingRotation, pickWeighted, sliceAngles } from '../lib/wheel'

export interface WheelHike {
  id: string
  name: string
  park: string
  match: number
  difficulty: Difficulty
}

interface Props {
  hikes: WheelHike[]
  quarterLabel: string
  onOpen: (id: string) => void
  onClose: () => void
  /** Injectable for tests; defaults to Math.random. */
  rng?: () => number
}

const SPIN_SECONDS = 4
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const polar = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)]
}
const slicePath = (start: number, end: number) => {
  const [x0, y0] = polar(start, 96)
  const [x1, y1] = polar(end, 96)
  const large = end - start > 180 ? 1 : 0
  return `M100 100 L${x0} ${y0} A96 96 0 ${large} 1 ${x1} ${y1} Z`
}
const short = (name: string) => (name.length > 16 ? `${name.slice(0, 15)}…` : name)

export function Wheel({ hikes, quarterLabel, onOpen, onClose, rng = Math.random }: Props) {
  const rotation = useMotionValue(0)
  const [winner, setWinner] = useState<number | null>(null)
  const [spinning, setSpinning] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const openBtn = useRef<HTMLButtonElement>(null)
  const anim = useRef<AnimationPlaybackControls | null>(null)
  const spinId = useRef(0) // a newer spin makes an older one's "landed" callback stale
  const closed = useRef(false)
  const slices = useMemo(() => sliceAngles(hikes.map((h) => ({ match: h.match }))), [hikes])

  const spin = useCallback(() => {
    const pick = pickWeighted(hikes.map((h) => ({ match: h.match })), rng)
    if (!pick) return
    anim.current?.stop()
    const id = ++spinId.current
    setWinner(null)
    const end = landingRotation(rotation.get(), slices[pick.index], pick.fraction)
    if (reduced()) {
      rotation.set(end) // picks at once: no spinning
      setWinner(pick.index)
      return
    }
    setSpinning(true)
    anim.current = animate(rotation, end, {
      duration: SPIN_SECONDS,
      ease: [0.12, 0.7, 0.1, 1],
      onComplete: () => {
        if (closed.current || id !== spinId.current) return
        setSpinning(false)
        setWinner(pick.index)
      },
    })
  }, [hikes, rng, rotation, slices])

  // spin once when it opens; focus the dialog so keyboard users start inside it
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null // give focus back to the button that opened the wheel
    dialog.current?.focus()
    closed.current = false
    const start = window.setTimeout(spin, 0) // next tick: with reduced motion that is still "at once"
    return () => {
      window.clearTimeout(start)
      closed.current = true
      anim.current?.stop()
      opener?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (winner !== null) openBtn.current?.focus()
  }, [winner])

  const won = winner === null ? null : hikes[winner]
  return (
    <div className="wheel-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="wheel" role="dialog" aria-modal="true" aria-labelledby="wheel-title" tabIndex={-1} ref={dialog}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Tab') { // keep focus inside the dialog
            const f = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])]
            if (!f.length) return
            const first = f[0], last = f[f.length - 1]
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
          }
        }}
      >
        <h2 id="wheel-title">Not sure? Spin the wheel</h2>
        <p className="hintline">The top {hikes.length} hikes that fit in {quarterLabel}. A better match gets a wider slice.</p>
        <div className="wheel-stage" aria-hidden="true">
          <div className="wheel-pointer" />
          <motion.div className="wheel-disc" style={{ rotate: rotation }}>
            <svg viewBox="0 0 200 200">
              {hikes.map((h, i) => {
                const { start, end } = slices[i]
                const mid = (start + end) / 2
                const [tx, ty] = polar(mid, 62)
                const light = h.difficulty !== 'hard'
                return (
                  <g key={h.id}>
                    <path d={slicePath(start, end)} fill={DIFFICULTY_COLORS[h.difficulty]} stroke="#101418" strokeWidth="1.5" opacity={winner === null || winner === i ? 1 : 0.55} />
                    {end - start >= 14 && (
                      <text x={tx} y={ty} fontSize="6" fontWeight="700" fill={light ? '#101418' : '#ffffff'} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${mid - 90} ${tx} ${ty})`}>{short(h.name)}</text>
                    )}
                  </g>
                )
              })}
              <circle cx="100" cy="100" r="9" fill="#101418" stroke="#f2efe9" strokeWidth="2" />
            </svg>
          </motion.div>
        </div>

        <div className="wheel-result" aria-live="polite">
          {spinning && <p className="hintline">Spinning…</p>}
          {won && (
            <>
              <p className="eyebrow">Your pick · {Math.round(won.match)}% match</p>
              <h3>{won.name}</h3>
              <p className="sub"><i className="dd" style={{ background: DIFFICULTY_COLORS[won.difficulty] }} />{won.park} · {DIFFICULTY_LABEL[won.difficulty]}</p>
            </>
          )}
        </div>
        <div className="wheel-actions">
          <button type="button" className="go" ref={openBtn} disabled={!won} onClick={() => won && onOpen(won.id)}>Open <span aria-hidden="true">→</span></button>
          <button type="button" className="fit" disabled={spinning} onClick={spin}>Spin again</button>
          <button type="button" className="fit" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
