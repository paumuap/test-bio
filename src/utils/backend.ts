export type MsaSequence = { id: string; seq: string }

export type ClustalwAlignmentRequest = {
  output_format?: 'fasta' | 'clustal'
  sequences: MsaSequence[]
}

export type ClustalwAlignedRecord = {
  id: string
  aligned: string
  positions?: Array<number | null>
}

export type ClustalwAlignmentResponse = {
  alignment_length: number
  records: ClustalwAlignedRecord[]
}

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:8000'

export async function runClustalwAlignment(
  req: ClustalwAlignmentRequest,
  baseUrl = DEFAULT_BACKEND_BASE_URL
): Promise<ClustalwAlignmentResponse> {
  const res = await fetch(`${baseUrl}/clustalw-alignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      output_format: req.output_format ?? 'fasta',
      sequences: req.sequences,
    }),
  })

  if (!res.ok) {
    let detail: unknown = null
    try {
      detail = await res.json()
    } catch {
      detail = await res.text()
    }
    throw new Error(`Backend error (${res.status}): ${JSON.stringify(detail)}`)
  }

  return res.json()
}