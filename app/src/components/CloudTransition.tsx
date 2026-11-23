import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useData } from '../data/DataContext'
import './CloudTransition.css'

export type WalkSeason = 'winter' | 'spring' | 'summer' | 'autumn'

export interface CloudTransitionProps {
  hikeId: string
  season: WalkSeason
  /** Called after the transition; the caller navigates to the walk URL with back/times parameters. */
  onDone: () => void
}

/** Full-screen cloud dive used immediately before navigating to a 3D trail walk. */
export default function CloudTransition({ hikeId, season, onDone }: CloudTransitionProps) {
  const { index } = useData()
  const hike = index.hikeById.get(hikeId)
  const reduceMotion = useReducedMotion()
  const [phase, setPhase] = useState<'rush' | 'white' | 'part'>('rush')
  const doneRef = useRef(onDone)

  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  const layers = hike ? {
    // Cloud textures are shared by all walk pages rather than duplicated in
    // each walk's directory. Resolve them from the same site base as the walk.
    far: `${import.meta.env.BASE_URL}walks/_shared/clouds/wisps.webp`,
    mid: `${import.meta.env.BASE_URL}walks/_shared/clouds/cumulus.webp`,
    near: `${import.meta.env.BASE_URL}walks/_shared/clouds/mass.webp`,
  } : {}

  useEffect(() => {
    const finish = window.setTimeout(() => doneRef.current(), reduceMotion ? 180 : 3000)
    if (reduceMotion) return () => window.clearTimeout(finish)
    const white = window.setTimeout(() => setPhase('white'), 1050)
    const part = window.setTimeout(() => setPhase('part'), 1750)
    return () => {
      window.clearTimeout(finish)
      window.clearTimeout(white)
      window.clearTimeout(part)
    }
  }, [reduceMotion])

  const entering = phase === 'rush'
  const parting = phase === 'part'
  return (
    <div className={`cloud-transition${reduceMotion ? ' reduced' : ''}`}>
      <motion.div className="ct-sky" initial={{ opacity: 0 }} animate={{ opacity: entering ? 0.85 : parting ? 0 : 0.85 }} transition={{ duration: reduceMotion ? 0.15 : 0.9 }} />
      <motion.div className="ct-layer far" style={{ backgroundImage: layers.far ? `url("${layers.far}")` : undefined }} initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: parting ? 0 : 0.68, scale: entering ? 1.5 : parting ? 3.2 : 1.5 }} transition={{ duration: reduceMotion ? 0.15 : 1.6, ease: 'easeOut' }} />
      <motion.div className="ct-layer mid" style={{ backgroundImage: layers.mid ? `url("${layers.mid}")` : undefined }} initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: parting ? 0 : 0.86, scale: entering ? 2 : parting ? 5 : 2 }} transition={{ duration: reduceMotion ? 0.15 : 1.8, delay: 0.12, ease: 'easeOut' }} />
      <motion.div className="ct-layer near" style={{ backgroundImage: layers.near ? `url("${layers.near}")` : undefined }} initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: parting ? 0 : 1, scale: entering ? 3.2 : parting ? 9 : 3.2 }} transition={{ duration: reduceMotion ? 0.15 : 1.7, delay: 0.24, ease: 'easeOut' }} />
      <motion.div className="ct-veil" animate={{ opacity: phase === 'white' ? 1 : parting ? 0 : 0.12 }} transition={{ duration: reduceMotion ? 0.15 : 0.6 }} />
      <motion.div className="ct-title" role="status" aria-live="polite" animate={{ opacity: phase === 'white' ? 1 : 0 }} transition={{ duration: reduceMotion ? 0.1 : 0.35 }}>
        <span>Entering the trail</span><b>{hike?.name ?? '3D trail walk'}</b><small>{season}</small>
      </motion.div>
    </div>
  )
}
