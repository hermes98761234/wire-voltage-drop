export interface Series { name: string; color: string; points: [number, number][]; dash?: string }
export interface Marker { x?: number; y?: number; label?: string; color?: string }

export function niceTicks(lo: number, hi: number, n = 6): number[] {
  if (!(hi > lo)) return [lo]
  const raw = (hi - lo) / n
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / p
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p
  const out: number[] = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12))
  return out
}

function logTicks(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of [1, 2, 5]) {
    const v = m * Math.pow(10, e)
    if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v)
  }
  return out
}

const short = (v: number) => (Math.abs(v) >= 10000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(0) : String(+v.toPrecision(6)))

/** Responsive SVG line chart with optional log axes, markers and a legend. */
export default function LineChart(props: {
  series: Series[]
  xLabel: string
  yLabel: string
  xLog?: boolean
  yLog?: boolean
  xMin?: number
  xMax?: number
  yMin?: number
  yMax?: number
  markers?: Marker[]
  height?: number
  area?: boolean
  label?: string
}) {
  const W = 720
  const H = props.height ?? 340
  const m = { l: 58, r: 14, t: 14, b: 46 }
  const all = props.series.flatMap((s) => s.points).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  const xs = all.map((p) => p[0])
  const ys = all.map((p) => p[1])
  let x0 = props.xMin ?? Math.min(...xs, Infinity)
  let x1 = props.xMax ?? Math.max(...xs, -Infinity)
  let y0 = props.yMin ?? Math.min(...ys, Infinity)
  let y1 = props.yMax ?? Math.max(...ys, -Infinity)
  if (!all.length) { x0 = 0; x1 = 1; y0 = 0; y1 = 1 }
  if (x1 <= x0) x1 = x0 + 1
  if (y1 <= y0) y1 = y0 + 1
  if (props.yMax === undefined && !props.yLog) y1 += (y1 - y0) * 0.05
  const fx = (x: number) => m.l + ((props.xLog ? Math.log10(x / x0) / Math.log10(x1 / x0) : (x - x0) / (x1 - x0)) * (W - m.l - m.r))
  const fy = (y: number) => H - m.b - ((props.yLog ? Math.log10(y / y0) / Math.log10(y1 / y0) : (y - y0) / (y1 - y0)) * (H - m.t - m.b))
  const xt = props.xLog ? logTicks(x0, x1) : niceTicks(x0, x1)
  const yt = props.yLog ? logTicks(y0, y1) : niceTicks(y0, y1, 5)
  const clampY = (y: number) => Math.min(H - m.b, Math.max(m.t, fy(y)))
  return (
    <figure className="chart" aria-label={props.label ?? props.yLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" width="100%">
        <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="var(--chart-bg)" stroke="var(--line)" />
        {yt.map((v) => (
          <g key={'y' + v}>
            <line x1={m.l} x2={W - m.r} y1={fy(v)} y2={fy(v)} stroke="var(--grid)" />
            <text x={m.l - 6} y={fy(v) + 4} textAnchor="end" fill="var(--chart-fg)" fontSize="11">{short(v)}</text>
          </g>
        ))}
        {xt.map((v) => (
          <g key={'x' + v}>
            <line x1={fx(v)} x2={fx(v)} y1={m.t} y2={H - m.b} stroke="var(--grid)" />
            <text x={fx(v)} y={H - m.b + 15} textAnchor="middle" fill="var(--chart-fg)" fontSize="11">{short(v)}</text>
          </g>
        ))}
        <text x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle" fill="var(--chart-fg)" fontSize="12">{props.xLabel}</text>
        <text transform={`translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fill="var(--chart-fg)" fontSize="12">{props.yLabel}</text>
        <clipPath id="plot"><rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} /></clipPath>
        <g clipPath="url(#plot)">
          {props.series.map((s) => {
            const pts = s.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!props.yLog || y > 0) && (!props.xLog || x > 0))
            const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fx(x).toFixed(1)} ${fy(y).toFixed(1)}`).join('')
            return (
              <g key={s.name}>
                {props.area && pts.length > 1 ? (
                  <path d={`${d}L${fx(pts[pts.length - 1][0]).toFixed(1)} ${clampY(y0)}L${fx(pts[0][0]).toFixed(1)} ${clampY(y0)}Z`} fill={s.color} opacity=".12" />
                ) : null}
                <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeDasharray={s.dash} strokeLinejoin="round" />
              </g>
            )
          })}
          {(props.markers ?? []).map((k, i) => (
            <g key={i}>
              {k.x !== undefined ? <line x1={fx(k.x)} x2={fx(k.x)} y1={m.t} y2={H - m.b} stroke={k.color ?? 'var(--ref-line)'} strokeDasharray="5 4" /> : null}
              {k.y !== undefined ? <line x1={m.l} x2={W - m.r} y1={fy(k.y)} y2={fy(k.y)} stroke={k.color ?? 'var(--ref-line)'} strokeDasharray="5 4" /> : null}
              {k.x !== undefined && k.y !== undefined ? <circle cx={fx(k.x)} cy={fy(k.y)} r="5" fill={k.color ?? 'var(--ref-line)'} stroke="var(--panel)" strokeWidth="2" /> : null}
              {k.label ? (
                <text x={k.x !== undefined ? Math.min(fx(k.x) + 6, W - m.r - 4) : W - m.r - 4} y={k.y !== undefined ? fy(k.y) - 5 : m.t + 13} textAnchor={k.x !== undefined && fx(k.x) + 6 > W - 160 ? 'end' : k.x !== undefined ? 'start' : 'end'} fill={k.color ?? 'var(--ref-line)'} fontSize="11">{k.label}</text>
              ) : null}
            </g>
          ))}
        </g>
      </svg>
      {props.series.length > 1 || props.series[0]?.name ? (
        <figcaption className="legend">
          {props.series.map((s) => (
            <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  )
}
