// Test helper: read styles/tokens.css and return the resolved custom properties of each theme.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const TOKENS_CSS = readFileSync(join(__dirname, '../styles/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

type Vars = Record<string, string>
const declsOf = (body: string): Vars => {
  const out: Vars = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

/** Every top-level `selector { ... }` rule outside @media, in file order. */
function topRules(css: string) {
  const rules: { selector: string; body: string }[] = []
  let i = 0
  while (i < css.length) {
    const open = css.indexOf('{', i)
    if (open < 0) break
    const head = css.slice(i, open).trim()
    let depth = 1
    let j = open + 1
    while (j < css.length && depth) {
      if (css[j] === '{') depth++
      else if (css[j] === '}') depth--
      j++
    }
    rules.push({ selector: head, body: css.slice(open + 1, j - 1) })
    i = j
  }
  return rules
}

const rules = topRules(TOKENS_CSS)
const merged = (selector: string) => Object.assign({}, ...rules.filter((r) => r.selector === selector).map((r) => declsOf(r.body))) as Vars

export const lightTokens: Vars = merged(':root')
export const darkOverrides: Vars = merged(":root[data-theme='dark']")
const media = rules.find((r) => r.selector.startsWith('@media (prefers-color-scheme: dark)'))
export const darkMediaOverrides: Vars = media ? declsOf(topRules(media.body).find((r) => r.selector.includes(':not([data-theme'))?.body ?? '') : {}
/** Dark = light with the dark overrides on top (same cascade the browser applies). */
export const darkTokens: Vars = { ...lightTokens, ...darkOverrides }
export const themes = { light: lightTokens, dark: darkTokens } as const
