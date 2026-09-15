import type { FieldSource } from '../contracts/marswindnet.ts'

const LABELS: Record<FieldSource, string> = {
  fixture: 'Illustrative field',
  saved: 'Saved comparison',
  live: 'API result',
  stub: 'Interpolation baseline',
  cfd: 'Imported CFD reference',
}

export function SourcePill({
  source,
  provenance,
}: {
  source: FieldSource | null
  provenance: string | null
}) {
  if (!source) return null
  return (
    <p className={`source-pill source-pill--${source}`} title={provenance ?? undefined}>
      <span className="source-pill__kind">{LABELS[source]}</span>
      <span className="source-pill__note">{provenance}</span>
    </p>
  )
}
