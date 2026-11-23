// Icons that go with words, so colour is never the only signal (CLAUDE.md section 3). Shape differs per status (check, triangle, dash);
// the colour comes from the .st-* classes in styles/hike.css so it follows the theme.
import { Icon, type IconName } from './Icon'

export type Status = 'ok' | 'warn' | 'none'

const NAME: Record<Status, IconName> = { ok: 'check', warn: 'alert', none: 'dash' }

export function StatusIcon({ status, size = 18 }: { status: Status; size?: number }) {
  return <Icon name={NAME[status]} size={size} className={`st st-${status}`} />
}
