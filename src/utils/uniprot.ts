/**
 * Fetches a protein sequence from UniProt by accession ID.
 * Returns the raw amino acid sequence string (no FASTA header).
 */
export async function fetchUniProt(accessionId: string): Promise<string> {
  const id = accessionId.trim().toUpperCase()
  const url = `https://www.uniprot.org/uniprot/${id}.fasta`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`UniProt fetch failed for "${id}": ${res.status} ${res.statusText}`)
  }

  const fasta = await res.text()
  // Strip the header line(s) and join sequence lines
  const lines = fasta.split('\n')
  const seq = lines
    .filter(l => !l.startsWith('>'))
    .join('')
    .trim()

  if (!seq) throw new Error(`No sequence found for "${id}"`)
  return seq
}
