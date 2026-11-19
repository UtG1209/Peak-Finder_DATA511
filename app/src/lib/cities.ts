// The 10 home cities we have travel and cost data for (CLAUDE.md section 2).
export interface City {
  code: string
  name: string
  lat: number
  lon: number
}

export const CITIES: City[] = [
  { code: 'SEA', name: 'Seattle', lat: 47.61, lon: -122.33 },
  { code: 'SFO', name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { code: 'LAX', name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { code: 'PHX', name: 'Phoenix', lat: 33.45, lon: -112.07 },
  { code: 'DEN', name: 'Denver', lat: 39.74, lon: -104.99 },
  { code: 'DFW', name: 'Dallas/Fort Worth', lat: 32.78, lon: -96.8 },
  { code: 'ORD', name: 'Chicago', lat: 41.88, lon: -87.63 },
  { code: 'ATL', name: 'Atlanta', lat: 33.75, lon: -84.39 },
  { code: 'NYC', name: 'New York', lat: 40.71, lon: -74.01 },
  { code: 'DCA', name: 'Washington DC', lat: 38.91, lon: -77.04 },
]

export const cityByCode = (code: string | null | undefined) => CITIES.find((c) => c.code === code) ?? null
