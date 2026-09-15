import type { KeyboardEvent } from 'react'
import type { PresentationMode } from '../contracts/marswindnet'

const presentations: Array<{ id: PresentationMode; label: string; description: string }> = [
  { id: 'mars', label: 'Mars', description: 'Explore the settlement' },
  { id: 'cfd', label: 'CFD', description: 'Inspect the wind field' },
  { id: 'structure', label: 'Structure', description: 'Illustrative contours · not a solver result' },
]

function ModeIcon({ mode }: { mode: PresentationMode }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    {mode === 'mars' ? <><circle cx="10" cy="10" r="6.7" /><path d="M4 8.3c2-1.5 4 .1 5.5-1.5s3.3-1.7 4.4-1M5.3 13.7c1.6-1.9 4-2.2 5.6-.9s3.2.5 4.3-.8" /></> : mode === 'cfd' ? <><path d="M2 6h8c4 0 4-4 1-4M2 10h13c4 0 4 4 1 4M2 14h6c4 0 4 4 1 4" /></> : <><path d="m10 2 8 4-8 4-8-4 8-4ZM2 10l8 4 8-4M2 14l8 4 8-4" /></>}
  </svg>
}

export function PresentationTabs({ value, onChange }: { value: PresentationMode; onChange: (mode: PresentationMode) => void }) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % presentations.length
    else if (event.key === 'ArrowLeft') next = (index + presentations.length - 1) % presentations.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = presentations.length - 1
    else return
    event.preventDefault()
    onChange(presentations[next]!.id)
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return <div className="presentation-bar">
    <div className="presentation-tabs" role="tablist" aria-label="Scene presentation">
      {presentations.map((mode, index) => <button key={mode.id} id={`presentation-${mode.id}`} type="button" role="tab" aria-selected={value === mode.id} aria-controls="settlement-presentation" tabIndex={value === mode.id ? 0 : -1} onClick={() => onChange(mode.id)} onKeyDown={(event) => onKeyDown(event, index)}><ModeIcon mode={mode.id} /><span>{mode.label}</span></button>)}
    </div>
    <p className={`presentation-description${value === 'structure' ? ' is-illustrative' : ''}`}>{presentations.find((mode) => mode.id === value)?.description}</p>
  </div>
}
