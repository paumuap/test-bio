import { useState } from 'react'
import { fetchUniProt } from '../utils/uniprot'

interface Props {
  label: string
  value: string
  onChange: (val: string) => void
}

export function SequenceInput({ label, value, onChange }: Props) {
  const [uniprotId, setUniprotId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFetch() {
    if (!uniprotId.trim()) return
    setLoading(true)
    setError('')
    try {
      const seq = await fetchUniProt(uniprotId)
      onChange(seq)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="seq-input-block">
      <label className="seq-label">{label}</label>

      <div className="uniprot-row">
        <input
          className="input-text"
          placeholder="UniProt ID (e.g. P68871)"
          value={uniprotId}
          onChange={e => setUniprotId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetch()}
        />
        <button
          className="btn-fetch"
          onClick={handleFetch}
          disabled={loading || !uniprotId.trim()}
        >
          {loading ? <span className="spinner" /> : 'Fetch'}
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      <textarea
        className="seq-textarea"
        placeholder="…or paste amino acid sequence directly (e.g. MVHLTPEEK…)"
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        spellCheck={false}
      />

      {value && (
        <p className="seq-meta">
          {value.length} residues
        </p>
      )}
    </div>
  )
}
