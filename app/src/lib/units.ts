// Metric toggle (`units=metric` in the URL). The data stays in °F, miles and feet; only the words on screen change.
export type Units = 'us' | 'metric'

export const fToC = (f: number) => ((f - 32) * 5) / 9
/** A temperature difference (not a point): no 32° offset. */
export const dFtoC = (d: number) => (d * 5) / 9
export const MI_TO_KM = 1.609344

export const fmtTemp = (f: number, u: Units) => (u === 'metric' ? `${Math.round(fToC(f))}°C` : `${Math.round(f)}°F`)
export const fmtTempDelta = (d: number, u: Units) => (u === 'metric' ? `${dFtoC(d).toFixed(0)}°C` : `${d.toFixed(0)}°F`)
export const fmtTempRange = (lo: number, hi: number, u: Units) =>
  u === 'metric' ? `${Math.round(fToC(lo))}–${Math.round(fToC(hi))}°C` : `${lo}–${hi}°F`
export const fmtLength = (mi: number, u: Units) => (u === 'metric' ? `${(mi * MI_TO_KM).toFixed(1)} km` : `${mi} mi`)
export const tempWord = (u: Units) => (u === 'metric' ? 'degrees Celsius' : 'degrees Fahrenheit')
/** Spoken value for a temperature slider whose internal unit is °F. */
export const spokenTemp = (f: number, u: Units) => `${u === 'metric' ? Math.round(fToC(f)) : f} ${tempWord(u)}`

export const FT_TO_M = 0.3048
/** Elevation given in feet (the data's unit): "5,790 ft" or "1,765 m". */
export const fmtElev = (ft: number, u: Units) => (u === 'metric' ? `${Math.round(ft * FT_TO_M).toLocaleString('en-US')} m` : `${Math.round(ft).toLocaleString('en-US')} ft`)
/** A distance given in metres: "3.3 km" or "2.1 mi". */
export const fmtDist = (m: number, u: Units) => (u === 'metric' ? `${(m / 1000).toFixed(1)} km` : `${(m / 1609.344).toFixed(1)} mi`)
export const distUnit = (u: Units) => (u === 'metric' ? 'km' : 'mi')
export const elevUnit = (u: Units) => (u === 'metric' ? 'm' : 'ft')
/** Metres to the unit used on the elevation axis. */
export const elevFromM = (m: number, u: Units) => (u === 'metric' ? m : m / FT_TO_M)
/** Metres to the unit used on the distance axis. */
export const distFromM = (m: number, u: Units) => (u === 'metric' ? m / 1000 : m / 1609.344)
