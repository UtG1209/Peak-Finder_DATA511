import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, type TargetAndTransition } from 'framer-motion'
import { useData } from '../data/DataContext'
import { cloudSchedule, type CloudPhase } from '../lib/cloudSchedule'
import './CloudTransition.css'

export type WalkSeason = 'winter' | 'spring' | 'summer' | 'autumn'

export interface CloudTransitionProps {
  hikeId: string
  season: WalkSeason
  /** Called when the transition ends; going in, the caller navigates to the walk URL; coming back, it removes the overlay. */
  onDone: () => void
  /** 'in' (default) goes to the walk; 'out' plays the clouds in reverse when the user is back from it. */
  direction?: 'in' | 'out'
}

/** Full-screen cloud dive used immediately before navigating to a 3D trail walk, and again in reverse on the way back. */
export default function CloudTransition({ hikeId, season, onDone, direction = 'in' }: CloudTransitionProps) {
  const { index } = useData()
  const hike = index.hikeById.get(hikeId)
  const reduceMotion = !!useReducedMotion()
  const sched = cloudSchedule(direction, reduceMotion)
  const [phase, setPhase] = useState<CloudPhase>(sched.start)
  const doneRef = useRef(onDone)

  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  // Cloud textures are shared by all walk pages (walks/_shared), resolved from the site base.
  const tex = (name: string) => `url("${import.meta.env.BASE_URL}walks/_shared/clouds/${name}.webp")`

  useEffect(() => {
    const s = cloudSchedule(direction, reduceMotion)
    const timers = [window.setTimeout(() => doneRef.current(), s.doneAt), ...s.steps.map((st) => window.setTimeout(() => setPhase(st.phase), st.at))]
    return () => timers.forEach(window.clearTimeout)
  }, [reduceMotion, direction])

  const entering = phase === 'rush'
  const parting = phase === 'part'
  const t = (d: number) => (reduceMotion ? 0.15 : d)
  const from = (v: TargetAndTransition) => (direction === 'out' ? false : v)
  return (
    <div className={`cloud-transition${reduceMotion ? ' reduced' : ''}`} data-direction={direction} data-phase={phase}>
      {!reduceMotion && (
        <>
          <motion.div className="ct-sky" initial={from({ opacity: 0 })} animate={{ opacity: parting ? 0 : 0.85 }} transition={{ duration: 0.9 }} />
          <motion.div className="ct-layer far" style={{ backgroundImage: tex('wisps') }} initial={from({ opacity: 0, scale: 1.2 })} animate={{ opacity: parting ? 0 : 0.68, scale: entering ? 1.5 : parting ? 3.2 : 1.5 }} transition={{ duration: 1.6, ease: 'easeOut' }} />
          <motion.div className="ct-layer mid" style={{ backgroundImage: tex('cumulus') }} initial={from({ opacity: 0, scale: 1.2 })} animate={{ opacity: parting ? 0 : 0.86, scale: entering ? 2 : parting ? 5 : 2 }} transition={{ duration: 1.8, delay: 0.12, ease: 'easeOut' }} />
          <motion.div className="ct-layer near" style={{ backgroundImage: tex('mass') }} initial={from({ opacity: 0, scale: 1.2 })} animate={{ opacity: parting ? 0 : 1, scale: entering ? 3.2 : parting ? 9 : 3.2 }} transition={{ duration: 1.7, delay: 0.24, ease: 'easeOut' }} />
        </>
      )}
      <motion.div className="ct-veil" initial={{ opacity: direction === 'out' ? 1 : 0 }} animate={{ opacity: phase === 'white' ? 1 : parting ? 0 : 0.12 }} transition={{ duration: t(0.6) }} />
      <motion.div className="ct-title" role="status" aria-live="polite" initial={{ opacity: direction === 'out' ? 1 : 0 }} animate={{ opacity: phase === 'white' ? 1 : 0 }} transition={{ duration: t(0.35) }}>
        <span>{direction === 'in' ? 'Entering the trail' : 'Back to the trail page'}</span><b>{hike?.name ?? '3D trail walk'}</b><small>{season}</small>
      </motion.div>
    </div>
  )
}
