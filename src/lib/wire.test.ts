import { describe, expect, it } from 'vitest'
import { ampacity, awgAreaMm2, awgDiameterMm, awgLabel, maxLengthM, resistancePerKm, sizeByKey, smallestSize, voltageDrop, MM2_SIZES, type Circuit } from './wire'

const base: Circuit = { area: 2.5, mat: 'cu', tC: 20, phase: 'dc', voltage: 230, current: 10, lengthM: 20, pf: 1, xPerKm: 0 }

describe('AWG', () => {
  it('matches the standard table', () => {
    expect(awgDiameterMm(12)).toBeCloseTo(2.053, 3)
    expect(awgDiameterMm(0)).toBeCloseTo(8.251, 3)
    expect(awgDiameterMm(-3)).toBeCloseTo(11.684, 3)
    expect(awgAreaMm2(10)).toBeCloseTo(5.26, 2)
    expect(awgAreaMm2(14)).toBeCloseTo(2.08, 2)
  })
  it('labels', () => {
    expect(awgLabel(12)).toBe('12 AWG')
    expect(awgLabel(-1)).toBe('2/0 AWG')
  })
})

describe('resistance', () => {
  it('copper 1 mm² at 20 °C is 17.241 ohm/km', () => expect(resistancePerKm(1, 'cu', 20)).toBeCloseTo(17.241, 3))
  it('rises with temperature (copper 75 °C)', () => expect(resistancePerKm(1, 'cu', 75)).toBeCloseTo(17.241 * (1 + 0.00393 * 55), 3))
  it('aluminium is about 1.64x copper', () => expect(resistancePerKm(10, 'al', 20) / resistancePerKm(10, 'cu', 20)).toBeCloseTo(1.639, 2))
})

describe('voltage drop', () => {
  it('DC: 2 I R L', () => {
    const d = voltageDrop(base)
    expect(d.volts).toBeCloseTo(2 * 10 * (0.017241 / 2.5) * 20, 6)
    expect(d.percent).toBeCloseTo((d.volts / 230) * 100, 9)
    expect(d.lossW).toBeCloseTo(d.volts * 10, 6)
  })
  it('3-phase uses sqrt(3)', () => {
    const d1 = voltageDrop({ ...base, phase: '1ph' })
    const d3 = voltageDrop({ ...base, phase: '3ph' })
    expect(d3.volts / d1.volts).toBeCloseTo(Math.sqrt(3) / 2, 9)
  })
  it('power factor and reactance lower the resistive part', () => {
    const d = voltageDrop({ ...base, phase: '1ph', pf: 0.8, xPerKm: 0.08 })
    const r = 0.017241 / 2.5
    expect(d.volts).toBeCloseTo(2 * 10 * (r * 0.8 + 0.00008 * 0.6) * 20, 6)
  })
})

describe('max length and sizing', () => {
  it('max length reproduces the limit', () => {
    const L = maxLengthM({ ...base, phase: '3ph' }, 3)
    expect(voltageDrop({ ...base, phase: '3ph', lengthM: L }).percent).toBeCloseTo(3, 9)
  })
  it('smallest size meeting 3 % over 50 m / 16 A', () => {
    const s = smallestSize(MM2_SIZES, { ...base, phase: '1ph', current: 16, lengthM: 50 }, 2, true)
    expect(s?.area).toBe(6) // 4 mm² gives 3.0 %, 6 mm² gives 2.0 %
    const s2 = smallestSize(MM2_SIZES, { ...base, phase: '1ph', current: 16, lengthM: 50 }, 1, true)
    expect(s2?.area).toBe(16)
  })
  it('ampacity hint', () => {
    expect(ampacity(sizeByKey('mm2:2.5'), 'cu', '1ph')).toBe(27)
    expect(ampacity(sizeByKey('mm2:2.5'), 'cu', '3ph')).toBe(24)
    expect(ampacity(sizeByKey('awg:12'), 'cu', 'dc')).toBe(25)
    expect(Number.isNaN(ampacity(sizeByKey('mm2:2.5'), 'al', 'dc'))).toBe(true)
  })
})
