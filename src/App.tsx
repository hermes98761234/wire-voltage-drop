import { Box, Choice, Num, Section, Seg, Shell, Stat, usePersisted, usePrefs } from './ui'
import LineChart from './chart'
import { download, fmt, toCsv } from './io'
import { UK } from './uk'
import {
  AWG_SIZES, MM2_SIZES, ampacity, maxLengthM, sizeByKey, smallestSize, voltageDrop,
  type Material, type Phase, type Circuit,
} from './lib/wire'

interface State {
  phase: Phase; voltage: number; current: number; length: number; lenUnit: 'm' | 'ft'; pf: number; x: number
  mat: Material; sys: 'mm2' | 'awg'; size: string; tC: number; limit: number
}
const INIT: State = { phase: '1ph', voltage: 230, current: 16, length: 40, lenUnit: 'm', pf: 0.95, x: 0.08, mat: 'cu', sys: 'mm2', size: 'mm2:2.5', tC: 30, limit: 3 }
const FT = 0.3048

export default function App() {
  const { prefs, setPrefs, t } = usePrefs(UK)
  const [s, set, link] = usePersisted<State>('wire-voltage-drop', INIT)
  const lenM = s.lenUnit === 'ft' ? s.length * FT : s.length
  const size = sizeByKey(s.size)
  const sizes = s.sys === 'mm2' ? MM2_SIZES : AWG_SIZES
  const circ: Circuit = { area: size.area, mat: s.mat, tC: s.tC, phase: s.phase, voltage: s.voltage, current: s.current, lengthM: lenM, pf: s.pf, xPerKm: s.x }
  const d = voltageDrop(circ)
  const maxL = maxLengthM(circ, s.limit)
  const amp = ampacity(size, s.mat, s.phase)
  const toU = (m: number) => (s.lenUnit === 'ft' ? m / FT : m)
  const best = smallestSize(sizes, circ, s.limit, true)
  const rows = sizes.map((z) => {
      const c = { ...circ, area: z.area }
      const a = ampacity(z, s.mat, s.phase)
      const dd = voltageDrop(c)
      return { z, r: dd.rPerKm, pct: dd.percent, max: maxLengthM(c, s.limit), amp: a, ok: dd.percent <= s.limit && Number.isFinite(a) && a >= s.current }
    })
  const lenMax = Math.max(toU(Math.min(maxL, lenM * 4)), s.length * 1.5, 1)
  const pts: [number, number][] = [0, 1].map((i) => [i * lenMax, voltageDrop({ ...circ, lengthM: (i * lenMax) * (s.lenUnit === 'ft' ? FT : 1) }).percent])
  const u = s.lenUnit
  const setSys = (sys: 'mm2' | 'awg') => {
    const list = sys === 'mm2' ? MM2_SIZES : AWG_SIZES
    const near = list.reduce((a, b) => (Math.abs(Math.log(b.area / size.area)) < Math.abs(Math.log(a.area / size.area)) ? b : a))
    set({ sys, size: near.key })
  }
  const ampMsg = !Number.isFinite(amp) ? { c: 'warn', m: t('No ampacity data for this size and material.') } : s.current > amp ? { c: 'err', m: t('Current exceeds the typical ampacity of this size ({0} A). Use a larger wire.', amp) } : null
  return (
    <Shell title={t('Wire voltage drop')} subtitle={t('Wire gauge, voltage drop and maximum run length.')} note={t('Estimates for copper and aluminium conductors. Check the local wiring code before building.')} repo="wire-voltage-drop" prefs={prefs} setPrefs={setPrefs} t={t} link={link}
      side={<>
        <Section title={t('Circuit')}>
          <Choice label={t('Supply')} value={s.phase} onChange={(phase) => set({ phase })} options={[['dc', t('Direct current (DC)')], ['1ph', t('Single-phase AC')], ['3ph', t('Three-phase AC')]]} />
          <div className="grid2">
            <Num label={t('Voltage')} unit="V" value={s.voltage} min={1} onChange={(voltage) => set({ voltage })} />
            <Num label={t('Current')} unit="A" value={s.current} min={0.001} onChange={(current) => set({ current })} />
          </div>
          <div className="grid2">
            <Num label={t('One-way run length')} unit={u} value={s.length} min={0.01} onChange={(length) => set({ length })} />
            <Choice label=" " value={s.lenUnit} onChange={(lenUnit) => set({ lenUnit })} options={[['m', 'm'], ['ft', 'ft']]} />
          </div>
          {s.phase !== 'dc' && (
            <div className="grid2">
              <Num label={t('Power factor')} value={s.pf} min={0.1} max={1} step={0.01} onChange={(pf) => set({ pf })} />
              <Num label={t('Reactance')} unit="Ω/km" value={s.x} min={0} onChange={(x) => set({ x })} />
            </div>
          )}
        </Section>
        <Section title={t('Conductor')}>
          <Seg value={s.mat} onChange={(mat) => set({ mat })} options={[['cu', t('Copper')], ['al', t('Aluminium')]]} />
          <Seg value={s.sys} onChange={setSys} options={[['mm2', 'mm²'], ['awg', 'AWG']]} />
          <Choice label={t('Wire size')} value={s.size} onChange={(size) => set({ size })} options={sizes.map((z) => [z.key, z.label] as [string, string])} />
          <div className="grid2">
            <Num label={t('Conductor temperature')} unit="°C" value={s.tC} min={-40} max={200} onChange={(tC) => set({ tC })} />
            <Num label={t('Allowed drop')} unit="%" value={s.limit} min={0.1} max={50} onChange={(limit) => set({ limit })} />
          </div>
        </Section>
      </>}>
      <div className="stats">
        <Stat label={t('Voltage drop')} value={fmt(d.volts, 2)} unit="V" tone={d.percent <= s.limit ? 'ok' : 'err'} />
        <Stat label={t('Drop')} value={fmt(d.percent, 2)} unit="%" tone={d.percent <= s.limit ? 'ok' : 'err'} />
        <Stat label={t('Voltage at load')} value={fmt(d.loadVoltage, 1)} unit="V" />
        <Stat label={t('Cable loss')} value={fmt(d.lossW, 1)} unit="W" />
        <Stat label={t('Maximum length')} value={fmt(toU(maxL), 1)} unit={u} />
        <Stat label={t('Resistance')} value={fmt(d.rPerKm, 3)} unit="Ω/km" />
        <Stat label={t('Ampacity (hint)')} value={Number.isFinite(amp) ? fmt(amp, 0) : '–'} unit="A" tone={ampMsg?.c === 'err' ? 'err' : undefined} />
      </div>
      <p className={`msg ${d.percent <= s.limit ? 'ok' : 'err'}`}>
        {d.percent <= s.limit ? t('Within the {0}% limit.', s.limit) : t('Drop is {0}%, over the {1}% limit.', fmt(d.percent, 2), s.limit)}{' '}
        {t('Smallest size that works')}: <b>{best ? best.label : t('No listed size is enough')}</b>
      </p>
      {ampMsg && <p className={`msg ${ampMsg.c}`}>{ampMsg.m}</p>}
      <Box title={t('Drop versus length')}>
        <LineChart xLabel={`${t('Length')} (${u})`} yLabel={t('Drop (%)')} xMin={0} yMin={0} area
          series={[{ name: size.label, color: 'var(--accent)', points: pts }]}
          markers={[{ y: s.limit, label: t('Allowed'), color: 'var(--err)' }, { x: s.length, y: d.percent, label: `${fmt(d.percent, 2)}%` }]} />
      </Box>
      <Box title={t('All sizes')} actions={<button className="small" onClick={() => download('wire-sizes.csv', toCsv([[t('Size'), t('Area (mm²)'), t('Ω/km'), t('Drop') + ' %', t('Max length') + ` (${u})`, t('Ampacity') + ' A'], ...rows.map((r) => [r.z.label, fmt(r.z.area, 2), fmt(r.r, 3), fmt(r.pct, 2), fmt(toU(r.max), 1), Number.isFinite(r.amp) ? r.amp : ''])]), 'text/csv')}>{t('Export CSV')}</button>}>
        <div className="scroll-x">
          <table className="data">
            <thead><tr><th>{t('Size')}</th><th className="num">{t('Area (mm²)')}</th><th className="num">{t('Ω/km')}</th><th className="num">{t('Drop')} %</th><th className="num">{t('Max length')} ({u})</th><th className="num">{t('Ampacity')} A</th><th>{t('Status')}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.z.key} className={r.z.key === s.size ? 'active' : ''}>
                  <td>{r.z.label}</td><td className="num">{fmt(r.z.area, 2)}</td><td className="num">{fmt(r.r, 3)}</td><td className="num">{fmt(r.pct, 2)}</td>
                  <td className="num">{fmt(toU(r.max), 1)}</td><td className="num">{Number.isFinite(r.amp) ? r.amp : '–'}</td>
                  <td className={r.ok ? 'ok-text' : 'err-text'}>{r.ok ? t('OK') : t('Too thin')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">{t('Ampacity values are typical (IEC method C / NEC 75 °C). Derate for grouping and ambient temperature.')}</p>
      </Box>
    </Shell>
  )
}
