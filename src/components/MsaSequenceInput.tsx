import { useState } from 'react'
import { fetchUniProt } from '../utils/uniprot'

export type MsaRow = {
  id: string
  seq: string
  submitted: boolean
}

interface Props {
  index: number
  row: MsaRow
  onChange: (next: MsaRow) => void
  onRemove: () => void
  disableRemove: boolean
  disabled: boolean
}

export function MsaSequenceInput({
  index,
  row,
  onChange,
  onRemove,
  disableRemove,
  disabled,
}: Props) {
  const [uniprotId, setUniprotId] = useState(row.id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFetch() {
    if (!uniprotId.trim()) return
    setLoading(true)
    setError('')
    try {
      const seq = await fetchUniProt(uniprotId)
      // Set ID to accession (uppercased) and set sequence, but keep submitted=false until user clicks Submit
      onChange({
        ...row,
        id: uniprotId.trim().toUpperCase(),
        seq,
        submitted: false,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit() {
    const id = row.id.trim()
    const seq = row.seq.trim()
    if (!id || !seq) {
      setError('Please provide both Sequence ID and sequence before submitting.')
      return
    }
    setError('')
    onChange({ ...row, id, seq, submitted: true })
  }

  return (
    <div className="seq-input-block">
      <label className="seq-label">Sequence {index + 1}</label>

      {/* Sequence ID row */}
      <div className="uniprot-row" style={{ marginBottom: 8 }}>
        <input
          className="input-text"
          placeholder="Sequence ID (e.g. P68871)"
          value={row.id}
          disabled={disabled}
          onChange={(e) => onChange({ ...row, id: e.target.value.toUpperCase(), submitted: false })}
        />
        <button
          className="btn-fetch"
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !row.id.trim() || !row.seq.trim()}
          style={{
            opacity: row.submitted ? 0.85 : 1,
          }}
        >
          {row.submitted ? 'Submitted' : 'Submit'}
        </button>
      </div>

      {/* UniProt row (same style as pairwise) */}
      <div className="uniprot-row">
        <input
          className="input-text"
          placeholder="UniProt ID (e.g. P68871)"
          value={uniprotId}
          disabled={disabled}
          onChange={(e) => setUniprotId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
        />
        <button
          className="btn-fetch"
          type="button"
          onClick={handleFetch}
          disabled={disabled || loading || !uniprotId.trim()}
        >
          {loading ? <span className="spinner" /> : 'Fetch'}
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <textarea
        className="seq-textarea"
        placeholder="…or paste amino acid sequence directly (e.g. MVHLTPEEK…)"
        value={row.seq}
        disabled={disabled}
        onChange={(e) =>
          onChange({
            ...row,
            seq: e.target.value.toUpperCase().replace(/[^A-Z]/g, ''),
            submitted: false,
          })
        }
        spellCheck={false}
      />

      {row.seq && <p className="seq-meta">{row.seq.length} residues</p>}
    </div>
  )
}