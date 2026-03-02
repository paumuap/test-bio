import type { AlignmentMode } from '../types/alignment'

interface Props {
  mode: AlignmentMode
  matchScore: number
  mismatchScore: number
  gapOpen: number
  gapExtend: number
  onChange: (field: string, value: number | AlignmentMode) => void
}

export function ParamsPanel({ mode, matchScore, mismatchScore, gapOpen, gapExtend, onChange }: Props) {
  return (
    <div className="params-panel">
      <h3 className="params-title">Parameters</h3>

      <div className="params-grid">
        {/* Mode toggle */}
        <div className="param-field full-width">
          <label className="param-label">Alignment Mode</label>
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === 'global' ? 'active' : ''}`}
              onClick={() => onChange('mode', 'global')}
            >
              Global
              <span className="mode-sub">Needleman-Wunsch</span>
            </button>
            <button
              className={`mode-btn ${mode === 'local' ? 'active' : ''}`}
              onClick={() => onChange('mode', 'local')}
            >
              Local
              <span className="mode-sub">Smith-Waterman</span>
            </button>
          </div>
        </div>

        <NumberField
          label="Match Score"
          value={matchScore}
          onChange={v => onChange('matchScore', v)}
          min={0} max={10} step={1}
        />
        <NumberField
          label="Mismatch Penalty"
          value={mismatchScore}
          onChange={v => onChange('mismatchScore', v)}
          min={-10} max={0} step={1}
        />
        <NumberField
          label="Gap Open"
          value={gapOpen}
          onChange={v => onChange('gapOpen', v)}
          min={-10} max={0} step={1}
        />
        <NumberField
          label="Gap Extend"
          value={gapExtend}
          onChange={v => onChange('gapExtend', v)}
          min={-5} max={0} step={0.5}
        />
      </div>
    </div>
  )
}

function NumberField({
  label, value, onChange, min, max, step
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <div className="param-field">
      <label className="param-label">{label}</label>
      <div className="param-input-row">
        <input
          type="range"
          className="param-slider"
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
        />
        <span className="param-value">{value}</span>
      </div>
    </div>
  )
}
