import type { Meta } from '../data/schema'

/** Shown whenever meta.json says "fake": true, so nobody mistakes placeholder numbers for results. */
export function FakeBanner({ meta }: { meta: Meta }) {
  if (!meta.fake) return null
  return (
    <div className="fake-banner" role="status">
      <strong>Sample data.</strong> Numbers on this page are placeholders, not real results (data version {meta.pipeline_version}).
    </div>
  )
}
