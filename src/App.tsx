import { useEffect, useRef, useState } from 'react'
import { SequenceInput } from './components/SequenceInput'
import { ParamsPanel } from './components/ParamsPanel'
import { ResultPanel } from './components/ResultPanel'
import { MsaPanel } from './components/MsaPanel'
import type { AlignmentMode, AlignmentParams, AlignmentResult, WorkerResponse } from './types/alignment'
import './App.css'

const EXAMPLE_SEQ1 =
  'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH'
const EXAMPLE_SEQ2 =
  'MGLSDGEWQLVLNVWGKVEADIPGHGQEVLIRLFKGHPETLEKFDKFKHLKSEDEMKASEDLKKHGATVLTALGGILKKKGHHEAEIKPLAQSHATKHKIPVKYLEFISECIIQVLQSKHPGDFGADAQGAMNKALELFRKDMASNYKELGFQG'

type ViewMode = 'pairwise' | 'msa'

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('pairwise')

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
    workerRef.current = new Worker(new URL('./workers/alignmentWorker.ts', import.meta.url), {
      type: 'module',
    })

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
    if (!s1 || !s2) {
      setError('Please provide both sequences.')
      return
    }
    if (s1.length > 2000 || s2.length > 2000) {
      setError('Sequences must be ≤ 2000 residues for browser alignment.')
      return
    }

    setError('')
    setRunning(true)
    setResult(null)

    const params: AlignmentParams = {
      seq1: s1,
      seq2: s2,
      mode,
      matchScore,
      mismatchScore,
      gapOpen,
      gapExtend,
    }

    workerRef.current?.postMessage(params)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="app-header">
        <h1 className="app-title">BioAlign</h1>

        <div className="view-toggle">
          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'pairwise' ? 'active' : ''}`}
            onClick={() => setViewMode('pairwise')}
          >
            Pairwise
          </button>

          <button
            type="button"
            className={`view-toggle-btn ${viewMode === 'msa' ? 'active' : ''}`}
            onClick={() => setViewMode('msa')}
          >
            Multiple (ClustalW)
          </button>
        </div>
      </div>

      {viewMode === 'msa' ? (
        <MsaPanel backendBaseUrl="http://localhost:8000" />
      ) : (
        <>
          <SequenceInput label="Sequence 1" value={seq1} onChange={setSeq1} />

          <SequenceInput label="Sequence 2" value={seq2} onChange={setSeq2} />

          <ParamsPanel
            mode={mode}
            matchScore={matchScore}
            mismatchScore={mismatchScore}
            gapOpen={gapOpen}
            gapExtend={gapExtend}
            onChange={handleParamChange}
            onAlign={handleAlign}
            running={running}
          />

          {error && <div style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</div>}

          {result && <ResultPanel result={result} />}
        </>
      )}
    </div>
  )
}