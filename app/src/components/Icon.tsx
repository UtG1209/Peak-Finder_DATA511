// Inline SVG icon set: 20 px grid, 1.5 px stroke, round caps, currentColor. Decorative by default (aria-hidden); pass `title` when the icon is the only label.
import type { ReactNode } from 'react'

const PATHS = {
  'arrow-left': <path d="M16 10H4M9 5l-5 5 5 5" />,
  'arrow-right': <path d="M4 10h12M11 5l5 5-5 5" />,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  plus: <path d="M10 4v12M4 10h12" />,
  minus: <path d="M4 10h12" />,
  'chevron-up': <path d="M5 12.5l5-5 5 5" />,
  'chevron-down': <path d="M5 7.5l5 5 5-5" />,
  sliders: <path d="M3 6h8M15 6h2M3 14h2M9 14h8M11 4v4M5 12v4" />,
  check: <path d="M4.5 10.5l3.5 3.5 7.5-8" />,
  alert: <path d="M10 3L18 16.5H2zM10 8.5v4M10 14.6h.01" />,
  dash: <path d="M6.5 10h7" />,
  peak: <path d="M2 16.5l5.5-10 3 5 2-3 5.5 8z" />,
  walk3d: <path d="M10 2.5l6.5 3.75v7.5L10 17.5l-6.5-3.75v-7.5zM10 10v7.5M3.5 6.25L10 10l6.5-3.75" />,
  share: <path d="M10 12.5V3M6.5 6.5L10 3l3.5 3.5M5 10v5.5a1 1 0 001 1h8a1 1 0 001-1V10" />,
  shuffle: <path d="M3 6h3.5c4 0 3.5 8 7.5 8H17M14.5 11.5L17 14l-2.5 2.5M3 14h3.5c1.2 0 2-.5 2.7-1.2M11 7.8c.7-.8 1.6-1.8 3-1.8H17M14.5 3.5L17 6l-2.5 2.5" />,
  sun: <><circle cx="10" cy="10" r="3.5" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4" /></>,
  moon: <path d="M16 11.5A6.5 6.5 0 018.5 4a6.5 6.5 0 107.5 7.5z" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

type Props = { name: IconName; size?: number; title?: string; className?: string }

export function Icon({ name, size = 20, title, className }: Props) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true, focusable: false })}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  )
}
