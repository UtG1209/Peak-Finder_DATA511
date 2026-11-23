// Gear and conditions for a hike: an icon AND a word for each (never an icon alone).
import type { ReactNode } from 'react'

interface GearInfo {
  label: string
  /** One line for hover and screen readers. */
  hint: string
  icon: ReactNode
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const GEAR: Record<string, GearInfo> = {
  chains: { label: 'Chains', hint: 'A section with chains to hold', icon: <g {...S}><ellipse cx="8" cy="9" rx="4.5" ry="3" transform="rotate(-30 8 9)" /><ellipse cx="16" cy="15" rx="4.5" ry="3" transform="rotate(-30 16 15)" /></g> },
  exposure: { label: 'Exposure', hint: 'Steep drop-offs next to the trail', icon: <g {...S}><path d="M3 8h8v4h4v4h6" /><path d="M7 21l3-3M10 21v-3h3" /></g> },
  'no-shade': { label: 'No shade', hint: 'Little or no shade: sun and heat', icon: <g {...S}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></g> },
  steep: { label: 'Steep', hint: 'Long, steep climbs', icon: <g {...S}><path d="M3 20h18L3 20zM3 20V8l18 12" /></g> },
  'snow-gear': { label: 'Snow gear', hint: 'Snow or ice is likely: traction helps', icon: <g {...S}><path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" /><path d="M10 4l2 2 2-2M10 20l2-2 2 2" /></g> },
  'bear-spray': { label: 'Bear spray', hint: 'Bear country: carry bear spray', icon: <g {...S}><rect x="8" y="9" width="7" height="12" rx="1.5" /><path d="M10 9V6h4l2-2M17 7h4M17 10h3" /></g> },
  'water-crossing': { label: 'Water crossing', hint: 'The trail crosses water', icon: <g {...S}><path d="M2 9c3-3 5 3 8 0s5 3 8 0 3 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 3 0 4 0" /></g> },
  scramble: { label: 'Scramble', hint: 'Hands-on rock scrambling', icon: <g {...S}><path d="M2 20l6-11 3 5 3-8 8 14z" /></g> },
  'extra-water': { label: 'Extra water', hint: 'Carry more water than usual', icon: <g {...S}><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" /></g> },
  headlamp: { label: 'Headlamp', hint: 'A long day: carry a headlamp', icon: <g {...S}><circle cx="9" cy="12" r="4.5" /><path d="M14 8l7-3M14.5 12H22M14 16l7 3" /></g> },
  'bug-spray': { label: 'Bug spray', hint: 'Biting insects in season', icon: <g {...S}><ellipse cx="12" cy="13" rx="4" ry="5.5" /><path d="M12 7.5V4M8 10L4 8M8 14l-4 2M16 10l4-2M16 14l4 2M9.5 6L8 3M14.5 6L16 3" /></g> },
}

export function GearList({ gear }: { gear: string[] }) {
  if (gear.length === 0) return null
  return (
    <ul className="gear" aria-label="Gear and conditions">
      {gear.map((g) => {
        const info = GEAR[g] ?? { label: g, hint: g, icon: null }
        return (
          <li key={g} title={info.hint}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{info.icon}</svg>
            <span>{info.label}</span>
            <span className="sr-only">: {info.hint}</span>
          </li>
        )
      })}
    </ul>
  )
}
