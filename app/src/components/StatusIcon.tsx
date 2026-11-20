// Icons that go with words, so colour is never the only signal (CLAUDE.md section 3).
export type Status = 'ok' | 'warn' | 'none'

export function StatusIcon({ status, size = 18 }: { status: Status; size?: number }) {
  if (status === 'ok')
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="10" fill="var(--accent)" />
        <path d="M5.5 10.5l3 3 6-6.5" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (status === 'warn')
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <path d="M10 1.5l9 16H1z" fill="var(--hazard)" />
        <path d="M10 7.5v5M10 14.2v.6" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9" fill="none" stroke="var(--muted)" strokeWidth="1.5" />
      <path d="M6 10h8" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
