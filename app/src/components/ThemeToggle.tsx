// Dark / light switch: an icon button (44 px target). The label stays "Dark theme" and aria-pressed says whether it is on, so screen readers hear a stable switch.
// The icon shows what a press will give you (sun while dark, moon while light).
import { useTheme } from '../lib/theme'
import { Icon } from './Icon'

export function ThemeToggle() {
  const [theme, toggle] = useTheme()
  const dark = theme === 'dark'
  return (
    <button type="button" className="icon-btn theme-toggle" aria-pressed={dark} aria-label="Dark theme" title={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggle}>
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  )
}
