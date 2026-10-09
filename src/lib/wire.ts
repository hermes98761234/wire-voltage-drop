export type Material = 'cu' | 'al'
export type Phase = 'dc' | '1ph' | '3ph'

export const RHO20: Record<Material, number> = { cu: 0.017241, al: 0.028264 } // ohm·mm²/m at 20 °C
export const ALPHA: Record<Material, number> = { cu: 0.00393, al: 0.00403 }

/** AWG n (n = -3 for 4/0) → wire diameter in mm. */
export const awgDiameterMm = (n: number) => 0.127 * Math.pow(92, (36 - n) / 39)
export const awgAreaMm2 = (n: number) => (Math.PI / 4) * awgDiameterMm(n) ** 2
export const awgLabel = (n: number) => (n >= 1 ? `${n} AWG` : `${1 - n}/0 AWG`)

export interface Size { key: string; label: string; area: number; ampCu: number; ampAl: number; ampCu3?: number; ampAl3?: number }

// IEC 60364-5-52 reference method C, PVC, 2 and 3 loaded conductors (typical values).
const MM2: [number, number, number, number | null, number | null][] = [
  // area, Cu 2-loaded, Cu 3-loaded, Al 2-loaded, Al 3-loaded
  [1.5, 19.5, 17.5, null, null],
  [2.5, 27, 24, null, null],
  [4, 36, 32, null, null],
  [6, 46, 41, null, null],
  [10, 63, 57, null, null],
  [16, 85, 76, 66, 60],
  [25, 112, 101, 83, 78],
  [35, 138, 125, 103, 96],
  [50, 168, 151, 125, 117],
  [70, 213, 192, 160, 150],
  [95, 258, 232, 195, 183],
  [120, 299, 269, 226, 212],
  [150, 344, 309, 261, 245],
  [185, 392, 353, 298, 280],
  [240, 461, 415, 352, 330],
]
// NEC 310.16, 75 °C column (copper / aluminium), AWG 14 … 4/0.
const AWG_AMPS: Record<number, [number, number | null]> = {
  14: [20, null], 12: [25, 20], 10: [35, 30], 8: [50, 40], 6: [65, 50], 4: [85, 65], 3: [100, 75], 2: [115, 90], 1: [130, 100],
  0: [150, 120], [-1]: [175, 135], [-2]: [200, 155], [-3]: [230, 180],
}

export const MM2_SIZES: Size[] = MM2.map(([a, c2, c3, a2, a3]) => ({
  key: `mm2:${a}`, label: `${a} mm²`, area: a, ampCu: c2, ampCu3: c3, ampAl: a2 ?? NaN, ampAl3: a3 ?? NaN,
}))
export const AWG_SIZES: Size[] = [18, 16, 14, 12, 10, 8, 6, 4, 3, 2, 1, 0, -1, -2, -3].map((n) => ({
  key: `awg:${n}`, label: awgLabel(n), area: awgAreaMm2(n), ampCu: AWG_AMPS[n]?.[0] ?? NaN, ampAl: AWG_AMPS[n]?.[1] ?? NaN,
}))
export const ALL_SIZES = [...MM2_SIZES, ...AWG_SIZES]
export const sizeByKey = (k: string): Size => ALL_SIZES.find((s) => s.key === k) ?? MM2_SIZES[1]

export function ampacity(size: Size, mat: Material, phase: Phase): number {
  if (mat === 'cu') return phase === '3ph' && size.ampCu3 ? size.ampCu3 : size.ampCu
  return phase === '3ph' && size.ampAl3 ? size.ampAl3 : size.ampAl
}

export const resistivity = (mat: Material, tC: number) => RHO20[mat] * (1 + ALPHA[mat] * (tC - 20))
/** Conductor resistance in ohm per km. */
export const resistancePerKm = (areaMm2: number, mat: Material, tC: number) => (resistivity(mat, tC) / areaMm2) * 1000

export interface Circuit { area: number; mat: Material; tC: number; phase: Phase; voltage: number; current: number; lengthM: number; pf: number; xPerKm: number }

const kFactor = (p: Phase) => (p === '3ph' ? Math.sqrt(3) : 2)
function zEff(c: Pick<Circuit, 'area' | 'mat' | 'tC' | 'phase' | 'pf' | 'xPerKm'>): number {
  const r = resistancePerKm(c.area, c.mat, c.tC) / 1000
  if (c.phase === 'dc') return r
  const phi = Math.acos(Math.min(1, Math.max(0, c.pf)))
  return r * Math.cos(phi) + (c.xPerKm / 1000) * Math.sin(phi)
}

export interface Drop { volts: number; percent: number; loadVoltage: number; lossW: number; rPerKm: number }
export function voltageDrop(c: Circuit): Drop {
  const volts = kFactor(c.phase) * c.current * zEff(c) * c.lengthM
  const r = resistancePerKm(c.area, c.mat, c.tC) / 1000
  const lossW = (c.phase === '3ph' ? 3 : 2) * c.current ** 2 * r * c.lengthM
  return { volts, percent: (volts / c.voltage) * 100, loadVoltage: c.voltage - volts, lossW, rPerKm: r * 1000 }
}

/** Longest run (m) that keeps the drop within limitPct. */
export function maxLengthM(c: Omit<Circuit, 'lengthM'>, limitPct: number): number {
  const z = zEff(c)
  return z > 0 && c.current > 0 ? ((limitPct / 100) * c.voltage) / (kFactor(c.phase) * c.current * z) : Infinity
}

/** Smallest size (from `sizes`, ascending area) meeting both the drop limit and (optionally) the ampacity. */
export function smallestSize(sizes: Size[], c: Omit<Circuit, 'area'>, limitPct: number, checkAmpacity: boolean): Size | null {
  const sorted = [...sizes].sort((a, b) => a.area - b.area)
  for (const s of sorted) {
    const amp = ampacity(s, c.mat, c.phase)
    if (checkAmpacity && (!Number.isFinite(amp) || amp < c.current)) continue
    if (voltageDrop({ ...c, area: s.area }).percent <= limitPct) return s
  }
  return null
}
