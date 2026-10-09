export function download(filename: string, text: string, mime = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(',')).join('\n') + '\n'
}

/** Encode app state into a URL-safe string for share links. */
export function encodeState(s: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodeState(h: string): unknown {
  try {
    const b = h.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(b + '='.repeat((4 - (b.length % 4)) % 4))))) as unknown
  } catch {
    return null
  }
}

/** Format a number with up to `d` decimals, trimming trailing zeros. */
export function fmt(x: number, d = 2): string {
  if (!Number.isFinite(x)) return '–'
  const s = x.toFixed(d)
  return d > 0 ? s.replace(/\.?0+$/, '') : s
}
