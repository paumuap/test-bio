import { useMemo, useState } from 'react'
import { runClustalwAlignment } from '../utils/backend'
import type { ClustalwAlignmentResponse } from '../utils/backend'
import { MsaSequenceInput, type MsaRow } from './MsaSequenceInput'

// Amino acid color groups (same as ResultPanel)
const AA_COLORS: Record<string, string> = {
  // Hydrophobic - amber
  A: '#e8a020', V: '#e8a020', I: '#e8a020', L: '#e8a020',
  M: '#e8a020', F: '#e8a020', W: '#e8a020', P: '#e8a020',
  // Polar - teal
  S: '#20b2aa', T: '#20b2aa', C: '#20b2aa', Y: '#20b2aa', N: '#20b2aa', Q: '#20b2aa',
  // Positive (basic) - blue
  K: '#4a90d9', R: '#4a90d9', H: '#4a90d9',
  // Negative (acidic) - red
  D: '#e05555', E: '#e05555',
  // Special
  G: '#aaaaaa',
}

function ColoredChar({ ch }: { ch: string }) {
  if (ch === '-') return <span className="gap-char">—</span>
  const color = AA_COLORS[ch] ?? '#cccccc'
  return <span className="aa-char" style={{ color }}>{ch}</span>
}

function MsaAlignment({ records }: { records: Array<{ id: string; aligned: string }> }) {
  const CHARS_PER_LINE = 80
  const lines: string[][] = []
  
  // Split aligned sequences into chunks
  const alignmentLength = records[0]?.aligned.length || 0
  for (let i = 0; i < alignmentLength; i += CHARS_PER_LINE) {
    lines.push(records.map(r => r.aligned.slice(i, i + CHARS_PER_LINE)))
  }

  return (
    <div style={{ fontFamily: 'monospace', lineHeight: 1.6 }}>
      {lines.map((lineChunk, lineIdx) => (
        <div key={lineIdx} style={{ marginBottom: 16 }}>
          {/* Position header */}
          <div style={{ display: 'flex', marginBottom: 4 }}>
            <div style={{ width: 80, fontSize: '0.9rem', color: '#999' }}>
              {lineIdx > 0 && <span>{lineIdx * CHARS_PER_LINE + 1}</span>}
            </div>
          </div>

          {/* Sequence rows */}
          {records.map((rec, seqIdx) => {
            const chunk = lineChunk[seqIdx] || ''
            const startPos = _getSequencePositionStart(rec.aligned, lineIdx * CHARS_PER_LINE)
            const endPos = _getSequencePositionEnd(rec.aligned, lineIdx * CHARS_PER_LINE, chunk.length)
            const posStr = endPos === 0 ? '0' : `${startPos}-${endPos}`
            return (
              <div key={rec.id} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 2 }}>
                <span style={{ width: 80, textAlign: 'right', paddingRight: 8, fontSize: '0.9rem', fontWeight: 500 }}>
                  {rec.id}/{posStr}
                </span>
                <span style={{ letterSpacing: 1 }}>
                  {chunk.split('').map((ch, i) => (
                    <ColoredChar key={i} ch={ch} />
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function _getSequencePositionStart(fullAligned: string, startIdx: number): number {
  let count = 0
  for (let i = 0; i < startIdx && i < fullAligned.length; i++) {
    if (fullAligned[i] !== '-') count++
  }
  return count + 1
}

function _getSequencePositionEnd(fullAligned: string, startIdx: number, chunkLen: number): number {
  let count = 0
  const endIdx = Math.min(startIdx + chunkLen, fullAligned.length)
  for (let i = 0; i < endIdx; i++) {
    if (fullAligned[i] !== '-') count++
  }
  return count
}

type Props = {
  backendBaseUrl?: string
}

const INITIAL: MsaRow[] = [
  { id: 'P68871', seq: '', submitted: false },
  { id: 'P02144', seq: '', submitted: false },
  { id: 'Q9NPG2', seq: '', submitted: false },
]

export function MsaPanel({ backendBaseUrl }: Props) {
  const [rows, setRows] = useState<MsaRow[]>(INITIAL)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ClustalwAlignmentResponse | null>(null)

  const submitted = useMemo(() => {
    return rows
      .filter((r) => r.id.trim() && r.seq.trim())
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
            Tip: provide an ID and sequence for at least 2 sequences (IDs must be unique).
          </p>
        )}
      </div>

      {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}

      {/* Results */}
      {result && (
        <div className="result-panel" style={{ marginTop: 16 }}>
          <div className="result-header">
            <h2 className="result-title">MSA Result</h2>
            <span className="result-badge">Progressive Alignment</span>
          </div>

          {/* Stats row */}
          <div className="stats-row">
            <Stat label="Sequences" value={String(result.records.length)} accent />
            <Stat label="Length" value={String(result.alignment_length)} />
          </div>

          {/* Color legend */}
          <div className="legend">
            <span className="legend-item" style={{ color: '#e8a020' }}>■ Hydrophobic</span>
            <span className="legend-item" style={{ color: '#20b2aa' }}>■ Polar</span>
            <span className="legend-item" style={{ color: '#4a90d9' }}>■ Basic (+)</span>
            <span className="legend-item" style={{ color: '#e05555' }}>■ Acidic (−)</span>
            <span className="legend-item" style={{ color: '#aaaaaa' }}>■ Glycine</span>
          </div>

          {/* Alignment visualization */}
          <div className="alignment-view">
            <MsaAlignment records={result.records} />
          </div>
        </div>
      )}
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`stat-box ${accent ? 'stat-accent' : ''}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}