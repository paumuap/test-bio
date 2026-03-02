import { useMemo, useState } from 'react'
import { runClustalwAlignment } from '../utils/backend'
import type { ClustalwAlignmentResponse } from '../utils/backend'
import { MsaSequenceInput, type MsaRow } from './MsaSequenceInput'

type Props = {
  backendBaseUrl?: string
}

const INITIAL: MsaRow[] = [
  { id: 'seq1', seq: '', submitted: false },
  { id: 'seq2', seq: '', submitted: false },
  { id: 'seq3', seq: '', submitted: false },
]

export function MsaPanel({ backendBaseUrl }: Props) {
  const [rows, setRows] = useState<MsaRow[]>(INITIAL)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ClustalwAlignmentResponse | null>(null)

  const submitted = useMemo(() => {
    return rows
      .filter((r) => r.submitted && r.id.trim() && r.seq.trim())
      .map((r) => ({
        id: r.id.trim(),
        seq: r.seq.trim(),
      }))
  }, [rows])

  const canAlign = useMemo(() => {
    if (submitted.length < 2) return false
    const ids = submitted.map((s) => s.id)
    return new Set(ids).size === ids.length
  }, [submitted])

  function addRow() {
    setRows((prev) => [...prev, { id: `seq${prev.length + 1}`, seq: '', submitted: false }])
  }

  function updateRow(i: number, next: MsaRow) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? next : r)))
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleAlign() {
    if (!canAlign) {
      setError('Submit at least 2 sequences with unique IDs before aligning.')
      return
    }

    setRunning(true)
    setError('')
    setResult(null)

    try {
      const data = await runClustalwAlignment(
        { output_format: 'fasta', sequences: submitted },
        backendBaseUrl
      )
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      {/* Sequences (same style blocks as pairwise) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Multiple alignment input</h2>
          <button type="button" onClick={addRow} disabled={running}>
            + Add sequence
          </button>
        </div>

        {rows.map((row, i) => (
          <MsaSequenceInput
            key={i}
            index={i}
            row={row}
            disabled={running}
            onChange={(next) => updateRow(i, next)}
            />
        ))}
      </div>

      {/* Params panel area: reuse your params-panel class so it matches pairwise */}
      <div className="params-panel" style={{ marginTop: 12 }}>
        <h3 className="params-title">ClustalW (protein MSA)</h3>

        <div className="params-grid">
          <div className="param-field full-width">
            <label className="param-label">Submitted sequences</label>
            <div style={{ opacity: 0.85 }}>{submitted.length}</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="align-btn" onClick={handleAlign} disabled={!canAlign || running}>
            {running ? 'Aligning…' : 'Align'}
          </button>
        </div>

        {!canAlign && (
          <p className="seq-meta" style={{ marginTop: 8 }}>
            Tip: click <b>Submit</b> on at least 2 sequences (IDs must be unique).
          </p>
        )}
      </div>

      {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}

      {/* Results: you can style further later; this keeps it simple */}
      {result && (
        <div className="result-panel" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Result</h3>
          <p className="seq-meta">Alignment length: {result.alignment_length}</p>

          <div style={{ display: 'grid', gap: 10 }}>
            {result.records.map((rec) => (
              <div key={rec.id} className="seq-input-block">
                <label className="seq-label">{rec.id}</label>
                <pre style={{ margin: 0, overflowX: 'auto' }}>{rec.aligned}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}