import type { AlignmentResult } from '../types/alignment'

// Amino acid color groups (biochemical properties)
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

function AlignedRow({ seq, label }: { seq: string; label: string }) {
  const CHUNK = 60
  const chunks: string[] = []
  for (let i = 0; i < seq.length; i += CHUNK) chunks.push(seq.slice(i, i + CHUNK))

  return (
    <div className="aligned-row">
      <span className="seq-row-label">{label}</span>
      <div className="seq-row-chunks">
        {chunks.map((chunk, ci) => (
          <div key={ci} className="seq-chunk">
            <span className="chunk-pos">{ci * CHUNK + 1}</span>
            <span className="chunk-seq">
              {chunk.split('').map((ch, i) => <ColoredChar key={i} ch={ch} />)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchRow({ seq1, seq2 }: { seq1: string; seq2: string }) {
  const CHUNK = 60
  const matchStr = seq1.split('').map((c, i) => {
    if (c === '-' || seq2[i] === '-') return ' '
    return c === seq2[i] ? '|' : '·'
  }).join('')

  const chunks: string[] = []
  for (let i = 0; i < matchStr.length; i += CHUNK) chunks.push(matchStr.slice(i, i + CHUNK))

  return (
    <div className="aligned-row match-row">
      <span className="seq-row-label"></span>
      <div className="seq-row-chunks">
        {chunks.map((chunk, ci) => (
          <div key={ci} className="seq-chunk">
            <span className="chunk-pos"></span>
            <span className="chunk-seq match-chars">{chunk}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  result: AlignmentResult
  mode: string
}

export function ResultPanel({ result, mode }: Props) {
  const { alignedSeq1, alignedSeq2, score, identity, gaps, length, elapsedMs } = result

  return (
    <div className="result-panel">
      <div className="result-header">
        <h2 className="result-title">Alignment Result</h2>
        <span className="result-badge">{mode === 'global' ? 'Needleman-Wunsch' : 'Smith-Waterman'}</span>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <Stat label="Score" value={score.toFixed(1)} accent />
        <Stat label="Identity" value={`${identity.toFixed(1)}%`} />
        <Stat label="Length" value={String(length)} />
        <Stat label="Gaps" value={String(gaps)} />
        <Stat label="Time" value={`${elapsedMs.toFixed(1)} ms`} />
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
        <AlignedRow seq={alignedSeq1} label="Seq 1" />
        <MatchRow seq1={alignedSeq1} seq2={alignedSeq2} />
        <AlignedRow seq={alignedSeq2} label="Seq 2" />
      </div>
    </div>
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
