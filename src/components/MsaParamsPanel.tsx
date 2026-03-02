interface Props {
  running: boolean
  submittedCount: number
  onAlign: () => void
}

export function MsaParamsPanel({ running, submittedCount, onAlign }: Props) {
  return (
    <div className="params-panel">
      <h3 className="params-title">Multiple Alignment (ClustalW)</h3>

      <div className="params-grid">
        <div className="param-field full-width">
          <label className="param-label">Algorithm</label>
          <div style={{ opacity: 0.85 }}>
            ClustalW (protein MSA, computed on the backend)
          </div>
        </div>

        <div className="param-field full-width">
          <label className="param-label">Submitted sequences</label>
          <div style={{ opacity: 0.85 }}>{submittedCount}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="align-btn" onClick={onAlign} disabled={running}>
          {running ? 'Aligning…' : 'Align'}
        </button>
      </div>
    </div>
  )
}