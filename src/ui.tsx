import { useEffect, useRef, useState, type ReactNode } from 'react'
import { tr, type Lang, type T } from './i18n'
import { decodeState, encodeState } from './io'

export type Theme = 'auto' | 'light' | 'dark'
interface Prefs { lang: Lang; theme: Theme }

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem('prefs') ?? 'null') as Partial<Prefs> | null
    if (p) return { lang: p.lang === 'uk' ? 'uk' : 'en', theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'auto' }
  } catch { /* ignore */ }
  return { lang: navigator.language?.startsWith('uk') ? 'uk' : 'en', theme: 'auto' }
}

/** Language and theme, persisted, with the translator bound to the app's Ukrainian dictionary. */
export function usePrefs(uk: Record<string, string>) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  useEffect(() => {
    localStorage.setItem('prefs', JSON.stringify(prefs))
    const root = document.documentElement
    if (prefs.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = prefs.theme
    root.lang = prefs.lang
  }, [prefs])
  const t: T = (s, ...a) => tr(uk, prefs.lang, s, ...a)
  return { prefs, setPrefs, t }
}

/** App state persisted in localStorage; a `#s=` share link takes priority on load. */
export function usePersisted<S extends object>(key: string, init: S): [S, (p: Partial<S>) => void, () => string] {
  const [state, setState] = useState<S>(() => {
    let saved: unknown = null
    const m = /^#s=(.+)$/.exec(location.hash)
    if (m) saved = decodeState(m[1])
    if (!saved || typeof saved !== 'object') {
      try { saved = JSON.parse(localStorage.getItem(key) ?? 'null') } catch { saved = null }
    }
    return saved && typeof saved === 'object' ? { ...init, ...(saved as Partial<S>) } : init
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* ignore */ }
  }, [key, state])
  const patch = (p: Partial<S>) => setState((s) => ({ ...s, ...p }))
  const link = () => `${location.origin}${location.pathname}#s=${encodeState(state)}`
  return [state, patch, link]
}

export function Shell(props: {
  title: string
  subtitle: string
  note: string
  repo: string
  prefs: { lang: Lang; theme: Theme }
  setPrefs: (p: { lang: Lang; theme: Theme }) => void
  t: T
  link: () => string
  side: ReactNode
  children: ReactNode
}) {
  const { t, prefs, setPrefs } = props
  const [copied, setCopied] = useState(false)
  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{props.title}</span>
        <span className="hint">{props.subtitle}</span>
        <span className="spacer" />
        <button
          className="small"
          onClick={() => {
            const u = props.link()
            history.replaceState(null, '', u.slice(u.indexOf('#')))
            void navigator.clipboard?.writeText(u)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? t('Link copied') : t('Copy link')}
        </button>
        <select aria-label={t('Language')} value={prefs.lang} onChange={(e) => setPrefs({ ...prefs, lang: e.target.value as Lang })}>
          <option value="en">English</option>
          <option value="uk">Українська</option>
        </select>
        <select aria-label={t('Theme')} value={prefs.theme} onChange={(e) => setPrefs({ ...prefs, theme: e.target.value as Theme })}>
          <option value="auto">{t('System')}</option>
          <option value="light">{t('Light')}</option>
          <option value="dark">{t('Dark')}</option>
        </select>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">{props.side}</div>
        </aside>
        <main className="main" data-ready>{props.children}</main>
      </div>
      <p className="hint foot">
        {props.note} <a href={`https://github.com/hermes98761234/${props.repo}`}>{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}

export function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h3>{props.title}</h3>
      {props.children}
    </section>
  )
}

/** Number input that lets you type freely and only reports valid numbers inside [min, max]. */
export function Num(props: {
  label: string
  value: number
  onChange: (n: number) => void
  unit?: string
  min?: number
  max?: number
  step?: number | 'any'
  hint?: string
}) {
  const { value, min, max } = props
  const [text, setText] = useState(String(value))
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) { last.current = value; setText(String(value)) }
  }, [value])
  const n = text.trim() === '' ? NaN : Number(text)
  const bad = !Number.isFinite(n) || (min !== undefined && n < min) || (max !== undefined && n > max)
  return (
    <div className="field">
      <label>
        {props.label}
        {props.unit ? <span className="unit"> ({props.unit})</span> : null}
      </label>
      <input
        type="number"
        inputMode="decimal"
        className={bad ? 'bad' : ''}
        value={text}
        min={min}
        max={max}
        step={props.step ?? 'any'}
        aria-invalid={bad}
        onChange={(e) => {
          setText(e.target.value)
          const v = e.target.value.trim() === '' ? NaN : Number(e.target.value)
          if (Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max)) {
            last.current = v
            props.onChange(v)
          }
        }}
      />
      {props.hint ? <span className="hint">{props.hint}</span> : null}
    </div>
  )
}

export function Choice<V extends string>(props: { label?: string; value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <div className="field">
      {props.label ? <label>{props.label}</label> : null}
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as V)}>
        {props.options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  )
}

export function Seg<V extends string>(props: { value: V; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <div className="seg" role="group">
      {props.options.map(([v, l]) => (
        <button key={v} className={v === props.value ? 'on' : ''} aria-pressed={v === props.value} onClick={() => props.onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

export function Stat(props: { label: string; value: string; unit?: string; tone?: 'ok' | 'warn' | 'err' }) {
  return (
    <div className={`stat ${props.tone ?? ''}`}>
      <div className="stat-label">{props.label}</div>
      <div className="stat-value">{props.value}{props.unit ? <small> {props.unit}</small> : null}</div>
    </div>
  )
}

export function Box(props: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="box">
      {props.title || props.actions ? (
        <div className="row">
          {props.title ? <h3 style={{ margin: 0 }}>{props.title}</h3> : null}
          <span className="spacer" />
          {props.actions}
        </div>
      ) : null}
      {props.children}
    </div>
  )
}
