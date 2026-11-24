import type { Meta } from '../data/schema'

/** Shown whenever meta.json says "fake": true: part of the data is still sample data, and the banner says which part. */
export function FakeBanner({ meta }: { meta: Meta }) {
  if (!meta.fake) return null
  return (
    <div className="fake-banner" role="status">
      <strong>Work in progress.</strong> Weather, crowds and air quality are real. Some hikes still use sample data for trailheads, travel, cost or trail profiles (data version {meta.pipeline_version}).
    </div>
  )
}
