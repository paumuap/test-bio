import { useEffect, useRef, useState } from 'react'
import { SequenceInput } from './components/SequenceInput'
import { ParamsPanel } from './components/ParamsPanel'
import { ResultPanel } from './components/ResultPanel'
import type { AlignmentMode, AlignmentParams, AlignmentResult, WorkerResponse } from './types/alignment'
import './App.css'

const EXAMPLE_SEQ1 = 'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH'
const EXAMPLE_SEQ2 = 'MGLSDGEWQLVLNVWGKVEADIPGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKASEDLKKHGATVLTALGGILKKKGHHEAEIKPLAQSHATKHKIPVKYLEFISECIIQVLQSKHPGDFGADAQGAMNKALELFRKDMASNYKELGFQG'

export default function App() {
  const [seq1, setSeq1] = useState('')
  const [seq2, setSeq2] = useState('')
  const [mode, setMode] = useState<AlignmentMode>('global')
  const [matchScore, setMatchScore] = useState(1)
  const [mismatchScore, setMismatchScore] = useState(-2)
  const [gapOpen, setGapOpen] = useState(-2)
  const [gapExtend, setGapExtend] = useState(-1)

  const [result, setResult] = useState<AlignmentResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const workerRef = useRef<Worker | null>(null)

  // Boot Web Worker once
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('./workers/alignmentWorker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
      setRunning(false)
      if (e.data.type === 'result') {
        setResult(e.data.result)
        setError('')
      } else {
        setError(e.data.message)
      }
    }
    return () => workerRef.current?.terminate()
  }, [])

  function handleParamChange(field: string, value: number | AlignmentMode) {
    if (field === 'mode') setMode(value as AlignmentMode)
    else if (field === 'matchScore') setMatchScore(value as number)
    else if (field === 'mismatchScore') setMismatchScore(value as number)
    else if (field === 'gapOpen') setGapOpen(value as number)
    else if (field === 'gapExtend') setGapExtend(value as number)
  }

  function handleAlign() {
    const s1 = seq1.trim()
    const s2 = seq2.trim()
    if (!s1 || !s2) { setError('Please provide both sequences.'); return }
    if (s1.length > 2000 || s2.length > 2000) { setError('Sequences must be ≤ 2000 residues for browser alignment.'); return }

    setError('')
    setRunning(true)
    setResult(null)

    const params: AlignmentParams = { seq1: s1, seq2: s2, mode, matchScore, mismatchScore, gapOpen, gapExtend }
    workerRef.current?.postMessage({ type: 'align', params })
  }

  function loadExample() {
    setSeq1(EXAMPLE_SEQ1)
    setSeq2(EXAMPLE_SEQ2)
    setResult(null)
  }

  const canAlign = seq1.trim().length > 0 && seq2.trim().length > 0 && !running

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">⬡</span>
            <span className="logo-text">BioAlign</span>
          </div>
          <p className="header-sub">Pairwise sequence alignment in your browser</p>
          <button className="btn-example" onClick={loadExample}>Load example (Hb β / Myoglobin)</button>
        </div>
      </header>

      <main className="main-content">
        {/* Left column: inputs + params */}
        <div className="left-col">
          <section className="card">
            <SequenceInput label="Sequence 1" value={seq1} onChange={setSeq1} />
          </section>
          <section className="card">
            <SequenceInput label="Sequence 2" value={seq2} onChange={setSeq2} />
          </section>
          <section className="card">
            <ParamsPanel
              mode={mode}
              matchScore={matchScore}
              mismatchScore={mismatchScore}
              gapOpen={gapOpen}
              gapExtend={gapExtend}
              onChange={handleParamChange}
            />
          </section>

          <button
            className={`btn-align ${running ? 'running' : ''}`}
            onClick={handleAlign}
            disabled={!canAlign}
          >
            {running
              ? <><span className="spinner" /> Aligning…</>
              : '⟶ Run Alignment'}
          </button>

          {error && <p className="error-msg">{error}</p>}
        </div>

        {/* Right column: result */}
        <div className="right-col">
          {result
            ? <ResultPanel result={result} mode={mode} />
            : (
              <div className="empty-state">
                <span className="empty-icon">◈</span>
                <p>Alignment result will appear here.</p>
                <p className="empty-sub">Runs in a Web Worker — UI stays responsive.</p>
              </div>
            )
          }
        </div>
      </main>
    </div>
  )
}
