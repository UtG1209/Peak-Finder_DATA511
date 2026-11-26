// State for the "Walk it in 3D" cloud transition and for coming back from a walk (Plan 5b step 1: moved out of Hike.tsx unchanged).
import { useEffect, useState } from 'react'
import { takeWalkReturn } from '../../lib/walkReturn'

export function useWalkReturn(id: string | undefined) {
  const [openingWalk, setOpeningWalk] = useState(false)
  // Back from the 3D walk: play the clouds in reverse and put the page back where it was (the walk reloads the app, so the position is kept in sessionStorage)
  const [returnY, setReturnY] = useState<number | null>(() => (id ? takeWalkReturn(window.sessionStorage, id) : null))
  const returning = returnY != null
  useEffect(() => {
    // charts and photos load after mount, so the page may be too short at first: keep trying for about a second
    let raf = 0
    const t0 = performance.now()
    const restore = () => {
      if (returnY == null) return
      // the page scrolls inside .hikepage, not the window
      const box = document.querySelector('.hikepage')
      if (box) box.scrollTo(0, returnY)
      else window.scrollTo(0, returnY)
      if (Math.abs((box ? box.scrollTop : window.scrollY) - returnY) > 2 && performance.now() - t0 < 1200) raf = requestAnimationFrame(restore)
    }
    restore()
    // the page is restored from the back/forward cache with the overlay still up: drop it and play the reverse
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) { setOpeningWalk(false); setReturnY(document.querySelector('.hikepage')?.scrollTop ?? window.scrollY) } }
    window.addEventListener('pageshow', onShow)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pageshow', onShow) }
  }, [returnY])
  return { openingWalk, setOpeningWalk, returning, setReturnY }
}
